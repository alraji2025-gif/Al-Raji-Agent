import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { DEFAULT_SYSTEM_INSTRUCTION, saveLeadFunctionDeclaration } from '../services/gemini';

export default function VoiceCall({ systemInstruction, onBack }: { systemInstruction: string, onBack?: () => void }) {
  const [isCalling, setIsCalling] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [transcript, setTranscript] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const nextPlaybackTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const startCall = async () => {
    setIsCalling(true);
    setStatus('connecting');
    nextPlaybackTimeRef.current = 0;
    activeSourcesRef.current = [];
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Setup Audio
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setStatus('active');
            processorRef.current!.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              sessionRef.current?.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Gemini Live returns 16-bit PCM at 24000Hz
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
              }
              
              if (audioContextRef.current) {
                const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
                audioBuffer.getChannelData(0).set(float32);
                
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                
                // Track source to stop on interruption
                activeSourcesRef.current.push(source);
                source.onended = () => {
                  activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
                };
                
                // Schedule playback to avoid overlapping
                const currentTime = audioContextRef.current.currentTime;
                if (nextPlaybackTimeRef.current < currentTime) {
                  nextPlaybackTimeRef.current = currentTime + 0.05; // Small buffer
                }
                
                source.start(nextPlaybackTimeRef.current);
                nextPlaybackTimeRef.current += audioBuffer.duration;
              }
            }
            
            if (message.serverContent?.interrupted) {
              // Stop all current playback if interrupted
              activeSourcesRef.current.forEach(source => {
                try {
                  source.stop();
                } catch (e) {
                  // Ignore errors if source already stopped
                }
              });
              activeSourcesRef.current = [];
              nextPlaybackTimeRef.current = 0;
            }
            
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              setTranscript(message.serverContent.modelTurn.parts[0].text);
            }

            // Handle Tool Calls
            const toolCall = message.serverContent?.modelTurn?.parts?.find(p => p.functionCall);
            if (toolCall?.functionCall) {
              const { name, args } = toolCall.functionCall;
              if (name === 'saveLead') {
                const { name: leadName, phone, course } = args as any;
                try {
                  await addDoc(collection(db, 'leads'), {
                    name: leadName,
                    phone,
                    course: course || 'Voice Inquiry',
                    status: 'new',
                    timestamp: Timestamp.now()
                  });
                  
                  console.log(`Lead saved: ${leadName} (${phone})`);
                  
                  // Send tool response back to model
                  sessionRef.current?.sendToolResponse({
                    functionResponses: [{
                      name: 'saveLead',
                      id: toolCall.functionCall.id,
                      response: { success: true }
                    }]
                  });
                } catch (e) {
                  handleFirestoreError(e, OperationType.CREATE, 'leads');
                }
              }
            }
          },
          onclose: () => endCall(),
          onerror: (e) => {
            console.error(e);
            endCall();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
          systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error(error);
      endCall();
    }
  };

  const endCall = () => {
    setIsCalling(false);
    setStatus('idle');
    setTranscript('');
    
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        // Ignore session close errors
      }
      sessionRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0502] text-white md:rounded-2xl overflow-hidden relative">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
      </div>
      
      {onBack && status === 'idle' && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-20 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-full transition-all flex items-center gap-2 text-sm font-medium text-indigo-200"
        >
          <ArrowLeft size={18} />
          Back to Chat
        </button>
      )}

      <AnimatePresence mode="wait">
        {status === 'idle' ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-8 z-10 max-w-sm text-center px-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="w-24 h-24 md:w-32 md:h-32 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 relative">
                <Mic size={32} className="text-indigo-300 md:w-12 md:h-12" />
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-3 bg-gradient-to-b from-white to-indigo-300 bg-clip-text text-transparent">
                ভয়েস কল শুরু করুন
              </h3>
              <p className="text-indigo-200/60 text-xs md:text-sm leading-relaxed">
                Al raji agent Nusrat-এর সাথে সরাসরি কথা বলে আপনার অ্যাডমিশন সংক্রান্ত সকল তথ্য জেনে নিন।
              </p>
            </div>

            <button
              onClick={startCall}
              className="group relative px-6 py-3 md:px-8 md:py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base md:text-lg transition-all shadow-2xl shadow-indigo-900/40 flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <Mic size={24} />
              কল শুরু করুন
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-between h-full w-full p-8 md:p-12 z-10"
          >
            <div className="text-center space-y-2">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">
                  {status === 'connecting' ? 'Establishing Connection...' : 'Live Session Active'}
                </span>
              </motion.div>
              <h3 className="text-2xl md:text-4xl font-black tracking-tighter">Al raji agent Nusrat</h3>
              <p className="text-indigo-300/40 text-[10px] font-mono">ENCRYPTED VOICE CHANNEL</p>
            </div>

            <div className="relative flex items-center justify-center w-full max-w-xs md:max-w-md aspect-square">
              {/* Animated Rings */}
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.1, 0.3, 0.1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.8,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 border border-indigo-500/30 rounded-full"
                ></motion.div>
              ))}
              
              <div className="w-40 h-40 md:w-56 md:h-56 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 flex items-center justify-center relative shadow-inner">
                <div className="flex gap-1 md:gap-1.5 items-end h-12 md:h-16">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ 
                        height: status === 'active' ? [8, Math.random() * 50 + 10, 8] : [8, 8, 8],
                        opacity: [0.4, 1, 0.4]
                      }}
                      transition={{ 
                        duration: 0.4, 
                        repeat: Infinity, 
                        delay: i * 0.05,
                        ease: "easeInOut"
                      }}
                      className="w-1 md:w-1.5 bg-gradient-to-t from-indigo-500 to-emerald-400 rounded-full"
                    ></motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full max-w-lg space-y-6 md:space-y-8">
              <div className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-4 md:p-6 min-h-[80px] md:min-h-[100px] flex items-center justify-center text-center">
                <p className="text-indigo-100/80 text-base md:text-lg font-medium leading-relaxed italic">
                  {transcript || (status === 'connecting' ? 'Connecting to server...' : 'কথা বলা শুরু করুন, আমি শুনছি...')}
                </p>
              </div>

              <div className="flex justify-center gap-6 md:gap-8">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`group relative p-4 md:p-6 rounded-full transition-all duration-500 ${
                    isMuted 
                      ? 'bg-red-500/20 text-red-500 border-red-500/50' 
                      : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                  } border backdrop-blur-xl`}
                >
                  <div className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${isMuted ? 'bg-red-500/20 opacity-100' : 'opacity-0'}`}></div>
                  {isMuted ? <MicOff size={24} className="relative md:w-8 md:h-8" /> : <Mic size={24} className="relative md:w-8 md:h-8" />}
                </button>
                
                <button
                  onClick={endCall}
                  className="group relative p-4 md:p-6 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all duration-500 shadow-2xl shadow-red-900/40 border border-red-400/20"
                >
                  <div className="absolute inset-0 rounded-full bg-red-600 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <PhoneOff size={24} className="relative md:w-8 md:h-8" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

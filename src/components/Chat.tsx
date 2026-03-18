import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, Phone, Volume2, VolumeX, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { getChatResponse, getChatResponseStream, generateSpeech } from '../services/gemini';
import { db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  text: string;
}

function TTSButton({ text }: { text: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const toggleSpeech = async () => {
    if (isPlaying) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const audioContext = audioContextRef.current;

        // Gemini TTS returns raw PCM 16-bit mono at 24kHz
        // We need to convert this to an AudioBuffer
        const pcmData = new Int16Array(bytes.buffer);
        const audioBuffer = audioContext.createBuffer(1, pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert 16-bit PCM to float32 (-1.0 to 1.0)
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start(0);
        audioSourceRef.current = source;
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <button
      onClick={toggleSpeech}
      disabled={isLoading}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
        isPlaying 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
      }`}
    >
      {isLoading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : isPlaying ? (
        <Square size={12} fill="currentColor" />
      ) : (
        <Volume2 size={12} />
      )}
      {isLoading ? 'Loading...' : isPlaying ? 'Stop' : 'Listen'}
    </button>
  );
}

export default function Chat({ systemInstruction, onVoiceClick }: { systemInstruction: string, onVoiceClick?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'আসসালামু আলাইকুম! আমি নুসরাত, আল রাজী কম্পিউটার ট্রেনিং ইনস্টিটিউট থেকে। আপনাকে কিভাবে সাহায্য করতে পারি?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const stream = await getChatResponseStream(userMessage, messages, systemInstruction);
      
      let fullText = '';
      let hasFunctionCall = false;

      // Add an empty message for the model that we will update
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { role: 'model', text: fullText };
            return newMessages;
          });
        }

        const functionCalls = chunk.functionCalls;
        if (functionCalls) {
          hasFunctionCall = true;
          for (const call of functionCalls) {
            if (call.name === 'saveLead') {
              const { name, phone, course } = call.args as any;
              try {
                await addDoc(collection(db, 'leads'), {
                  name,
                  phone,
                  course: course || 'General Inquiry',
                  timestamp: Timestamp.now()
                });
                
                // After saving, we might want a final confirmation
                const followUp = await getChatResponse(
                  "System: Lead saved successfully. Please thank the user briefly.",
                  [...messages, { role: 'user', text: userMessage }, { role: 'model', text: fullText }],
                  systemInstruction
                );
                
                const followUpText = followUp.text || 'ধন্যবাদ! আপনার তথ্য সংরক্ষিত হয়েছে।';
                setMessages(prev => [...prev, { role: 'model', text: followUpText }]);
              } catch (e) {
                handleFirestoreError(e, OperationType.CREATE, 'leads');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: 'দুঃখিত, আমি এখন উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-md md:rounded-2xl shadow-xl md:border border-white/20 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 scroll-smooth" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[90%] md:max-w-[85%] items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`p-1.5 md:p-2 rounded-full flex-shrink-0 ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`}>
                  {msg.role === 'user' ? <User size={14} className="md:w-4 md:h-4" /> : <Bot size={14} className="md:w-4 md:h-4" />}
                </div>
                <div className={`p-3 rounded-xl md:rounded-2xl shadow-sm relative group/msg ${
                  msg.role === 'user' 
                    ? 'bg-emerald-50 text-emerald-900 rounded-tr-none' 
                    : 'bg-indigo-50 text-indigo-900 rounded-tl-none'
                }`}>
                  <div className="prose prose-sm max-w-none text-sm md:text-base leading-relaxed">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  
                  {msg.role === 'model' && (
                    <div className="mt-2 flex justify-end">
                      <TTSButton text={msg.text} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-indigo-50 p-3 rounded-xl md:rounded-2xl rounded-tl-none flex items-center gap-2 text-indigo-400">
              <Loader2 className="animate-spin" size={14} />
              <span className="text-[10px] md:text-xs font-medium">নুসরাত লিখছে...</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-3 md:p-4 bg-white border-t border-indigo-100 flex gap-2 items-center flex-shrink-0">
        {onVoiceClick && (
          <button
            onClick={onVoiceClick}
            className="p-2.5 md:p-3 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm flex-shrink-0"
            title="Voice Call"
          >
            <Phone size={18} className="md:w-5 md:h-5" />
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="আপনার প্রশ্ন লিখুন..."
          className="flex-1 bg-indigo-50/50 border-none rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm md:text-base text-indigo-900"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white p-2.5 md:p-3 rounded-lg md:rounded-xl transition-all shadow-lg shadow-indigo-200 flex-shrink-0"
        >
          <Send size={18} className="md:w-5 md:h-5" />
        </button>
      </div>
    </div>
  );
}

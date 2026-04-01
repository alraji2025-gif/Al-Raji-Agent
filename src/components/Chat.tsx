import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, Phone, Volume2, VolumeX, Square, ArrowLeft, Plus, History, Trash2, Menu, X as CloseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { getChatResponse, getChatResponseStream, generateSpeech } from '../services/gemini';
import { db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from '../firebase';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
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

export default function Chat({ systemInstruction, onVoiceClick, onBack }: { systemInstruction: string, onVoiceClick?: () => void, onBack?: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('nusrat_chat_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const savedId = localStorage.getItem('nusrat_active_session_id');
    return savedId || null;
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const initialMessage: Message = { role: 'model', text: 'আসসালামু আলাইকুম! আমি Al raji agent Nusrat, আল রাজী কম্পিউটার ট্রেনিং ইনস্টিটিউট থেকে। আপনাকে কিভাবে সাহায্য করতে পারি?' };

  // Load active session messages
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        setMessages(session.messages);
      } else {
        // If session not found, start a new one
        startNewChat();
      }
    } else if ((sessions || []).length > 0) {
      // If no active session but sessions exist, pick the first one
      setActiveSessionId(sessions[0].id);
    } else {
      // No sessions at all, start a new one
      startNewChat();
    }
  }, [activeSessionId]);

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem('nusrat_chat_sessions', JSON.stringify(sessions));
    if (activeSessionId) {
      localStorage.setItem('nusrat_active_session_id', activeSessionId);
    }
  }, [sessions, activeSessionId]);

  // Update current session messages in the sessions list (only when not loading to avoid lag during streaming)
  useEffect(() => {
    if (activeSessionId && (messages || []).length > 0 && !isLoading) {
      setSessions(prev => (prev || []).map(s => {
        if (s.id === activeSessionId) {
          // Update title if it's the first user message
          let newTitle = s.title;
          if (s.title === 'New Chat' && messages.some(m => m.role === 'user')) {
            const firstUserMsg = messages.find(m => m.role === 'user')?.text || 'New Chat';
            newTitle = firstUserMsg.slice(0, 30) + ((firstUserMsg || '').length > 30 ? '...' : '');
          }
          return { ...s, messages, title: newTitle };
        }
        return s;
      }));
    }
  }, [messages, isLoading, activeSessionId]);

  // Scroll to bottom on every message update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [initialMessage],
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...(prev || [])]);
    setActiveSessionId(newId);
    setMessages([initialMessage]);
    setIsSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = (prev || []).filter(s => s.id !== id);
      if (id === activeSessionId) {
        if ((filtered || []).length > 0) {
          setActiveSessionId(filtered[0].id);
        } else {
          setActiveSessionId(null);
        }
      }
      return filtered;
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...(prev || []), { role: 'user', text: userMessage } as Message]);
    setIsLoading(true);

    try {
      const stream = await getChatResponseStream(userMessage, messages, systemInstruction);
      
      let fullText = '';
      setMessages(prev => [...(prev || []), { role: 'model', text: '' } as Message]);

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          setMessages(prev => {
            const newMessages = [...(prev || [])];
            newMessages[(newMessages || []).length - 1] = { role: 'model', text: fullText };
            return newMessages;
          });
        }

        const functionCalls = chunk.functionCalls;
        if (functionCalls) {
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
                
                // Use a pre-defined message instead of an extra API call to avoid delay
                const followUpText = 'ধন্যবাদ! আপনার তথ্য সংরক্ষিত হয়েছে। আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।';
                setMessages(prev => [...(prev || []), { role: 'model', text: followUpText } as Message]);
              } catch (e) {
                handleFirestoreError(e, OperationType.CREATE, 'leads');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...(prev || []), { role: 'model', text: 'দুঃখিত, আমি এখন উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।' } as Message]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-[#212121] text-white overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          x: isSidebarOpen ? 0 : -300,
          width: isSidebarOpen ? 260 : 0
        }}
        className={`fixed md:relative z-50 h-full bg-[#171717] flex flex-col transition-all duration-300 ease-in-out border-r border-white/5 ${
          isSidebarOpen ? 'w-[260px]' : 'w-0 md:w-[260px] md:translate-x-0'
        }`}
      >
        <div className="p-3 flex flex-col h-full overflow-hidden">
          {/* New Chat Button */}
          <button
            onClick={startNewChat}
            className="flex items-center gap-3 px-3 py-3 w-full bg-transparent hover:bg-white/5 border border-white/10 rounded-lg transition-all text-sm font-medium mb-4 group"
          >
            <Plus size={18} className="text-white/70 group-hover:text-white" />
            <span>New Chat</span>
          </button>

          {/* History Section */}
          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            <div className="px-3 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <History size={12} />
              Recent Chats
            </div>
            {(sessions || []).map(session => (
              <div
                key={session.id}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setIsSidebarOpen(false);
                }}
                className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all ${
                  activeSessionId === session.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <Bot size={16} className={activeSessionId === session.id ? 'text-indigo-400' : 'text-white/40'} />
                  <span className="text-sm truncate text-white/80 group-hover:text-white">
                    {session.title}
                  </span>
                </div>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-white/40 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="mt-auto pt-4 border-t border-white/5">
            <button
              onClick={onBack}
              className="flex items-center gap-3 px-3 py-3 w-full hover:bg-white/5 rounded-lg transition-all text-sm font-medium text-white/60 hover:text-white"
            >
              <ArrowLeft size={18} />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#212121] z-30 sticky top-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-white/60 hover:text-white bg-white/5 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="font-black text-sm text-white/90 tracking-tight">Al raji agent Nusrat</div>
          <button
            onClick={startNewChat}
            className="p-2 text-white/60 hover:text-white bg-white/5 rounded-lg"
          >
            <Plus size={20} />
          </button>
        </header>

        {/* Desktop Sidebar Toggle (Floating) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`hidden md:flex fixed left-4 top-4 z-50 p-2 bg-[#2f2f2f] border border-white/10 rounded-lg text-white/60 hover:text-white transition-all ${
            isSidebarOpen ? 'translate-x-[260px]' : 'translate-x-0'
          }`}
        >
          {isSidebarOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
        </button>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar" ref={scrollRef}>
          <div className="max-w-3xl mx-auto w-full py-8 px-4">
            <AnimatePresence initial={false}>
              {(!messages || messages.length === 0) && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 py-20">
                  <Bot size={48} className="text-indigo-500" />
                  <h2 className="text-xl font-bold">Start a new conversation</h2>
                  <p className="text-sm max-w-xs">Ask Al raji agent Nusrat about courses, admission, or anything else about Al Raji Institute.</p>
                </div>
              )}
              {(messages || []).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`w-full py-4 md:py-6 flex gap-3 md:gap-6 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {msg.role === 'user' ? (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-lg">
                        <User size={18} className="md:w-6 md:h-6" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                        <Bot size={18} className="md:w-6 md:h-6" />
                      </div>
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 space-y-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className="font-bold text-[10px] md:text-xs uppercase tracking-widest text-white/30 mb-1">
                      {msg.role === 'user' ? 'আপনি' : 'Al raji agent Nusrat'}
                    </div>
                    <div className={`inline-block p-4 md:p-0 rounded-2xl md:rounded-none ${msg.role === 'user' ? 'bg-emerald-600/10 md:bg-transparent' : 'bg-white/5 md:bg-transparent'} prose prose-invert max-w-none text-sm md:text-lg leading-relaxed text-white/90`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    
                    {msg.role === 'model' && msg.text && (
                      <div className="mt-4 flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <TTSButton text={msg.text} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full py-6 flex gap-4 md:gap-6">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <Bot size={18} />
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2 text-white/40">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-sm font-medium italic">Al raji agent Nusrat লিখছে...</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-8 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent">
          <div className="max-w-3xl mx-auto relative group">
            <div className="relative flex items-end w-full bg-[#2f2f2f] border border-white/10 rounded-2xl shadow-2xl focus-within:border-white/20 transition-all p-1.5 md:p-2">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Al raji agent Nusrat..."
                className="flex-1 bg-transparent border-none px-3 md:px-4 py-3 focus:ring-0 outline-none text-sm md:text-lg text-white placeholder-white/20 resize-none max-h-40"
                style={{ height: 'auto', minHeight: '44px' }}
              />
              <div className="flex items-center gap-1.5 md:gap-2 pb-1 pr-1 md:pb-1.5 md:pr-1.5">
                {onVoiceClick && (
                  <button
                    onClick={onVoiceClick}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title="Voice Call"
                  >
                    <Phone size={18} className="md:w-5 md:h-5" />
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className={`p-2.5 md:p-2 rounded-xl transition-all flex items-center justify-center ${
                    input.trim() && !isLoading 
                      ? 'bg-white text-black hover:bg-white/90' 
                      : 'bg-white/10 text-white/20 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} className="md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

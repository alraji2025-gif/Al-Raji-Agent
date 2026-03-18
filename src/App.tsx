import React, { useState, useEffect } from 'react';
import { MessageSquare, Phone, Info, Shield, LayoutDashboard, GraduationCap, X, LogIn, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Chat from './components/Chat';
import VoiceCall from './components/VoiceCall';
import AdminPanel from './components/AdminPanel';
import InfoModal from './components/InfoModal';
import { db, doc, onSnapshot, auth, signInWithPopup, googleProvider, onAuthStateChanged, User } from './firebase';
import { DEFAULT_SYSTEM_INSTRUCTION } from './services/gemini';

export default function App() {
  const [activeMode, setActiveMode] = useState<'chat' | 'voice'>('chat');
  const [showInfo, setShowInfo] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Listen for bot settings
    const unsub = onSnapshot(doc(db, 'settings', 'bot-config'), (doc) => {
      if (doc.exists()) {
        setSystemInstruction(doc.data().systemInstruction);
      }
    });

    // Listen for auth state
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => {
      unsub();
      unsubAuth();
    };
  }, []);

  const handleAdminLogin = () => {
    if (adminUsername === 'admin' && adminPassword === 'alraji2025') {
      setIsAdminLoggedIn(true);
      setAdminUsername('');
      setAdminPassword('');
    } else {
      alert('Incorrect username or password!');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 font-sans text-slate-900 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-indigo-100 px-3 py-3 md:px-6 md:py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-indigo-600 p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-lg shadow-indigo-200 flex-shrink-0">
            <GraduationCap className="text-white w-5 h-5 md:w-7 md:h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-black text-indigo-900 tracking-tight leading-tight truncate md:whitespace-normal">Al-Raji Computer Training Institute</h1>
            <p className="text-[8px] md:text-[10px] uppercase font-bold text-indigo-400 tracking-widest mt-0.5 md:mt-1">Nusrat Admission Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          <a 
            href="https://wa.me/8801723684031" 
            target="_blank" 
            rel="noreferrer"
            className="p-2 md:p-2.5 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"
            title="WhatsApp"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
          <button 
            onClick={() => setShowInfo(true)}
            className="p-2 md:p-2.5 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
          >
            <Info size={20} className="md:w-6 md:h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden md:container md:mx-auto md:max-w-5xl md:p-8">
        {/* Active Component */}
        <div className="flex-1 min-h-0 relative">
          <AnimatePresence mode="wait">
            {activeMode === 'chat' ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full"
              >
                <Chat 
                  systemInstruction={systemInstruction} 
                  onVoiceClick={() => setActiveMode('voice')}
                />
              </motion.div>
            ) : (
              <motion.div
                key="voice"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <VoiceCall 
                  systemInstruction={systemInstruction} 
                  onBack={() => setActiveMode('chat')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showInfo && (
          <InfoModal 
            onClose={() => setShowInfo(false)} 
            onAdminClick={() => {
              setShowInfo(false);
              setShowAdmin(true);
            }} 
          />
        )}
        
        {showAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative"
            >
              <button 
                onClick={() => setShowAdmin(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-all z-10"
              >
                <X size={24} />
              </button>

              {!isAdminLoggedIn ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="bg-indigo-50 p-6 rounded-full mb-6">
                    <Shield className="text-indigo-600" size={48} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Admin Access</h2>
                  <p className="text-slate-500 mb-8">Enter password to access admin panel</p>
                  
                  <div className="w-full max-w-xs space-y-4">
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold"
                    />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                      placeholder="Password"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold tracking-widest"
                    />
                    <button
                      onClick={handleAdminLogin}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn size={20} />
                      Login
                    </button>
                  </div>
                  
                  <p className="mt-8 text-xs text-slate-400">
                    Contact director if you forgot password
                  </p>
                </div>
              ) : (
                <AdminPanel onLogout={() => setIsAdminLoggedIn(false)} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

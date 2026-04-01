import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import { MessageSquare, Phone, Info, Shield, LayoutDashboard, GraduationCap, X, LogIn, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Chat from './components/Chat';
import VoiceCall from './components/VoiceCall';
import AdminPanel from './components/AdminPanel';
import InfoModal from './components/InfoModal';
import { db, doc, onSnapshot, auth, signInWithPopup, googleProvider, onAuthStateChanged, User, signInWithEmailAndPassword, signInAnonymously } from './firebase';
import { DEFAULT_SYSTEM_INSTRUCTION } from './services/gemini';

export default function App() {
  const [activeMode, setActiveMode] = useState<'home' | 'chat' | 'voice'>('home');
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
      if (u) {
        // Auto-login to admin panel if user matches admin criteria
        if (u.email === 'alraji2025@gmail.com' || u.email === 'admin@alraji.com') {
          setIsAdminLoggedIn(true);
        }
      } else {
        setIsAdminLoggedIn(false);
      }
    });

    return () => {
      unsub();
      unsubAuth();
    };
  }, []);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      alert('Please enter both username and password');
      return;
    }

    setIsLoggingIn(true);
    try {
      // 1. Check hardcoded credentials first
      if (adminUsername.toLowerCase() === 'admin' && adminPassword === 'alraji2025') {
        // We still let them into the UI for local testing, 
        // but Firestore rules will block them if not authenticated correctly.
        setIsAdminLoggedIn(true);
        setAdminUsername('');
        setAdminPassword('');
        return;
      }

      // 2. Try real email/password
      const adminEmail = adminUsername.includes('@') ? adminUsername : `${adminUsername}@alraji.com`;
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      setIsAdminLoggedIn(true);
      setAdminUsername('');
      setAdminPassword('');
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = 'Incorrect username or password!';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Invalid username or password.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      }
      alert('Login failed: ' + message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setIsAdminLoggedIn(false);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 font-sans text-slate-900 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-indigo-100 px-4 py-3 md:px-8 md:py-5 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <div className="bg-white p-1 rounded-xl shadow-lg shadow-indigo-100 flex-shrink-0 overflow-hidden border border-indigo-50">
            <img 
              src="https://scontent.fdac151-1.fna.fbcdn.net/v/t39.30808-6/590387982_122105713041128923_7459473621847877221_n.jpg?_nc_cat=102&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=oVkKIOPGqL4Q7kNvwHk0yau&_nc_oc=AdoojEyil8TFafvNqFvusgMW5112tzOU7OuX6uwrC2Mn-5xQFYDKSP_UIYJXFpw1swA&_nc_zt=23&_nc_ht=scontent.fdac151-1.fna&_nc_gid=O-HuU8lqu4pSzo8F6Jc6tQ&_nc_ss=7a3a8&oh=00_AfzRwYCJz2Jwbti4bJL-tnRrL5T3xKCTSf1dMDFTBAge-A&oe=69D17564" 
              alt="Al-Raji Logo" 
              className="w-8 h-8 md:w-12 md:h-12 object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-2xl font-black text-indigo-900 tracking-tight leading-tight truncate">Al Raji Institute</h1>
            <p className="text-[9px] md:text-xs uppercase font-bold text-indigo-400 tracking-[0.2em] mt-0.5">Al raji agent Nusrat</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
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
      <main className="flex-1 flex flex-col relative overflow-hidden md:container md:mx-auto md:max-w-6xl md:p-8 p-4">
        {/* Active Component */}
        <div className="flex-1 min-h-0 relative">
          <AnimatePresence mode="wait">
            {activeMode === 'home' ? (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <Home 
                  onStartChat={() => setActiveMode('chat')}
                  onStartCall={() => setActiveMode('voice')}
                  onShowInfo={() => setShowInfo(true)}
                />
              </motion.div>
            ) : activeMode === 'chat' ? (
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
                  onBack={() => setActiveMode('home')}
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
                  onBack={() => setActiveMode('home')} 
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
              className="bg-white w-full max-w-4xl h-[90vh] md:h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <button 
                  onClick={() => setShowAdmin(false)}
                  className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-all font-bold text-sm"
                >
                  <X size={20} />
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <Shield className="text-indigo-600" size={20} />
                  <span className="font-black text-slate-900">Admin Portal</span>
                </div>
                <div className="w-20"></div> {/* Spacer */}
              </div>

              {!isAdminLoggedIn ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="bg-indigo-50 p-6 rounded-full mb-6">
                    <Shield className="text-indigo-600" size={48} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Admin Access</h2>
                  <p className="text-slate-500 mb-8">Enter password to access admin panel</p>
                  
                  <div className="w-full max-w-sm space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="Username or Email"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                      />
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                        placeholder="Password"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
                      />
                    </div>
                    <button
                      onClick={handleAdminLogin}
                      disabled={isLoggingIn}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      {isLoggingIn ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <LogIn size={20} />
                      )}
                      {isLoggingIn ? 'Logging in...' : 'Login to Admin Panel'}
                    </button>

                    <div className="relative flex items-center gap-4 my-2">
                      <div className="flex-1 h-px bg-slate-100"></div>
                      <span className="text-xs text-slate-400 font-bold uppercase">OR</span>
                      <div className="flex-1 h-px bg-slate-100"></div>
                    </div>

                    <button
                      onClick={handleGoogleLogin}
                      className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c3.11 0 5.72-1.01 7.64-2.74l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C4.09 20.52 7.83 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.02a8.03 8.03 0 0 1 0-4.04V7.14H2.18a11.98 11.98 0 0 0 0 9.72l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.83 1 4.09 3.48 2.18 7.14l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Login with Google
                    </button>
                  </div>
                  
                  <p className="mt-8 text-xs text-slate-400">
                    Contact director if you forgot password
                  </p>
                </div>
              ) : (
                <AdminPanel 
                  onLogout={handleLogout} 
                  onBack={() => setShowAdmin(false)} 
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, orderBy, query, setDoc, doc, Timestamp, getDoc, auth, signInWithPopup, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { Users, Settings, LogOut, Save as SaveIcon, ShieldCheck, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

import { DEFAULT_SYSTEM_INSTRUCTION } from '../services/gemini';

export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'leads' | 'settings'>('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      fetchLeads();
      fetchSettings();
    }
  }, []);

  const fetchLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const q = query(collection(db, 'leads'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'bot-config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSystemInstruction(docSnap.data().systemInstruction);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/bot-config');
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'bot-config'), {
        systemInstruction,
        lastUpdated: Timestamp.now()
      });
      alert('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/bot-config');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      fetchLeads();
      fetchSettings();
    } catch (error) {
      console.error(error);
    }
  };

  if (!auth.currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-indigo-50 p-6 rounded-full mb-6">
          <ShieldCheck className="text-indigo-600" size={48} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Admin Authentication</h2>
        <p className="text-slate-500 mb-8">Login with Google to view leads and train the bot (alraji2025@gmail.com)</p>
        <button
          onClick={handleGoogleLogin}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-2xl font-bold shadow-sm transition-all flex items-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-2xl">
      <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-emerald-400" size={32} />
          <div>
            <h2 className="text-xl font-bold">Admin Dashboard</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest">{auth.currentUser.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 bg-slate-800 hover:bg-red-600 px-4 py-2 rounded-lg transition-all text-sm font-medium">
          <LogOut size={18} />
          Logout
        </button>
      </div>

      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition-all ${activeTab === 'leads' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Users size={20} />
          Student Leads ({leads.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition-all ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Settings size={20} />
          Bot Training
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'leads' ? (
          <div className="space-y-4">
            {isLoadingLeads ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Users size={48} className="mx-auto mb-4 opacity-20" />
                <p>No leads collected yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {leads.map(lead => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{lead.name}</h4>
                      <p className="text-indigo-600 font-medium">{lead.phone}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {lead.timestamp?.toDate().toLocaleString() || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      New Lead
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                System Instruction (Bot Knowledge)
              </label>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                className="w-full h-[400px] p-4 bg-white border border-slate-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder="Enter instructions for Nusrat..."
              />
            </div>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <SaveIcon size={20} />}
              Save Bot Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

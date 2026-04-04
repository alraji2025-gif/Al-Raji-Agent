import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, orderBy, query, setDoc, doc, Timestamp, getDoc, auth, signInWithPopup, googleProvider, handleFirestoreError, OperationType, deleteDoc, onAuthStateChanged, onSnapshot } from '../firebase';
import { Users, Settings, LogOut, Save as SaveIcon, ShieldCheck, Loader2, Trash2, Download, BarChart3, MessageSquare, Clock, Phone, GraduationCap, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { DEFAULT_SYSTEM_INSTRUCTION } from '../services/gemini';

export default function AdminPanel({ onLogout, onBack }: { onLogout: () => void, onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'settings'>('dashboard');
  const [leads, setLeads] = useState<any[]>([]);
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubLeads: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchSettings();
        
        // Real-time leads listener
        setIsLoadingLeads(true);
        setError(null);
        const q = query(collection(db, 'leads'), orderBy('timestamp', 'desc'));
        unsubLeads = onSnapshot(q, (snapshot) => {
          const fetchedLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log(`Fetched ${fetchedLeads.length} leads`);
          setLeads(fetchedLeads);
          setIsLoadingLeads(false);
          setLastRefresh(new Date());
        }, (err) => {
          console.error("Firestore Listener Error:", err);
          setError("You don't have permission to view leads. Please ensure you are logged in as an authorized admin.");
          setIsLoadingLeads(false);
        });
      } else {
        setLeads([]);
        if (unsubLeads) {
          unsubLeads();
          unsubLeads = null;
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubLeads) unsubLeads();
    };
  }, []);

  const manualRefresh = async () => {
    setIsLoadingLeads(true);
    try {
      const q = query(collection(db, 'leads'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastRefresh(new Date());
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

  const deleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'leads', id));
      setLeads(prev => (prev || []).filter(lead => lead.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${id}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const updateLeadStatus = async (id: string, status: string) => {
    setIsUpdatingStatus(id);
    try {
      await setDoc(doc(db, 'leads', id), { status }, { merge: true });
      setLeads(prev => (prev || []).map(l => l.id === id ? { ...l, status } : l));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${id}`);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const deleteAllLeads = async () => {
    if (!window.confirm('CRITICAL: Are you sure you want to delete ALL leads? This cannot be undone.')) return;
    if (!window.confirm('FINAL CONFIRMATION: Delete everything?')) return;
    
    setIsLoadingLeads(true);
    try {
      const batch = (leads || []).map(l => deleteDoc(doc(db, 'leads', l.id)));
      await Promise.all(batch);
      setLeads([]);
      alert('All leads deleted.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leads/all');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const filteredLeads = (leads || []).filter(l => 
    (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.phone || '').includes(searchQuery) ||
    (l.course && l.course.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const exportLeads = () => {
    const headers = ['Name', 'Phone', 'Course', 'Date', 'Status'];
    const csvData = (leads || []).map(l => [
      l.name || 'N/A',
      l.phone || 'N/A',
      l.course || 'N/A',
      l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString() : (l.timestamp ? new Date(l.timestamp).toLocaleString() : 'N/A'),
      l.status || 'new'
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `alraji_leads_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      fetchSettings();
    } catch (error) {
      console.error(error);
    }
  };

  const adminUser = auth.currentUser;

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-2xl">
      {/* Debug Info for Admin */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-1 text-[10px] text-amber-700 flex justify-between items-center">
        <span>Auth Status: {adminUser ? `Logged in (${adminUser.email || 'Anonymous'})` : 'Not Authenticated with Firebase'}</span>
        <span>UID: {adminUser?.uid || 'None'}</span>
      </div>

      <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
              title="Back to App"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-400" size={32} />
            <div>
              <h2 className="text-xl font-bold">Admin Dashboard</h2>
              <p className="text-xs text-slate-400 uppercase tracking-widest">
                {adminUser?.isAnonymous ? 'Logged in as Admin' : adminUser?.email || 'Admin Access'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!adminUser?.email && (
            <button
              onClick={handleGoogleLogin}
              className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-all text-xs font-medium"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3 h-3" />
              Link Google
            </button>
          )}
          <button onClick={onLogout} className="flex items-center gap-2 bg-slate-800 hover:bg-red-600 px-4 py-2 rounded-lg transition-all text-sm font-medium">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 md:py-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 font-bold transition-all ${activeTab === 'dashboard' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <BarChart3 size={18} className="md:w-5 md:h-5" />
          <span className="text-[10px] md:text-sm">Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex-1 py-3 md:py-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 font-bold transition-all ${activeTab === 'leads' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Users size={18} className="md:w-5 md:h-5" />
          <span className="text-[10px] md:text-sm">Leads ({(leads || []).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 md:py-4 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 font-bold transition-all ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Settings size={18} className="md:w-5 md:h-5" />
          <span className="text-[10px] md:text-sm">Training</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                    <Users size={24} />
                  </div>
                  <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Total Leads</h3>
                </div>
                <p className="text-4xl font-black text-slate-900">{(leads || []).length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
                    <Clock size={24} />
                  </div>
                  <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Last 24 Hours</h3>
                </div>
                <p className="text-4xl font-black text-slate-900">
                  {(leads || []).filter(l => {
                    const ts = l.timestamp?.toDate ? l.timestamp.toDate() : (l.timestamp ? new Date(l.timestamp) : null);
                    return ts && ts > new Date(Date.now() - 24 * 60 * 60 * 1000);
                  }).length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
                    <GraduationCap size={24} />
                  </div>
                  <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider">Top Course</h3>
                </div>
                <p className="text-xl font-black text-slate-900 truncate">
                  {Object.entries((leads || []).reduce((acc: any, l) => {
                    const c = l.course || 'General';
                    acc[c] = (acc[c] || 0) + 1;
                    return acc;
                  }, {})).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-500" />
                    Recent Activity
                  </h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {(leads || []).slice(0, 5).map(lead => (
                    <div key={lead.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                          {(lead.name || 'U')[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{lead.name}</p>
                          <p className="text-xs text-slate-500">{lead.course || 'General Inquiry'}</p>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {lead.timestamp?.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <GraduationCap size={18} className="text-orange-500" />
                    Course Popularity
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {Object.entries((leads || []).reduce((acc: any, l) => {
                    const c = l.course || 'General';
                    acc[c] = (acc[c] || 0) + 1;
                    return acc;
                  }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([course, count]: any) => (
                    <div key={course} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>{course}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / (leads?.length || 1)) * 100}%` }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-indigo-900 rounded-2xl p-4 md:p-6 text-white shadow-xl shadow-indigo-200 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
              <div className="text-center md:text-left">
                <h3 className="text-lg md:text-xl font-bold mb-1">Admin Quick Actions</h3>
                <p className="text-indigo-300 text-xs md:text-sm">Manage your institute data efficiently</p>
              </div>
              <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                <button onClick={exportLeads} className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2">
                  <Download size={16} />
                  Export
                </button>
                <button onClick={() => setActiveTab('settings')} className="flex-1 md:flex-none bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2">
                  <Settings size={16} />
                  Train
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Manage Student Leads</h3>
                <button 
                  onClick={manualRefresh}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                  title="Refresh Leads"
                >
                  <Clock size={14} className={isLoadingLeads ? 'animate-spin' : ''} />
                </button>
                <span className="text-[10px] text-slate-400 font-medium">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="Search leads..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none flex-1 md:w-64"
                />
                <button 
                  onClick={exportLeads}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Download size={14} />
                  Export
                </button>
                <button 
                  onClick={deleteAllLeads}
                  className="flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                  Clear All
                </button>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
                <ShieldCheck size={20} className="text-red-500" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {isLoadingLeads ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Loading leads...</p>
              </div>
            ) : (filteredLeads || []).length === 0 ? (
              <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <Users size={48} className="mx-auto mb-4 opacity-10" />
                <p>No leads found matching your search.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {(filteredLeads || []).map(lead => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                  >
                    <div className="flex gap-4 items-center">
                      <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <Phone size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{lead.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-indigo-600 font-medium text-sm">{lead.phone}</p>
                          <span className="text-slate-300">|</span>
                          <p className="text-xs text-slate-500 font-medium">{lead.course || 'General'}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock size={10} />
                          {lead.timestamp?.toDate ? lead.timestamp.toDate().toLocaleString() : (lead.timestamp ? new Date(lead.timestamp).toLocaleString() : 'N/A')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                      <select 
                        value={lead.status || 'new'}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        disabled={isUpdatingStatus === lead.id}
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border-none outline-none cursor-pointer transition-all ${
                          lead.status === 'enrolled' ? 'bg-emerald-100 text-emerald-700' :
                          lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="enrolled">Enrolled</option>
                      </select>

                      <button 
                        onClick={() => deleteLead(lead.id)}
                        disabled={isDeleting === lead.id}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                      >
                        {isDeleting === lead.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-500" />
                  System Instruction (Bot Knowledge)
                </label>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                  v2.0 Active
                </span>
              </div>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                className="w-full h-[400px] p-4 bg-white border border-slate-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"
                placeholder="Enter instructions for Al raji agent Nusrat..."
              />
            </div>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <SaveIcon size={20} />}
              Update Bot Intelligence
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

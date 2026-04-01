import React from 'react';
import { MessageSquare, Phone, Info, Shield, GraduationCap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeProps {
  onStartChat: () => void;
  onStartCall: () => void;
  onShowInfo: () => void;
}

export default function Home({ onStartChat, onStartCall, onShowInfo }: HomeProps) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="max-w-5xl mx-auto p-4 md:p-12 space-y-8 md:space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-4 md:space-y-8 pt-4 md:pt-0">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block p-1.5 md:p-3 bg-white rounded-[2rem] shadow-2xl shadow-indigo-100 mb-2 md:mb-4 overflow-hidden border border-indigo-50"
          >
            <img 
              src="https://scontent.fdac151-1.fna.fbcdn.net/v/t39.30808-6/590387982_122105713041128923_7459473621847877221_n.jpg?_nc_cat=102&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=oVkKIOPGqL4Q7kNvwHk0yau&_nc_oc=AdoojEyil8TFafvNqFvusgMW5112tzOU7OuX6uwrC2Mn-5xQFYDKSP_UIYJXFpw1swA&_nc_zt=23&_nc_ht=scontent.fdac151-1.fna&_nc_gid=O-HuU8lqu4pSzo8F6Jc6tQ&_nc_ss=7a3a8&oh=00_AfzRwYCJz2Jwbti4bJL-tnRrL5T3xKCTSf1dMDFTBAge-A&oe=69D17564" 
              alt="Al-Raji Logo" 
              className="w-16 h-16 md:w-32 md:h-32 object-cover rounded-[1.5rem]"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight"
          >
            Welcome to <br />
            <span className="text-indigo-600">Al Raji</span> <br />
            Institute
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-4"
          >
            Empowering your future with professional computer training and technical skills. 
            Chat with <span className="font-bold text-indigo-600">Al raji agent Nusrat</span>, our AI assistant, to learn more.
          </motion.p>
        </section>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartChat}
            className="group relative overflow-hidden bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 text-left transition-all hover:shadow-2xl hover:shadow-indigo-100"
          >
            <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <MessageSquare size={140} className="text-indigo-600" />
            </div>
            <div className="bg-indigo-100 p-4 md:p-5 rounded-2xl inline-block mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <MessageSquare size={32} className="md:w-10 md:h-10" />
            </div>
            <h3 className="text-xl md:text-3xl font-black text-slate-900 mb-3 leading-tight">Chat with <br/>Al raji agent Nusrat</h3>
            <p className="text-sm md:text-base text-slate-500 mb-8 leading-relaxed">Get instant answers about courses, admission, and more.</p>
            <div className="flex items-center gap-2 text-indigo-600 font-black text-sm md:text-lg">
              Start Conversation <ArrowRight size={20} />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartCall}
            className="group relative overflow-hidden bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 text-left transition-all hover:shadow-2xl hover:shadow-emerald-100"
          >
            <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <Phone size={140} className="text-emerald-600" />
            </div>
            <div className="bg-emerald-100 p-4 md:p-5 rounded-2xl inline-block mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <Phone size={32} className="md:w-10 md:h-10" />
            </div>
            <h3 className="text-xl md:text-3xl font-black text-slate-900 mb-3 leading-tight">Voice Call <br/>Experience</h3>
            <p className="text-sm md:text-base text-slate-500 mb-8 leading-relaxed">Experience real-time voice interaction with our AI agent.</p>
            <div className="flex items-center gap-2 text-emerald-600 font-black text-sm md:text-lg">
              Call Now <ArrowRight size={20} />
            </div>
          </motion.button>
        </div>

        {/* Secondary Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button 
            onClick={onShowInfo}
            className="flex items-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 rounded-full font-bold text-slate-700 transition-all"
          >
            <Info size={20} />
            Institute Info
          </button>
        </div>

        {/* Footer Info */}
        <div className="pt-12 border-t border-slate-200 text-center">
          <p className="text-slate-400 text-sm font-medium">
            © 2026 Al Raji Computer Training Institute. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { X, MapPin, Phone, Clock, GraduationCap, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function InfoModal({ onClose, onAdminClick }: { onClose: () => void, onAdminClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GraduationCap size={32} />
            <h2 className="text-2xl font-bold">Institute Information</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              Our Courses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "Computer Basic to Advanced",
                "Computer Office Application",
                "Graphics Design & Multimedia",
                "Web Design & Development",
                "Digital Marketing",
                "Video & Audio Editing",
                "AutoCAD",
                "Spoken English"
              ].map(course => (
                <div key={course} className="bg-indigo-50 p-3 rounded-xl text-indigo-700 font-medium text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                  {course}
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <MapPin className="text-red-500" size={20} />
                Address
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                200 yards east of S.K Factory,<br />
                Near Sreepur Road, Ansar Road,<br />
                Sreepur, Gazipur.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Class Hours
              </h3>
              <p className="text-slate-600 text-sm">
                9:00 AM to 10:00 PM.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Phone className="text-indigo-500" size={20} />
              Contact
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Md. Raizul Islam</p>
                  <p className="font-bold text-slate-800">01903584883</p>
                </div>
                <a href="https://wa.me/8801903584883" target="_blank" className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold">WhatsApp</a>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Tahmid Islam</p>
                  <p className="font-bold text-slate-800">01723684031</p>
                </div>
                <a href="https://wa.me/8801723684031" target="_blank" className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold">WhatsApp</a>
              </div>
            </div>
          </section>

          <section className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
            <h3 className="text-emerald-900 font-bold mb-2">Required Documents for Admission:</h3>
            <ul className="text-emerald-700 text-sm space-y-2 list-disc list-inside">
              <li>4 copies of passport size photos</li>
              <li>National ID card or Birth Certificate</li>
              <li>JSC or SSC Certificate</li>
              <li>Blood group report photocopy</li>
              <li>Parents' ID card</li>
            </ul>
            <div className="mt-4 bg-emerald-600 text-white p-3 rounded-xl text-center font-bold text-sm">
              20% discount for SSC examinees and employees!
            </div>
          </section>

          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <button 
              onClick={onAdminClick}
              className="text-slate-400 hover:text-indigo-600 text-xs font-medium transition-colors"
            >
              Admin Login
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

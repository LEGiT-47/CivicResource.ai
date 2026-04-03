import { motion } from "framer-motion";
import { 
  ArrowRight, ShieldCheck, Zap, Activity, 
  MapPin, BarChart3, Globe2, ChevronDown,
  Layers, Lock, Phone, UserPlus
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] overflow-x-hidden font-inter selection:bg-primary/20">
      {/* ── NAVIGATION: The Thin Line ────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 h-24 flex items-center justify-between px-10 md:px-20 z-50 bg-[#F8F9FA]/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
             <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black uppercase tracking-tighter text-slate-900">CivicFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-12">
           {["Intelligence", "Tactical", "Governance", "Security"].map(link => (
             <a key={link} href="#" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-primary transition-colors">{link}</a>
           ))}
        </div>
        <div className="flex items-center gap-6">
           <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 hover:text-slate-900 transition-colors">Access Portal</Link>
           <Link to="/signup" className="px-8 py-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-plinth hover:bg-black transition-all active:scale-95">
              Request Induction
           </Link>
        </div>
      </nav>

      {/* ── HERO: Strategic Foundation ────────────────────────────────────────── */}
      <section className="relative pt-48 pb-32 px-10 md:px-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10px_10px,#00000005_1px,transparent_0)] bg-[length:40px_40px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-50" />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white border border-border/40 shadow-sm text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-10">
               <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" /> GLOBAL ARCHITECTURE v4.0
            </span>
            <h1 className="text-7xl md:text-[11rem] font-black uppercase tracking-tighter text-slate-900 leading-[0.85] mb-12 italic">
               Strategic <br /> <span className="text-primary not-italic">City Logic</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg font-black text-slate-400 uppercase tracking-widest leading-relaxed mb-16">
               Induct the next generation of urban resource orchestration. High-fidelity intelligence for district-scale protocols.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
               <Link to="/signup" className="w-full md:w-auto px-12 py-7 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-[0.4em] shadow-plinth shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4">
                  Initialize Relay <ArrowRight className="w-5 h-5" />
               </Link>
               <button className="w-full md:w-auto px-12 py-7 rounded-2xl bg-white border-2 border-border/60 text-slate-900 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-slate-50 transition-all flex items-center justify-center gap-4">
                  Protocol Blueprint <Globe2 className="w-5 h-5" />
               </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── BLUEPRINT: Platform Matrix ────────────────────────────────────────── */}
      <section className="px-10 md:px-20 py-20">
         <div className="max-w-7xl mx-auto plinth-card bg-white p-0 relative overflow-hidden group">
            <div className="flex flex-col xl:flex-row min-h-[700px]">
               {/* Left Controls Shell */}
               <div className="w-full xl:w-[480px] border-r border-border/40 p-12 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                     <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-4 leading-none italic">Control Matrix</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-16">Active Operational Triage Preview</p>
                     
                     <div className="space-y-8">
                        {[
                          { l: "Signals Detected", v: "1,242", i: Activity, c: "text-primary" },
                          { l: "Active Hubs", v: "07", i: MapPin, c: "text-slate-900" },
                          { l: "Flow Stability", v: "99.9%", i: ShieldCheck, c: "text-secondary" }
                        ].map(item => (
                          <div key={item.l} className="flex items-center gap-6 group/item">
                             <div className={cn("w-14 h-14 rounded-2xl bg-white shadow-tactile flex items-center justify-center transition-all group-hover/item:scale-110", item.c)}>
                                <item.i className="w-6 h-6" />
                             </div>
                             <div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.l}</span>
                                <h4 className="text-2xl font-black text-slate-900 tabular-nums">{item.v}</h4>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>

                  <div className="p-8 rounded-[2rem] bg-slate-900 text-white flex items-center justify-between">
                     <span className="text-[10px] font-black uppercase tracking-[0.4em]">Initialize Matrix UI</span>
                     <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                        <ArrowRight className="w-5 h-5 text-white" />
                     </div>
                  </div>
               </div>

               {/* Large High-Fidelity Preview */}
               <div className="flex-1 bg-white relative p-12 flex flex-col items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[#F1F5F9]/30" />
                  <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-plinth border border-border/20 p-1 transition-all group-hover:scale-[1.02] duration-700">
                     <div className="bg-slate-50 rounded-[2.2rem] h-[500px] p-10 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-10">
                           <div className="flex gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-400" />
                              <div className="w-3 h-3 rounded-full bg-amber-400" />
                              <div className="w-3 h-3 rounded-full bg-emerald-400" />
                           </div>
                           <div className="bg-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200">OP_REPLAY://LIVE_07</div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           {[1,2,3,4].map(i => (
                             <div key={i} className="h-40 rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-end">
                                <div className="h-1 bg-slate-50 w-full rounded-full mb-4 overflow-hidden">
                                   <div className="h-full bg-primary" style={{ width: `${i * 20}%` }} />
                                </div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">NODE_PULSE_0{i}</span>
                                <span className="text-lg font-black text-slate-900 tabular-nums lowercase">{Math.random().toFixed(2)}ms</span>
                             </div>
                           ))}
                        </div>

                        <div className="absolute inset-x-0 bottom-0 p-10 bg-gradient-to-t from-slate-50 to-transparent">
                           <div className="flex items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-plinth">
                               <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                                  <ShieldCheck className="w-5 h-5 text-white" />
                               </div>
                               <div className="flex-1">
                                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Optimization Active</div>
                                  <div className="h-1 bg-slate-50 w-full mt-2 rounded-full overflow-hidden">
                                     <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="h-full bg-primary w-1/3" />
                                  </div>
                                </div>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Floating Labels */}
                  <div className="absolute top-20 right-20 bg-white px-8 py-4 rounded-2xl shadow-plinth border border-border/40 text-[9px] font-black uppercase tracking-widest text-primary animate-bounce">
                     High-Fidelity Relay
                  </div>
                  <div className="absolute bottom-20 left-20 bg-slate-900 px-8 py-4 rounded-2xl shadow-plinth border border-white/5 text-[9px] font-black uppercase tracking-widest text-white italic">
                     Predictive Intelligence Mode
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* ── ARTIFACTS: Feature Slabs ────────────────────────────────────────── */}
      <section className="px-10 md:px-20 py-32 bg-[#F2F4F7]">
         <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { t: "Logic Extraction", d: "Deep recursive analysis of district signals for proactive resource triage.", i: Layers, c: "text-primary" },
              { t: "Induction Firewall", d: "High-end cryptographic validation for civilian reporting protocols.", i: Lock, c: "text-slate-900" },
              { t: "Strategic Flow", d: "Real-time orchestration of municipal assets across the district node.", i: Activity, c: "text-secondary" }
            ].map((f, i) => (
              <motion.div 
                key={f.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="plinth-card bg-white p-16 hover:border-primary/20 transition-all flex flex-col border-none"
              >
                 <div className={cn("w-20 h-20 rounded-[2rem] bg-white shadow-tactile flex items-center justify-center mb-10", f.c)}>
                    <f.i className="w-10 h-10" />
                 </div>
                 <h4 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-6 leading-none italic">{f.t}</h4>
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-relaxed">{f.d}</p>
                 <div className="mt-auto pt-16 flex items-center gap-4 text-[10px] font-black text-primary uppercase tracking-[0.3em] group cursor-pointer">
                    Examine Protocol <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                 </div>
              </motion.div>
            ))}
         </div>
      </section>

      {/* ── FOOTER: The Terminal ───────────────────────────────────────────── */}
      <footer className="px-10 md:px-20 py-24 bg-white border-t border-border/40 overflow-hidden relative">
         <div className="absolute top-0 right-0 p-32 opacity-[0.03] rotate-12 pointer-events-none">
            <Zap className="w-[800px] h-[800px]" />
         </div>
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-20 relative z-10">
            <div className="max-w-md">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shadow-2xl">
                     <Zap className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-2xl font-black uppercase tracking-tighter text-slate-900">CivicFlow</span>
               </div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] leading-relaxed mb-12">
                  CivicFlow is the primary orchestrator for modern municipal intelligence. Distributed governance for resilient cities.
               </p>
               <div className="flex gap-4">
                  <Link to="/signup" className="flex items-center gap-3 px-8 py-4 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-plinth hover:scale-105 active:scale-95 transition-all">
                     Join Node <UserPlus className="w-4 h-4" />
                  </Link>
                  <button className="p-4 rounded-xl bg-slate-50 border border-border/60 hover:bg-slate-100 transition-all">
                     <Phone className="w-5 h-5 text-slate-400" />
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-20">
               {[
                 { t: "Protocols", l: ["Intelligence", "Operational HUD", "Governance", "Strategic Map"] },
                 { t: "CivicFlow", l: ["Municipal Lab", "Resource Triage", "Audit Registry", "Field Flow"] },
                 { t: "Security", l: ["Encryption V3", "Hardware Hub", "Identity Matrix", "System Sync"] }
               ].map(group => (
                 <div key={group.t}>
                    <h5 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900 mb-8">{group.t}</h5>
                    <ul className="space-y-4">
                       {group.l.map(item => (
                         <li key={item}><a href="#" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">{item}</a></li>
                       ))}
                    </ul>
                 </div>
               ))}
            </div>
         </div>
         <div className="max-w-7xl mx-auto mt-32 pt-12 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40">
            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">© 2026 CivicFlow Registry. All protocols reserved.</p>
            <div className="flex gap-10">
               <span className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">SECURE_LINK_V3</span>
               <span className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">ENCRYPT_TLS_1.4</span>
            </div>
         </div>
      </footer>
    </div>
  );
}

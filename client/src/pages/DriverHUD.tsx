import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Navigation, MapPin, AlertCircle, Clock, 
  CheckCircle, Shield, Truck, Zap, Phone,
  ArrowRight, Activity, Radio, Signal, Info, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export default function DriverHUD() {
  const [activeIncident, setActiveIncident] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const { data } = await api.get('/incidents');
        setIncidents(data);
        if (!activeIncident && data.length > 0) {
          setActiveIncident(data.find((i: any) => i.severity === 'critical') || data[0]);
        }
      } catch (err) {
        console.error("DriverHUD fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
  }, []);

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-white">
      <Activity className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-50/30 overflow-hidden font-inter">
      {/* ── LEFT: Operational Dispatch HUD ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.2rem] bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center">
                 <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">Operational HUD</h1>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Field Resource Relay v4.0</p>
              </div>
           </div>
           <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white border border-border/60 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">GPS_LOCK: 0.2ms</span>
           </div>
        </header>

        {activeIncident ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="plinth-card bg-slate-900 text-white min-h-[500px] flex flex-col group overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-150 transition-transform duration-[2s]">
                  <Shield className="w-64 h-64" />
               </div>
               
               <div className="flex-1 space-y-10 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="px-4 py-1.5 rounded-lg bg-primary text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20">Protocol Critical</div>
                     <span className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">#{activeIncident._id.slice(-6)}</span>
                  </div>
                  
                  <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">{activeIncident.title}</h2>
                  
                  <div className="space-y-6">
                     <div className="flex items-start gap-4 p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-md">
                        <MapPin className="w-6 h-6 text-primary mt-1 shrink-0" />
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Inducted Coordinate</p>
                           <p className="text-lg font-black tracking-tight">{activeIncident.location?.address}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-4 p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-md">
                        <Info className="w-6 h-6 text-secondary mt-1 shrink-0" />
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Signal Parameters</p>
                           <p className="text-[11px] font-bold opacity-80 uppercase leading-relaxed tracking-wider">{activeIncident.description}</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="mt-auto flex gap-4 relative z-10 pt-12">
                  <button className="flex-1 py-6 rounded-2xl bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3">
                     <Navigation className="w-4 h-4" /> Initialize Route
                  </button>
                  <button className="p-6 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all">
                     <Phone className="w-5 h-5" />
                  </button>
               </div>
            </div>

            <div className="flex flex-col gap-8">
               <div className="tactile-slab bg-white flex-1 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_10px_10px,#00000008_1px,transparent_0)] bg-[length:20px_20px]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                     <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Activity className="w-8 h-8 text-primary" />
                     </div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2 block">District Topology</span>
                     <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Active Proximity</h4>
                     <div className="mt-8 flex items-end gap-1.5 h-20 w-full animate-pulse">
                        {Array.from({ length: 42 }).map((_, i) => (
                           <div key={i} className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: `${20 + Math.random() * 80}%` }} />
                        ))}
                     </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="plinth-card bg-white p-8 flex flex-col justify-center border-none">
                     <div className="flex items-center gap-3 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-lg shadow-secondary" />
                        <span className="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">Estimated Arrivals</span>
                     </div>
                     <div className="text-4xl font-black tracking-tighter text-slate-900">08:42</div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Relative to Vector Flow</span>
                  </div>
                  <div className="plinth-card bg-white p-8 flex flex-col justify-center border-none">
                     <div className="flex items-center gap-3 mb-3 text-emerald-500">
                        <Signal className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Link Status</span>
                     </div>
                     <div className="text-4xl font-black tracking-tighter text-slate-900 uppercase tracking-tight">OPTIMAL</div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Network Reliability 99.8%</span>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] p-24 text-center border-2 border-dashed border-slate-100">
             <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8">
                <Radio className="w-10 h-10 text-slate-200" />
             </div>
             <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Listening for Signal</h3>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Operational status idle. District 7 relay pending induction.</p>
          </div>
        )}
      </div>

      {/* ── RIGHT: Protocol Registry ────────────────────────────────────────── */}
      <div className="w-full lg:w-[480px] bg-white border-l border-border/40 flex flex-col shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.02)] z-10 transition-all duration-500">
         <div className="p-8 border-b border-border/40 bg-slate-50/50">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900 mb-6 flex items-center gap-3">
               <Activity className="w-4 h-4 text-primary" /> Active Signal Registry
            </h3>
            <div className="relative">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                  placeholder="Filter by Protocol ID..."
                  className="w-full bg-white border-none rounded-2xl pl-16 pr-6 py-5 text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
               />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {incidents.map((incident) => (
              <motion.button
                key={incident._id}
                whileHover={{ scale: 1.02, x: 5 }}
                onClick={() => setActiveIncident(incident)}
                className={cn(
                  "w-full p-8 rounded-3xl text-left transition-all border-2",
                  activeIncident?._id === incident._id 
                    ? "bg-white border-primary shadow-plinth" 
                    : "bg-slate-50/50 border-transparent hover:border-slate-200"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        incident.severity === 'critical' ? 'bg-primary shadow-[0_0_10px_rgba(255,79,0,0.5)]' : 'bg-secondary'
                     )} />
                     <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{incident._id.slice(-6)}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{incident.status}</span>
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight mb-2">{incident.title}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{incident.location?.address}</p>
                <div className="mt-8 flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest group">
                   Initialize Data <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.button>
            ))}
         </div>

         <div className="p-8 border-t border-border/40 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-4 h-4 rounded-full bg-success animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">All Systems Nominal</span>
            </div>
            <Shield className="w-5 h-5 text-slate-200" />
         </div>
      </div>
    </div>
  );
}

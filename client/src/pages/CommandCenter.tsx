import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Shield, MapPin, Zap, AlertTriangle, 
  ChevronRight, Search, Filter, Layers, Navigation2,
  Clock, CheckCircle, BarChart3, Radio, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";
import CityMap from "@/components/CityMap";
import LiveFeed from "@/components/LiveFeed";
import api from "@/lib/api";

const stats = [
  { label: "Active Nodes", value: "14", icon: MapPin, color: "text-primary", bg: "bg-primary/5" },
  { label: "AI Response", value: "1.2s", icon: Zap, color: "text-secondary", bg: "bg-secondary/5" },
  { label: "Compliance", value: "98.2%", icon: Shield, color: "text-emerald-500", bg: "bg-emerald-50/50" },
  { label: "Threat Index", value: "LOW", icon: AlertTriangle, color: "text-slate-400", bg: "bg-slate-50" },
];

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<"map" | "analysis">("map");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const { data } = await api.get('/incidents');
        setIncidents(data);
      } catch (err) {
        console.error("CommandCenter fetch failed", err);
      }
    };
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, []);

  const runOptimization = () => {
    setIsOptimizing(true);
    setTimeout(() => setIsOptimizing(false), 2400);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30 font-inter">
      {/* ── TOP STATS: The Pulse ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-border/40 bg-white">
        {stats.map((s, i) => (
          <div key={s.label} className={cn(
            "p-8 transition-colors hover:bg-slate-50",
            i !== stats.length - 1 && "border-r border-border/40"
          )}>
            <div className="flex items-center gap-3 mb-2 opacity-60">
              <s.icon className={cn("w-4 h-4", s.color)} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{s.label}</span>
            </div>
            <div className="text-3xl font-black tracking-tighter text-slate-900 tabular-nums">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        {/* ── LEFT: Strategic Matrix ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto custom-scrollbar">
          
          {/* Dashboard Header UI */}
          <div className="flex items-center justify-between">
            <div>
               <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-2xl">
                     <Radio className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">Operation Pulse</h2>
               </div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-[52px]">Real-time Resource Distribution Relay</p>
            </div>
            
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border/40 shadow-sm">
                <button 
                  onClick={() => setActiveTab("map")}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === "map" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                   Visual Relay
                </button>
                <button 
                  onClick={() => setActiveTab("analysis")}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === "analysis" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                   Logic Flow
                </button>
            </div>
          </div>

          {/* Main Control Slab */}
          <div className="flex-1 relative tactile-slab border-none h-[600px] xl:h-auto overflow-hidden">
             {activeTab === "map" ? (
               <div className="w-full h-full relative group">
                  <CityMap incidents={incidents} />
                  
                  {/* Floating Overlay Controls */}
                  <div className="absolute top-6 left-6 flex flex-col gap-3">
                     <button className="w-12 h-12 bg-white flex items-center justify-center rounded-xl shadow-plinth border border-border/40 hover:bg-slate-50 transition-all">
                        <Layers className="w-5 h-5 text-slate-600" />
                     </button>
                     <button className="w-12 h-12 bg-white flex items-center justify-center rounded-xl shadow-plinth border border-border/40 hover:bg-slate-50 transition-all">
                        <Filter className="w-5 h-5 text-slate-600" />
                     </button>
                  </div>

                  <div className="absolute bottom-10 inset-x-10 flex items-end justify-between pointer-events-none">
                     <div className="bg-white/90 backdrop-blur-xl p-5 rounded-2xl border border-border/40 shadow-plinth pointer-events-auto max-w-sm">
                        <div className="flex items-center gap-3 mb-3">
                           <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                           <span className="text-[10px] font-black tracking-widest uppercase text-slate-900">Optimization Protocol Active</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed mb-5">
                           The AI Intelligence Hub is currently performing a predictive triage of high-risk districts.
                        </p>
                        <button 
                          onClick={runOptimization}
                          disabled={isOptimizing}
                          className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50"
                        >
                           {isOptimizing ? <Activity className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                           {isOptimizing ? "Calibrating..." : "Execute Re-Sync"}
                        </button>
                     </div>

                     <div className="flex items-center gap-2 pointer-events-auto">
                        <div className="bg-white/90 backdrop-blur-xl px-6 py-4 rounded-xl border border-border/40 shadow-plinth flex items-center gap-4">
                           <div className="flex flex-col text-right">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Signals</span>
                              <span className="text-xl font-black text-slate-900 leading-none">2,481</span>
                           </div>
                           <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                              <Activity className="w-5 h-5 text-primary" />
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
             ) : (
               <div className="p-10 flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto">
                  <div className="w-24 h-24 rounded-3xl bg-primary/5 flex items-center justify-center mb-10 shadow-inner">
                     <BarChart3 className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-6 leading-none">Strategic Logic Matrix</h3>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] leading-relaxed mb-12">
                     Analyze sector performance and resource allocation trends via the Intelligence Matrix protocol.
                  </p>
                  <button className="btn-tactile">Initialize Global Analysis</button>
               </div>
             )}
          </div>
        </div>

        {/* ── RIGHT: Field Data Feed ────────────────────────────────────────── */}
        <div className="w-full xl:w-[420px] bg-white border-l border-border/40 flex flex-col shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.02)]">
           <div className="p-8 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Radio className="w-4 h-4 text-primary" />
                 <span className="text-[11px] font-black tracking-[0.3em] uppercase text-slate-900">Live Feedback</span>
              </div>
              <Share2 className="w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-pointer" />
           </div>
           
           <div className="p-6 bg-slate-50/50 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
              {["Critical", "High", "Resolved", "Recent"].map(stat => (
                 <button key={stat} className="px-5 py-2.5 rounded-xl bg-white border border-border/40 text-[9px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm hover:border-primary/50 transition-all">
                    {stat}
                 </button>
              ))}
           </div>

           <div className="flex-1 overflow-y-auto">
              <LiveFeed incidents={incidents} />
           </div>

           <div className="p-8 border-t border-border/40 bg-slate-50/30">
              <div className="flex items-center gap-3 text-slate-400 mb-6">
                 <Clock className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-[0.4em]">Signal Synchronized @ 06:42 PM</span>
              </div>
              <button className="w-full flex items-center justify-between px-8 py-5 rounded-2xl bg-white border-2 border-border/40 text-[10px] font-black uppercase tracking-[0.3em] hover:border-primary group transition-all">
                 Initialize Field Protocol <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

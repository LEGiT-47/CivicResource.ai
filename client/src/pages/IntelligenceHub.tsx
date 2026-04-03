import api from "@/lib/api";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { StatCard } from "@/components/StatCard";
import { TrendingUp, Brain, BarChart3, Timer, Zap, ShieldCheck, Activity, ChevronRight, Info, Radio, Database, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IntelligenceHub() {
  const [timeIndex, setTimeIndex] = useState(12);
  const [optimizedView, setOptimizedView] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data } = await api.get('/dashboard');
        setAnalytics(data);
      } catch (err) {
        console.error("IntelligenceHub fetch failed", err);
      }
    };
    fetchAnalytics();
  }, []);

  if (!analytics) return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-white">
      <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center animate-pulse mb-6">
        <Brain className="w-10 h-10 text-primary" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Synchronizing Intelligence Core...</p>
    </div>
  );

  const demandData = (analytics.demandTimeSeries || []).slice(0, timeIndex + 1);
  const categoryBreakdown = analytics.categoryBreakdown || [];
  const weeklyTrend = analytics.weeklyTrend || [];

  return (
    <div className="flex flex-col h-full gap-8 p-8 overflow-y-auto bg-slate-50/30 custom-scrollbar pb-24">
      
      {/* ── HEADER: Strategic Context ────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Intelligence Matrix</h1>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-[56px]">Predictive Urban Triage & Resource Logic</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border/40 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-black text-primary uppercase bg-primary/5 rounded-xl border border-primary/10">
               <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Live Relay Active
            </div>
            <button className="p-3 text-slate-400 hover:text-primary transition-all">
               <Database className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* ── DIAGNOSTIC SLABS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Predicted Triage" value="87" change="↑ 12%" trend="up" icon={<Brain className="w-4 h-4" />} accentColor="indigo" />
        <StatCard label="System Flow" value={optimizedView ? "94.2%" : "68.4%"} icon={<Zap className="w-4 h-4" />} accentColor={optimizedView ? "orange" : "slate"} />
        <StatCard label="Induction Latency" value={optimizedView ? "8m 12s" : "24m 45s"} icon={<Timer className="w-4 h-4" />} accentColor={optimizedView ? "orange" : "red"} />
        <StatCard label="Sync Stability" value="99.98%" icon={<ShieldCheck className="w-4 h-4" />} accentColor="indigo" />
      </div>

      {/* ── SIMULATION CONTROL UNIT ────────────────────────────────────────────── */}
      <div className="plinth-card flex flex-col md:flex-row items-center justify-between gap-12 bg-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-3 mb-4">
                <Radio className="w-4 h-4 text-primary" /> Strategy Simulation Matrix
            </span>
            <div className="flex items-center gap-3 p-2 bg-slate-50 border border-border/50 rounded-2xl w-fit shadow-inner">
                <button
                  onClick={() => setOptimizedView(false)}
                  className={cn(
                    "px-8 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                    !optimizedView ? "bg-white shadow-xl border border-border/40 text-slate-900" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Raw Operational Flow
                </button>
                <button
                  onClick={() => setOptimizedView(true)}
                  className={cn(
                    "px-8 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                    optimizedView ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Induct Optimization
                </button>
            </div>
          </div>
          <div className="h-16 w-px bg-slate-100 hidden md:block" />
          <div className="flex-1 min-w-[320px]">
            <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Projection Horizon</span>
                 <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/10">Delta: {(analytics.demandTimeSeries || [])[timeIndex]?.time || "00:00"}</span>
            </div>
            <input
                type="range"
                min={0}
                max={23}
                value={timeIndex}
                onChange={(e) => setTimeIndex(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
        <div className="p-6 bg-slate-900 rounded-2xl flex items-start gap-4 max-w-sm relative z-10 shadow-2xl">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] font-black text-white uppercase leading-relaxed tracking-widest opacity-80">
               Dynamic AI model syncing with global municipal signals. Flow variance target: ±0.4%.
            </p>
        </div>
      </div>

      {/* ── ANALYTICAL VOID LAYER ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Triage Load Projection */}
        <div className="lg:col-span-2 plinth-card p-10 bg-white group h-[500px]">
          <div className="flex items-center justify-between mb-12">
            <div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">Operational Load Matrix</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Predictive Sector Demand Distribution</p>
            </div>
            <div className="flex items-center gap-8">
               {[
                 { l: "Raw", c: "#94A3B8" },
                 { l: "Forecast", c: "#4F46E5" },
                 { l: "Optimized", c: "#FF4F00", v: optimizedView }
               ].filter(i => i.v !== false).map(i => (
                 <div key={i.l} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i.c }} />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{i.l}</span>
                 </div>
               ))}
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={demandData}>
                <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF4F00" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#FF4F00" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748B' }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748B' }} />
                <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', padding: '24px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.1)', background: '#FFF' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Area type="monotone" dataKey="actual" stroke="#94A3B8" fill="transparent" strokeWidth={3} strokeDasharray="10 5" />
                <Area type="monotone" dataKey="predicted" stroke="#4F46E5" fill="url(#colorPrimary)" strokeWidth={4} />
                {optimizedView && (
                    <Area type="monotone" dataKey="optimized" stroke="#FF4F00" fill="url(#colorOrange)" strokeWidth={5} />
                )}
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Allocation Breakdown */}
        <div className="plinth-card p-10 bg-white flex flex-col h-[500px]">
            <div className="mb-10">
                <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">Sector Triage</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Active Municipal Resource Flow</p>
            </div>
            <div className="flex-1 flex flex-col justify-center relative">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={70} outerRadius={105} dataKey="value" strokeWidth={10} stroke="#FFF">
                        {categoryBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                        ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '20px', border: 'none', padding: '16px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                
                {/* Custom Legend Overlay */}
                <div className="grid grid-cols-1 gap-2 mt-8">
                    {categoryBreakdown.slice(0, 4).map((c) => (
                        <div key={c.name} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/50 border border-border/50 hover:bg-slate-50 transition-all hover:scale-[1.02] cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: c.color }} />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{c.name}</span>
                            </div>
                            <span className="text-[11px] font-black text-primary">{c.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* ── COMPLIANCE PERFORMANCE FEED ───────────────────────────────────────────── */}
      <div className="plinth-card p-10 bg-white mb-24">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">Lifecycle Compliance Matrix</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">7-Day Operational Signal Integrity Sync</p>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-secondary/10 border border-secondary/20 rounded-2xl">
             <ShieldCheck className="w-5 h-5 text-secondary" />
             <span className="text-[11px] font-black text-secondary uppercase tracking-[0.2em] underline decoration-2 cursor-pointer">Compliance Rating: 99.1%</span>
          </div>
        </div>
        <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748B', textTransform: 'uppercase' }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748B' }} />
                <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: '20px', border: 'none', padding: '16px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="incidents" fill="#E2E8F0" radius={[8, 8, 0, 0]} barSize={40} />
                <Bar dataKey="resolved" fill="#4F46E5" radius={[8, 8, 0, 0]} barSize={40} />
            </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

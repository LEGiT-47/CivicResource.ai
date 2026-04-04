import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, Search, Filter, ChevronRight, 
  Download, Share2, Archive, BarChart3, 
  Activity, CheckCircle2, AlertCircle, Clock,
  Brain, Zap, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const mockPerformanceData = [
    { time: "00:00", active: 45, resolved: 30 },
    { time: "04:00", active: 52, resolved: 35 },
    { time: "08:00", active: 68, resolved: 45 },
    { time: "12:00", active: 75, resolved: 55 },
    { time: "16:00", active: 62, resolved: 50 },
    { time: "20:00", active: 55, resolved: 48 },
    { time: "23:59", active: 48, resolved: 42 },
];

export default function ReportsArchive() {
  const [reports, setReports] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [personnel, setPersonnel] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [newResourceType, setNewResourceType] = useState<"police" | "fire" | "medical" | "public_works" | "drone">("public_works");

    const syncArchiveData = async () => {
        try {
            const [reportsRes, resourcesRes, personnelRes] = await Promise.all([
                api.get('/incidents?status=all'),
                api.get('/resources'),
                api.get('/dispatch/personnel')
            ]);
            setReports(reportsRes.data);
            setResources(resourcesRes.data || []);
            setPersonnel(personnelRes.data || []);
        } catch (err) {
            console.error("Reports fetch failed", err);
            toast.error("Unable to sync archive records");
        }
    };

  useEffect(() => {
        syncArchiveData();
  }, []);

    const updateStatus = async (status: 'active' | 'investigating' | 'resolved') => {
        if (!selectedReport) return;
        setActionLoading(true);
        try {
            const { data } = await api.put(`/incidents/${selectedReport._id}/status`, { status });
            setSelectedReport(data);
            toast.success(`Incident marked as ${status}`);
            await syncArchiveData();
        } catch (err) {
            console.error(err);
            toast.error("Unable to update incident status");
        } finally {
            setActionLoading(false);
        }
    };

    const assignPersonnel = async (personnelId: string) => {
        if (!selectedReport) return;
        setActionLoading(true);
        try {
            await api.post('/dispatch/assign', {
                incidentId: selectedReport._id,
                personnelId,
            });
            toast.success("Personnel allocated successfully");
            await syncArchiveData();
        } catch (err) {
            console.error(err);
            toast.error("Failed to allocate personnel");
        } finally {
            setActionLoading(false);
        }
    };

    const dispatchResourceToSelected = async (resourceId: string) => {
        if (!selectedReport) return;
        setActionLoading(true);
        try {
            await api.put(`/resources/${resourceId}/dispatch`, { incidentId: selectedReport._id });
            toast.success("Resource sent to incident");
            await syncArchiveData();
        } catch (err) {
            console.error(err);
            toast.error("Failed to send resource");
        } finally {
            setActionLoading(false);
        }
    };

    const createAndDispatchNewResource = async () => {
        if (!selectedReport) return;
        setActionLoading(true);
        try {
            const unitCode = Math.floor(100 + Math.random() * 900);
            const { data: createdResource } = await api.post('/resources', {
                name: `${newResourceType.replace('_', ' ').toUpperCase()} UNIT-${unitCode}`,
                type: newResourceType,
                location: selectedReport.location,
                batteryOrFuelLevel: 100,
            });

            await api.put(`/resources/${createdResource._id}/dispatch`, { incidentId: selectedReport._id });
            toast.success("New resource created and dispatched");
            await syncArchiveData();
        } catch (err) {
            console.error(err);
            toast.error("Unable to create and dispatch new resource");
        } finally {
            setActionLoading(false);
        }
    };

    const availableResources = resources.filter((r) => r.status === 'patrol');

  const filteredReports = reports.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50/30 overflow-hidden font-inter">
      {/* ── TOP: Strategic Overview ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-b border-border/40 bg-white">
        {[
            { label: "Total Reports", value: reports.length, icon: FileText, color: "text-primary" },
            { label: "AI Mitigation Rate", value: "84.2%", icon: Brain, color: "text-indigo-500" },
            { label: "Avg Resolution", value: "14m 20s", icon: Clock, color: "text-emerald-500" },
            { label: "System Health", value: "99.1%", icon: Shield, color: "text-slate-900" },
        ].map((stat, i) => (
            <div key={stat.label} className={cn(
                "p-8 transition-all hover:bg-slate-50 border-r border-border/40 last:border-r-0"
            )}>
                <div className="flex items-center gap-3 mb-2 opacity-60">
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{stat.label}</span>
                </div>
                <div className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">
                    {stat.value}
                </div>
            </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: Report Register ────────────────────────────────────────── */}
        <div className="w-[520px] bg-white border-r border-border/40 flex flex-col shadow-2xl relative z-10">
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Reports Index</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Archival Historical Data</p>
                    </div>
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([JSON.stringify(filteredReports, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `civic-reports-${Date.now()}.json`;
                                                link.click();
                                                URL.revokeObjectURL(url);
                                                toast.success("Archive exported");
                                            }}
                                            className="p-3 bg-slate-50 rounded-xl border border-border/40 hover:text-primary transition-all shadow-sm"
                                        >
                        <Download className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex items-center gap-4 border-b border-border/30 pb-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Identify Signal..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-50/50 border border-border/40 rounded-2xl py-4 pl-12 pr-6 text-[10px] font-black uppercase tracking-[0.2em] focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                    </div>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-border/40">
                        {['all', 'active', 'resolved'].map(t => (
                            <button 
                                key={t}
                                onClick={() => setFilter(t)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    filter === t ? "bg-white text-slate-900 shadow-plinth border border-border/40" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-4 custom-scrollbar">
                {filteredReports.map((report) => (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={report._id}
                        onClick={() => setSelectedReport(report)}
                        className={cn(
                            "p-6 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden",
                            selectedReport?._id === report._id 
                                ? "bg-white border-primary shadow-2xl shadow-primary/10 scale-[1.01]" 
                                : "bg-white/50 border-border/40 hover:border-slate-300 hover:bg-white"
                        )}
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        report.status === 'resolved' ? "bg-emerald-500" : "bg-primary animate-pulse"
                                    )} />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{report.status}</span>
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{report.title}</h3>
                            </div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">#{report._id.slice(-6)}</span>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-[10px] text-slate-400">
                                    {report.type?.[0]?.toUpperCase() || 'I'}
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{report.type}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                <Clock className="w-3 h-3" />
                                {new Date(report.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        {/* ── RIGHT: Analytical Deep Dive ───────────────────────────────────── */}
        <div className="flex-1 bg-slate-50/30 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
                {selectedReport ? (
                    <motion.div 
                        key={selectedReport._id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-12 max-w-5xl mx-auto space-y-12 pb-32"
                    >
                        {/* Summary Header */}
                        <div className="flex items-start justify-between gap-12">
                            <div className="flex-1">
                                <span className="text-primary font-black text-[10px] uppercase tracking-[0.5em] block mb-4">Signal Investigation Matrix</span>
                                <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-6">{selectedReport.title}</h1>
                                <div className="flex items-center gap-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2.5">
                                        <AlertCircle className="w-4 h-4 text-primary" /> Severity: <span className="text-slate-900">{selectedReport.severity}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <Shield className="w-4 h-4 text-emerald-500" /> Resolution: <span className="text-slate-900">89% Mitigation</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <Zap className="w-4 h-4 text-indigo-500" /> Confidence: <span className="text-slate-900">{selectedReport.aiPredictionConfidence}%</span>
                                    </div>
                                </div>

                                                                {(selectedReport.sourceLanguage || 'english') !== 'english' && (
                                                                    <div className="mt-8 p-6 bg-white border border-border/40 rounded-2xl">
                                                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
                                                                            Multilingual Archive Record
                                                                        </p>
                                                                        <p className="text-xs font-black text-slate-900 uppercase tracking-wide mb-2">
                                                                            Source ({selectedReport.sourceLanguage}): {selectedReport.titleOriginal || selectedReport.title}
                                                                        </p>
                                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide leading-relaxed mb-4">
                                                                            {selectedReport.detailsOriginal || selectedReport.details || 'No original description provided'}
                                                                        </p>
                                                                        <p className="text-xs font-black text-primary uppercase tracking-wide mb-2">
                                                                            English normalized: {selectedReport.titleEnglish || selectedReport.title}
                                                                        </p>
                                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                                                            {selectedReport.detailsEnglish || selectedReport.details || 'No English normalized description available'}
                                                                        </p>
                                                                    </div>
                                                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                                                <button
                                                                    onClick={() => {
                                                                        const blob = new Blob([JSON.stringify(selectedReport, null, 2)], { type: 'application/json' });
                                                                        const url = URL.createObjectURL(blob);
                                                                        const link = document.createElement('a');
                                                                        link.href = url;
                                                                        link.download = `incident-${selectedReport._id}.json`;
                                                                        link.click();
                                                                        URL.revokeObjectURL(url);
                                                                    }}
                                                                    className="w-14 h-14 bg-white border border-border/40 rounded-2xl flex items-center justify-center shadow-sm hover:text-primary transition-all"
                                                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const shareText = `Incident: ${selectedReport.title}\nStatus: ${selectedReport.status}\nSeverity: ${selectedReport.severity}`;
                                                                        navigator.clipboard.writeText(shareText);
                                                                        toast.success("Incident summary copied");
                                                                    }}
                                                                    className="w-14 h-14 bg-white border border-border/40 rounded-2xl flex items-center justify-center shadow-sm hover:text-primary transition-all"
                                                                >
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="bg-white border border-border/40 rounded-2xl p-6 space-y-4">
                                                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Official Actions</h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <button
                                                                disabled={actionLoading}
                                                                onClick={() => updateStatus('investigating')}
                                                                className="px-3 py-3 rounded-xl border border-border/40 text-[9px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                                            >
                                                                Allocate Case
                                                            </button>
                                                            <button
                                                                disabled={actionLoading}
                                                                onClick={() => updateStatus('active')}
                                                                className="px-3 py-3 rounded-xl border border-border/40 text-[9px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                                            >
                                                                Reopen
                                                            </button>
                                                            <button
                                                                disabled={actionLoading}
                                                                onClick={() => updateStatus('resolved')}
                                                                className="px-3 py-3 rounded-xl border border-border/40 text-[9px] font-black uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all disabled:opacity-50"
                                                            >
                                                                Mark Resolved
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current status: {selectedReport.status}</p>
                                                    </div>

                                                    <div className="bg-white border border-border/40 rounded-2xl p-6 space-y-4">
                                                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Allocate Personnel</h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {personnel.slice(0, 4).map((p) => (
                                                                <button
                                                                    key={p._id}
                                                                    disabled={actionLoading}
                                                                    onClick={() => assignPersonnel(p._id)}
                                                                    className="px-3 py-3 rounded-xl border border-border/40 text-left text-[9px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {personnel.length === 0 && (
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No available personnel</p>
                                                        )}
                                                    </div>
                                                </div>

                        {/* AI Analysis Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="plinth-card p-10 bg-white space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                        <Brain className="w-6 h-6 text-indigo-500" />
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Growth vs Mitigation</h3>
                                </div>
                                <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
                                    AI clustering indicates a <span className="text-red-500 font-black">+14.2%</span> growth in signal density within this vector over the last 24 hours. Current mitigation logic suggests a <span className="text-emerald-500 font-black">78%</span> success rate in resolving interdependent infrastructure links.
                                </p>
                                <div className="h-48 w-full bg-slate-50/50 rounded-2xl border border-border/40 flex items-center justify-center border-dashed">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={mockPerformanceData}>
                                            <defs>
                                                <linearGradient id="colorReport" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="active" stroke="#4F46E5" fill="url(#colorReport)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="plinth-card p-10 bg-slate-900 border-none space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                                        <Activity className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Strategic Mitigation</h3>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        { l: "Cluster Impact", v: "High", c: "bg-red-500" },
                                        { l: "Resource Utilization", v: "Optimized", c: "bg-emerald-500" },
                                        { l: "Predicted Recurrence", v: "Low", c: "bg-emerald-500" },
                                    ].map(item => (
                                        <div key={item.l} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{item.l}</span>
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-2 h-2 rounded-full", item.c)} />
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.v}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const blob = new Blob([JSON.stringify(selectedReport, null, 2)], { type: 'application/json' });
                                                                        const url = URL.createObjectURL(blob);
                                                                        const link = document.createElement('a');
                                                                        link.href = url;
                                                                        link.download = `official-incident-report-${selectedReport._id}.json`;
                                                                        link.click();
                                                                        URL.revokeObjectURL(url);
                                                                        toast.success("Official report generated");
                                                                    }}
                                                                    className="w-full bg-primary py-4 rounded-xl text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all"
                                                                >
                                                                        Generate Official Report
                                                                </button>
                            </div>
                        </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="plinth-card p-8 bg-white space-y-4">
                                                        <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Send Existing Resource</h3>
                                                        <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                                                            {availableResources.slice(0, 6).map((resource) => (
                                                                <button
                                                                    key={resource._id}
                                                                    disabled={actionLoading}
                                                                    onClick={() => dispatchResourceToSelected(resource._id)}
                                                                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border/40 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                                                >
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{resource.name}</span>
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{resource.type}</span>
                                                                </button>
                                                            ))}
                                                            {availableResources.length === 0 && (
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No patrol resources available</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="plinth-card p-8 bg-white space-y-4">
                                                        <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Create New Resource</h3>
                                                        <select
                                                            value={newResourceType}
                                                            onChange={(e) => setNewResourceType(e.target.value as "police" | "fire" | "medical" | "public_works" | "drone")}
                                                            className="w-full bg-slate-50 border border-border/40 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            <option value="public_works">Public Works</option>
                                                            <option value="police">Police</option>
                                                            <option value="fire">Fire</option>
                                                            <option value="medical">Medical</option>
                                                            <option value="drone">Drone</option>
                                                        </select>
                                                        <button
                                                            disabled={actionLoading}
                                                            onClick={createAndDispatchNewResource}
                                                            className="w-full bg-slate-900 py-4 rounded-xl text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-black transition-all disabled:opacity-50"
                                                        >
                                                            Create + Dispatch
                                                        </button>
                                                    </div>
                                                </div>

                        {/* Visual Evidence / Timeline */}
                        <div className="space-y-8">
                             <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Life Cycle Log</h3>
                             <div className="space-y-2">
                                {[
                                    { t: "09:42 AM", e: "Signal Induction via AI Engine", s: "complete" },
                                    { t: "10:15 AM", e: "Personnel Relay Assigned: Officer Sarah Chen", s: "complete" },
                                    { t: "10:30 AM", e: "On-Site Mitigation Protocols Active", s: "active" },
                                    { t: "11:45 AM", e: "Strategic Resolution & Archive Sync", s: "pending" },
                                ].map((log, i) => (
                                    <div key={i} className="flex items-center gap-6 p-6 bg-white border border-border/40 rounded-2xl group hover:border-primary/50 transition-all">
                                        <div className="w-20 text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.t}</div>
                                        <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-200 group-hover:border-primary transition-all" />
                                        <div className="flex-1 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">{log.e}</div>
                                        {log.s === 'complete' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                        {log.s === 'active' && <div className="w-2 h-2 rounded-full bg-primary animate-ping" />}
                                    </div>
                                ))}
                             </div>
                        </div>
                    </motion.div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-10 group">
                        <div className="w-32 h-32 rounded-[40px] bg-white shadow-plinth flex items-center justify-center border border-border/40 group-hover:scale-110 transition-transform duration-500">
                            <Archive className="w-14 h-14 text-slate-200 animate-bounce" />
                        </div>
                        <div>
                             <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-4 opacity-20">Select Strategic Signal</h2>
                             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Navigate the index to initialize deep analysis</p>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

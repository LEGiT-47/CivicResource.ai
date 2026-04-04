import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock,
  MapPin,
  Radio,
  Share2,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CityMap from "@/components/CityMap";
import LiveFeed from "@/components/LiveFeed";
import api from "@/lib/api";
import { toast } from "sonner";

const stats = [
  { label: "Active Nodes", value: "14", icon: MapPin, color: "text-primary" },
  { label: "AI Response", value: "1.2s", icon: Zap, color: "text-secondary" },
  { label: "Compliance", value: "98.2%", icon: Shield, color: "text-emerald-500" },
  { label: "Threat Index", value: "LOW", icon: AlertTriangle, color: "text-slate-400" },
];

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<"map" | "analysis">("map");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [feedFilter, setFeedFilter] = useState<"Critical" | "High" | "Resolved" | "Recent">("Recent");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incidentsRes, resourcesRes] = await Promise.all([
          api.get("/incidents"),
          api.get("/resources"),
        ]);
        setIncidents(incidentsRes.data);
        setResources(resourcesRes.data);
      } catch (err) {
        console.error("CommandCenter fetch failed", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const runOptimization = async () => {
    setIsOptimizing(true);
    try {
      const [{ data: latestIncidents }, { data: latestResources }] = await Promise.all([
        api.get("/incidents"),
        api.get("/resources"),
      ]);
      setIncidents(latestIncidents);
      setResources(latestResources);
      await runGlobalAnalysis();
      toast.success("Optimization cycle completed");
    } catch (err) {
      console.error("Optimization cycle failed", err);
      toast.error("Unable to execute optimization");
    } finally {
      setIsOptimizing(false);
    }
  };

  const runGlobalAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data } = await api.post("/dispatch/ai-analyze", {});
      setAnalysisData(data);
      setActiveTab("analysis");
      toast.success("Global analysis initialized");
    } catch (err) {
      console.error("Global analysis failed", err);
      toast.error("Failed to initialize global analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredFeedIncidents = incidents.filter((incident: any) => {
    if (feedFilter === "Critical") return incident.severity === "critical";
    if (feedFilter === "High") return incident.severity === "high";
    if (feedFilter === "Resolved") return incident.status === "resolved";
    return true;
  });

  const sortedFeedIncidents = [...filteredFeedIncidents].sort((a: any, b: any) => {
    if (feedFilter !== "Recent") return 0;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return (
    <div className="flex flex-col min-h-full bg-slate-50/30 font-inter">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-border/40 bg-white">
        {stats.map((item, i) => (
          <div
            key={item.label}
            className={cn("p-8 transition-colors hover:bg-slate-50", i !== stats.length - 1 && "border-r border-border/40")}
          >
            <div className="flex items-center gap-3 mb-2 opacity-60">
              <item.icon className={cn("w-4 h-4", item.color)} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{item.label}</span>
            </div>
            <div className="text-3xl font-black tracking-tighter text-slate-900 tabular-nums">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-visible">
        <div className="flex-1 flex flex-col p-8 gap-8 overflow-visible">
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

          <div className="flex-1 relative tactile-slab border-none overflow-hidden">
            {activeTab === "map" ? (
              <div className="w-full h-full">
                <div className="h-[90vh] min-h-[860px] max-h-[1200px]">
                  <CityMap
                    incidents={incidents}
                    resources={resources}
                    selectedIncidentId={selectedIncidentId}
                    onIncidentSelect={setSelectedIncidentId}
                  />
                </div>

                <div className="bg-white border-t border-border/40 px-6 py-4 flex flex-wrap items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Map Dot Legend</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" /> Fire Units</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#1d4ed8]" /> Police Units</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#059669]" /> Medical Units</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#ff4f00]" /> Critical Incident Pins</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-white/70 border-t border-border/40">
                  <div className="bg-white p-5 rounded-2xl border border-border/40 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span className="text-[10px] font-black tracking-widest uppercase text-slate-900">Optimization Protocol Active</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed mb-5">
                      AI intelligence is evaluating zone urgency and recommending unit allocation.
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

                  <div className="bg-white p-5 rounded-2xl border border-border/40 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 block">Total Signals</span>
                      <span className="text-3xl font-black text-slate-900 leading-none">{incidents.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-primary" />
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
                <button
                  className="btn-tactile"
                  onClick={runGlobalAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Running Analysis..." : "Initialize Global Analysis"}
                </button>

                {analysisData && (
                  <div className="mt-10 w-full bg-white border border-border/40 rounded-2xl p-6 text-left shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4">Strategic Output</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Risk Clusters</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.clusters?.length || 0}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prone Areas</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.proneAreas?.length || 0}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Forecast Zones</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.demandForecast?.length || 0}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">AI Recommendation</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 leading-relaxed">
                      {analysisData?.strategicAdvice || "No strategic recommendation generated."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full xl:w-[420px] bg-white border-l border-border/40 flex flex-col shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.02)] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="p-8 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-slate-900">Live Feedback</span>
            </div>
            <Share2 className="w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-pointer" />
          </div>

          <div className="p-6 bg-slate-50/50 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
            {["Critical", "High", "Resolved", "Recent"].map((stat) => (
              <button
                key={stat}
                onClick={() => setFeedFilter(stat as "Critical" | "High" | "Resolved" | "Recent")}
                className={cn(
                  "px-5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm transition-all",
                  feedFilter === stat ? "bg-primary text-white border-primary" : "bg-white border-border/40 hover:border-primary/50"
                )}
              >
                {stat}
              </button>
            ))}
          </div>

          <div className="h-[440px] xl:h-[460px] overflow-hidden border-y border-border/30">
            <LiveFeed
              incidents={sortedFeedIncidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={setSelectedIncidentId}
              maxItems={6}
            />
          </div>

          <div className="p-8 border-t border-border/40 bg-slate-50/30">
            <div className="flex items-center gap-3 text-slate-400 mb-6">
              <Clock className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Signal Synchronized @ 06:42 PM</span>
            </div>
            <button
              onClick={runGlobalAnalysis}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-between px-8 py-5 rounded-2xl bg-white border-2 border-border/40 text-[10px] font-black uppercase tracking-[0.3em] hover:border-primary group transition-all disabled:opacity-50"
            >
              Initialize Field Protocol <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

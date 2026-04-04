import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MapPin, Zap, AlertTriangle, 
                ChevronRight, Radio, Send, Shield, Activity, Truck,
  CheckCircle, Clock, Filter, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import CityMap from "@/components/CityMap";
import api from "@/lib/api";
import { toast } from "sonner";

export default function DispatchSystem() {
  const [incidents, setIncidents] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
        const [aiPulse, setAiPulse] = useState<any | null>(null);
        const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
    const [incidentSearch, setIncidentSearch] = useState("");
        const [resourceFilter, setResourceFilter] = useState<"All" | "Garbage" | "Water" | "Maintenance" | "Public Works">("All");
        const [showResourceDrawer, setShowResourceDrawer] = useState(false);
        const operationalResources = resources.filter((r) => {
            const name = String(r.name || "").toLowerCase();
            const type = String(r.type || "").toLowerCase();
            return type === "public_works" || name.includes("garbage") || name.includes("water") || name.includes("maintenance") || name.includes("repair");
        });

    const fetchData = async () => {
        try {
                        const [incRes, resourceRes] = await Promise.all([
                api.get('/incidents'),
                api.get('/resources')
            ]);
            setIncidents((incRes.data || []).filter((i: any) => i.status !== 'resolved'));
            setResources(resourceRes.data || []);
        } catch (err) {
            console.error("Dispatch fetch failed", err);
            toast.error("Unable to sync dispatch data");
        }
    };

    const fetchAiPulse = async (silent = true) => {
        try {
            const { data } = await api.post('/dispatch/ai-analyze', {
                liveInputs: {
                    weather_rain_mm: 6,
                    event_factor: 1.15,
                    population_density_boost: 1.05,
                },
            });
            setAiPulse(data);
            if (!silent) {
                toast.success('Live optimization updated');
            }
        } catch (err) {
            if (!silent) {
                toast.error('Unable to refresh live optimization');
            }
            console.error(err);
        }
    };

  useEffect(() => {
    fetchData();
        fetchAiPulse(true);
    const interval = setInterval(fetchData, 10000);
        const pulseInterval = setInterval(() => fetchAiPulse(true), 15000);
        return () => {
            clearInterval(interval);
            clearInterval(pulseInterval);
        };
  }, []);

    const handleAbortProtocol = async () => {
        if (!selectedIncident) {
            toast.error("No active protocol to abort");
            return;
        }

        const abortedTitle = selectedIncident.title;
        setSelectedIncident(null);
        setShowResourceDrawer(false);
        setIsDispatching(false);
        await fetchData();
        toast.success(`Dispatch protocol aborted for: ${abortedTitle}`);
    };

    const handleResourceDispatch = async (resourceId: string, targetIncidentId?: string) => {
        const incidentId = targetIncidentId || selectedIncident?._id;
        if (!incidentId) {
            toast.error("Select an incident to dispatch a resource");
            return;
        }

        try {
            await api.put(`/resources/${resourceId}/dispatch`, { incidentId });
            toast.success("Resource dispatched to selected incident");
            fetchData();
        } catch (err) {
            toast.error("Resource dispatch failed");
            console.error(err);
        }
    };

    const zoneIdForIncident = (incident: any) => {
        const lat = Number(incident?.location?.lat);
        const lng = Number(incident?.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
        return `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
    };

    const liveSuggestions = useMemo(() => {
        if (!aiPulse?.allocationPlan?.length) return [];

        const civicServiceTypes = new Set(['sanitation', 'water', 'roads', 'maintenance', 'utility', 'infrastructure', 'traffic']);
        const unresolved = incidents.filter((i: any) => i.status !== 'resolved' && civicServiceTypes.has(String(i.type || '').toLowerCase()));
        const incidentsByZone = unresolved.reduce((acc: Record<string, any[]>, incident: any) => {
            const key = zoneIdForIncident(incident);
            if (!key) return acc;
            acc[key] = acc[key] || [];
            acc[key].push(incident);
            return acc;
        }, {});

        const resourceById = resources.reduce((acc: Record<string, any>, resource: any) => {
            acc[String(resource._id)] = resource;
            return acc;
        }, {});

        return aiPulse.allocationPlan
            .map((allocation: any) => {
                const resource = resourceById[String(allocation.resource_id)];
                const inZone = incidentsByZone[String(allocation.zone_id)] || [];
                const targetIncident = inZone.sort((a: any, b: any) => {
                    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
                    return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0);
                })[0];

                if (!resource || !targetIncident) return null;
                return {
                    resource,
                    incident: targetIncident,
                    eta: allocation.eta_minutes,
                    predictedTravel: allocation.predicted_travel_time_minutes,
                    routeFactors: allocation.route_factors,
                    rankingScore: allocation.ranking_score,
                    zone: allocation.zone_id,
                    urgency: allocation.urgency_score,
                    explainability: allocation.explainability,
                    preferredFamily: allocation.preferred_family,
                    resourceFamily: allocation.resource_family,
                };
            })
            .filter(Boolean)
            .slice(0, 6);
    }, [aiPulse, incidents, resources]);

    const applyLivePlan = async () => {
        if (!liveSuggestions.length) {
            toast.error('No live allocation suggestions available');
            return;
        }

        setIsApplyingPlan(true);
        try {
            for (const suggestion of liveSuggestions.slice(0, 3)) {
                await api.put(`/resources/${suggestion.resource._id}/dispatch`, { incidentId: suggestion.incident._id });
            }
            await Promise.all([fetchData(), fetchAiPulse(true)]);
            toast.success('Live plan applied to top priority zones');
        } catch (err) {
            console.error(err);
            toast.error('Failed to apply live plan');
        } finally {
            setIsApplyingPlan(false);
        }
    };

    const filteredIncidents = incidents.filter((inc) => {
        const q = incidentSearch.trim().toLowerCase();
        if (!q) return true;
        const title = (inc.title || "").toLowerCase();
        const type = (inc.type || "").toLowerCase();
        const address = (inc.location?.address || "").toLowerCase();
        return title.includes(q) || type.includes(q) || address.includes(q);
    });

    const filteredResources = operationalResources.filter((r) => {
        if (resourceFilter === "All") return true;
        const name = String(r.name || "").toLowerCase();
        const type = String(r.type || "").toLowerCase();
        if (resourceFilter === "Garbage") return name.includes("garbage") || name.includes("trash");
        if (resourceFilter === "Water") return name.includes("water") || name.includes("tanker");
        if (resourceFilter === "Maintenance") return name.includes("maintenance") || name.includes("repair");
        return type === "public_works";
    });

    const typeMatchedResources = filteredResources;

    const formatCoord = (n?: number) => (typeof n === 'number' ? n.toFixed(4) : 'NA');

    const resourcePanel = (
        <>
            <div className="p-8 border-b border-slate-800">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Truck className="w-4 h-4 text-primary" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Resource Matrix</span>
                    </div>
                    <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">{resources.length} Units</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {['All', 'Garbage', 'Water', 'Maintenance', 'Public Works'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setResourceFilter(cat as "All" | "Garbage" | "Water" | "Maintenance" | "Public Works")}
                            className={cn(
                                "flex-1 py-3 items-center rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                                resourceFilter === cat ? "border-primary/40 text-white bg-primary/10" : "border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {typeMatchedResources.map((r) => (
                    <div
                        key={r._id}
                        className="group bg-slate-800/40 border border-slate-800 p-5 rounded-2xl hover:bg-slate-800 hover:border-slate-700 transition-all relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                                    <Truck className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-tight">{r.name}</h4>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{r.type?.replace('_', ' ') || 'resource'} • {r.status}</span>
                                </div>
                            </div>

                            <button
                                disabled={!selectedIncident || isDispatching}
                                onClick={() => handleResourceDispatch(r._id)}
                                className={cn(
                                    "px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    selectedIncident
                                        ? "bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
                                        : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                                )}
                            >
                                Dispatch
                            </button>
                        </div>
                    </div>
                ))}
                {selectedIncident && typeMatchedResources.length === 0 && (
                    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-xs font-bold uppercase tracking-wider">
                        No available resources right now.
                    </div>
                )}
            </div>

            <div className="p-8 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between text-slate-500 uppercase font-black text-[9px] tracking-widest mb-6 px-2">
                    <span>Network Stability</span>
                    <span className="text-emerald-500">99.98%</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "99.98%" }}
                        className="h-full bg-primary"
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className="relative flex min-h-screen bg-slate-50/30 overflow-y-auto font-inter">
      {/* ── LEFT: Incident Triage Cluster ──────────────────────────────────── */}
    <div className="w-full max-w-[480px] bg-white border-r border-border/40 flex flex-col shadow-2xl">
         <div className="p-8 border-b border-border/40 bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Radio className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                               <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Dispatch Relay</h2>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Resource Allocation Matrix</p>
                </div>
            </div>
            
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input 
                    type="text" 
                    placeholder="Filter Incidents..." 
                    value={incidentSearch}
                    onChange={(e) => setIncidentSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-border/40 rounded-2xl py-4 pl-12 pr-6 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <AnimatePresence mode="popLayout">
                {filteredIncidents.map((inc) => (
                    <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={inc._id}
                        onClick={() => setSelectedIncident(inc)}
                        className={cn(
                            "group p-6 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden",
                            selectedIncident?._id === inc._id 
                                ? "bg-white border-primary shadow-2xl shadow-primary/10 scale-[1.02]" 
                                : "bg-white/50 border-border/40 hover:border-slate-300 hover:bg-white"
                        )}
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border",
                                        inc.severity === 'critical' ? "bg-red-50 text-red-600 border-red-100" : "bg-primary/5 text-primary border-primary/10"
                                    )}>
                                        {inc.severity}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{inc.type}</span>
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{inc.title}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                <ChevronRight className={cn("w-4 h-4 transition-transform", selectedIncident?._id === inc._id ? "text-primary" : "text-slate-300")} />
                            </div>
                        </div>
                        
                        <div className="mt-4 flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> {inc.location.address?.split(',')[0] || "Unknown Vector"}
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3" /> 2m ago
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
            {incidents.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <CheckCircle className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">All Incident Signals Cleared</p>
                </div>
            )}
            {incidents.length > 0 && filteredIncidents.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <Filter className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No incidents match current filter</p>
                </div>
            )}
         </div>
      </div>

      {/* ── CENTER: Visual Relay ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
                 <div className="p-8 border-b border-border/40 bg-white">
                        <div className="h-[620px] rounded-3xl overflow-hidden border border-border/40">
                            <CityMap incidents={[...incidents, ...(selectedIncident ? [selectedIncident] : [])]} resources={operationalResources} />
                        </div>

                        <AnimatePresence>
                            {selectedIncident && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="mt-6 bg-white border-2 border-primary/20 rounded-3xl p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.12)] flex items-center justify-between gap-6"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
                                            <Send className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] block mb-2">Protocol: Unit Assignment</span>
                                            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none mb-2">Execute Dispatch</h2>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assign available field assets to <span className="text-slate-900">{selectedIncident.title}</span></p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAbortProtocol}
                                        className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all text-slate-500"
                                    >
                                        Abort Protocol
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-6 bg-white border border-border/40 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Smart Allocation Suggestions</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto every 15s</span>
                                    <button
                                        onClick={() => fetchAiPulse(false)}
                                        className="px-3 py-2 rounded-lg border border-border/40 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-primary hover:text-primary transition-all"
                                    >
                                        Refresh AI
                                    </button>
                                    <button
                                        onClick={applyLivePlan}
                                        disabled={isApplyingPlan || liveSuggestions.length === 0}
                                        className="px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                                    >
                                        {isApplyingPlan ? 'Applying...' : 'Apply Live Plan'}
                                    </button>
                                </div>
                            </div>

                            {liveSuggestions.length === 0 ? (
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No live recommendations yet. Run refresh to generate optimization.</p>
                            ) : (
                                <div className="space-y-2">
                                    {liveSuggestions.map((s: any) => (
                                        <div key={`${s.resource._id}-${s.incident._id}`} className="p-3 rounded-xl border border-border/30 bg-slate-50/50 flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{s.resource.name}{' -> '}{s.incident.title}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Zone {s.zone} • Route ETA {s.predictedTravel || s.eta}m • Urgency {Number(s.urgency || 0).toFixed(1)}</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Explainability Score {s.explainability?.score ?? '--'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Rank {s.rankingScore ?? '--'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Need {s.preferredFamily || 'general'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Unit {s.resourceFamily || 'general'}
                                                    </span>
                                                </div>
                                                {Array.isArray(s.explainability?.why) && s.explainability.why.length > 0 && (
                                                    <p className="mt-2 text-[9px] font-bold text-slate-600 uppercase tracking-wide">
                                                        {s.explainability.why[0]}
                                                    </p>
                                                )}
                                                {s.routeFactors && (
                                                    <p className="mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                                        Traffic x{Number(s.routeFactors.trafficIndex || 1).toFixed(2)} • Road x{Number(s.routeFactors.roadConditionIndex || 1).toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleResourceDispatch(s.resource._id, s.incident._id)}
                                                className="px-3 py-2 rounded-lg border border-border/40 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-primary hover:text-primary transition-all"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 bg-white border border-border/40 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Seeded Resource Preview</h3>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{operationalResources.length} units</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-left">
                                    <thead>
                                        <tr className="border-b border-border/40">
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Resource</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Type</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Current Position</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Destination</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {operationalResources.map((r: any) => (
                                            <tr key={r._id} className="border-b border-border/20">
                                                <td className="py-3 pr-4 text-[11px] font-black uppercase tracking-wide text-slate-900">{r.name}</td>
                                                <td className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-500">{r.type.replace('_', ' ')}</td>
                                                <td className="py-3 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    {formatCoord(r.location?.lat)}, {formatCoord(r.location?.lng)}
                                                </td>
                                                <td className="py-3 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    {r.currentIncident?.location
                                                        ? `${formatCoord(r.currentIncident.location.lat)}, ${formatCoord(r.currentIncident.location.lng)}`
                                                        : 'Patrol Loop'}
                                                    {r.currentIncident?.location?.address ? ` (${r.currentIncident.location.address})` : ''}
                                                </td>
                                                <td className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest">
                                                    <span className={cn(
                                                        'px-2 py-1 rounded-lg border',
                                                        r.status === 'dispatched' ? 'text-primary border-primary/20 bg-primary/5' : 'text-slate-500 border-slate-200 bg-slate-50'
                                                    )}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <button
                                                        onClick={() => handleResourceDispatch(r._id)}
                                                        disabled={!selectedIncident || isDispatching || r.status === 'dispatched'}
                                                        className="px-3 py-2 rounded-lg border border-border/40 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                                    >
                                                        Send Unit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                 </div>
      </div>

            {/* Right-edge arrow toggle */}
                <button
                onClick={() => setShowResourceDrawer((v) => !v)}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-[1210] w-10 h-16 rounded-l-xl bg-slate-900 text-white text-xl font-black shadow-2xl border border-slate-700 border-r-0"
                aria-label={showResourceDrawer ? "Close resource matrix" : "Open resource matrix"}
            >
                {showResourceDrawer ? ">" : "<"}
            </button>

            <AnimatePresence>
                {showResourceDrawer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowResourceDrawer(false)}
                            className="fixed inset-0 bg-black/40 z-[1190]"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 280, damping: 28 }}
                            className="fixed top-0 right-0 h-full w-[min(92vw,420px)] bg-slate-900 border-l border-slate-800 z-[1200] flex flex-col shadow-2xl"
                        >
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Resource Matrix</span>
                                <button
                                    onClick={() => setShowResourceDrawer(false)}
                                    className="px-3 py-2 rounded-lg border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
                                >
                                    Close
                                </button>
                            </div>
                            {resourcePanel}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
    </div>
  );
}

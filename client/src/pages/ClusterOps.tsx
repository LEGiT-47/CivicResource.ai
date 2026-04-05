import { type ComponentType, useState } from "react";
import { Layers3, Loader2, Route, Users, Waves, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

type ClusterIncident = {
  id: string;
  title: string;
  severity: string;
  stopOrder: number;
  demandUnits: number;
  demandUnitLabel: string;
  location?: { address?: string };
};

type ClusterPlan = {
  clusterId: string;
  serviceFamily: string;
  radiusKm: number;
  applyEligible?: boolean;
  capacityOverrun?: boolean;
  rankingScore?: number;
  aiFeasibilityScore?: number;
  feasibilityProbability?: number;
  aiFeasibilitySource?: string;
  incidents: ClusterIncident[];
  explainability: string[];
  capacity: {
    units: number;
    used: number;
    unitLabel: string;
    utilizationPercent: number;
    maxStops: number;
    plannedStops: number;
    crewSize: number;
    shiftRemainingMinutes: number;
    refillMinutes: number;
  };
  assignment: {
    resource: { id: string; name: string; type: string } | null;
    personnel: { id: string; name: string; type: string; unitId?: string } | null;
  };
};

type AppliedClusterSummary = {
  clusterId: string;
  serviceFamily: string;
  incidents: ClusterIncident[];
  assignment: ClusterPlan['assignment'];
};

const familyIcon: Record<string, ComponentType<{ className?: string }>> = {
  water: Waves,
  garbage: Trash2,
  maintenance: Wrench,
  general: Layers3,
};

export default function ClusterOps() {
  const [radiusKm, setRadiusKm] = useState(4);
  const [maxClusters, setMaxClusters] = useState(8);
  const [loading, setLoading] = useState(false);
  const [applyingClusterId, setApplyingClusterId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterPlan[]>([]);
  const [appliedClusters, setAppliedClusters] = useState<AppliedClusterSummary[]>([]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/dispatch/group-clusters/recommend", {
        radiusKm,
        maxClusters,
        minIncidentsPerCluster: 2,
        includeDispatched: false,
      });
      setClusters(data?.clusters || []);
      toast.success(`Generated ${data?.summary?.clusters || 0} grouped cluster plan(s)`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate grouped plans");
    } finally {
      setLoading(false);
    }
  };

  const applyCluster = async (cluster: ClusterPlan) => {
    setApplyingClusterId(cluster.clusterId);
    try {
      const { data } = await api.post("/dispatch/group-clusters/apply", { cluster });
      toast.success(data?.message || "Grouped cluster applied");
      if (data?.clusterId) {
        setAppliedClusters((current) => {
          const nextEntry: AppliedClusterSummary = {
            clusterId: String(data.clusterId),
            serviceFamily: cluster.serviceFamily,
            incidents: cluster.incidents,
            assignment: cluster.assignment,
          };
          return [nextEntry, ...current.filter((item) => item.clusterId !== nextEntry.clusterId)].slice(0, 5);
        });
      }
      await generate();
    } catch (error) {
      console.error(error);
      toast.error("Failed to apply grouped cluster");
    } finally {
      setApplyingClusterId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 min-h-full">
      {appliedClusters.length > 0 ? (
        <section className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-2xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Recently Applied Cluster</p>
              <h2 className="text-2xl font-black tracking-tight mt-1">Applied cluster summary</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/80">
              Visible until refresh
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {appliedClusters.map((cluster) => (
              <div key={cluster.clusterId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Cluster {cluster.clusterId} formed</p>
                    <h3 className="text-lg font-black mt-1">{cluster.serviceFamily} response</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    {cluster.incidents.length} stop{cluster.incidents.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {cluster.incidents.map((incident, index) => (
                    <div key={incident.id} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                      <p className="text-[11px] font-black uppercase tracking-widest text-white">
                        {index + 1}. {incident.title}
                      </p>
                      <p className="text-[10px] text-white/70 mt-1 uppercase tracking-wider">
                        {incident.location?.address || "Address unavailable"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-[11px] font-bold text-white/75 uppercase tracking-widest">
                  Assigned: {cluster.assignment.personnel?.name || "Auto-pick at apply time"} | Resource: {cluster.assignment.resource?.name || "No compatible resource"}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-8">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Capacity-Aware Dispatch Grouping</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-1">Cluster Operations</h1>
            <p className="text-sm text-slate-600 mt-2">
              Groups nearby complaints by service family and enforces tanker or truck capacity constraints before assignment.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Radius (km)
              <input
                type="number"
                min={1}
                max={10}
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value || 4))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Max Clusters
              <input
                type="number"
                min={1}
                max={20}
                value={maxClusters}
                onChange={(event) => setMaxClusters(Number(event.target.value || 8))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={generate}
              disabled={loading}
              className="h-fit self-end px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black uppercase tracking-wider hover:bg-black disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers3 className="w-4 h-4" />}
              Generate
            </button>
          </div>
        </div>
      </section>

      {clusters.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-10 text-center text-slate-500 text-sm">
          Generate a plan to see grouped complaint clusters.
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {clusters.map((cluster) => {
            const Icon = familyIcon[cluster.serviceFamily] || Layers3;
            return (
              <article key={cluster.clusterId} className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-black uppercase tracking-wider">
                      <Icon className="w-3.5 h-3.5" /> {cluster.serviceFamily}
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-2">Cluster {cluster.clusterId} formed</h2>
                    <p className="text-xs text-slate-500 mt-1">Radius {cluster.radiusKm} km</p>
                  </div>
                  <button
                    onClick={() => applyCluster(cluster)}
                    disabled={Boolean(applyingClusterId) || cluster.applyEligible === false}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {applyingClusterId === cluster.clusterId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Route className="w-4 h-4" />}
                    {cluster.applyEligible === false ? "Blocked" : "Apply"}
                  </button>
                </div>

                {cluster.applyEligible === false ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-semibold">
                    Apply blocked: cluster exceeds capacity or lacks a compatible resource. Split/re-plan this cluster first.
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-slate-500 uppercase tracking-wider">Capacity</p>
                    <p className="font-black text-slate-900 mt-1">
                      {cluster.capacity.used} / {cluster.capacity.units} {cluster.capacity.unitLabel}
                    </p>
                    <p className="text-slate-600 mt-1">{cluster.capacity.utilizationPercent}% utilized</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-slate-500 uppercase tracking-wider">Crew/Stops</p>
                    <p className="font-black text-slate-900 mt-1">
                      {cluster.capacity.crewSize} crew | {cluster.capacity.plannedStops}/{cluster.capacity.maxStops} stops
                    </p>
                    <p className="text-slate-600 mt-1">Shift left: {cluster.capacity.shiftRemainingMinutes}m</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-emerald-700 uppercase tracking-wider font-bold">AI Feasibility</p>
                    <p className="font-black text-emerald-900 mt-1">{cluster.aiFeasibilityScore ?? 0}/100</p>
                    <p className="text-emerald-700 mt-1">{Math.round((cluster.feasibilityProbability ?? 0) * 100)}% probability</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                    <p className="text-blue-700 uppercase tracking-wider font-bold">Final Rank</p>
                    <p className="font-black text-blue-900 mt-1">{cluster.rankingScore ?? 0}/100</p>
                    <p className="text-blue-700 mt-1">{cluster.aiFeasibilitySource || 'trained-model'}</p>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1">
                  <p className="font-black text-slate-800 uppercase tracking-wider">Recommended Assignment</p>
                  <p>
                    Resource: {cluster.assignment.resource?.name || "No compatible resource"}
                  </p>
                  <p>
                    <Users className="w-3.5 h-3.5 inline-block mr-1" />
                    Personnel: {cluster.assignment.personnel?.name || "Auto-pick at apply time"}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {cluster.incidents.map((incident) => (
                    <div key={incident.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-900 text-sm">Cluster {cluster.clusterId} formed {incident.stopOrder}/{cluster.incidents.length} - {incident.title}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase font-bold">{incident.severity}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Demand: {incident.demandUnits} {incident.demandUnitLabel}
                      </p>
                      {incident.location?.address ? <p className="text-xs text-slate-500 mt-1">{incident.location.address}</p> : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 space-y-1">
                  {cluster.explainability.map((line, idx) => (
                    <p key={`${cluster.clusterId}-${idx}`}>• {line}</p>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Layers, MapPin, Truck, Flame, Eye, EyeOff, Settings2, AlertTriangle, Crosshair, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { clusters as mockClusters } from "@/lib/mockData";

const MAP_W = 800;
const MAP_H = 500;
const LAT_MIN = 40.730;
const LAT_MAX = 40.765;
const LNG_MIN = -74.000;
const LNG_MAX = -73.968;

function toXY(lat: number, lng: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return { x, y };
}

const priorityFill: Record<string, string> = {
  critical: "#FF4F00",
  high: "#F59E0B",
  medium: "#4F46E5",
  low: "#10B981",
};

interface Tooltip {
  x: number;
  y: number;
  content: React.ReactNode;
}

export default function CityMap({ incidents }: { incidents: any[] }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTrucks, setShowTrucks] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const showClusters = zoomLevel < 0.8;

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i <= 10; i++) {
      lines.push({ x1: (i / 10) * MAP_W, y1: 0, x2: (i / 10) * MAP_W, y2: MAP_H });
      lines.push({ x1: 0, y1: (i / 10) * MAP_H, x2: MAP_W, y2: (i / 10) * MAP_H });
    }
    return lines;
  }, []);

  const handleClusterHover = useCallback((e: React.MouseEvent, cluster: typeof mockClusters[0]) => {
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      content: (
        <div className="space-y-1">
          <p className="font-black text-[12px] text-slate-900 uppercase tracking-tight">Sector {cluster.id} Vector</p>
          <div className="h-0.5 bg-slate-100 my-2" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority Index: <span className="text-primary">{(cluster.priorityScore / 10).toFixed(1)}/10</span></p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logic Forecast: <span className="text-secondary">+{cluster.predictedDemand} Unit Load</span></p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cluster.count} Active Signals</p>
        </div>
      ),
    });
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-white relative">
      <div className="flex-1 relative overflow-hidden bg-white group cursor-crosshair">
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-full" onMouseLeave={() => setTooltip(null)}>
          {/* Global Architectural Grid */}
          {gridLines.map((l, i) => (
            <line key={i} {...l} stroke="#F1F5F9" strokeWidth="1" />
          ))}

          {/* District Chassis (Grayscale) */}
          <path 
            d="M50,100 L150,120 L200,80 L350,100 L400,200 L300,350 L100,300 Z" 
            fill="#F8FAFC" 
            stroke="#E2E8F0" 
            strokeWidth="3" 
            strokeDasharray="10 5"
          />

          {/* Heatmap zones: The Triage Layer */}
          {showHeatmap &&
            incidents.map((inc) => {
              if(!inc.location?.lat) return null;
              const { x, y } = toXY(inc.location.lat, inc.location.lng);
              const severityWeight = inc.severity === "critical" ? 1.2 : inc.severity === "high" ? 0.8 : 0.4;
              const r = severityWeight * 50; // Dynamic radius for visual heatmap
              
              return (
                <g key={`heat-${inc._id}`}>
                  <defs>
                    <radialGradient id={`heat-grad-${inc._id}`}>
                      <stop offset="0%" stopColor={priorityFill[inc.severity] || "#4F46E5"} stopOpacity="0.2" />
                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle
                    cx={x} cy={y} r={r}
                    fill={`url(#heat-grad-${inc._id})`}
                    className="animate-pulse"
                  />
                </g>
              );
            })}

          {/* Incident pins: High-Contrast Operational Data */}
          {showPins && !showClusters &&
            incidents.map((inc) => {
              if(!inc.location?.lat) return null;
              const { x, y } = toXY(inc.location.lat, inc.location.lng);
              return (
                <g key={inc._id}>
                  <circle cx={x} cy={y} r={inc.severity === "critical" ? 8 : 5} fill={priorityFill[inc.severity] || priorityFill.medium} stroke="#FFF" strokeWidth="2" className="shadow-lg">
                    {inc.severity === "critical" && (
                      <animate attributeName="r" values="6;10;6" dur="1.5s" repeatCount="indefinite" />
                    )}
                  </circle>
                </g>
              );
            })}

          {/* Logistics Units */}
          {showTrucks &&
            [].map((truck: any) => { // Resources would go here if passed as prop
              if(!truck.location?.lat) return null;
              const { x, y } = toXY(truck.location.lat, truck.location.lng);
              return (
                <g key={truck._id}>
                   <rect x={x - 8} y={y - 5} width="16" height="10" rx="3" fill="#111827" />
                   <circle cx={x} cy={y} r={1.5} fill="#FFF" />
                </g>
              );
            })}
        </svg>

        {/* Global Blueprint Controls */}
        <div className="absolute top-8 left-8 flex flex-col gap-4">
           <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-plinth border border-border/40 space-y-1">
              <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-lg shadow-primary/20 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">District 07 Relay</span>
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Operational Scale: {zoomLevel.toFixed(1)}x</p>
           </div>
           
           <div className="flex flex-col gap-2">
              {[
                { id: 'h', icon: Flame, active: showHeatmap, toggle: () => setShowHeatmap(!showHeatmap) },
                { id: 'p', icon: MapPin, active: showPins, toggle: () => setShowPins(!showPins) },
                { id: 't', icon: Truck, active: showTrucks, toggle: () => setShowTrucks(!showTrucks) },
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={btn.toggle}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all border shadow-plinth",
                    btn.active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-border/40 hover:bg-slate-50"
                  )}
                >
                  <btn.icon className="w-5 h-5" />
                </button>
              ))}
           </div>
        </div>

        {/* Tactical Status Overlay */}
        <div className="absolute bottom-10 right-10 flex flex-col items-end gap-3 pointer-events-none">
           <div className="bg-slate-900 px-6 py-4 rounded-2xl shadow-plinth flex items-center gap-4 pointer-events-auto group hover:scale-105 transition-transform">
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Signal Triage Intensity</span>
                 <span className="text-xl font-black text-white tabular-nums tracking-tighter">{(incidents.length * 0.42).toFixed(2)}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                 <Activity className="w-5 h-5 text-white" />
              </div>
           </div>
           <div className="bg-white/90 backdrop-blur-md px-5 py-3 rounded-xl border border-border/40 shadow-plinth flex gap-5 pointer-events-auto">
              {(["critical", "high", "medium"] as const).map((p) => (
                <div key={p} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: priorityFill[p] }} />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">{p}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Floating Tooltip Matrix */}
        {tooltip && (
          <div
            className="fixed z-50 plinth-card p-6 pointer-events-none bg-white/95 backdrop-blur-md border-primary/20 shadow-2xl"
            style={{ left: tooltip.x + 24, top: tooltip.y - 24 }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
}

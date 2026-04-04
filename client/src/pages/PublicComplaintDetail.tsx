import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Shield, Ticket } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

export default function PublicComplaintDetail() {
  const { id } = useParams();
  const [incident, setIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIncident = async () => {
      try {
        const { data } = await api.get(`/public/incidents/${id}`);
        setIncident(data || null);
      } catch (error) {
        console.error("Public complaint detail load failed", error);
        setIncident(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadIncident();
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading complaint...</div>;
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto bg-white border border-border/40 rounded-3xl p-10 text-center">
          <p className="text-lg font-bold text-slate-700 mb-6">Complaint not found.</p>
          <Link to="/archive" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold">
            <ArrowLeft className="w-4 h-4" /> Back to Archive
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/archive" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-slate-900 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="bg-white border border-border/40 rounded-[2rem] p-8 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">{incident.type}</p>
              <h1 className="text-4xl font-black text-slate-900 leading-tight">{incident.title}</h1>
            </div>
            <span className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em]",
              incident.status === "resolved" ? "bg-emerald-50 text-emerald-600" : incident.status === "investigating" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
            )}>
              {incident.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {incident.location?.address || "Location pending"}</div>
            <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> {incident.severity}</div>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {new Date(incident.createdAt).toLocaleString()}</div>
          </div>

          <div className="rounded-2xl border border-border/40 p-6 bg-slate-50/40">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Complaint Details</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {incident.detailsEnglish || incident.details || "No additional details provided."}
            </p>
          </div>

          <div className="rounded-2xl border border-border/40 p-6 bg-white">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Tracking ID</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" /> {incident.trackingId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
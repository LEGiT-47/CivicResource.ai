import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Shield, Clock, ArrowRight, Ticket, Phone, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ComplaintTracker() {
  const [trackingId, setTrackingId] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { citizenRating: number; success: boolean; followUpNotes: string }>>({});
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState<string | null>(null);

  const handleTrack = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/public/incidents/track", {
        params: {
          trackingId: trackingId.trim(),
          phone: phone.trim(),
        },
      });
      setResults(data || []);
    } catch (error) {
      console.error("Complaint tracking failed", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (incident: any) => {
    const draft = feedbackDraft[incident._id] || { citizenRating: 5, success: true, followUpNotes: "" };
    setSubmittingFeedbackId(incident._id);
    try {
      const { data } = await api.post(`/public/incidents/${incident._id}/feedback`, draft);
      const updated = data?.incident;
      if (updated?._id) {
        setResults((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      }
      toast.success("Thank you. Your feedback improved dispatch learning.");
    } catch (error) {
      console.error("Feedback submit failed", error);
      toast.error("Unable to save feedback right now");
    } finally {
      setSubmittingFeedbackId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-border/40 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
            <Ticket className="w-4 h-4" /> Complaint Tracker
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-none mb-4">
            Check your complaint without logging in.
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-2xl leading-relaxed">
            Enter your tracking ID or mobile number to see the latest complaint status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-[1.5rem] border border-border/40 p-5">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 block">Tracking ID</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="CF-..."
                className="w-full rounded-2xl border border-border/40 py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>
          <div className="bg-white rounded-[1.5rem] border border-border/40 p-5">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 block">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional if you have the tracking ID"
                className="w-full rounded-2xl border border-border/40 py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-10">
          <button
            onClick={handleTrack}
            disabled={loading || (!trackingId.trim() && !phone.trim())}
            className="px-6 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? "Searching..." : "Track Complaint"} <ArrowRight className="w-4 h-4" />
          </button>
          <Link to="/complaint" className="px-6 py-4 rounded-2xl bg-white border border-border/40 text-slate-700 text-[10px] font-black uppercase tracking-[0.3em]">
            File a New Complaint
          </Link>
          <Link to="/archive" className="px-6 py-4 rounded-2xl bg-white border border-border/40 text-slate-700 text-[10px] font-black uppercase tracking-[0.3em]">
            Public Archive
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {results.map((item) => (
            <div key={item._id} className="bg-white rounded-[1.5rem] border border-border/40 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">{item.type}</p>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">{item.title}</h2>
                  <p className="text-sm text-slate-600 mt-3 max-w-3xl leading-relaxed">{item.detailsEnglish || item.details || "No additional description stored."}</p>
                </div>
                <div className={cn(
                  "px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.3em]",
                  item.status === "resolved" ? "bg-emerald-50 text-emerald-600" : item.status === "investigating" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                )}>
                  {item.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {item.location?.address || "Location pending"}</div>
                <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> {item.severity}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {new Date(item.createdAt).toLocaleString()}</div>
              </div>

              {Array.isArray(item.timeline) && item.timeline.length > 0 && (
                <div className="mt-5 rounded-2xl border border-border/40 p-4 bg-slate-50/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Public Transparency Timeline</p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {item.timeline.map((step: any) => (
                      <div
                        key={step.key}
                        className={cn(
                          "rounded-xl border px-3 py-2",
                          step.done ? "bg-emerald-50 border-emerald-200" : "bg-white border-border/40"
                        )}
                      >
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", step.done ? "text-emerald-700" : "text-slate-500")}>{step.label}</p>
                        <p className="mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide">{step.timestamp ? new Date(step.timestamp).toLocaleString() : "Pending"}</p>
                        <p className="mt-1 text-[9px] font-bold text-slate-500">{step.explanation}</p>
                        {step.confidence ? <p className="mt-1 text-[9px] font-black text-primary uppercase tracking-wide">AI {step.confidence}%</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.status === "resolved" && !item?.outcomeLearning?.citizenRating && (
                <div className="mt-5 rounded-2xl border border-border/40 p-4 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Was This Complaint Fixed Properly?</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={feedbackDraft[item._id]?.citizenRating ?? 5}
                      onChange={(e) =>
                        setFeedbackDraft((prev) => ({
                          ...prev,
                          [item._id]: {
                            citizenRating: Number(e.target.value),
                            success: prev[item._id]?.success ?? true,
                            followUpNotes: prev[item._id]?.followUpNotes ?? "",
                          },
                        }))
                      }
                      className="rounded-xl border border-border/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <option key={rating} value={rating}>{rating} Star</option>
                      ))}
                    </select>
                    <select
                      value={(feedbackDraft[item._id]?.success ?? true) ? "yes" : "no"}
                      onChange={(e) =>
                        setFeedbackDraft((prev) => ({
                          ...prev,
                          [item._id]: {
                            citizenRating: prev[item._id]?.citizenRating ?? 5,
                            success: e.target.value === "yes",
                            followUpNotes: prev[item._id]?.followUpNotes ?? "",
                          },
                        }))
                      }
                      className="rounded-xl border border-border/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      <option value="yes">Fixed</option>
                      <option value="no">Not Fixed</option>
                    </select>
                    <button
                      onClick={() => submitFeedback(item)}
                      disabled={submittingFeedbackId === item._id}
                      className="rounded-xl bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {submittingFeedbackId === item._id ? "Saving..." : "Submit Feedback"}
                    </button>
                  </div>
                  <textarea
                    value={feedbackDraft[item._id]?.followUpNotes ?? ""}
                    onChange={(e) =>
                      setFeedbackDraft((prev) => ({
                        ...prev,
                        [item._id]: {
                          citizenRating: prev[item._id]?.citizenRating ?? 5,
                          success: prev[item._id]?.success ?? true,
                          followUpNotes: e.target.value,
                        },
                      }))
                    }
                    placeholder="Optional notes for operations quality"
                    className="mt-3 w-full rounded-xl border border-border/40 p-3 text-[11px]"
                  />
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tracking ID: <span className="text-slate-900">{item.trackingId || "Pending"}</span></p>
                <Link to={`/archive/${item._id}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:text-slate-900">
                  View
                </Link>
              </div>
            </div>
          ))}

          {results.length === 0 && (
            <div className="bg-white rounded-[1.5rem] border border-border/40 p-10 text-center text-slate-500">
              Search for a complaint using a tracking ID or phone number.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
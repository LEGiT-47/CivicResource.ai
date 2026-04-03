import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, MapPin, Camera, AlertTriangle, 
  CheckCircle, ArrowRight, ArrowLeft, Info,
  Search, Crosshair, Send, Zap, FileText, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

const types = [
  { id: "infrastructure", label: "Infrastructure", icon: Shield, color: "text-primary", bg: "bg-primary/5" },
  { id: "safety", label: "Public Safety", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50/50" },
  { id: "sanitation", label: "Sanitation", icon: MapPin, color: "text-secondary", bg: "bg-secondary/5" },
  { id: "utility", label: "Utility Fault", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50/50" },
];

export default function CitizenReport() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    location: { address: "" },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.post("/incidents", {
        ...formData,
        severity: "medium",
        status: "pending"
      });
      setStep(4);
    } catch (err) {
      console.error("Incident report failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50/30 font-inter">
      {/* ── PROGRESS BAR ─────────────────────────────────────────────────── */}
      <div className="h-2 flex w-full">
         {[1,2,3,4].map(i => (
           <div key={i} className={cn(
             "h-full flex-1 transition-all duration-700",
             step >= i ? "bg-primary shadow-[0_0_15px_rgba(255,79,0,0.4)]" : "bg-slate-200"
           )} />
         ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl w-full text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-white shadow-plinth flex items-center justify-center mx-auto mb-10">
                 <Shield className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 mb-6 leading-none">Induct Signal</h1>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-16 leading-relaxed">
                 Identify the core sector protocol for this operational observation.
              </p>

              <div className="grid grid-cols-2 gap-6">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setFormData({ ...formData, type: t.id }); setStep(2); }}
                    className={cn(
                      "p-10 rounded-[2.5rem] bg-white border-2 border-transparent shadow-tactile transition-all hover:border-primary hover:scale-[1.02] flex flex-col items-center group",
                      formData.type === t.id && "border-primary shadow-plinth"
                    )}
                  >
                    <div className={cn("w-20 h-20 rounded-[1.8rem] flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform", t.bg)}>
                      <t.icon className={cn("w-8 h-8", t.color)} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-slate-900 transition-colors">{t.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl w-full"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-3 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white text-sm">02</div> Protocol Analytics
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12">Submit technical metadata for the operational node.</p>

              <div className="space-y-8">
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2 italic">Incident Header</label>
                   <input
                     placeholder="e.g., Pothole detected on District 7 highway..."
                     className="concierge-input w-full"
                     value={formData.title}
                     onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                   />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2 italic">Analytical Breakdown</label>
                   <textarea
                     placeholder="Provide comprehensive situational metrics..."
                     className="concierge-input w-full min-h-[160px] resize-none"
                     value={formData.description}
                     onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                   />
                </div>
                
                <div className="flex gap-4 pt-4">
                   <button onClick={() => setStep(1)} className="flex-1 py-5 rounded-2xl bg-white border border-border/60 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                       <ArrowLeft className="w-4 h-4" /> Revert
                   </button>
                   <button 
                    disabled={!formData.title || !formData.description}
                    onClick={() => setStep(3)} 
                    className="flex-[2] py-5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed group"
                   >
                       Proceed to Geospatial <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                   </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl w-full"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-10 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white text-sm">03</div> Geospatial Target
              </h2>
              
              <div className="space-y-8">
                 <div className="relative group">
                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary" />
                    <input
                      placeholder="Induct Physical Coordinates..."
                      className="concierge-input w-full pl-16 pr-24"
                      value={formData.location.address}
                      onChange={(e) => setFormData({ ...formData, location: { address: e.target.value } })}
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary/10 text-[9px] font-black text-primary uppercase rounded-xl hover:bg-primary/20 transition-all">
                       <Crosshair className="w-3.5 h-3.5 inline mr-1" /> GPS
                    </button>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <button className="flex flex-col items-center justify-center p-8 rounded-3xl bg-white border border-border/50 shadow-tactile group hover:border-primary transition-all">
                       <Camera className="w-8 h-8 text-slate-400 mb-4 group-hover:text-primary transition-colors" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Visual Record</span>
                    </button>
                    <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-50 border border-slate-200 border-dashed">
                        <Info className="w-8 h-8 text-slate-300 mb-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Auth Signature</span>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-10">
                    <button onClick={() => setStep(2)} className="flex-1 py-5 rounded-2xl bg-white border border-border/60 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Revert
                    </button>
                    <button 
                      onClick={handleSubmit}
                      disabled={isSubmitting || !formData.location.address}
                      className="flex-[2] py-5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:bg-primary/95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isSubmitting ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isSubmitting ? "TRANSMITTING..." : "Finalize Induction"}
                    </button>
                 </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl w-full text-center"
            >
              <div className="w-32 h-32 rounded-[2.5rem] bg-emerald-500 shadow-2xl shadow-emerald-500/30 flex items-center justify-center mx-auto mb-10">
                 <CheckCircle className="w-14 h-14 text-white" />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-6">Signal Synchronized</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-12 leading-relaxed">
                 Your operational node has been broadcasted to the Strategic Command Center. District 7 response units are now calibrating.
              </p>
              
              <div className="plinth-card bg-white p-8 text-left mb-12 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4">
                    <FileText className="w-10 h-10 text-slate-50" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-5 block">Protocol Receipt #704-INDX</span>
                 <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{formData.title}</h4>
                 <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-6 italic">{formData.location.address}</p>
                 <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Status: Operational Transit
                 </div>
              </div>

              <button 
                onClick={() => { setStep(1); setFormData({ title: "", description: "", type: "", location: { address: "" } }); }}
                className="w-full py-6 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-plinth transition-all hover:bg-black active:scale-[0.98]"
              >
                 Authorize New Induction
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="p-8 border-t border-border/40 text-center">
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] flex items-center justify-center gap-3">
            <Shield className="w-4 h-4 opacity-30" /> CivicFlow Field Protocol Registry v2.4.1
         </p>
      </footer>
    </div>
  );
}

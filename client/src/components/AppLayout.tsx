import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Map, BarChart3, FileText, Truck, AlertTriangle, 
  Menu, X, Zap, LogOut, Bell, User, Settings, ShieldCheck,
  Search, LayoutGrid, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { to: "/app", label: "Strategic Map", icon: LayoutGrid },
  { to: "/app/intelligence", label: "Intelligence Matrix", icon: Activity },
  { to: "/app/report", label: "Field Induction", icon: FileText },
  { to: "/app/driver", label: "Operational HUD", icon: Truck },
  { to: "/app/escalation", label: "Governance Log", icon: AlertTriangle },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("CivicFlow_token");
    localStorage.removeItem("CivicFlow_user");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/10">
      {/* ── SIDEBAR: The Chassis ────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white border-r border-border/40 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.02)] z-30 transition-all duration-500">
        <div className="p-8 mb-4">
          <div className="flex items-center gap-3.5 group cursor-pointer" onClick={() => navigate("/app")}>
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20 group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">CivicFlow</h1>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mt-1 block">District Node 07</span>
            </div>
          </div>
        </div>

        <div className="px-6 mb-8">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input 
                placeholder="Global Protocol Search..." 
                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-3.5 text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
           <div className="px-5 mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Strategic Control</span>
           </div>
           {navItems.map((item) => (
             <NavLink
               key={item.to}
               to={item.to}
               end={item.to === "/app"}
               className="flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 transition-all group hover:text-slate-900"
               activeClassName="bg-slate-900 text-white shadow-2xl shadow-slate-900/10 hover:bg-black"
             >
               <item.icon className="w-5 h-5" />
               {item.label}
             </NavLink>
           ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-50 space-y-6 bg-slate-50/30">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                   <User className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                   <p className="text-[11px] font-black text-slate-900 leading-none">ADMIN_SEC_07</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: Active</p>
                </div>
             </div>
             <button onClick={handleLogout} className="p-2.5 rounded-xl hover:bg-destructive/10 text-slate-400 hover:text-destructive transition-all">
                <LogOut className="w-5 h-5" />
             </button>
          </div>
          <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
             <div className="flex-1 flex items-center gap-2 px-3 py-2 text-[10px] font-black text-primary uppercase">
                <ShieldCheck className="w-4 h-4" /> SECURE_SSL_V3
             </div>
             <div className="h-4 w-px bg-slate-100" />
             <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                <Settings className="w-4 h-4" />
             </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN: The Workspace ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
        {/* Top Header Layer */}
        <header className={cn(
          "h-20 flex items-center justify-between px-8 z-20 transition-all duration-300",
          isScrolled ? "bg-white/80 backdrop-blur-xl border-b border-border/40" : "bg-transparent"
        )}>
           <div className="flex items-center gap-4">
              <button className="lg:hidden p-3 rounded-2xl bg-white shadow-xl" onClick={() => setMobileOpen(true)}>
                 <Menu className="w-6 h-6" />
              </button>
              <div className="hidden lg:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                 <LayoutGrid className="w-4 h-4" /> Operation Pulse / <span className="text-primary italic">Live Relay</span>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <div className="flex -space-x-3">
                 {[1,2,3].map(i => (
                   <div key={i} className="w-9 h-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black">OP</div>
                 ))}
                 <div className="w-9 h-9 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[10px] font-black text-white shadow-lg">+12</div>
              </div>
              <div className="h-8 w-px bg-slate-200/50" />
              <button className="relative p-3 rounded-2xl hover:bg-slate-100 transition-colors group">
                 <Bell className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                 <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white" />
              </button>
           </div>
        </header>

        {/* Dynamic Nested Content */}
        <main className="flex-1 overflow-auto custom-scrollbar relative">
           <AnimatePresence mode="wait">
             <motion.div
               key={location.pathname}
               initial={{ opacity: 0, y: 15, scale: 0.99 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: -15 }}
               transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
               className="h-full"
             >
                {children}
             </motion.div>
           </AnimatePresence>
        </main>

        {/* Floating Mobile Nav Overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-white"
            >
               <div className="p-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter uppercase">CivicFlow</span>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="p-3 rounded-2xl bg-slate-50"><X className="w-7 h-7" /></button>
               </div>
               <nav className="p-8 space-y-4">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/app"}
                      className="flex items-center gap-5 px-6 py-5 rounded-3xl text-xl font-black uppercase tracking-widest text-slate-400 transition-all"
                      activeClassName="bg-slate-900 text-white shadow-2xl"
                      onClick={() => setMobileOpen(false)}
                    >
                      <item.icon className="w-8 h-8" />
                      {item.label}
                    </NavLink>
                  ))}
               </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

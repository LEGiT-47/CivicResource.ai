import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import CommandCenter from "./pages/CommandCenter";
import IntelligenceHub from "./pages/IntelligenceHub";
import CitizenReport from "./pages/CitizenReport";
import DriverHUD from "./pages/DriverHUD";
import Escalation from "./pages/Escalation";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout><CommandCenter /></AppLayout>} />
            <Route path="/app/intelligence" element={<AppLayout><IntelligenceHub /></AppLayout>} />
            <Route path="/app/report" element={<AppLayout><CitizenReport /></AppLayout>} />
            <Route path="/app/driver" element={<AppLayout><DriverHUD /></AppLayout>} />
            <Route path="/app/escalation" element={<AppLayout><Escalation /></AppLayout>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

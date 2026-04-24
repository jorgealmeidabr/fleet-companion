import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Setup from "./pages/Setup";
import Veiculos from "./pages/Veiculos";
import VeiculoDetalhe from "./pages/VeiculoDetalhe";
import Motoristas from "./pages/Motoristas";
import MotoristaDetalhe from "./pages/MotoristaDetalhe";
import Manutencoes from "./pages/Manutencoes";
import Abastecimentos from "./pages/Abastecimentos";
import Agendamentos from "./pages/Agendamentos";
import Checklists from "./pages/Checklists";
import Multas from "./pages/Multas";
import Historico from "./pages/Historico";
import Alertas from "./pages/Alertas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children, admin }: { children: React.ReactNode; admin?: boolean }) => (
  <ProtectedRoute requireAdmin={admin}><AppLayout>{children}</AppLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Protected admin><Index /></Protected>} />
            <Route path="/veiculos" element={<Protected admin><Veiculos /></Protected>} />
            <Route path="/veiculos/:id" element={<Protected admin><VeiculoDetalhe /></Protected>} />
            <Route path="/motoristas" element={<Protected admin><Motoristas /></Protected>} />
            <Route path="/motoristas/:id" element={<Protected admin><MotoristaDetalhe /></Protected>} />
            <Route path="/manutencoes" element={<Protected admin><Manutencoes /></Protected>} />
            <Route path="/abastecimentos" element={<Protected admin><Abastecimentos /></Protected>} />
            <Route path="/agendamentos" element={<Protected><Agendamentos /></Protected>} />
            <Route path="/checklists" element={<Protected><Checklists /></Protected>} />
            <Route path="/multas" element={<Protected admin><Multas /></Protected>} />
            <Route path="/historico" element={<Protected admin><Historico /></Protected>} />
            <Route path="/alertas" element={<Protected admin><Alertas /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

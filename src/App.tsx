import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import SetupSenha from "./pages/SetupSenha";
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
import Usuarios from "./pages/Usuarios";
import MeuPerfil from "./pages/MeuPerfil";
import Solicitacoes from "./pages/Solicitacoes";
import NotFound from "./pages/NotFound";
import type { ModuloPermissao } from "@/lib/types";

const queryClient = new QueryClient();

const Protected = ({ children, perm, admin }: { children: React.ReactNode; perm?: ModuloPermissao; admin?: boolean }) => (
  <ProtectedRoute requirePerm={perm} requireAdmin={admin}><AppLayout>{children}</AppLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/setup-senha" element={<ProtectedRoute><SetupSenha /></ProtectedRoute>} />

            <Route path="/" element={<Protected perm="dashboard"><Index /></Protected>} />
            <Route path="/veiculos" element={<Protected perm="veiculos"><Veiculos /></Protected>} />
            <Route path="/veiculos/:id" element={<Protected perm="veiculos"><VeiculoDetalhe /></Protected>} />
            <Route path="/motoristas" element={<Protected perm="motoristas"><Motoristas /></Protected>} />
            <Route path="/motoristas/:id" element={<Protected perm="motoristas"><MotoristaDetalhe /></Protected>} />
            <Route path="/manutencoes" element={<Protected perm="manutencao"><Manutencoes /></Protected>} />
            <Route path="/abastecimentos" element={<Protected perm="abastecimento"><Abastecimentos /></Protected>} />
            <Route path="/agendamentos" element={<Protected perm="agendamentos"><Agendamentos /></Protected>} />
            <Route path="/checklists" element={<Protected perm="checklists"><Checklists /></Protected>} />
            <Route path="/multas" element={<Protected perm="multas"><Multas /></Protected>} />
            <Route path="/historico" element={<Protected perm="historico"><Historico /></Protected>} />
            <Route path="/alertas" element={<Protected perm="alertas"><Alertas /></Protected>} />
            <Route path="/solicitacoes" element={<Protected perm="solicitacoes"><Solicitacoes /></Protected>} />
            <Route path="/usuarios" element={<Protected admin><Usuarios /></Protected>} />
            <Route path="/meu-perfil" element={<ProtectedRoute><AppLayout><MeuPerfil /></AppLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

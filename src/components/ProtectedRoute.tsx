import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ModuloPermissao } from "@/lib/types";
import PendingApproval from "@/pages/PendingApproval";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePerm?: ModuloPermissao;
}

export function ProtectedRoute({ children, requireAdmin, requirePerm }: Props) {
  const { user, loading, isAdmin, mustChangePassword, profileStatus } = useAuth();
  const { canSee } = usePermissions();
  const location = useLocation();

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  // Bloqueia acesso se a conta ainda não foi aprovada (ou foi rejeitada)
  if (profileStatus === "pendente" || profileStatus === "rejeitado") {
    return <PendingApproval status={profileStatus} />;
  }

  // Força troca de senha em primeiro acesso
  if (mustChangePassword && location.pathname !== "/setup-senha") {
    return <Navigate to="/setup-senha" replace />;
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/agendamentos" replace />;
  if (requirePerm && !canSee(requirePerm)) return <Navigate to="/agendamentos" replace />;

  return <>{children}</>;
}

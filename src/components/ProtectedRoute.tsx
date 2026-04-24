import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return <Navigate to="/setup" replace />;
  }
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

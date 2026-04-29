import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { AppRole, Permissoes, TipoConta, UsuarioPerfil } from "@/lib/types";
import { PERMISSOES_TUDO } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  perfil: UsuarioPerfil | null;
  permissoes: Permissoes | null;
  tipoConta: TipoConta | null;
  loading: boolean;
  isAdmin: boolean;
  isMotorista: boolean;
  mustChangePassword: boolean;
  refreshPerfil: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPerfil = useCallback(async (uid: string) => {
    // 1. usuarios_perfis (novo sistema de permissões)
    const { data: perfRaw } = await (supabase as any)
      .from("usuarios_perfis").select("*").eq("user_id", uid).maybeSingle();
    const perf = perfRaw as UsuarioPerfil | null;
    if (perf) {
      setPerfil(perf);
      setRole(perf.tipo_conta === "admin" ? "admin" : "motorista");
      // touch last_login (best-effort)
      (supabase as any).from("usuarios_perfis")
        .update({ last_login: new Date().toISOString() })
        .eq("user_id", uid).then(() => {});
      return;
    }
    // 2. Fallback: user_roles legado
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roles = ((data ?? []) as Array<{ role: string }>).map(r => r.role);
    if (roles.includes("admin")) { setRole("admin"); setPerfil(null); }
    else if (roles.includes("motorista") || roles.includes("usuario")) { setRole("motorista"); setPerfil(null); }
    else { setRole(null); setPerfil(null); }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { loadPerfil(s.user.id); }, 0);
      } else {
        setRole(null); setPerfil(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadPerfil(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadPerfil]);

  const refreshPerfil = useCallback(async () => {
    if (user) await loadPerfil(user.id);
  }, [user, loadPerfil]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nome }, emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  const isAdmin = role === "admin";
  // Quando há perfil → permissoes vem do banco; admin sempre vê tudo
  const permissoes: Permissoes | null = isAdmin
    ? PERMISSOES_TUDO
    : perfil?.permissoes ?? null;
  const tipoConta: TipoConta | null = perfil?.tipo_conta ?? (isAdmin ? "admin" : role === "motorista" ? "usuario" : null);

  return (
    <Ctx.Provider value={{
      user, session, role, perfil, permissoes, tipoConta, loading,
      isAdmin,
      isMotorista: role === "motorista",
      mustChangePassword: !!perfil?.must_change_password,
      refreshPerfil, signIn, signUp, signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return v;
};

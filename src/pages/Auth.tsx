import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validarEmail } from "@/lib/validators";
import brqLogo from "@/assets/brq-logo-full.jpeg";

export default function Auth() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [signinErrors, setSigninErrors] = useState<{ email?: string; password?: string }>({});

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const errs = {
      email: validarEmail(email) ?? undefined,
      password: password.length < 6 ? "Senha mínima 6 caracteres" : undefined,
    };
    setSigninErrors(errs);
    if (errs.email || errs.password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast({ title: "Erro ao entrar", description: error, variant: "destructive" });
    else { toast({ title: "Bem-vindo!" }); nav("/"); }
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validarEmail(forgotEmail)) { toast({ title: "E-mail inválido", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "E-mail enviado", description: "Confira sua caixa de entrada." }); setForgot(false); }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Lado esquerdo - Logo (amarelo claro empresarial com animação 3D minimalista) */}
      <div className="relative flex items-center justify-center overflow-hidden bg-[#FFF4B8] p-8 md:w-[65%] md:p-12">
        {/* Gradiente suave de profundidade */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.55) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(230,194,0,0.18) 0%, transparent 60%)",
          }}
        />
        {/* Orbs 3D minimalistas com blur — movimento lento e suave */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span
            className="absolute -left-20 top-[10%] h-72 w-72 rounded-full opacity-70 blur-3xl animate-float-slow"
            style={{ background: "radial-gradient(circle at 30% 30%, #FFFFFF 0%, #FFE680 60%, transparent 75%)" }}
          />
          <span
            className="absolute right-[-60px] top-[55%] h-80 w-80 rounded-full opacity-60 blur-3xl animate-float-medium"
            style={{ background: "radial-gradient(circle at 40% 40%, #FFF7CC 0%, #F0D55A 60%, transparent 75%)" }}
          />
          <span
            className="absolute left-[35%] bottom-[-80px] h-64 w-64 rounded-full opacity-50 blur-3xl animate-float-fast"
            style={{ background: "radial-gradient(circle at 50% 50%, #FFFFFF 0%, #FFE680 55%, transparent 75%)" }}
          />
        </div>
        <img
          src={brqLogo}
          alt="BRQ Frota Interna"
          style={{ mixBlendMode: "multiply", filter: "drop-shadow(0 18px 30px rgba(120,90,0,0.18))" }}
          className="relative z-10 max-h-48 w-auto max-w-md object-contain md:max-h-[60vh]"
        />
      </div>

      {/* Lado direito - Formulário (escuro) */}
      <div className="flex flex-1 items-center justify-center bg-[#1a1a1a] p-6 md:w-[35%] md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white text-center">
              {forgot ? "Recuperar senha" : "Acessar sistema"}
            </h1>
            <p className="mt-2 text-sm text-white/60 text-center">
              {forgot
                ? "Enviaremos um link para redefinir sua senha."
                : "Entre com suas credenciais para continuar."}
            </p>
          </div>

          {forgot ? (
            <form onSubmit={onForgot} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fe" className="text-white/80">E-mail</Label>
                <Input
                  id="fe"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#FFD600] font-semibold text-black hover:bg-[#FFC700]"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-white/70 hover:bg-white/5 hover:text-white"
                onClick={() => setForgot(false)}
              >
                Voltar
              </Button>
            </form>
          ) : (
            <form onSubmit={onSignIn} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="se" className="text-white/80">E-mail</Label>
                <Input
                  id="se"
                  name="email"
                  type="email"
                  required
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  onBlur={(e) =>
                    setSigninErrors((s) => ({ ...s, email: validarEmail(e.target.value) ?? undefined }))
                  }
                />
                {signinErrors.email && <p className="text-xs text-destructive">{signinErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp" className="text-white/80">Senha</Label>
                <Input
                  id="sp"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
                {signinErrors.password && <p className="text-xs text-destructive">{signinErrors.password}</p>}
              </div>
              <Button
                type="submit"
                className="w-full bg-[#FFD600] font-semibold text-black hover:bg-[#FFC700]"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                className="block w-full text-center text-xs text-white/50 hover:text-white"
                onClick={() => setForgot(true)}
              >
                Esqueceu a senha?
              </button>
              <p className="pt-2 text-center text-[11px] text-white/40">
                Acesso restrito. Solicite seu cadastro ao administrador.
              </p>
            </form>
          )}

          <p className="mt-8 text-center text-[11px] text-white/30">
            <Link to="/setup" className="hover:text-white/60">​</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

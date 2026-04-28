import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { validarEmail } from "@/lib/validators";
import brqLogo from "@/assets/brq-logo-frota.png";
import { CheckCircle2 } from "lucide-react";

export default function Cadastro() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string; senha?: string; cargo?: string }>({});

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (user && !success) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const senha = String(fd.get("senha") ?? "");
    const cargo = String(fd.get("cargo") ?? "").trim();

    const errs: typeof errors = {
      nome: nome.length < 2 ? "Informe seu nome completo" : undefined,
      email: validarEmail(email) ?? undefined,
      senha: senha.length < 8 ? "Senha mínima de 8 caracteres" : undefined,
      cargo: cargo.length < 2 ? "Informe o cargo pretendido" : undefined,
    };
    setErrors(errs);
    if (errs.nome || errs.email || errs.senha || errs.cargo) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome, cargo_pretendido: cargo },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      // Garante o profile com status pendente (caso o trigger não atue por algum motivo)
      if (data.user?.id) {
        await (supabase as any).from("profiles").upsert(
          { id: data.user.id, nome, email, cargo_pretendido: cargo, status: "pendente" },
          { onConflict: "id" },
        );
      }

      // Desloga imediatamente — só pode entrar após aprovação
      await supabase.auth.signOut();

      setSuccess(true);
    } catch (e: any) {
      toast({ title: "Erro no cadastro", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={brqLogo} alt="BRQ Frota Interna" className="w-44 mb-2" />
          <p className="text-amber-500 italic text-sm">Solicite seu acesso ao sistema</p>
        </div>

        {success ? (
          <div className="rounded-xl border border-success/40 bg-success/10 p-8 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="text-xl font-bold text-foreground">Cadastro realizado!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aguarde a aprovação do administrador. Você receberá acesso assim que sua conta for liberada.
            </p>
            <button
              onClick={() => nav("/auth")}
              className="mt-4 inline-flex items-center justify-center w-full h-11 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-sm transition"
            >
              Voltar para o login
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="bg-zinc-900/80 border border-white/10 rounded-xl p-7 backdrop-blur-sm shadow-2xl space-y-4"
          >
            <h1 className="text-xl font-bold text-white text-center mb-1">Criar conta</h1>
            <p className="text-xs text-zinc-400 text-center mb-5">
              Preencha os dados para solicitar acesso ao sistema
            </p>

            <Field label="Nome completo *" error={errors.nome}>
              <input
                name="nome"
                type="text"
                required
                className="brq-input"
                placeholder="João da Silva"
              />
            </Field>

            <Field label="E-mail *" error={errors.email}>
              <input
                name="email"
                type="email"
                required
                className="brq-input"
                placeholder="voce@empresa.com"
              />
            </Field>

            <Field label="Senha *" error={errors.senha}>
              <input
                name="senha"
                type="password"
                required
                minLength={8}
                className="brq-input"
                placeholder="Mínimo 8 caracteres"
              />
            </Field>

            <Field label="Cargo pretendido *" error={errors.cargo}>
              <input
                name="cargo"
                type="text"
                required
                className="brq-input"
                placeholder="Motorista, Supervisor, Técnico..."
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Enviando..." : "Solicitar cadastro"}
            </button>

            <p className="text-center text-xs text-zinc-500 pt-2">
              Já tem conta?{" "}
              <Link to="/auth" className="text-amber-500 hover:text-amber-400 font-medium">
                Entrar
              </Link>
            </p>
          </form>
        )}

        <style>{`
          .brq-input {
            width: 100%;
            background: #1e2128;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 7px;
            height: 44px;
            padding: 0 14px;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color .15s, box-shadow .15s;
            box-sizing: border-box;
          }
          .brq-input::placeholder { color: rgba(255,255,255,0.3); }
          .brq-input:focus {
            border-color: rgba(245,196,0,0.5);
            box-shadow: 0 0 0 3px rgba(245,196,0,0.1);
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-zinc-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

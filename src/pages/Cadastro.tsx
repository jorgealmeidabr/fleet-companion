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
  const [errors, setErrors] = useState<{ nome?: string; email?: string; senha?: string }>({});

  if (!isSupabaseConfigured) return <Navigate to="/setup" replace />;
  if (user && !success) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const senha = String(fd.get("senha") ?? "");

    const errs: typeof errors = {
      nome: nome.length < 2 ? "Informe seu nome completo" : undefined,
      email: validarEmail(email) ?? undefined,
      senha: senha.length < 8 ? "Senha mínima de 8 caracteres" : undefined,
    };
    setErrors(errs);
    if (errs.nome || errs.email || errs.senha) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (data.user?.id) {
        await (supabase as any).from("profiles").upsert(
          { id: data.user.id, nome, email, status: "pendente" },
          { onConflict: "id" },
        );
      }

      await supabase.auth.signOut();
      setSuccess(true);
    } catch (e: any) {
      toast({ title: "Erro no cadastro", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .brq-login { font-family: 'Barlow', sans-serif; min-height: 100vh; width: 100vw; display: flex; overflow: hidden; }

        .brq-left {
          flex: 1;
          position: relative;
          background-color: #0a0c0f;
          background-image:
            radial-gradient(ellipse 70% 60% at 58% 52%, rgba(212,160,23,0.52) 0%, transparent 70%);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: brqFadeIn 1s ease both;
        }
        .brq-left::before {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 42px 42px;
          pointer-events: none;
          animation: brqGridDrift 30s linear infinite;
        }
        .brq-left::after {
          content: "";
          position: absolute; inset: -20%;
          background:
            radial-gradient(circle at 20% 30%, rgba(212,160,23,0.18) 0, transparent 8%),
            radial-gradient(circle at 70% 80%, rgba(212,160,23,0.14) 0, transparent 7%),
            radial-gradient(circle at 85% 20%, rgba(245,196,0,0.12) 0, transparent 6%),
            radial-gradient(circle at 35% 75%, rgba(212,160,23,0.10) 0, transparent 9%);
          filter: blur(2px);
          pointer-events: none;
          animation: brqOrbDrift 22s ease-in-out infinite alternate;
        }
        .brq-eyebrow {
          position: absolute;
          top: 28px; left: 36px;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          font-weight: 300;
          z-index: 2;
        }
        .brq-logo-wrap {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          animation: brqFloat 6s ease-in-out infinite;
        }
        .brq-logo { max-width: 460px; width: 100%; height: auto; }
        .brq-tagline {
          font-family: 'Barlow', sans-serif;
          font-style: italic;
          color: #d4a017;
          font-size: 20px;
          font-weight: 400;
          margin: 0;
        }

        .brq-right {
          width: 360px;
          flex-shrink: 0;
          background: #14171d;
          border-left: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          padding: 40px 32px;
        }
        .brq-form { width: 100%; }
        .brq-title {
          font-family: 'Barlow', sans-serif;
          font-weight: 700;
          font-size: 26px;
          color: #fff;
          text-align: center;
          margin: 0 0 8px;
          animation: brqFadeUp 0.6s ease both; animation-delay: .10s;
        }
        .brq-sub {
          font-size: 13px; color: #9ca3af;
          text-align: center;
          margin: 0 0 28px;
          animation: brqFadeUp 0.6s ease both; animation-delay: .18s;
        }
        .brq-field { margin-bottom: 14px; animation: brqFadeUp 0.6s ease both; }
        .brq-field.f1 { animation-delay: .26s; }
        .brq-field.f2 { animation-delay: .32s; }
        .brq-field.f3 { animation-delay: .38s; }
        .brq-label {
          display: block;
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,0.75);
          margin-bottom: 6px;
        }
        .brq-input {
          width: 100%;
          background: #1e2128;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 7px;
          height: 46px;
          padding: 0 14px;
          color: #fff;
          font-family: 'Barlow', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
          box-sizing: border-box;
        }
        .brq-input::placeholder { color: rgba(255,255,255,0.3); }
        .brq-input:focus {
          border-color: rgba(212,160,23,0.5);
          box-shadow: 0 0 0 3px rgba(212,160,23,0.1);
        }
        .brq-error { color: #f87171; font-size: 11.5px; margin-top: 4px; }

        .brq-btn {
          width: 100%; height: 50px; margin-top: 8px;
          background: #f5c400; color: #0a0c0f;
          font-family: 'Barlow', sans-serif;
          font-weight: 700; font-size: 15px;
          border-radius: 7px; border: none; cursor: pointer;
          transition: background .15s, transform .05s;
          animation: brqFadeUp 0.6s ease both; animation-delay: .46s;
        }
        .brq-btn:hover { background: #e6b800; }
        .brq-btn:active { transform: scale(0.98); }
        .brq-btn:disabled { opacity: .7; cursor: not-allowed; }

        .brq-note {
          text-align: center; margin-top: 18px;
          font-size: 12px; color: #9ca3af;
          animation: brqFadeUp 0.6s ease both; animation-delay: .52s;
        }
        .brq-note a { color: #d4a017; font-weight: 600; text-decoration: none; }
        .brq-note a:hover { color: #f5c400; }

        .brq-success {
          width: 100%;
          text-align: center;
          animation: brqFadeUp 0.6s ease both;
        }
        .brq-success h1 {
          color: #fff; font-size: 22px; font-weight: 700; margin: 12px 0 8px;
        }
        .brq-success p {
          color: #9ca3af; font-size: 13.5px; line-height: 1.55; margin: 0 0 22px;
        }

        @keyframes brqFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes brqFadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes brqGridDrift { from { background-position: 0 0, 0 0; } to { background-position: 42px 42px, 42px 42px; } }
        @keyframes brqOrbDrift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-2%, 2%) scale(1.05); }
          100% { transform: translate(2%, -1%) scale(1); }
        }
        @keyframes brqFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }

        @media (max-width: 768px) {
          .brq-login { flex-direction: column; min-height: 100vh; }
          .brq-right { width: 100%; }
          .brq-left { min-height: 40vh; padding: 80px 20px 40px; }
          .brq-logo { max-width: 280px; }
        }
      `}</style>

      <div className="brq-login">
        <div className="brq-left">
          <div className="brq-eyebrow">SISTEMA DE FROTAS EMPRESARIAIS</div>
          <div className="brq-logo-wrap">
            <img src={brqLogo} alt="BRQ Frota Interna" className="brq-logo" />
            <p className="brq-tagline">Nós alimentamos o mundo!</p>
          </div>
        </div>

        <aside className="brq-right">
          {success ? (
            <div className="brq-success">
              <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: "#22c55e" }} />
              <h1>Cadastro realizado!</h1>
              <p>Aguarde a aprovação do administrador. Você receberá acesso assim que sua conta for liberada.</p>
              <button onClick={() => nav("/auth")} className="brq-btn" style={{ animation: "none" }}>
                Voltar para o login
              </button>
            </div>
          ) : (
            <form className="brq-form" onSubmit={onSubmit} noValidate>
              <h1 className="brq-title">Criar conta</h1>
              <p className="brq-sub">Solicite seu acesso ao sistema</p>

              <div className="brq-field f1">
                <label htmlFor="cn" className="brq-label">Nome completo</label>
                <input id="cn" name="nome" type="text" required className="brq-input" placeholder="João da Silva" />
                {errors.nome && <div className="brq-error">{errors.nome}</div>}
              </div>

              <div className="brq-field f2">
                <label htmlFor="ce" className="brq-label">E-mail</label>
                <input id="ce" name="email" type="email" required className="brq-input" placeholder="voce@empresa.com"
                  onBlur={(e) => setErrors((s) => ({ ...s, email: validarEmail(e.target.value) ?? undefined }))} />
                {errors.email && <div className="brq-error">{errors.email}</div>}
              </div>

              <div className="brq-field f3">
                <label htmlFor="cs" className="brq-label">Senha</label>
                <input id="cs" name="senha" type="password" required minLength={8} className="brq-input" placeholder="Mínimo 8 caracteres" />
                {errors.senha && <div className="brq-error">{errors.senha}</div>}
              </div>

              <button type="submit" className="brq-btn" disabled={loading}>
                {loading ? "Enviando..." : "Solicitar cadastro"}
              </button>

              <p className="brq-note">
                Já tem conta? <Link to="/auth">Entrar</Link>
              </p>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}

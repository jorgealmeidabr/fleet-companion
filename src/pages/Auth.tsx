import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validarEmail } from "@/lib/validators";
import brqLogo from "@/assets/brq-logo-frota.png";

export default function Auth() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
    setErrors(errs);
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
    <>
      <style>{`
        .brq-login { font-family: 'Barlow', sans-serif; height: 100vh; width: 100vw; display: flex; overflow: hidden; }

        /* ===== Painel esquerdo ===== */
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
        }
        .brq-logo {
          max-width: 460px; width: 100%; height: auto;
          filter: brightness(0) invert(1);
          mix-blend-mode: screen;
        }
        .brq-tagline {
          font-family: 'Barlow', sans-serif;
          font-style: italic;
          color: #d4a017;
          font-size: 20px;
          font-weight: 400;
          margin: 0;
        }

        /* ===== Painel direito ===== */
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
          margin: 0 0 36px;
          animation: brqFadeUp 0.6s ease both; animation-delay: .18s;
        }
        .brq-field { margin-bottom: 16px; animation: brqFadeUp 0.6s ease both; }
        .brq-field.f1 { animation-delay: .26s; }
        .brq-field.f2 { animation-delay: .34s; }
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
          height: 48px;
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
          animation: brqFadeUp 0.6s ease both; animation-delay: .42s;
        }
        .brq-btn:hover { background: #e6b800; }
        .brq-btn:active { transform: scale(0.98); }
        .brq-btn:disabled { opacity: .7; cursor: not-allowed; }

        .brq-link {
          display: block; width: 100%;
          background: none; border: none; cursor: pointer;
          text-align: center; margin-top: 18px;
          font-size: 13px; color: #9ca3af;
          font-family: 'Barlow', sans-serif;
          transition: color .15s;
          animation: brqFadeUp 0.6s ease both; animation-delay: .48s;
        }
        .brq-link:hover { color: #d4a017; }

        .brq-note {
          text-align: center; margin-top: 20px;
          font-size: 11.5px; color: #6b7280;
          animation: brqFadeUp 0.6s ease both; animation-delay: .52s;
        }

        @keyframes brqFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes brqFadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .brq-login { flex-direction: column; height: auto; min-height: 100vh; }
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
          {forgot ? (
            <form className="brq-form" onSubmit={onForgot}>
              <h1 className="brq-title">Recuperar senha</h1>
              <p className="brq-sub">Enviaremos um link para redefinir sua senha.</p>
              <div className="brq-field f1">
                <label htmlFor="fe" className="brq-label">E-mail</label>
                <input id="fe" type="email" required value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)} className="brq-input" />
              </div>
              <button type="submit" className="brq-btn" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </button>
              <button type="button" className="brq-link" onClick={() => setForgot(false)}>
                Voltar
              </button>
            </form>
          ) : (
            <form className="brq-form" onSubmit={onSignIn} noValidate>
              <h1 className="brq-title">Acessar sistema</h1>
              <p className="brq-sub">Entre com suas credenciais para continuar.</p>

              <div className="brq-field f1">
                <label htmlFor="se" className="brq-label">E-mail</label>
                <input id="se" name="email" type="email" required className="brq-input"
                  onBlur={(e) => setErrors((s) => ({ ...s, email: validarEmail(e.target.value) ?? undefined }))} />
                {errors.email && <div className="brq-error">{errors.email}</div>}
              </div>

              <div className="brq-field f2">
                <label htmlFor="sp" className="brq-label">Senha</label>
                <input id="sp" name="password" type="password" required minLength={6} className="brq-input" />
                {errors.password && <div className="brq-error">{errors.password}</div>}
              </div>

              <button type="submit" className="brq-btn" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <button type="button" className="brq-link" onClick={() => setForgot(true)}>
                Esqueceu a senha?
              </button>

              <p className="brq-note">
                Acesso restrito. Solicite seu cadastro ao administrador.
              </p>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}

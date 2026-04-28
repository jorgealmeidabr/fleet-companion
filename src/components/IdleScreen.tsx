import { useEffect } from "react";
import brqLogo from "@/assets/brq-logo-frota.png";

interface IdleScreenProps {
  onExit: () => void;
}

/**
 * Tela "protetor de tela" — versão fullscreen da landing sem o formulário.
 * Mantém as animações de fundo do painel esquerdo + adiciona partículas sutis.
 * Qualquer interação chama onExit().
 */
export function IdleScreen({ onExit }: IdleScreenProps) {
  useEffect(() => {
    const handler = () => onExit();
    const events: (keyof WindowEventMap)[] = ["mousedown", "touchstart", "pointerdown"];
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
    };
  }, [onExit]);

  return (
    <>
      <style>{`
        .idle-overlay {
          position: fixed; inset: 0;
          z-index: 9999;
          font-family: 'Barlow', sans-serif;
          background-color: #0a0c0f;
          background-image:
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(212,160,23,0.55) 0%, transparent 70%);
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          animation: idleFadeIn .4s ease both;
          cursor: none;
        }
        .idle-overlay.exiting { animation: idleFadeOut .35s ease both; }

        .idle-overlay::before {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 42px 42px;
          pointer-events: none;
          animation: idleGridDrift 30s linear infinite;
        }
        .idle-overlay::after {
          content: "";
          position: absolute; inset: -20%;
          background:
            radial-gradient(circle at 20% 30%, rgba(212,160,23,0.20) 0, transparent 8%),
            radial-gradient(circle at 70% 80%, rgba(212,160,23,0.16) 0, transparent 7%),
            radial-gradient(circle at 85% 20%, rgba(245,196,0,0.14) 0, transparent 6%),
            radial-gradient(circle at 35% 75%, rgba(212,160,23,0.12) 0, transparent 9%);
          filter: blur(2px);
          pointer-events: none;
          animation: idleOrbDrift 22s ease-in-out infinite alternate;
        }

        .idle-content {
          position: relative; z-index: 3;
          display: flex; flex-direction: column; align-items: center; gap: 18px;
          animation: idleFloat 6s ease-in-out infinite;
        }
        .idle-logo { max-width: 520px; width: 80vw; height: auto; }
        .idle-tagline {
          font-style: italic;
          color: #d4a017;
          font-size: 24px;
          font-weight: 400;
          margin: 0;
          letter-spacing: 0.02em;
        }
        .idle-hint {
          margin-top: 28px;
          font-size: 12px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          animation: idlePulse 2.4s ease-in-out infinite;
        }
        .idle-eyebrow {
          position: absolute; top: 32px; left: 40px;
          font-size: 11px; letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          font-weight: 300;
          z-index: 2;
        }

        /* Partículas sutis */
        .idle-particles {
          position: absolute; inset: 0;
          pointer-events: none;
          z-index: 2;
        }
        .idle-particle {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(245,196,0,0.55);
          box-shadow: 0 0 8px rgba(245,196,0,0.6);
          opacity: 0;
          animation: idleParticle linear infinite;
        }

        @keyframes idleFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes idleFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes idleGridDrift { from { background-position: 0 0; } to { background-position: 42px 42px; } }
        @keyframes idleOrbDrift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-2%, 2%) scale(1.05); }
          100% { transform: translate(2%, -1%) scale(1); }
        }
        @keyframes idleFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes idlePulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.75; }
        }
        @keyframes idleParticle {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 0.8; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
        }
      `}</style>

      <div className="idle-overlay" role="presentation" aria-hidden="true">
        <div className="idle-eyebrow">SISTEMA DE FROTAS EMPRESARIAIS</div>

        <div className="idle-particles">
          {Array.from({ length: 18 }).map((_, i) => {
            const left = (i * 53) % 100;
            const delay = (i * 0.7) % 12;
            const duration = 14 + ((i * 3) % 10);
            const size = 2 + (i % 3);
            return (
              <span
                key={i}
                className="idle-particle"
                style={{
                  left: `${left}%`,
                  bottom: `-10px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                }}
              />
            );
          })}
        </div>

        <div className="idle-content">
          <img src={brqLogo} alt="BRQ Frota Interna" className="idle-logo" />
          <p className="idle-tagline">Nós alimentamos o mundo!</p>
          <div className="idle-hint">Clique na tela para continuar</div>
        </div>
      </div>
    </>
  );
}

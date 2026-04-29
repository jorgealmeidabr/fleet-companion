import { useEffect, useRef, useState } from "react";

const BAR_HEIGHTS = [10, 16, 22, 18, 14, 20, 12];
const BAR_DELAYS = [0, 0.1, 0.2, 0.05, 0.15, 0.25, 0.1];

let patched = false;
function ensurePatched() {
  if (patched || typeof window === "undefined" || !window.speechSynthesis) return;
  patched = true;
  const synth = window.speechSynthesis;
  const original = synth.speak.bind(synth);
  synth.speak = (utterance: SpeechSynthesisUtterance) => {
    try {
      (window as unknown as { __lastSpokenText?: string }).__lastSpokenText = utterance?.text ?? "";
    } catch {
      // ignore
    }
    return original(utterance);
  };
}

export function VoiceActiveIndicator() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [text, setText] = useState("");
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    ensurePatched();

    const id = window.setInterval(() => {
      const speaking = window.speechSynthesis.speaking;
      const lastText = (window as unknown as { __lastSpokenText?: string }).__lastSpokenText ?? "";

      if (speaking) {
        if (closeTimer.current) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        setClosing(false);
        setVisible(true);
        setText((prev) => (prev !== lastText ? lastText : prev));
      } else if (visible && !closing) {
        setClosing(true);
        closeTimer.current = window.setTimeout(() => {
          setVisible(false);
          setClosing(false);
          closeTimer.current = null;
        }, 250);
      }
    }, 300);

    return () => {
      window.clearInterval(id);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [visible, closing]);

  if (!visible && !closing) return null;

  return (
    <div
      className={`voice-indicator ${closing ? "voice-indicator--closing" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="voice-indicator__bars" aria-hidden="true">
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="voice-indicator__bar"
            style={{ height: `${h}px`, animationDelay: `${BAR_DELAYS[i]}s` }}
          />
        ))}
      </div>
      <div className="voice-indicator__content">
        <div className="voice-indicator__row">
          <span className="voice-indicator__dot" aria-hidden="true" />
          <span className="voice-indicator__label">Frota</span>
        </div>
        <div className="voice-indicator__text">{text}</div>
      </div>
    </div>
  );
}

export default VoiceActiveIndicator;

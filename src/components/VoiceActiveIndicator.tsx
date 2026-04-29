import { useEffect, useRef, useState } from "react";

const BAR_HEIGHTS = [10, 16, 22, 18, 14, 20, 12];
const BAR_DELAYS = [0, 0.1, 0.2, 0.05, 0.15, 0.25, 0.1];

type VoiceState = {
  active: boolean;
  text: string;
  charIndex: number;
  charLength: number;
};

const EVT = "voice-indicator-update";

function dispatch(state: VoiceState) {
  window.dispatchEvent(new CustomEvent<VoiceState>(EVT, { detail: state }));
}

let patched = false;
function ensurePatched() {
  if (patched || typeof window === "undefined" || !window.speechSynthesis) return;
  patched = true;
  const synth = window.speechSynthesis;
  const original = synth.speak.bind(synth);

  synth.speak = (utterance: SpeechSynthesisUtterance) => {
    try {
      const text = utterance?.text ?? "";

      const prevStart = utterance.onstart;
      utterance.onstart = (e) => {
        dispatch({ active: true, text, charIndex: 0, charLength: 0 });
        if (typeof prevStart === "function") prevStart.call(utterance, e);
      };

      const prevBoundary = utterance.onboundary;
      utterance.onboundary = (e) => {
        if (!e.name || e.name === "word") {
          let len = (e as SpeechSynthesisEvent).charLength ?? 0;
          if (!len) {
            const rest = text.slice(e.charIndex);
            const m = rest.match(/^\S+/);
            len = m ? m[0].length : 0;
          }
          dispatch({
            active: true,
            text,
            charIndex: e.charIndex,
            charLength: len,
          });
        }
        if (typeof prevBoundary === "function") prevBoundary.call(utterance, e);
      };

      const prevEnd = utterance.onend;
      utterance.onend = (e) => {
        dispatch({ active: false, text: "", charIndex: 0, charLength: 0 });
        if (typeof prevEnd === "function") prevEnd.call(utterance, e);
      };

      const prevError = utterance.onerror;
      utterance.onerror = (e) => {
        dispatch({ active: false, text: "", charIndex: 0, charLength: 0 });
        if (typeof prevError === "function") prevError.call(utterance, e);
      };
    } catch {
      // ignore
    }
    return original(utterance);
  };
}

export function VoiceActiveIndicator() {
  const [state, setState] = useState<VoiceState>({
    active: false,
    text: "",
    charIndex: 0,
    charLength: 0,
  });
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    ensurePatched();

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<VoiceState>).detail;
      if (detail.active) {
        if (closeTimer.current) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        setClosing(false);
        setState(detail);
      } else {
        setClosing(true);
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => {
          setClosing(false);
          setState({ active: false, text: "", charIndex: 0, charLength: 0 });
          closeTimer.current = null;
        }, 250);
      }
    };

    window.addEventListener(EVT, handler);
    return () => {
      window.removeEventListener(EVT, handler);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const visible = state.active || closing;
  if (!visible) return null;

  const { text, charIndex, charLength } = state;
  const before = text.slice(0, charIndex);
  const current = charLength > 0 ? text.slice(charIndex, charIndex + charLength) : "";
  const after = text.slice(charIndex + charLength);

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
        <div className="voice-indicator__text">
          <span>{before}</span>
          {current && <span className="voice-indicator__highlight">{current}</span>}
          <span>{after}</span>
        </div>
      </div>
    </div>
  );
}

export default VoiceActiveIndicator;

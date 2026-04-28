import { useEffect, useState } from "react";

/**
 * Detecta inatividade do usuário. Retorna true após `timeoutMs` sem interação.
 */
export function useIdle(timeoutMs = 35000, enabled = true) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled) { setIdle(false); return; }

    let timer: number | undefined;
    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), timeoutMs);
    };
    const onActivity = () => {
      if (idle) return; // saída é controlada pelo overlay
      reset();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "touchstart", "wheel", "pointerdown", "scroll",
    ];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    reset();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [timeoutMs, enabled, idle]);

  return { idle, wake: () => setIdle(false) };
}

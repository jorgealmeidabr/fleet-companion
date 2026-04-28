import { useEffect, useRef, useState } from "react";

/**
 * Detecta inatividade do usuário. Retorna true após `timeoutMs` sem interação.
 * A saída do estado idle é controlada externamente via wake().
 */
export function useIdle(timeoutMs = 35000, enabled = true) {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  idleRef.current = idle;

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return;
    }

    let timer: number | undefined;
    const reset = () => {
      if (idleRef.current) return; // não resetar enquanto overlay aberto
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), timeoutMs);
    };

    const events: (keyof DocumentEventMap)[] = [
      "mousemove", "mousedown", "keydown", "touchstart", "wheel", "pointerdown", "scroll", "click",
    ];
    // capture = true garante que pegamos eventos mesmo em containers com scroll próprio
    events.forEach((ev) => document.addEventListener(ev, reset, { passive: true, capture: true }));
    reset();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((ev) => document.removeEventListener(ev, reset, { capture: true } as any));
    };
  }, [timeoutMs, enabled]);

  return { idle, wake: () => setIdle(false) };
}

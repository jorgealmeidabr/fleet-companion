// Persistência local dos alertas dispensados pelo usuário.
// Como os alertas são derivados dinamicamente (CNH, manutenção, multas, etc.),
// não há tabela para deletá-los. Guardamos os IDs dispensados em localStorage
// para ocultá-los das listagens e dos contadores até que um alerta novo
// (com ID novo) seja gerado.
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "brq:dismissed-alerts:v1";
const EVENT_NAME = "brq:dismissed-alerts:changed";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* ignora */
  }
}

export function useDismissedAlerts() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => readSet());

  useEffect(() => {
    const sync = () => setDismissed(readSet());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const next = readSet();
    next.add(id);
    writeSet(next);
  }, []);

  const dismissMany = useCallback((ids: string[]) => {
    const next = readSet();
    ids.forEach((id) => next.add(id));
    writeSet(next);
  }, []);

  const restore = useCallback((id: string) => {
    const next = readSet();
    next.delete(id);
    writeSet(next);
  }, []);

  const clearAll = useCallback(() => {
    writeSet(new Set());
  }, []);

  const isDismissed = useCallback(
    (id: string) => dismissed.has(id),
    [dismissed]
  );

  return { dismissed, isDismissed, dismiss, dismissMany, restore, clearAll };
}

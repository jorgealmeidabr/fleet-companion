import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Contagem de solicitações com status "requested".
 * - Admin: vê todas (via RLS).
 * - Usuário: vê apenas as próprias (via RLS).
 * - Atualiza em tempo real via postgres_changes.
 */
export function useRequestBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { count: c } = await (supabase as any)
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "requested");
      if (mounted) setCount(c ?? 0);
    };
    load();

    const ch = supabase
      .channel("requests-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => load())
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  return count;
}

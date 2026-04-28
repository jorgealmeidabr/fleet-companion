import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Agendamento } from "@/lib/types";

export interface PendingChecklist {
  agendamento: Agendamento;
  veiculo_placa: string;
  veiculo_modelo: string;
}

/**
 * Detecta agendamentos concluídos pelo motorista atual sem um checklist
 * registrado APÓS a data de retorno real (checklist pós-uso obrigatório).
 */
export function useChecklistPendente() {
  const { perfil, isAdmin } = useAuth();
  const [pendentes, setPendentes] = useState<PendingChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!perfil?.motorista_id) {
      setPendentes([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Janela: últimas 72h (evita travar sistema com históricos antigos)
    const desde = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data: ags } = await (supabase
      .from("agendamentos") as any)
      .select("*, veiculos(placa, modelo)")
      .eq("motorista_id", perfil.motorista_id)
      .eq("status", "concluido")
      .gte("data_retorno_real", desde)
      .not("data_retorno_real", "is", null)
      .order("data_retorno_real", { ascending: false });

    if (!ags?.length) {
      setPendentes([]);
      setLoading(false);
      return;
    }

    // Para cada agendamento, verifica se há checklist do motorista no veículo após data_retorno_real
    const result: PendingChecklist[] = [];
    for (const a of ags as any[]) {
      const { count } = await (supabase
        .from("checklists") as any)
        .select("id", { count: "exact", head: true })
        .eq("veiculo_id", a.veiculo_id)
        .eq("motorista_id", perfil.motorista_id)
        .gte("created_at", a.data_retorno_real);

      if ((count ?? 0) === 0) {
        result.push({
          agendamento: a as Agendamento,
          veiculo_placa: a.veiculos?.placa ?? "—",
          veiculo_modelo: a.veiculos?.modelo ?? "",
        });
      }
    }
    setPendentes(result);
    setLoading(false);
  }, [perfil?.motorista_id]);

  useEffect(() => {
    if (isAdmin) {
      // Admin não é bloqueado, mas pode visualizar pendências próprias
      check();
    } else {
      check();
    }
  }, [check, isAdmin]);

  return { pendentes, loading, refresh: check };
}

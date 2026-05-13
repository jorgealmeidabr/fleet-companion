// Hook unificado de alertas da frota: CNH vencida/vencendo, manutenção atrasada,
// checklist faltando, multa pendente, consumo anormal.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDismissedAlerts } from "@/hooks/useDismissedAlerts";
import type { Veiculo, Motorista, Manutencao, Checklist, Multa, Abastecimento, Acidente } from "@/lib/types";

export type AlertLevel = "critico" | "atencao" | "info";

export interface AlertItem {
  id: string;
  level: AlertLevel;
  tipo: string;
  titulo: string;
  descricao: string;
  veiculoId?: string;
  motoristaId?: string;
  link?: string;
}

const DAY = 24 * 60 * 60 * 1000;

export function useAlerts() {
  const { isDismissed } = useDismissedAlerts();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [acidentes, setAcidentes] = useState<Acidente[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [v, mt, mn, ck, mu, ab, ac] = await Promise.all([
      supabase.from("veiculos").select("*"),
      supabase.from("motoristas").select("*"),
      supabase.from("manutencoes").select("*"),
      supabase.from("checklists").select("*"),
      supabase.from("multas").select("*"),
      supabase.from("abastecimentos").select("*"),
      (supabase as any).from("acidentes").select("*").eq("status", "pendente"),
    ]);
    setVeiculos((v.data ?? []) as Veiculo[]);
    setMotoristas((mt.data ?? []) as Motorista[]);
    setManutencoes((mn.data ?? []) as Manutencao[]);
    setChecklists((ck.data ?? []) as Checklist[]);
    setMultas((mu.data ?? []) as Multa[]);
    setAbastecimentos((ab.data ?? []) as Abastecimento[]);
    setAcidentes((ac?.data ?? []) as Acidente[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const alerts: AlertItem[] = useMemo(() => {
    const now = Date.now();
    const out: AlertItem[] = [];
    const placa = (id?: string) => veiculos.find(x => x.id === id)?.placa ?? "—";

    // CNH
    motoristas.filter(m => m.status === "ativo").forEach(m => {
      const validade = new Date(m.cnh_validade).getTime();
      const diff = validade - now;
      if (diff < 0) {
        out.push({
          id: `cnh-${m.id}`, level: "critico", tipo: "CNH",
          titulo: `CNH vencida — ${m.nome}`,
          descricao: `Vencida em ${new Date(m.cnh_validade).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          motoristaId: m.id, link: `/motoristas/${m.id}`,
        });
      } else if (diff < 30 * DAY) {
        out.push({
          id: `cnh-${m.id}`, level: "atencao", tipo: "CNH",
          titulo: `CNH vence em breve — ${m.nome}`,
          descricao: `Vence em ${new Date(m.cnh_validade).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          motoristaId: m.id, link: `/motoristas/${m.id}`,
        });
      }
    });

    // Manutenção atrasada
    manutencoes.filter(mn => mn.status !== "concluida" && (mn.proxima_data || mn.proxima_km)).forEach(mn => {
      const v = veiculos.find(x => x.id === mn.veiculo_id);
      const kmDelta = mn.proxima_km && v ? v.km_atual - mn.proxima_km : null;
      const diaDelta = mn.proxima_data ? (now - new Date(mn.proxima_data).getTime()) / DAY : null;
      const critico = (kmDelta != null && kmDelta > 500) || (diaDelta != null && diaDelta > 30);
      const atencao = (kmDelta != null && kmDelta > 0) || (diaDelta != null && diaDelta > 0);
      if (critico) {
        out.push({
          id: `mn-${mn.id}`, level: "critico", tipo: "Manutenção",
          titulo: `Manutenção muito atrasada — ${placa(mn.veiculo_id)}`,
          descricao: kmDelta != null && kmDelta > 0 ? `+${kmDelta} km da revisão` : `+${Math.round(diaDelta!)} dias atrasada`,
          veiculoId: mn.veiculo_id, link: `/veiculos/${mn.veiculo_id}`,
        });
      } else if (atencao) {
        out.push({
          id: `mn-${mn.id}`, level: "atencao", tipo: "Manutenção",
          titulo: `Manutenção vencendo — ${placa(mn.veiculo_id)}`,
          descricao: kmDelta != null ? `${kmDelta} km da próxima` : `${Math.round(diaDelta!)} dias`,
          veiculoId: mn.veiculo_id, link: `/veiculos/${mn.veiculo_id}`,
        });
      }
    });

    // Checklist não realizado há 7+ dias por veículo ativo
    veiculos.filter(v => v.status !== "inativo").forEach(v => {
      const ult = checklists.filter(c => c.veiculo_id === v.id)
        .sort((a, b) => b.data.localeCompare(a.data))[0];
      const dias = ult ? (now - new Date(ult.data).getTime()) / DAY : Infinity;
      if (dias > 7) {
        out.push({
          id: `ck-${v.id}`, level: "info", tipo: "Checklist",
          titulo: `Checklist pendente — ${v.placa}`,
          descricao: ult ? `Último há ${Math.round(dias)} dias` : "Nenhum checklist registrado",
          veiculoId: v.id, link: `/checklists`,
        });
      }
    });

    // Multas pendentes
    multas.filter(m => m.status_pagamento === "pendente").forEach(m => {
      out.push({
        id: `mu-${m.id}`, level: "info", tipo: "Multa",
        titulo: `Multa pendente — ${placa(m.veiculo_id)}`,
        descricao: `${m.tipo_infracao} • R$ ${m.valor.toFixed(2)}`,
        veiculoId: m.veiculo_id, link: `/multas`,
      });
    });

    // Consumo anormal: último consumo < 85% da média do veículo
    const byVeic: Record<string, Abastecimento[]> = {};
    abastecimentos.filter(a => a.consumo_km_l).forEach(a => {
      (byVeic[a.veiculo_id] ??= []).push(a);
    });
    Object.entries(byVeic).forEach(([vid, list]) => {
      if (list.length < 3) return;
      const sorted = [...list].sort((a, b) => b.data.localeCompare(a.data));
      const last = sorted[0].consumo_km_l!;
      const histAvg = sorted.slice(1).reduce((s, x) => s + (x.consumo_km_l ?? 0), 0) / (sorted.length - 1);
      if (histAvg > 0 && last < histAvg * 0.85) {
        out.push({
          id: `ab-${vid}`, level: "atencao", tipo: "Consumo",
          titulo: `Consumo anormal — ${placa(vid)}`,
          descricao: `Caiu ${(((histAvg - last) / histAvg) * 100).toFixed(0)}% vs. média (${histAvg.toFixed(1)} km/L)`,
          veiculoId: vid, link: `/veiculos/${vid}`,
        });
      }
    });

    // Acidentes pendentes (notificação para admins, motoristas só veem seus próprios via RLS)
    acidentes.forEach(ac => {
      const v = veiculos.find(x => x.id === ac.veiculo_id);
      out.push({
        id: `ac-${ac.id}`, level: "atencao", tipo: "Acidente",
        titulo: `Nova ocorrência registrada — ${ac.motorista_nome}, ${v?.placa ?? "veículo"}`,
        descricao: `Protocolo ${ac.protocolo} • ${new Date(ac.data_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        veiculoId: ac.veiculo_id ?? undefined,
        link: `/acidentes/${ac.id}`,
      });
    });

    // Documentos veiculares (CRLV, IPVA, Seguro, Inspeção) — críticos se vencidos ou ≤30d
    veiculos.forEach(v => {
      const checaDoc = (idSuffix: string, tipo: string, dataISO?: string | null, pendente = false) => {
        if (!dataISO && !pendente) return;
        const dias = dataISO ? Math.ceil((new Date(dataISO).getTime() - now) / DAY) : null;
        if (pendente) {
          out.push({
            id: `doc-${idSuffix}-${v.id}`, level: "critico", tipo: "Documento",
            titulo: `${tipo} pendente — ${v.placa}`,
            descricao: dataISO ? `Vence em ${new Date(dataISO).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Pagamento pendente",
            veiculoId: v.id, link: `/veiculos/${v.id}`,
          });
          return;
        }
        if (dias == null) return;
        if (dias < 0) {
          out.push({
            id: `doc-${idSuffix}-${v.id}`, level: "critico", tipo: "Documento",
            titulo: `${tipo} vencido — ${v.placa}`,
            descricao: `Vencido há ${Math.abs(dias)} dias`,
            veiculoId: v.id, link: `/veiculos/${v.id}`,
          });
        } else if (dias <= 30) {
          out.push({
            id: `doc-${idSuffix}-${v.id}`, level: "critico", tipo: "Documento",
            titulo: `${tipo} vence em breve — ${v.placa}`,
            descricao: `Vence em ${dias} dias`,
            veiculoId: v.id, link: `/veiculos/${v.id}`,
          });
        }
      };
      checaDoc("crlv", "CRLV", (v as any).crlv_vencimento);
      checaDoc("ipva", "IPVA", (v as any).ipva_vencimento, (v as any).ipva_status === "pendente");
      checaDoc("seguro", "Seguro", (v as any).seguro_fim);
      checaDoc("inspecao", "Inspeção", (v as any).inspecao_proxima);
    });

    const order: Record<AlertLevel, number> = { critico: 0, atencao: 1, info: 2 };
    return out
      .filter(a => !isDismissed(a.id))
      .sort((a, b) => order[a.level] - order[b.level]);
  }, [veiculos, motoristas, manutencoes, checklists, multas, abastecimentos, acidentes, isDismissed]);

  const counts = useMemo(() => ({
    total: alerts.length,
    critico: alerts.filter(a => a.level === "critico").length,
    atencao: alerts.filter(a => a.level === "atencao").length,
    info: alerts.filter(a => a.level === "info").length,
  }), [alerts]);

  return { alerts, counts, loading, reload };
}

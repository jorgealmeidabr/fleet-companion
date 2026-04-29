// Hook unificado de alertas da frota: CNH vencida/vencendo, manutenção atrasada,
// checklist faltando, multa pendente, consumo anormal.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Veiculo, Motorista, Manutencao, Checklist, Multa, Abastecimento } from "@/lib/types";

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
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [v, mt, mn, ck, mu, ab] = await Promise.all([
      supabase.from("veiculos").select("*"),
      supabase.from("motoristas").select("*"),
      supabase.from("manutencoes").select("*"),
      supabase.from("checklists").select("*"),
      supabase.from("multas").select("*"),
      supabase.from("abastecimentos").select("*"),
    ]);
    setVeiculos((v.data ?? []) as Veiculo[]);
    setMotoristas((mt.data ?? []) as Motorista[]);
    setManutencoes((mn.data ?? []) as Manutencao[]);
    setChecklists((ck.data ?? []) as Checklist[]);
    setMultas((mu.data ?? []) as Multa[]);
    setAbastecimentos((ab.data ?? []) as Abastecimento[]);
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
          descricao: `Vencida em ${new Date(m.cnh_validade).toLocaleDateString("pt-BR")}`,
          motoristaId: m.id, link: `/motoristas/${m.id}`,
        });
      } else if (diff < 30 * DAY) {
        out.push({
          id: `cnh-${m.id}`, level: "atencao", tipo: "CNH",
          titulo: `CNH vence em breve — ${m.nome}`,
          descricao: `Vence em ${new Date(m.cnh_validade).toLocaleDateString("pt-BR")}`,
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

    const order: Record<AlertLevel, number> = { critico: 0, atencao: 1, info: 2 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }, [veiculos, motoristas, manutencoes, checklists, multas, abastecimentos]);

  const counts = useMemo(() => ({
    total: alerts.length,
    critico: alerts.filter(a => a.level === "critico").length,
    atencao: alerts.filter(a => a.level === "atencao").length,
    info: alerts.filter(a => a.level === "info").length,
  }), [alerts]);

  return { alerts, counts, loading, reload };
}

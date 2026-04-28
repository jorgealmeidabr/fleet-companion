import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { fmtDateTime, fmtBRL, fmtNumber } from "@/lib/format";
import { History as HistoryIcon, Wrench, Fuel, ClipboardCheck, CalendarRange, AlertTriangle, ExternalLink } from "lucide-react";
import type { Veiculo, Motorista, Manutencao, Abastecimento, Checklist, Agendamento, Multa } from "@/lib/types";

type EventType = "Manutenção" | "Abastecimento" | "Checklist" | "Agendamento" | "Multa";

interface TimelineItem {
  id: string;
  tipo: EventType;
  data: string;
  titulo: string;
  subtitulo?: string;
  responsavel?: string;
  valor?: number;
}

const ICONS: Record<EventType, any> = {
  "Manutenção": Wrench, "Abastecimento": Fuel, "Checklist": ClipboardCheck,
  "Agendamento": CalendarRange, "Multa": AlertTriangle,
};

const TIPO_CLASS: Record<EventType, string> = {
  "Manutenção": "bg-warning/15 text-warning border-warning/20",
  "Abastecimento": "bg-info/15 text-info border-info/20",
  "Checklist": "bg-primary/15 text-primary border-primary/20",
  "Agendamento": "bg-success/15 text-success border-success/20",
  "Multa": "bg-destructive/15 text-destructive border-destructive/20",
};

export function DashboardHistorico() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [v, m] = await Promise.all([
        supabase.from("veiculos").select("*").order("placa"),
        supabase.from("motoristas").select("*").order("nome"),
      ]);
      const vs = (v.data ?? []) as Veiculo[];
      setVeiculos(vs);
      setMotoristas((m.data ?? []) as Motorista[]);
      if (vs.length && !veiculoId) setVeiculoId(vs[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const motoristaMap = useMemo(() => Object.fromEntries(motoristas.map(m => [m.id, m.nome])), [motoristas]);

  useEffect(() => {
    if (!veiculoId) { setItems([]); return; }
    (async () => {
      setLoading(true);
      const [m, a, c, ag, mu] = await Promise.all([
        supabase.from("manutencoes").select("*").eq("veiculo_id", veiculoId).order("data", { ascending: false }).limit(20),
        supabase.from("abastecimentos").select("*").eq("veiculo_id", veiculoId).order("data", { ascending: false }).limit(20),
        supabase.from("checklists").select("*").eq("veiculo_id", veiculoId).order("data", { ascending: false }).limit(20),
        supabase.from("agendamentos").select("*").eq("veiculo_id", veiculoId).order("data_saida", { ascending: false }).limit(20),
        supabase.from("multas").select("*").eq("veiculo_id", veiculoId).order("data_infracao", { ascending: false }).limit(20),
      ]);
      const all: TimelineItem[] = [
        ...((m.data ?? []) as Manutencao[]).map(x => ({
          id: `m-${x.id}`, tipo: "Manutenção" as EventType, data: x.data,
          titulo: `${x.tipo === "preventiva" ? "Preventiva" : "Corretiva"} • ${x.oficina ?? "—"}`,
          subtitulo: x.descricao ?? undefined, valor: x.custo_total,
        })),
        ...((a.data ?? []) as Abastecimento[]).map(x => ({
          id: `a-${x.id}`, tipo: "Abastecimento" as EventType, data: x.data,
          titulo: `${fmtNumber(x.litros)} L • ${x.posto ?? "—"}`,
          subtitulo: x.consumo_km_l ? `Consumo: ${fmtNumber(x.consumo_km_l, { maximumFractionDigits: 2 })} km/L` : undefined,
          responsavel: x.motorista_id ? motoristaMap[x.motorista_id] : undefined,
          valor: x.valor_total,
        })),
        ...((c.data ?? []) as Checklist[]).map(x => ({
          id: `c-${x.id}`, tipo: "Checklist" as EventType, data: x.data,
          titulo: `Checklist — ${x.status === "ok" ? "OK" : "Problema"}`,
          subtitulo: x.observacoes ?? undefined,
          responsavel: x.motorista_id ? motoristaMap[x.motorista_id] : undefined,
        })),
        ...((ag.data ?? []) as Agendamento[]).map(x => ({
          id: `g-${x.id}`, tipo: "Agendamento" as EventType, data: x.data_saida,
          titulo: `Agendamento • ${x.status}`,
          subtitulo: x.destino ?? undefined,
          responsavel: motoristaMap[x.motorista_id],
        })),
        ...((mu.data ?? []) as Multa[]).map(x => ({
          id: `mu-${x.id}`, tipo: "Multa" as EventType, data: x.data_infracao,
          titulo: x.tipo_infracao,
          subtitulo: `${x.pontos_cnh} pts • ${x.status_pagamento}`,
          responsavel: x.motorista_id ? motoristaMap[x.motorista_id] : undefined,
          valor: x.valor,
        })),
      ];
      all.sort((p, q) => q.data.localeCompare(p.data));
      setItems(all.slice(0, 15));
      setLoading(false);
    })();
  }, [veiculoId, motoristaMap]);

  return (
    <Card className="mt-6 shadow-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HistoryIcon className="h-4 w-4" /> Histórico — Linha do tempo por veículo
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={veiculoId} onValueChange={setVeiculoId}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Selecione um veículo" /></SelectTrigger>
            <SelectContent>
              {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button asChild size="sm" variant="outline">
            <Link to="/historico"><ExternalLink className="mr-1 h-3.5 w-3.5" />Ver completo</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!veiculoId ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Selecione um veículo.</p>
        ) : loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Sem eventos registrados para este veículo.</p>
        ) : (
          <ol className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {items.map(it => {
              const Icon = ICONS[it.tipo];
              return (
                <li key={it.id} className="flex items-start gap-3 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={TIPO_CLASS[it.tipo]}>{it.tipo}</Badge>
                      <span className="text-sm font-medium">{it.titulo}</span>
                      {it.responsavel && <span className="text-xs text-muted-foreground">• {it.responsavel}</span>}
                    </div>
                    {it.subtitulo && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{it.subtitulo}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(it.data)}</span>
                    {it.valor != null && <span className="text-xs font-medium">{fmtBRL(it.valor)}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

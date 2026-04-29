import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtDateTime, fmtDateTimeShort, fmtBRL, fmtNumber } from "@/lib/format";
import type { Veiculo, Motorista, Agendamento, Manutencao, Abastecimento, Checklist, Multa } from "@/lib/types";
import { Wrench, Fuel, ClipboardCheck, CalendarRange, AlertTriangle, Download } from "lucide-react";

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

export default function Historico() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("veiculos").select("*").order("placa").then(({ data }) => setVeiculos((data ?? []) as Veiculo[]));
    supabase.from("motoristas").select("*").order("nome").then(({ data }) => setMotoristas((data ?? []) as Motorista[]));
  }, []);

  const motoristaMap = useMemo(() => Object.fromEntries(motoristas.map(m => [m.id, m.nome])), [motoristas]);
  const veiculoSel = useMemo(() => veiculos.find(v => v.id === veiculoId), [veiculos, veiculoId]);

  useEffect(() => {
    if (!veiculoId) { setItems([]); setAgendamentos([]); return; }
    (async () => {
      setLoading(true);
      const [m, a, c, ag, mu] = await Promise.all([
        supabase.from("manutencoes").select("*").eq("veiculo_id", veiculoId).order("data", { ascending: false }),
        supabase.from("abastecimentos").select("*").eq("veiculo_id", veiculoId).order("data", { ascending: false }),
        supabase.from("checklists").select("*").eq("veiculo_id", veiculoId).order("data", { ascending: false }),
        supabase.from("agendamentos").select("*").eq("veiculo_id", veiculoId).order("data_saida", { ascending: false }),
        supabase.from("multas").select("*").eq("veiculo_id", veiculoId).order("data_infracao", { ascending: false }),
      ]);
      const ags = (ag.data ?? []) as Agendamento[];
      setAgendamentos(ags);
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
        ...ags.map(x => ({
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
      setItems(all);
      setLoading(false);
    })();
  }, [veiculoId, motoristaMap]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (tipoFiltro !== "todos" && i.tipo !== tipoFiltro) return false;
      if (from && i.data < from) return false;
      if (to && i.data > to + "T23:59:59") return false;
      return true;
    });
  }, [items, tipoFiltro, from, to]);

  const usoRows = useMemo(() => {
    return agendamentos
      .filter(a => !from || a.data_saida >= from)
      .filter(a => !to || a.data_saida <= to + "T23:59:59")
      .map(a => ({
        motorista: motoristaMap[a.motorista_id] ?? "—",
        saida: a.data_saida,
        retorno: a.data_retorno_real ?? a.data_retorno_prevista,
        destino: a.destino ?? "—",
        kmRodado: a.km_retorno && a.km_saida ? a.km_retorno - a.km_saida : null,
        status: a.status,
      }));
  }, [agendamentos, motoristaMap, from, to]);

  const exportCSV = () => {
    if (!veiculoSel) return;
    const header = ["Motorista", "Saida", "Retorno", "Destino", "Km Rodado", "Status"];
    const rows = usoRows.map(r => [
      r.motorista, r.saida, r.retorno, r.destino,
      r.kmRodado != null ? String(r.kmRodado) : "", r.status,
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico_${veiculoSel.placa}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Histórico" subtitle="Linha do tempo completa por veículo" />

      <Card className="mb-4 shadow-card">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Veículo *</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue placeholder="Selecione um veículo..." /></SelectTrigger>
                <SelectContent>
                  {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de evento</Label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Abastecimento">Abastecimento</SelectItem>
                  <SelectItem value="Checklist">Checklist</SelectItem>
                  <SelectItem value="Agendamento">Agendamento</SelectItem>
                  <SelectItem value="Multa">Multa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!veiculoId ? (
        <Card className="shadow-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Selecione um veículo para carregar o histórico.
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="shadow-card"><CardContent className="p-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : (
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timeline">Timeline ({filtered.length})</TabsTrigger>
            <TabsTrigger value="uso">Tabela de uso ({usoRows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <Card className="shadow-card">
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <p className="p-10 text-center text-muted-foreground">Nenhum evento no período.</p>
                ) : (
                  <ol className="divide-y divide-border">
                    {filtered.map(it => {
                      const Icon = ICONS[it.tipo];
                      return (
                        <li key={it.id} className="flex items-start gap-3 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={TIPO_CLASS[it.tipo]}>{it.tipo}</Badge>
                              <span className="font-medium">{it.titulo}</span>
                              {it.responsavel && <span className="text-xs text-muted-foreground">• {it.responsavel}</span>}
                            </div>
                            {it.subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{it.subtitulo}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="text-xs text-muted-foreground">{fmtDateTime(it.data)}</span>
                            {it.valor != null && <span className="text-sm font-medium">{fmtBRL(it.valor)}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uso">
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Quem pegou, quando e km rodado</CardTitle>
                <Button size="sm" variant="outline" onClick={exportCSV} disabled={usoRows.length === 0}>
                  <Download className="mr-1 h-4 w-4" />Exportar CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {usoRows.length === 0 ? (
                  <p className="p-10 text-center text-muted-foreground">Sem agendamentos no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Saída</TableHead>
                          <TableHead>Retorno</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead className="text-right">Km rodado</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usoRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.motorista}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtDate(r.saida)}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtDate(r.retorno)}</TableCell>
                            <TableCell>{r.destino}</TableCell>
                            <TableCell className="text-right">{r.kmRodado != null ? fmtNumber(r.kmRodado) : "—"}</TableCell>
                            <TableCell>{r.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

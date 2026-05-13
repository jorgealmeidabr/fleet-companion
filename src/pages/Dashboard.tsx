import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Veiculo, Manutencao, Abastecimento, Motorista, Checklist, Multa } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { fmtBRL, fmtNumber, nowSP } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { useAlerts } from "@/hooks/useAlerts";
import { Car, Wrench, AlertTriangle, Fuel, Gauge, Bell } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardHistorico } from "@/components/DashboardHistorico";
import { differenceInDays, parseISO, format, subMonths, startOfMonth, endOfMonth } from "date-fns";

// Safe wrappers — never throw on null/invalid dates
const safeParse = (d: string | null | undefined): Date | null => {
  if (!d || typeof d !== "string") return null;
  try {
    const x = parseISO(d);
    return isNaN(x.getTime()) ? null : x;
  } catch { return null; }
};
const safeDiffDays = (d: string | null | undefined, ref: Date): number | null => {
  const x = safeParse(d);
  return x ? differenceInDays(ref, x) : null;
};

export default function Dashboard() {
  const { canSeeFinancial } = usePermissions();
  const { counts: alertCounts } = useAlerts();
  const money = (n: number) => canSeeFinancial() ? fmtBRL(n) : "🔒 ••••";
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const [v, m, a, mo, c, mu, ag] = await Promise.all([
        supabase.from("veiculos").select("*"),
        supabase.from("manutencoes").select("*"),
        supabase.from("abastecimentos").select("*"),
        supabase.from("motoristas").select("*"),
        supabase.from("checklists").select("*"),
        supabase.from("multas").select("*"),
        supabase.from("agendamentos").select("veiculo_id,status").eq("status", "ativo"),
      ]);
      setVeiculos((v.data ?? []) as Veiculo[]);
      setManutencoes((m.data ?? []) as Manutencao[]);
      setAbastecimentos((a.data ?? []) as Abastecimento[]);
      setMotoristas((mo.data ?? []) as Motorista[]);
      setChecklists((c.data ?? []) as Checklist[]);
      setMultas((mu.data ?? []) as Multa[]);
      setOcupados(new Set(((ag.data ?? []) as Array<{ veiculo_id: string }>).map(x => x.veiculo_id)));
      setLoading(false);
    };
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  // Status efetivo: agendamento ativo sobrescreve "disponivel" para "reservado"
  const statusEfetivo = (v: Veiculo) =>
    (v.status === "manutencao" || v.status === "inativo") ? v.status
      : (ocupados.has(v.id) ? "reservado" : v.status);

  // KPIs
  const disponiveis = veiculos.filter(v => statusEfetivo(v) === "disponivel").length;
  const emManutencao = veiculos.filter(v => statusEfetivo(v) === "manutencao").length;
  const inativos = veiculos.filter(v => statusEfetivo(v) === "inativo").length;

  const now = nowSP();
  const ini = startOfMonth(now), fim = endOfMonth(now);
  const iniAnt = startOfMonth(subMonths(now, 1)), fimAnt = endOfMonth(subMonths(now, 1));

  const inRange = (d: string | null | undefined, a: Date, b: Date) => {
    const x = safeParse(d);
    return x ? x >= a && x <= b : false;
  };
  const gastoCombMes = abastecimentos.filter(x => inRange(x.data, ini, fim)).reduce((s, x) => s + Number(x.valor_total), 0);
  const gastoCombMesAnt = abastecimentos.filter(x => inRange(x.data, iniAnt, fimAnt)).reduce((s, x) => s + Number(x.valor_total), 0);
  const varComb = gastoCombMesAnt > 0 ? ((gastoCombMes - gastoCombMesAnt) / gastoCombMesAnt) * 100 : 0;

  const gastoManutMes = manutencoes.filter(x => inRange(x.data, ini, fim)).reduce((s, x) => s + Number(x.custo_total), 0);
  const gastoManutMesAnt = manutencoes.filter(x => inRange(x.data, iniAnt, fimAnt)).reduce((s, x) => s + Number(x.custo_total), 0);
  const varManut = gastoManutMesAnt > 0 ? ((gastoManutMes - gastoManutMesAnt) / gastoManutMesAnt) * 100 : 0;

  // Top 3 veículos por custo total
  const custosVeic = veiculos.map(v => {
    const ab = abastecimentos.filter(a => a.veiculo_id === v.id).reduce((s, a) => s + Number(a.valor_total), 0);
    const mn = manutencoes.filter(m => m.veiculo_id === v.id).reduce((s, m) => s + Number(m.custo_total), 0);
    return { ...v, custo: ab + mn };
  }).sort((a, b) => b.custo - a.custo).slice(0, 3);

  const consumoMedio = (() => {
    const vals = abastecimentos.map(a => Number(a.consumo_km_l)).filter(n => n && n > 0);
    return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
  })();

  // Alertas
  const alertas: { tipo: string; msg: string; nivel: "danger" | "warning" }[] = [];
  veiculos.forEach(v => {
    const ms = manutencoes.filter(m => m.veiculo_id === v.id);
    ms.forEach(m => {
      if (m.proxima_km && v.km_atual > m.proxima_km) alertas.push({ tipo: "Manutenção", msg: `${v.placa} – km vencido (${v.km_atual} > ${m.proxima_km})`, nivel: "danger" });
      const px = safeParse(m.proxima_data);
      if (px && px < now && m.status !== "concluida") alertas.push({ tipo: "Manutenção", msg: `${v.placa} – data vencida (${m.proxima_data})`, nivel: "danger" });
    });
    const ult = checklists.filter(c => c.veiculo_id === v.id).sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))[0];
    const ultDiff = ult ? safeDiffDays(ult.data, now) : null;
    if (!ult || (ultDiff !== null && ultDiff > 7)) {
      alertas.push({ tipo: "Checklist", msg: `${v.placa} – sem checklist há ${ultDiff !== null ? ultDiff : "+7"} dias`, nivel: "warning" });
    }
  });
  motoristas.forEach(m => {
    const dias = safeDiffDays(m.cnh_validade, now);
    if (dias === null) return;
    if (dias < 0) alertas.push({ tipo: "CNH", msg: `${m.nome} – CNH vencida`, nivel: "danger" });
    else if (dias <= 30) alertas.push({ tipo: "CNH", msg: `${m.nome} – CNH vence em ${dias}d`, nivel: "warning" });
  });
  multas.filter(m => m.status_pagamento === "pendente").forEach(m => {
    alertas.push({ tipo: "Multa", msg: `${m.tipo_infracao} – ${money(Number(m.valor))}`, nivel: "warning" });
  });

  // Gráficos: barras 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    const a = startOfMonth(d), b = endOfMonth(d);
    return {
      mes: format(d, "MMM/yy"),
      Combustivel: abastecimentos.filter(x => inRange(x.data, a, b)).reduce((s, x) => s + Number(x.valor_total), 0),
      Manutencao: manutencoes.filter(x => inRange(x.data, a, b)).reduce((s, x) => s + Number(x.custo_total), 0),
    };
  });

  const pieData = [
    { name: "Disponível", value: disponiveis, color: "hsl(142 70% 42%)" },
    { name: "Manutenção", value: emManutencao, color: "hsl(32 95% 50%)" },
    { name: "Reservado", value: veiculos.filter(v => statusEfetivo(v) === "reservado").length, color: "hsl(210 90% 55%)" },
    { name: "Inativo", value: inativos, color: "hsl(0 75% 55%)" },
  ];

  const linhaConsumo = Array.from({ length: 3 }, (_, i) => {
    const d = subMonths(now, 2 - i);
    const a = startOfMonth(d), b = endOfMonth(d);
    const vals = abastecimentos.filter(x => inRange(x.data, a, b)).map(x => Number(x.consumo_km_l)).filter(n => n && n > 0);
    return { mes: format(d, "MMM/yy"), kml: vals.length ? +(vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(2) : 0 };
  });

  if (loading) return <div className="text-muted-foreground">Carregando dashboard...</div>;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Painel de Eficiência e Disponibilidade da Frota" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Disponíveis" value={disponiveis} icon={Car} tone="success" hint={`${veiculos.length} veículos no total`} />
        <KpiCard label="Em manutenção" value={emManutencao} icon={Wrench} tone="warning" />
        <KpiCard label="Inativos" value={inativos} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="Alertas ativos" value={alertCounts.total} icon={Bell} tone={alertCounts.total ? "destructive" : "success"} />
        <KpiCard label="Combustível (mês)" value={money(gastoCombMes)} icon={Fuel} tone="brand" trend={canSeeFinancial() ? { value: varComb, label: "vs mês ant." } : undefined} />
        <KpiCard label="Manutenção (mês)" value={money(gastoManutMes)} icon={Wrench} tone="info" trend={canSeeFinancial() ? { value: varManut, label: "vs mês ant." } : undefined} />
        <KpiCard label="Consumo médio" value={`${fmtNumber(consumoMedio, { maximumFractionDigits: 2 })} km/l`} icon={Gauge} />
        <KpiCard label="Veículos cadastrados" value={veiculos.length} icon={Car} />
      </div>

      <ErrorBoundary fallback={<div className="mt-6 rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">Não foi possível carregar os gráficos.</div>}>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Gastos mensais (últimos 6 meses)</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meses}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => money(Number(v))} />
                <Legend />
                <Bar dataKey="Combustivel" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Manutencao" fill="hsl(var(--info))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Status da frota</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Consumo médio (km/l)</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={linhaConsumo}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="kml" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Top 3 veículos – maior custo total</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {custosVeic.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
              {custosVeic.map((v, i) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand text-sm font-bold text-primary-foreground bg-amber-500">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.placa} – {v.marca} {v.modelo}</p>
                    <p className="text-xs text-muted-foreground">{v.km_atual.toLocaleString("pt-BR")} km</p>
                  </div>
                  <p className="text-sm font-bold">{money(v.custo)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Documentos vencendo (próximos 60 dias)</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              type DocVenc = { vid: string; placa: string; titulo: string; tipo: string; dias: number; pendente: boolean };
              const items: DocVenc[] = [];
              const calcDias = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - now.getTime()) / 86_400_000) : null;
              veiculos.forEach(v => {
                const titulo = `${v.placa} – ${v.marca} ${v.modelo}`;
                const docs: Array<[string, string | null | undefined, boolean]> = [
                  ["CRLV", v.crlv_vencimento, false],
                  ["IPVA", v.ipva_vencimento, v.ipva_status === "pendente"],
                  ["Seguro", v.seguro_fim, false],
                  ["Inspeção", v.inspecao_proxima, false],
                ];
                docs.forEach(([tipo, data, pend]) => {
                  const dias = calcDias(data);
                  if (pend && dias != null) {
                    items.push({ vid: v.id, placa: v.placa, titulo, tipo, dias, pendente: true });
                  } else if (dias != null && dias <= 60) {
                    items.push({ vid: v.id, placa: v.placa, titulo, tipo, dias, pendente: false });
                  }
                });
              });
              items.sort((a, b) => a.dias - b.dias);
              if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum documento vencendo nos próximos 60 dias.</p>;
              return (
                <div className="divide-y divide-border">
                  {items.map((it, i) => {
                    const cls = it.pendente || it.dias < 0
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : it.dias <= 30
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                    const label = it.pendente ? "Pendente" : it.dias < 0 ? `Vencido há ${Math.abs(it.dias)}d` : `${it.dias}d restantes`;
                    return (
                      <div key={`${it.vid}-${it.tipo}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{it.titulo}</p>
                          <p className="text-xs text-muted-foreground">{it.tipo}</p>
                        </div>
                        <Badge variant="outline" className={cls}>{label}</Badge>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Próximas manutenções</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const veicMap = Object.fromEntries(veiculos.map(v => [v.id, v]));
              type Prox = { id: string; titulo: string; tipo: string; diasRest: number | null; kmRest: number | null; urg: number };
              const items: Prox[] = [];
              manutencoes.forEach(m => {
                if (m.status === "concluida") return;
                const v = veicMap[m.veiculo_id];
                if (!v) return;
                const proxKm = (m as any).km_proxima_manutencao ?? m.proxima_km;
                const proxData = (m as any).data_proxima_manutencao ?? m.proxima_data;
                let diasRest: number | null = null;
                let kmRest: number | null = null;
                if (proxData) diasRest = Math.ceil((new Date(proxData).getTime() - now.getTime()) / 86_400_000);
                if (proxKm != null) kmRest = proxKm - v.km_atual;
                const passaKm = kmRest != null && kmRest <= 1000;
                const passaData = diasRest != null && diasRest <= 30;
                if (!passaKm && !passaData) return;
                // Urgência: menor é mais urgente. Combina km e dias normalizados.
                const urg = Math.min(
                  kmRest != null ? kmRest : Number.POSITIVE_INFINITY,
                  diasRest != null ? diasRest * 50 : Number.POSITIVE_INFINITY,
                );
                items.push({
                  id: m.id,
                  titulo: `${v.placa} – ${v.marca} ${v.modelo}`,
                  tipo: (m as any).subtipo ? `${m.tipo} · ${String((m as any).subtipo).replace(/_/g, " ")}` : m.tipo,
                  diasRest, kmRest, urg,
                });
              });
              items.sort((a, b) => a.urg - b.urg);
              if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma manutenção próxima do limite (1.000 km ou 30 dias).</p>;
              return (
                <div className="divide-y divide-border">
                  {items.map(it => {
                    const critico = (it.kmRest != null && it.kmRest <= 0) || (it.diasRest != null && it.diasRest <= 0);
                    const cls = critico
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30";
                    const partes: string[] = [];
                    if (it.kmRest != null) partes.push(it.kmRest <= 0 ? `${Math.abs(it.kmRest)} km vencido` : `${fmtNumber(it.kmRest)} km restantes`);
                    if (it.diasRest != null) partes.push(it.diasRest <= 0 ? `${Math.abs(it.diasRest)}d vencido` : `${it.diasRest}d restantes`);
                    return (
                      <div key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{it.titulo}</p>
                          <p className="text-xs text-muted-foreground capitalize">{it.tipo}</p>
                        </div>
                        <Badge variant="outline" className={cls}>{partes.join(" · ")}</Badge>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
      </ErrorBoundary>

      <DashboardHistorico />
    </>
  );
}

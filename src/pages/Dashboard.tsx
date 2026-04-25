import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Veiculo, Manutencao, Abastecimento, Motorista, Checklist, Multa } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { fmtBRL, fmtNumber } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { Car, Wrench, AlertTriangle, Fuel, Gauge, Bell } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export default function Dashboard() {
  const { canSeeFinancial } = usePermissions();
  const money = (n: number) => canSeeFinancial() ? fmtBRL(n) : "🔒 ••••";
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);

  useEffect(() => {
    (async () => {
      const [v, m, a, mo, c, mu] = await Promise.all([
        supabase.from("veiculos").select("*"),
        supabase.from("manutencoes").select("*"),
        supabase.from("abastecimentos").select("*"),
        supabase.from("motoristas").select("*"),
        supabase.from("checklists").select("*"),
        supabase.from("multas").select("*"),
      ]);
      setVeiculos((v.data ?? []) as Veiculo[]);
      setManutencoes((m.data ?? []) as Manutencao[]);
      setAbastecimentos((a.data ?? []) as Abastecimento[]);
      setMotoristas((mo.data ?? []) as Motorista[]);
      setChecklists((c.data ?? []) as Checklist[]);
      setMultas((mu.data ?? []) as Multa[]);
      setLoading(false);
    })();
  }, []);

  // KPIs
  const disponiveis = veiculos.filter(v => v.status === "disponivel").length;
  const emManutencao = veiculos.filter(v => v.status === "manutencao").length;
  const inativos = veiculos.filter(v => v.status === "inativo").length;

  const now = new Date();
  const ini = startOfMonth(now), fim = endOfMonth(now);
  const iniAnt = startOfMonth(subMonths(now, 1)), fimAnt = endOfMonth(subMonths(now, 1));

  const inRange = (d: string, a: Date, b: Date) => { const x = parseISO(d); return x >= a && x <= b; };
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
      if (m.proxima_data && parseISO(m.proxima_data) < now && m.status !== "concluida") alertas.push({ tipo: "Manutenção", msg: `${v.placa} – data vencida (${m.proxima_data})`, nivel: "danger" });
    });
    const ult = checklists.filter(c => c.veiculo_id === v.id).sort((a, b) => b.data.localeCompare(a.data))[0];
    if (!ult || differenceInDays(now, parseISO(ult.data)) > 7) {
      alertas.push({ tipo: "Checklist", msg: `${v.placa} – sem checklist há ${ult ? differenceInDays(now, parseISO(ult.data)) : "+7"} dias`, nivel: "warning" });
    }
  });
  motoristas.forEach(m => {
    const dias = differenceInDays(parseISO(m.cnh_validade), now);
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
    { name: "Reservado", value: veiculos.filter(v => v.status === "reservado").length, color: "hsl(210 90% 55%)" },
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
      <PageHeader title="Dashboard" subtitle="Visão geral da frota BRQ em tempo real" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Disponíveis" value={disponiveis} icon={Car} tone="success" hint={`${veiculos.length} veículos no total`} />
        <KpiCard label="Em manutenção" value={emManutencao} icon={Wrench} tone="warning" />
        <KpiCard label="Inativos" value={inativos} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="Alertas ativos" value={alertas.length} icon={Bell} tone={alertas.length ? "destructive" : "success"} />
        <KpiCard label="Combustível (mês)" value={money(gastoCombMes)} icon={Fuel} tone="brand" trend={canSeeFinancial() ? { value: varComb, label: "vs mês ant." } : undefined} />
        <KpiCard label="Manutenção (mês)" value={money(gastoManutMes)} icon={Wrench} tone="info" trend={canSeeFinancial() ? { value: varManut, label: "vs mês ant." } : undefined} />
        <KpiCard label="Consumo médio" value={`${fmtNumber(consumoMedio, { maximumFractionDigits: 2 })} km/l`} icon={Gauge} />
        <KpiCard label="Veículos cadastrados" value={veiculos.length} icon={Car} />
      </div>

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
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand text-sm font-bold text-primary-foreground">{i + 1}</div>
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
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Alertas inteligentes
            {alertas.length > 0 && <Badge variant="destructive">{alertas.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">✓ Nenhum alerta no momento.</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={a.nivel === "danger" ? "destructive" : "outline"} className={a.nivel === "warning" ? "border-warning/30 bg-warning/10 text-warning" : ""}>{a.tipo}</Badge>
                    <span>{a.msg}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { KpiCard } from "@/components/KpiCard";
import { useTable } from "@/hooks/useTable";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtNumber } from "@/lib/format";
import type { Abastecimento, Veiculo, Motorista } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplet, DollarSign, Gauge, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/csv";
import { Money } from "@/components/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

const PALETTE = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

export default function Abastecimentos() {
  const { rows, loading, insert, update, remove, reload } = useTable<Abastecimento>("abastecimentos");
  const { canSeeFinancial } = usePermissions();
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  useEffect(() => {
    supabase.from("veiculos").select("*").then(({ data }) => setVeiculos((data ?? []) as Veiculo[]));
    supabase.from("motoristas").select("*").then(({ data }) => setMotoristas((data ?? []) as Motorista[]));
  }, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: "veiculo_id", label: "Veículo", type: "select", required: true,
      options: veiculos.map(v => ({ value: v.id, label: `${v.placa} – ${v.marca} ${v.modelo}` })) },
    { name: "motorista_id", label: "Motorista", type: "select",
      options: motoristas.map(m => ({ value: m.id, label: m.nome })) },
    { name: "data", label: "Data", type: "date", required: true },
    { name: "km_atual", label: "Km atual", type: "number", required: true },
    { name: "litros", label: "Litros", type: "number", step: "0.01", required: true },
    { name: "valor_total", label: "Valor total (R$)", type: "number", step: "0.01", required: true },
    { name: "posto", label: "Posto" },
  ], [veiculos, motoristas]);

  const vLabel = (id: string) => veiculos.find(x => x.id === id)?.placa ?? "—";
  const mLabel = (id: string | null) => motoristas.find(x => x.id === id)?.nome ?? "—";

  // Após salvar, atualiza km_atual do veículo se for maior
  const handleInsert = async (values: Partial<Abastecimento>) => {
    await insert(values);
    if (values.veiculo_id && values.km_atual) {
      const v = veiculos.find(x => x.id === values.veiculo_id);
      if (v && Number(values.km_atual) > v.km_atual) {
        await (supabase.from("veiculos") as any).update({ km_atual: Number(values.km_atual) }).eq("id", v.id);
        const { data } = await supabase.from("veiculos").select("*");
        setVeiculos((data ?? []) as Veiculo[]);
      }
    }
    await reload();
  };

  // KPIs do mês corrente
  const monthKpis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthRows = rows.filter(r => r.data?.startsWith(ym));
    const litros = monthRows.reduce((s, r) => s + Number(r.litros || 0), 0);
    const gasto = monthRows.reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const consumos = rows.map(r => Number(r.consumo_km_l || 0)).filter(n => n > 0);
    const consumoMedio = consumos.length ? consumos.reduce((a, b) => a + b, 0) / consumos.length : 0;
    return { litros, gasto, consumoMedio };
  }, [rows]);

  // Anomalias: consumo cai >15% vs média do veículo
  const anomalies = useMemo(() => {
    const byVeic = new Map<string, Abastecimento[]>();
    rows.forEach(r => {
      if (!r.consumo_km_l) return;
      const arr = byVeic.get(r.veiculo_id) ?? [];
      arr.push(r);
      byVeic.set(r.veiculo_id, arr);
    });
    const flagged = new Set<string>();
    byVeic.forEach((arr) => {
      if (arr.length < 3) return;
      const sorted = [...arr].sort((a, b) => a.data.localeCompare(b.data));
      const last = sorted[sorted.length - 1];
      const prev = sorted.slice(0, -1);
      const avg = prev.reduce((s, r) => s + Number(r.consumo_km_l || 0), 0) / prev.length;
      if (avg > 0 && Number(last.consumo_km_l) < avg * 0.85) flagged.add(last.id);
    });
    return flagged;
  }, [rows]);

  // Dados do gráfico: últimos 10 abastecimentos por veículo
  const chartData = useMemo(() => {
    const byVeic = new Map<string, Abastecimento[]>();
    rows.forEach(r => {
      if (!r.consumo_km_l) return;
      const arr = byVeic.get(r.veiculo_id) ?? [];
      arr.push(r);
      byVeic.set(r.veiculo_id, arr);
    });

    // pega top 5 veículos com mais abastecimentos
    const topVeics = [...byVeic.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
    if (!topVeics.length) return { data: [], keys: [] as string[] };

    const series = topVeics.map(([vid, arr]) => {
      const last10 = [...arr].sort((a, b) => a.data.localeCompare(b.data)).slice(-10);
      return { vid, placa: vLabel(vid), points: last10 };
    });

    const maxLen = Math.max(...series.map(s => s.points.length));
    const data = Array.from({ length: maxLen }, (_, i) => {
      const row: any = { idx: `#${i + 1}` };
      series.forEach(s => {
        const p = s.points[i];
        if (p) row[s.placa] = Number(p.consumo_km_l);
      });
      return row;
    });
    return { data, keys: series.map(s => s.placa) };
  }, [rows, veiculos]);

  return (
    <>
      <PageHeader title="Abastecimentos" subtitle="Consumo médio e custo por km calculados automaticamente"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={rows.length === 0 || !canSeeFinancial()} title={!canSeeFinancial() ? "Sem permissão para exportar valores" : ""}
              onClick={() => downloadCSV(
                `abastecimentos_${new Date().toISOString().slice(0,10)}.csv`,
                ["Veículo", "Data", "Km", "Litros", "Valor", "Posto", "Consumo (km/L)", "Custo/km"],
                rows.map(r => [
                  veiculos.find(v => v.id === r.veiculo_id)?.placa ?? "—",
                  r.data, r.km_atual, r.litros, r.valor_total, r.posto ?? "",
                  r.consumo_km_l ?? "", r.custo_por_km ?? "",
                ]),
              )}>
              <Download className="mr-1 h-4 w-4" />Exportar CSV
            </Button>
            <FormDialog<Abastecimento> title="Novo abastecimento" fields={fields} onSubmit={handleInsert} />
          </div>
        } />

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <KpiCard label="Litros no mês" value={fmtNumber(monthKpis.litros, { maximumFractionDigits: 1 })} icon={Droplet} tone="info" />
        <KpiCard label="Gasto no mês" value={canSeeFinancial() ? (monthKpis.gasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })) : "🔒 ••••"} icon={DollarSign} tone="brand" />
        <KpiCard label="Consumo médio frota" value={`${fmtNumber(monthKpis.consumoMedio, { maximumFractionDigits: 2 })} km/l`} icon={Gauge} tone="success" />
      </div>

      {anomalies.size > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Possível problema mecânico</AlertTitle>
          <AlertDescription>
            {anomalies.size} abastecimento(s) com consumo {">"} 15% abaixo da média do veículo. Verifique os destacados na tabela.
          </AlertDescription>
        </Alert>
      )}

      {chartData.data.length > 0 && (
        <Card className="mb-4 shadow-card">
          <CardHeader><CardTitle className="text-base">Evolução de consumo (km/l) – últimos 10 abastecimentos</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                {chartData.keys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <DataTable<Abastecimento>
        rows={rows} loading={loading}
        columns={[
          { header: "Data", cell: r => fmtDate(r.data) },
          { header: "Veículo", cell: r => <span className="font-mono">{vLabel(r.veiculo_id)}</span> },
          { header: "Motorista", cell: r => mLabel(r.motorista_id) },
          { header: "Km", cell: r => fmtNumber(r.km_atual) },
          { header: "Litros", cell: r => fmtNumber(Number(r.litros), { maximumFractionDigits: 2 }) },
          { header: "Valor", cell: r => <Money value={Number(r.valor_total)} /> },
          { header: "Consumo", cell: r => (
            <span className={anomalies.has(r.id) ? "text-destructive font-semibold inline-flex items-center gap-1" : ""}>
              {anomalies.has(r.id) && <AlertTriangle className="h-3.5 w-3.5" />}
              {r.consumo_km_l ? `${fmtNumber(Number(r.consumo_km_l), { maximumFractionDigits: 2 })} km/l` : "—"}
            </span>
          )},
          { header: "R$/km", cell: r => r.custo_por_km ? <Money value={Number(r.custo_por_km)} /> : "—" },
          { header: "Posto", cell: r => r.posto ?? "—" },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Abastecimento> title="Editar abastecimento" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

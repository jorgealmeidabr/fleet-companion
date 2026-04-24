import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtDate } from "@/lib/format";
import type { Multa, Veiculo, Motorista } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function Multas() {
  const { rows, loading, insert, update, remove, reload } = useTable<Multa>("multas");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Multa | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  const [fVeic, setFVeic] = useState<string>("all");
  const [fMot, setFMot] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    supabase.from("veiculos").select("*").then(({ data }) => setVeiculos((data ?? []) as Veiculo[]));
    supabase.from("motoristas").select("*").then(({ data }) => setMotoristas((data ?? []) as Motorista[]));
  }, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: "veiculo_id", label: "Veículo", type: "select", required: true,
      options: veiculos.map(v => ({ value: v.id, label: `${v.placa} – ${v.marca} ${v.modelo}` })) },
    { name: "motorista_id", label: "Motorista", type: "select",
      options: motoristas.map(m => ({ value: m.id, label: m.nome })) },
    { name: "data_infracao", label: "Data infração", type: "date", required: true },
    { name: "tipo_infracao", label: "Tipo de infração", required: true },
    { name: "valor", label: "Valor (R$)", type: "number", step: "0.01", required: true },
    { name: "pontos_cnh", label: "Pontos CNH", type: "number", required: true },
    { name: "auto_infracao", label: "Auto de infração" },
    { name: "status_pagamento", label: "Status pagamento", type: "select", required: true,
      options: [{ label: "Pendente", value: "pendente" }, { label: "Pago", value: "pago" }, { label: "Contestado", value: "contestado" }] },
  ], [veiculos, motoristas]);

  const vL = (id: string) => veiculos.find(x => x.id === id)?.placa ?? "—";
  const mL = (id: string | null) => motoristas.find(x => x.id === id)?.nome ?? "—";

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (fVeic !== "all" && r.veiculo_id !== fVeic) return false;
      if (fMot !== "all" && r.motorista_id !== fMot) return false;
      if (fStatus !== "all" && r.status_pagamento !== fStatus) return false;
      if (busca) {
        const s = busca.toLowerCase();
        if (!r.tipo_infracao.toLowerCase().includes(s) && !(r.auto_infracao ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rows, fVeic, fMot, fStatus, busca]);

  const totals = useMemo(() => {
    const pendente = filtered.filter(r => r.status_pagamento === "pendente").reduce((s, r) => s + Number(r.valor || 0), 0);
    const pago = filtered.filter(r => r.status_pagamento === "pago").reduce((s, r) => s + Number(r.valor || 0), 0);
    const pontosPend = filtered.filter(r => r.status_pagamento !== "pago").reduce((s, r) => s + Number(r.pontos_cnh || 0), 0);
    return { pendente, pago, pontosPend };
  }, [filtered]);

  const marcarPago = async (m: Multa) => {
    await update(m.id, { status_pagamento: "pago" });
    await reload();
  };

  return (
    <>
      <PageHeader title="Multas" subtitle="Controle de infrações e pagamentos"
        actions={isAdmin && <FormDialog<Multa> title="Nova multa" fields={fields} onSubmit={insert} />} />

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <KpiCard label="Pendente de pagamento" value={fmtBRL(totals.pendente)} icon={AlertCircle} tone="destructive" hint="Soma dos valores com status pendente" />
        <KpiCard label="Pago" value={fmtBRL(totals.pago)} icon={CheckCircle2} tone="success" />
        <KpiCard label="Pontos CNH (não pagos)" value={totals.pontosPend} tone="warning" />
      </div>

      <Card className="mb-4 shadow-card">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <Input placeholder="Buscar infração ou auto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Select value={fVeic} onValueChange={setFVeic}>
            <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos veículos</SelectItem>
              {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fMot} onValueChange={setFMot}>
            <SelectTrigger><SelectValue placeholder="Motorista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos motoristas</SelectItem>
              {motoristas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="contestado">Contestado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <DataTable<Multa>
        rows={filtered} loading={loading}
        columns={[
          { header: "Data", cell: r => fmtDate(r.data_infracao) },
          { header: "Veículo", cell: r => <span className="font-mono">{vL(r.veiculo_id)}</span> },
          { header: "Motorista", cell: r => mL(r.motorista_id) },
          { header: "Infração", cell: r => r.tipo_infracao },
          { header: "Valor", cell: r => fmtBRL(Number(r.valor)) },
          { header: "Pontos", cell: r => r.pontos_cnh },
          { header: "Auto", cell: r => r.auto_infracao ?? "—" },
          { header: "Pagamento", cell: r => <StatusBadge status={r.status_pagamento} /> },
          { header: "Ações", cell: r => r.status_pagamento !== "pago" ? (
            <Button size="sm" variant="outline" className="h-8 text-success border-success/40 hover:bg-success/10"
              onClick={() => marcarPago(r)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Marcar como pago
            </Button>
          ) : <span className="text-xs text-muted-foreground">—</span> },
        ]}
        onEdit={isAdmin ? setEditing : undefined}
        onDelete={isAdmin ? (r) => remove(r.id) : undefined}
      />
      {editing && <FormDialog<Multa> title="Editar multa" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

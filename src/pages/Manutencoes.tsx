import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtDate, fmtNumber } from "@/lib/format";
import type { Manutencao, Veiculo } from "@/lib/types";

export default function Manutencoes() {
  const { rows, loading, insert, update, remove } = useTable<Manutencao>("manutencoes");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Manutencao | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  useEffect(() => { supabase.from("veiculos").select("*").then(({ data }) => setVeiculos((data ?? []) as Veiculo[])); }, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: "veiculo_id", label: "Veículo", type: "select", required: true,
      options: veiculos.map(v => ({ value: v.id, label: `${v.placa} – ${v.marca} ${v.modelo}` })) },
    { name: "tipo", label: "Tipo", type: "select", required: true,
      options: [{ label: "Preventiva", value: "preventiva" }, { label: "Corretiva", value: "corretiva" }] },
    { name: "data", label: "Data", type: "date", required: true },
    { name: "km_momento", label: "Km no momento", type: "number", required: true },
    { name: "descricao", label: "Descrição", type: "textarea" },
    { name: "pecas_trocadas", label: "Peças trocadas", type: "textarea" },
    { name: "custo_total", label: "Custo total (R$)", type: "number", step: "0.01", required: true },
    { name: "oficina", label: "Oficina" },
    { name: "proxima_km", label: "Próxima manutenção (km)", type: "number" },
    { name: "proxima_data", label: "Próxima manutenção (data)", type: "date" },
    { name: "status", label: "Status", type: "select", required: true,
      options: [{ label: "Agendada", value: "agendada" }, { label: "Em andamento", value: "em_andamento" }, { label: "Concluída", value: "concluida" }] },
  ], [veiculos]);

  const veicLabel = (id: string) => { const v = veiculos.find(x => x.id === id); return v ? v.placa : "—"; };

  return (
    <>
      <PageHeader title="Manutenções" subtitle="Histórico, custos e próximas revisões"
        actions={isAdmin && <FormDialog<Manutencao> title="Nova manutenção" fields={fields} onSubmit={insert} />} />
      <DataTable<Manutencao>
        rows={rows} loading={loading}
        columns={[
          { header: "Veículo", cell: r => <span className="font-mono">{veicLabel(r.veiculo_id)}</span> },
          { header: "Tipo", cell: r => <span className="capitalize">{r.tipo}</span> },
          { header: "Data", cell: r => fmtDate(r.data) },
          { header: "Km", cell: r => fmtNumber(r.km_momento) },
          { header: "Custo", cell: r => fmtBRL(Number(r.custo_total)) },
          { header: "Próx. revisão", cell: r => `${r.proxima_km ? fmtNumber(r.proxima_km) + " km" : "—"} / ${fmtDate(r.proxima_data)}` },
          { header: "Status", cell: r => <StatusBadge status={r.status} /> },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Manutencao> title="Editar manutenção" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

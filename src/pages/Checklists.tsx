import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useTable } from "@/hooks/useTable";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import type { Checklist, Veiculo, Motorista } from "@/lib/types";
import { Check, X } from "lucide-react";

export default function Checklists() {
  const { rows, loading, insert, update, remove } = useTable<Checklist>("checklists");
  const [editing, setEditing] = useState<Checklist | null>(null);
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
    { name: "pneus_ok", label: "Pneus OK", type: "checkbox" },
    { name: "luzes_ok", label: "Luzes OK", type: "checkbox" },
    { name: "combustivel_ok", label: "Combustível OK", type: "checkbox" },
    { name: "nivel_oleo_ok", label: "Nível de óleo OK", type: "checkbox" },
    { name: "observacoes", label: "Observações", type: "textarea" },
    { name: "status", label: "Status", type: "select", required: true,
      options: [{ label: "OK", value: "ok" }, { label: "Problema", value: "problema" }] },
  ], [veiculos, motoristas]);

  const vL = (id: string) => veiculos.find(x => x.id === id)?.placa ?? "—";
  const mL = (id: string | null) => motoristas.find(x => x.id === id)?.nome ?? "—";
  const Mark = ({ ok }: { ok: boolean }) => ok ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />;

  return (
    <>
      <PageHeader title="Checklists" subtitle="Inspeções pré-uso dos veículos"
        actions={<FormDialog<Checklist> title="Novo checklist" fields={fields} onSubmit={insert}
          initial={{ pneus_ok: true, luzes_ok: true, combustivel_ok: true, nivel_oleo_ok: true, status: "ok" } as any} />} />
      <DataTable<Checklist>
        rows={rows} loading={loading}
        columns={[
          { header: "Data", cell: r => fmtDate(r.data) },
          { header: "Veículo", cell: r => <span className="font-mono">{vL(r.veiculo_id)}</span> },
          { header: "Motorista", cell: r => mL(r.motorista_id) },
          { header: "Pneus", cell: r => <Mark ok={r.pneus_ok} /> },
          { header: "Luzes", cell: r => <Mark ok={r.luzes_ok} /> },
          { header: "Combust.", cell: r => <Mark ok={r.combustivel_ok} /> },
          { header: "Óleo", cell: r => <Mark ok={r.nivel_oleo_ok} /> },
          { header: "Status", cell: r => <StatusBadge status={r.status} /> },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Checklist> title="Editar checklist" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

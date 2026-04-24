import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import type { Agendamento, Veiculo, Motorista } from "@/lib/types";

export default function Agendamentos() {
  const { rows, loading, insert, update, remove } = useTable<Agendamento>("agendamentos");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Agendamento | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  useEffect(() => {
    supabase.from("veiculos").select("*").then(({ data }) => setVeiculos((data ?? []) as Veiculo[]));
    supabase.from("motoristas").select("*").then(({ data }) => setMotoristas((data ?? []) as Motorista[]));
  }, []);

  const fields: FieldDef[] = useMemo(() => [
    { name: "veiculo_id", label: "Veículo", type: "select", required: true,
      options: veiculos.map(v => ({ value: v.id, label: `${v.placa} – ${v.marca} ${v.modelo}` })) },
    { name: "motorista_id", label: "Motorista", type: "select", required: true,
      options: motoristas.map(m => ({ value: m.id, label: m.nome })) },
    { name: "data_saida", label: "Saída", type: "datetime-local", required: true },
    { name: "data_retorno_prevista", label: "Retorno previsto", type: "datetime-local", required: true },
    { name: "data_retorno_real", label: "Retorno real", type: "datetime-local" },
    { name: "destino", label: "Destino" },
    { name: "km_saida", label: "Km saída", type: "number" },
    { name: "km_retorno", label: "Km retorno", type: "number" },
    { name: "status", label: "Status", type: "select", required: true,
      options: [{ label: "Agendado", value: "agendado" }, { label: "Em uso", value: "em_uso" }, { label: "Concluído", value: "concluido" }, { label: "Cancelado", value: "cancelado" }] },
    { name: "observacoes", label: "Observações", type: "textarea" },
  ], [veiculos, motoristas]);

  const vL = (id: string) => veiculos.find(x => x.id === id)?.placa ?? "—";
  const mL = (id: string) => motoristas.find(x => x.id === id)?.nome ?? "—";

  return (
    <>
      <PageHeader title="Agendamentos" subtitle="Reservas e uso dos veículos"
        actions={isAdmin && <FormDialog<Agendamento> title="Novo agendamento" fields={fields} onSubmit={insert} />} />
      <DataTable<Agendamento>
        rows={rows} loading={loading}
        columns={[
          { header: "Veículo", cell: r => <span className="font-mono">{vL(r.veiculo_id)}</span> },
          { header: "Motorista", cell: r => mL(r.motorista_id) },
          { header: "Saída", cell: r => fmtDateTime(r.data_saida) },
          { header: "Retorno previsto", cell: r => fmtDateTime(r.data_retorno_prevista) },
          { header: "Destino", cell: r => r.destino ?? "—" },
          { header: "Km", cell: r => `${r.km_saida ? fmtNumber(r.km_saida) : "—"} → ${r.km_retorno ? fmtNumber(r.km_retorno) : "—"}` },
          { header: "Status", cell: r => <StatusBadge status={r.status} /> },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Agendamento> title="Editar agendamento" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

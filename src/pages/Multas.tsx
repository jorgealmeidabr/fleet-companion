import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtDate } from "@/lib/format";
import type { Multa, Veiculo, Motorista } from "@/lib/types";

export default function Multas() {
  const { rows, loading, insert, update, remove } = useTable<Multa>("multas");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Multa | null>(null);
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

  return (
    <>
      <PageHeader title="Multas" subtitle="Controle de infrações e pagamentos"
        actions={isAdmin && <FormDialog<Multa> title="Nova multa" fields={fields} onSubmit={insert} />} />
      <DataTable<Multa>
        rows={rows} loading={loading}
        columns={[
          { header: "Data", cell: r => fmtDate(r.data_infracao) },
          { header: "Veículo", cell: r => <span className="font-mono">{vL(r.veiculo_id)}</span> },
          { header: "Motorista", cell: r => mL(r.motorista_id) },
          { header: "Infração", cell: r => r.tipo_infracao },
          { header: "Valor", cell: r => fmtBRL(Number(r.valor)) },
          { header: "Pontos", cell: r => r.pontos_cnh },
          { header: "Auto", cell: r => r.auto_infracao ?? "—" },
          { header: "Pagamento", cell: r => <StatusBadge status={r.status_pagamento} /> },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Multa> title="Editar multa" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

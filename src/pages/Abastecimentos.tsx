import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { useTable } from "@/hooks/useTable";
import { supabase } from "@/lib/supabase";
import { fmtBRL, fmtDate, fmtNumber } from "@/lib/format";
import type { Abastecimento, Veiculo, Motorista } from "@/lib/types";

export default function Abastecimentos() {
  const { rows, loading, insert, update, remove } = useTable<Abastecimento>("abastecimentos");
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

  return (
    <>
      <PageHeader title="Abastecimentos" subtitle="Consumo médio e custo por km calculados automaticamente"
        actions={<FormDialog<Abastecimento> title="Novo abastecimento" fields={fields} onSubmit={insert} />} />
      <DataTable<Abastecimento>
        rows={rows} loading={loading}
        columns={[
          { header: "Data", cell: r => fmtDate(r.data) },
          { header: "Veículo", cell: r => <span className="font-mono">{vLabel(r.veiculo_id)}</span> },
          { header: "Motorista", cell: r => mLabel(r.motorista_id) },
          { header: "Km", cell: r => fmtNumber(r.km_atual) },
          { header: "Litros", cell: r => fmtNumber(Number(r.litros), { maximumFractionDigits: 2 }) },
          { header: "Valor", cell: r => fmtBRL(Number(r.valor_total)) },
          { header: "Consumo", cell: r => r.consumo_km_l ? `${fmtNumber(Number(r.consumo_km_l), { maximumFractionDigits: 2 })} km/l` : "—" },
          { header: "R$/km", cell: r => r.custo_por_km ? fmtBRL(Number(r.custo_por_km)) : "—" },
          { header: "Posto", cell: r => r.posto ?? "—" },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Abastecimento> title="Editar abastecimento" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

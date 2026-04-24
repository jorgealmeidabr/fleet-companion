import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { fmtNumber } from "@/lib/format";
import type { Veiculo } from "@/lib/types";
import { Plus } from "lucide-react";

const fields: FieldDef[] = [
  { name: "placa", label: "Placa", required: true },
  { name: "marca", label: "Marca", required: true },
  { name: "modelo", label: "Modelo", required: true },
  { name: "ano", label: "Ano", type: "number", required: true },
  { name: "tipo", label: "Tipo", type: "select", required: true,
    options: [{ label: "Carro", value: "carro" }, { label: "Moto", value: "moto" }, { label: "Caminhão", value: "caminhao" }, { label: "Van", value: "van" }] },
  { name: "combustivel", label: "Combustível", type: "select", required: true,
    options: [{ label: "Flex", value: "flex" }, { label: "Gasolina", value: "gasolina" }, { label: "Diesel", value: "diesel" }, { label: "Elétrico", value: "eletrico" }] },
  { name: "km_atual", label: "Km atual", type: "number", required: true },
  { name: "status", label: "Status", type: "select", required: true,
    options: [{ label: "Disponível", value: "disponivel" }, { label: "Manutenção", value: "manutencao" }, { label: "Inativo", value: "inativo" }, { label: "Reservado", value: "reservado" }] },
];

export default function Veiculos() {
  const { rows, loading, insert, update, remove } = useTable<Veiculo>("veiculos");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Veiculo | null>(null);

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle="Cadastro completo da frota"
        actions={isAdmin && (
          <FormDialog<Veiculo> title="Novo veículo" fields={fields} onSubmit={insert}
            trigger={<Button className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" />Novo veículo</Button>} />
        )}
      />
      <DataTable<Veiculo>
        rows={rows} loading={loading}
        columns={[
          { header: "Placa", cell: r => <span className="font-mono font-semibold">{r.placa}</span> },
          { header: "Veículo", cell: r => <>{r.marca} <span className="text-muted-foreground">{r.modelo}</span></> },
          { header: "Ano", cell: r => r.ano },
          { header: "Tipo", cell: r => <span className="capitalize">{r.tipo}</span> },
          { header: "Combustível", cell: r => <span className="capitalize">{r.combustivel}</span> },
          { header: "Km", cell: r => fmtNumber(r.km_atual) },
          { header: "Status", cell: r => <StatusBadge status={r.status} /> },
        ]}
        onEdit={(r) => setEditing(r)}
        onDelete={(r) => remove(r.id)}
      />
      {editing && (
        <FormDialog<Veiculo> title="Editar veículo" fields={fields} initial={editing} open onOpenChange={(o) => !o && setEditing(null)}
          onSubmit={(v) => update(editing.id, v)} />
      )}
    </>
  );
}

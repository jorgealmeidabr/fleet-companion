import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate } from "@/lib/format";
import type { Motorista } from "@/lib/types";

const fields: FieldDef[] = [
  { name: "nome", label: "Nome", required: true },
  { name: "cnh_numero", label: "Número CNH", required: true },
  { name: "cnh_categoria", label: "Categoria CNH", required: true },
  { name: "cnh_validade", label: "Validade CNH", type: "date", required: true },
  { name: "telefone", label: "Telefone" },
  { name: "email", label: "E-mail" },
  { name: "status", label: "Status", type: "select", required: true,
    options: [{ label: "Ativo", value: "ativo" }, { label: "Inativo", value: "inativo" }] },
];

export default function Motoristas() {
  const { rows, loading, insert, update, remove } = useTable<Motorista>("motoristas");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Motorista | null>(null);

  return (
    <>
      <PageHeader title="Motoristas" subtitle="Cadastro de condutores e validade da CNH"
        actions={isAdmin && <FormDialog<Motorista> title="Novo motorista" fields={fields} onSubmit={insert} />} />
      <DataTable<Motorista>
        rows={rows} loading={loading}
        columns={[
          { header: "Nome", cell: r => <span className="font-medium">{r.nome}</span> },
          { header: "CNH", cell: r => `${r.cnh_numero} (${r.cnh_categoria})` },
          { header: "Validade", cell: r => fmtDate(r.cnh_validade) },
          { header: "Telefone", cell: r => r.telefone ?? "—" },
          { header: "E-mail", cell: r => r.email ?? "—" },
          { header: "Status", cell: r => <StatusBadge status={r.status} /> },
        ]}
        onEdit={setEditing} onDelete={(r) => remove(r.id)}
      />
      {editing && <FormDialog<Motorista> title="Editar motorista" fields={fields} initial={editing} open
        onOpenChange={(o) => !o && setEditing(null)} onSubmit={(v) => update(editing.id, v)} />}
    </>
  );
}

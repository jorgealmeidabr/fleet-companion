import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate } from "@/lib/format";
import type { Motorista } from "@/lib/types";
import { Plus, Search, MoreVertical, Pencil, Eye, AlertTriangle } from "lucide-react";

const fields: FieldDef[] = [
  { name: "nome", label: "Nome", required: true },
  { name: "cnh_numero", label: "Número CNH", required: true },
  { name: "cnh_categoria", label: "Categoria CNH", required: true },
  { name: "cnh_validade", label: "Validade CNH", type: "date", required: true },
  { name: "telefone", label: "Telefone" },
  { name: "email", label: "E-mail" },
  { name: "status", label: "Status", type: "select", required: true,
    options: [{ label: "Ativo", value: "ativo" }, { label: "Inativo", value: "inativo" }] },
  { name: "foto_url", label: "Foto", type: "file", bucket: "motoristas" },
];

function diasRestantes(validade: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const v = new Date(validade); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoje.getTime()) / 86400000);
}

export default function Motoristas() {
  const navigate = useNavigate();
  const { rows, loading, insert, update } = useTable<Motorista>("motoristas");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Motorista | null>(null);
  const [busca, setBusca] = useState("");

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(m => m.nome.toLowerCase().includes(q) || m.cnh_numero.includes(q));
  }, [rows, busca]);

  return (
    <>
      <PageHeader
        title="Motoristas"
        subtitle="Cadastro de condutores e validade da CNH"
        actions={isAdmin && (
          <FormDialog<Motorista>
            title="Novo motorista" fields={fields} onSubmit={insert}
            trigger={<Button className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" />Novo motorista</Button>}
          />
        )}
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou CNH..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum motorista encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(m => {
            const dias = diasRestantes(m.cnh_validade);
            const vencida = dias < 0;
            const vencendo = !vencida && dias <= 30;
            return (
              <Card
                key={m.id}
                className="cursor-pointer transition-all hover:shadow-elevated"
                onClick={() => navigate(`/motoristas/${m.id}`)}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={m.foto_url ?? undefined} alt={m.nome} />
                        <AvatarFallback>{m.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold leading-tight">{m.nome}</p>
                        <StatusBadge status={m.status} />
                      </div>
                    </div>
                    {isAdmin && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(m)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/motoristas/${m.id}`)}><Eye className="mr-2 h-4 w-4" />Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => update(m.id, { status: "inativo" })}>Inativar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">CNH</span>
                      <span className="font-mono">{m.cnh_numero} <Badge variant="outline" className="ml-1">{m.cnh_categoria}</Badge></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Validade</span>
                      <span className="font-medium">{fmtDate(m.cnh_validade)}</span>
                    </div>
                  </div>
                  {(vencida || vencendo) && (
                    <div className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${vencida ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/10 text-warning"}`}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {vencida ? `CNH vencida há ${Math.abs(dias)} dia(s)` : `CNH vence em ${dias} dia(s)`}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <FormDialog<Motorista>
          title="Editar motorista" fields={fields} initial={editing} open
          onOpenChange={(o) => !o && setEditing(null)}
          onSubmit={(v) => update(editing.id, v)}
        />
      )}
    </>
  );
}

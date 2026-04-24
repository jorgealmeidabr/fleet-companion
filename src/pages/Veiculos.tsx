import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { fmtNumber } from "@/lib/format";
import type { Veiculo } from "@/lib/types";
import { Plus, Search, MoreVertical, Car, Pencil, Eye, PowerOff } from "lucide-react";

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
  { name: "foto_url", label: "Foto", type: "file", bucket: "veiculos" },
];

export default function Veiculos() {
  const navigate = useNavigate();
  const { rows, loading, insert, update } = useTable<Veiculo>("veiculos");
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fComb, setFComb] = useState<string>("todos");

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(v => {
      if (q && !v.placa.toLowerCase().includes(q) && !v.modelo.toLowerCase().includes(q)) return false;
      if (fStatus !== "todos" && v.status !== fStatus) return false;
      if (fTipo !== "todos" && v.tipo !== fTipo) return false;
      if (fComb !== "todos" && v.combustivel !== fComb) return false;
      return true;
    });
  }, [rows, busca, fStatus, fTipo, fComb]);

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle="Cadastro completo da frota"
        actions={isAdmin && (
          <FormDialog<Veiculo>
            title="Novo veículo" fields={fields} onSubmit={insert}
            trigger={<Button className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" />Novo veículo</Button>}
          />
        )}
      />

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por placa ou modelo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="manutencao">Manutenção</SelectItem>
            <SelectItem value="reservado">Reservado</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="carro">Carro</SelectItem>
              <SelectItem value="moto">Moto</SelectItem>
              <SelectItem value="caminhao">Caminhão</SelectItem>
              <SelectItem value="van">Van</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fComb} onValueChange={setFComb}>
            <SelectTrigger><SelectValue placeholder="Comb." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos comb.</SelectItem>
              <SelectItem value="flex">Flex</SelectItem>
              <SelectItem value="gasolina">Gasolina</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="eletrico">Elétrico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum veículo encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(v => (
            <Card
              key={v.id}
              className="group cursor-pointer overflow-hidden transition-all hover:shadow-elevated"
              onClick={() => navigate(`/veiculos/${v.id}`)}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {v.foto_url ? (
                  <img src={v.foto_url} alt={v.modelo} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Car className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute right-2 top-2">
                  <StatusBadge status={v.status} />
                </div>
                {isAdmin && (
                  <div className="absolute left-2 top-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="secondary" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setEditing(v)}>
                          <Pencil className="mr-2 h-4 w-4" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/veiculos/${v.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />Ver histórico
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => update(v.id, { status: "inativo" })}>
                          <PowerOff className="mr-2 h-4 w-4" />Inativar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-base font-bold tracking-wider">{v.placa}</span>
                  <span className="text-xs text-muted-foreground">{v.ano}</span>
                </div>
                <div className="text-sm font-medium">{v.marca} <span className="text-muted-foreground">{v.modelo}</span></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{v.tipo} · {v.combustivel}</span>
                  <span className="font-semibold text-foreground">{fmtNumber(v.km_atual)} km</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <FormDialog<Veiculo>
          title="Editar veículo" fields={fields} initial={editing} open
          onOpenChange={(o) => !o && setEditing(null)}
          onSubmit={(v) => update(editing.id, v)}
        />
      )}
    </>
  );
}

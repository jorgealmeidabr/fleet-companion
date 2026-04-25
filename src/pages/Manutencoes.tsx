import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FormDialog, FieldDef } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { fmtDate, fmtNumber } from "@/lib/format";
import type { Manutencao, Veiculo } from "@/lib/types";
import { Plus, Wrench, ShieldCheck, AlertTriangle, MoreVertical, Pencil, Trash2, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { EmptyState } from "@/components/EmptyState";
import { CardGridSkeleton } from "@/components/Skeletons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Money } from "@/components/Money";

export default function Manutencoes() {
  const { rows, loading, insert, update, remove } = useTable<Manutencao>("manutencoes");
  const { isAdmin } = useAuth();
  const { canSeeFinancial } = usePermissions();
  const [editing, setEditing] = useState<Manutencao | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fVeic, setFVeic] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

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

  const veicMap = useMemo(() => Object.fromEntries(veiculos.map(v => [v.id, v])), [veiculos]);

  const filtered = useMemo(() => {
    return rows.filter(m => {
      if (fTipo !== "todos" && m.tipo !== fTipo) return false;
      if (fStatus !== "todos" && m.status !== fStatus) return false;
      if (fVeic !== "todos" && m.veiculo_id !== fVeic) return false;
      if (fDe && m.data < fDe) return false;
      if (fAte && m.data > fAte) return false;
      return true;
    });
  }, [rows, fTipo, fStatus, fVeic, fDe, fAte]);

  const totalCusto = useMemo(() => filtered.reduce((s, m) => s + Number(m.custo_total ?? 0), 0), [filtered]);

  const isVencida = (m: Manutencao): boolean => {
    if (m.status === "concluida") return false;
    const v = veicMap[m.veiculo_id];
    const hoje = new Date().toISOString().slice(0, 10);
    if (m.proxima_data && hoje > m.proxima_data) return true;
    if (m.proxima_km && v && v.km_atual > m.proxima_km) return true;
    return false;
  };

  return (
    <>
      <PageHeader
        title="Manutenções"
        subtitle="Histórico, custos e próximas revisões"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={filtered.length === 0 || !canSeeFinancial()} title={!canSeeFinancial() ? "Sem permissão para exportar valores" : ""}
              onClick={() => downloadCSV(
                `manutencoes_${new Date().toISOString().slice(0,10)}.csv`,
                ["Veículo", "Tipo", "Data", "Km", "Descrição", "Oficina", "Custo", "Status"],
                filtered.map(m => [
                  veicMap[m.veiculo_id]?.placa ?? "—", m.tipo, m.data, m.km_momento,
                  m.descricao ?? "", m.oficina ?? "", m.custo_total, m.status,
                ]),
              )}>
              <Download className="mr-1 h-4 w-4" />Exportar CSV
            </Button>
            {isAdmin && (
              <FormDialog<Manutencao>
                title="Nova manutenção" fields={fields} onSubmit={insert}
                trigger={<Button className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" />Nova manutenção</Button>}
              />
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="preventiva">Preventiva</SelectItem>
            <SelectItem value="corretiva">Corretiva</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fVeic} onValueChange={setFVeic}>
          <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos veículos</SelectItem>
            {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} – {v.modelo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} placeholder="De" />
        <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} placeholder="Até" />
        <Card className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-brand text-primary-foreground">
          <div className="text-xs opacity-80">Custo total</div>
          <div className="text-base font-bold"><Money value={totalCusto} className="text-primary-foreground" /></div>
        </Card>
      </div>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhuma manutenção encontrada"
          description="Ajuste os filtros ou registre a primeira manutenção." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(m => {
            const v = veicMap[m.veiculo_id];
            const vencida = isVencida(m);
            return (
              <Card key={m.id} className={vencida ? "border-destructive/50 shadow-[0_0_0_1px_hsl(var(--destructive)/0.3)]" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${m.tipo === "preventiva" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                        {m.tipo === "preventiva" ? <ShieldCheck className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold">{v?.placa ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{v?.marca} {v?.modelo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={m.status} />
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(m)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <ConfirmDialog
                              destructive
                              title="Excluir manutenção"
                              description="Esta ação não pode ser desfeita."
                              confirmLabel="Excluir"
                              onConfirm={() => remove(m.id)}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                                </DropdownMenuItem>
                              }
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{fmtDate(m.data)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Custo</p><p className="font-semibold"><Money value={Number(m.custo_total)} /></p></div>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Oficina</p><p className="font-medium">{m.oficina ?? "—"}</p></div>
                    {m.descricao && <div className="col-span-2"><p className="text-xs text-muted-foreground">Descrição</p><p className="line-clamp-2 text-muted-foreground">{m.descricao}</p></div>}
                  </div>

                  {(m.proxima_km || m.proxima_data) && (
                    <div className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                      Próxima: {m.proxima_km ? `${fmtNumber(m.proxima_km)} km` : "—"} {m.proxima_data && `· ${fmtDate(m.proxima_data)}`}
                    </div>
                  )}

                  {vencida && (
                    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />Manutenção vencida
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <FormDialog<Manutencao>
          title="Editar manutenção" fields={fields} initial={editing} open
          onOpenChange={(o) => !o && setEditing(null)}
          onSubmit={(v) => update(editing.id, v)}
        />
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Trash2 } from "lucide-react";
import type { Manutencao, ManutencaoPeca, ManutencaoSubtipo, ManutencaoTipo, ManutencaoPrioridade, Veiculo } from "@/lib/types";

const SUBTIPOS_PREVENTIVA: { v: ManutencaoSubtipo; l: string }[] = [
  { v: "troca_oleo", l: "Troca de óleo" },
  { v: "filtro", l: "Filtro" },
  { v: "correia", l: "Correia" },
  { v: "alinhamento", l: "Alinhamento" },
  { v: "revisao_geral", l: "Revisão geral" },
  { v: "outro", l: "Outro" },
];
const SUBTIPOS_CORRETIVA: { v: ManutencaoSubtipo; l: string }[] = [
  { v: "freio", l: "Freio" },
  { v: "pneu", l: "Pneu" },
  { v: "correia", l: "Correia" },
  { v: "outro", l: "Outro" },
];
const SUBTIPOS_PREDITIVA: { v: ManutencaoSubtipo; l: string }[] = [
  { v: "revisao_geral", l: "Diagnóstico/Inspeção" },
  { v: "outro", l: "Outro" },
];

interface Props {
  veiculos: Veiculo[];
  initial?: Partial<Manutencao> | null;
  onSubmit: (values: Partial<Manutencao>) => Promise<void> | void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export function ManutencaoFormDialog({ veiculos, initial, onSubmit, trigger, open, onOpenChange }: Props) {
  const [internal, setInternal] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open! : internal;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternal(v); };
  const [v, setV] = useState<Partial<Manutencao>>(() => ({ tipo: "preventiva", status: "agendada", prioridade: "media", pecas: [], ...initial }));
  const [proxModo, setProxModo] = useState<"km" | "data">(() => initial?.data_proxima_manutencao ? "data" : "km");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setV({ tipo: "preventiva", status: "agendada", prioridade: "media", pecas: [], ...initial });
      setProxModo(initial?.data_proxima_manutencao ? "data" : "km");
    }
  }, [isOpen, initial]);

  const subOpts = useMemo(() => {
    if (v.tipo === "corretiva") return SUBTIPOS_CORRETIVA;
    if (v.tipo === "preditiva") return SUBTIPOS_PREDITIVA;
    return SUBTIPOS_PREVENTIVA;
  }, [v.tipo]);

  const set = (k: keyof Manutencao, val: any) => setV(s => ({ ...s, [k]: val }));

  const pecas = (v.pecas ?? []) as ManutencaoPeca[];
  const setPecas = (next: ManutencaoPeca[]) => set("pecas", next);
  const addPeca = () => setPecas([...pecas, { nome: "", quantidade: 1, valor_unitario: 0 }]);
  const updPeca = (i: number, patch: Partial<ManutencaoPeca>) =>
    setPecas(pecas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const rmPeca = (i: number) => setPecas(pecas.filter((_, idx) => idx !== i));

  const totalPecas = pecas.reduce((s, p) => s + (Number(p.quantidade) || 0) * (Number(p.valor_unitario) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<Manutencao> = { ...v };
      // sincroniza próxima manutenção nos campos legados também
      if (proxModo === "km") {
        payload.km_proxima_manutencao = v.km_proxima_manutencao ?? null;
        payload.data_proxima_manutencao = null;
        payload.proxima_km = v.km_proxima_manutencao ?? null;
        payload.proxima_data = null;
      } else {
        payload.data_proxima_manutencao = v.data_proxima_manutencao ?? null;
        payload.km_proxima_manutencao = null;
        payload.proxima_data = v.data_proxima_manutencao ?? null;
        payload.proxima_km = null;
      }
      if (payload.custo_total == null || Number(payload.custo_total) === 0) {
        payload.custo_total = totalPecas;
      }
      await onSubmit(payload);
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!isControlled && trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar manutenção" : "Nova manutenção"}</DialogTitle>
          <DialogDescription className="sr-only">Formulário de manutenção</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Veículo <span className="text-destructive">*</span></Label>
            <Select value={v.veiculo_id ?? ""} onValueChange={(x) => set("veiculo_id", x)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {veiculos.map(vc => <SelectItem key={vc.id} value={vc.id}>{vc.placa} – {vc.marca} {vc.modelo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <ToggleGroup type="single" value={v.tipo ?? "preventiva"} onValueChange={(x) => x && set("tipo", x as ManutencaoTipo)} className="justify-start">
              <ToggleGroupItem value="preventiva">Preventiva</ToggleGroupItem>
              <ToggleGroupItem value="corretiva">Corretiva</ToggleGroupItem>
              <ToggleGroupItem value="preditiva">Preditiva</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Subtipo</Label>
              <Select value={v.subtipo ?? ""} onValueChange={(x) => set("subtipo", x as ManutencaoSubtipo)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {subOpts.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={v.prioridade ?? "media"} onValueChange={(x) => set("prioridade", x as ManutencaoPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data <span className="text-destructive">*</span></Label>
              <Input type="date" required value={v.data ?? ""} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Km atual do veículo</Label>
              <Input type="number" value={v.km_atual ?? ""} onChange={(e) => set("km_atual", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Km no momento <span className="text-destructive">*</span></Label>
              <Input type="number" required value={v.km_momento ?? ""} onChange={(e) => set("km_momento", e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tempo parado (horas)</Label>
              <Input type="number" step="0.5" value={v.tempo_parado_horas ?? ""} onChange={(e) => set("tempo_parado_horas", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <Label className="text-sm">Próxima manutenção</Label>
            <ToggleGroup type="single" value={proxModo} onValueChange={(x) => x && setProxModo(x as "km" | "data")} className="justify-start">
              <ToggleGroupItem value="km">Por Km</ToggleGroupItem>
              <ToggleGroupItem value="data">Por Data</ToggleGroupItem>
            </ToggleGroup>
            {proxModo === "km" ? (
              <Input type="number" placeholder="Próxima manutenção em km" value={v.km_proxima_manutencao ?? ""} onChange={(e) => set("km_proxima_manutencao", e.target.value === "" ? null : Number(e.target.value))} />
            ) : (
              <Input type="date" value={v.data_proxima_manutencao ?? ""} onChange={(e) => set("data_proxima_manutencao", e.target.value || null)} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={v.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Oficina</Label>
              <Input value={v.oficina ?? ""} onChange={(e) => set("oficina", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status <span className="text-destructive">*</span></Label>
              <Select value={v.status ?? "agendada"} onValueChange={(x) => set("status", x)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Peças */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Peças utilizadas</Label>
              <Button type="button" size="sm" variant="outline" onClick={addPeca}>
                <Plus className="mr-1 h-3.5 w-3.5" />Adicionar peça
              </Button>
            </div>
            {pecas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma peça adicionada.</p>
            ) : (
              <div className="space-y-2">
                {pecas.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" placeholder="Nome" value={p.nome} onChange={(e) => updPeca(i, { nome: e.target.value })} />
                    <Input className="col-span-2" type="number" placeholder="Qtd" value={p.quantidade} onChange={(e) => updPeca(i, { quantidade: Number(e.target.value) })} />
                    <Input className="col-span-4" type="number" step="0.01" placeholder="Valor unit." value={p.valor_unitario} onChange={(e) => updPeca(i, { valor_unitario: Number(e.target.value) })} />
                    <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => rmPeca(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <p className="text-right text-xs text-muted-foreground">Total peças: <span className="font-medium text-foreground">R$ {totalPecas.toFixed(2)}</span></p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Custo total (R$) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" required value={v.custo_total ?? ""} onChange={(e) => set("custo_total", e.target.value === "" ? "" : Number(e.target.value))} />
            <p className="text-[11px] text-muted-foreground">Se deixado em zero, será preenchido com o total das peças.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} variant="brand">{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

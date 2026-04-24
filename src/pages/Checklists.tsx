import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useTable } from "@/hooks/useTable";
import { supabase } from "@/lib/supabase";
import { uploadFiles } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import type { Checklist, Veiculo, Motorista } from "@/lib/types";
import { Check, X, Upload, Plus, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const ITEMS: { key: keyof Pick<Checklist, "pneus_ok" | "luzes_ok" | "combustivel_ok" | "nivel_oleo_ok">; label: string; hint: string }[] = [
  { key: "pneus_ok", label: "Pneus", hint: "Calibrados e sem furos" },
  { key: "luzes_ok", label: "Faróis e lanternas", hint: "Funcionando corretamente" },
  { key: "combustivel_ok", label: "Combustível", hint: "Nível adequado" },
  { key: "nivel_oleo_ok", label: "Nível de óleo", hint: "Dentro da faixa recomendada" },
];

// extras (não persistidos no banco) – exibidos no UI conforme briefing
const EXTRAS = [
  { key: "limpadores_ok", label: "Limpadores de para-brisa", hint: "Operando" },
  { key: "documentos_ok", label: "Documentos no veículo", hint: "CRLV e seguro em dia" },
];

export default function Checklists() {
  const { rows, loading, insert, remove, reload } = useTable<Checklist>("checklists");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("veiculos").select("*").then(({ data }) => setVeiculos((data ?? []) as Veiculo[]));
    supabase.from("motoristas").select("*").then(({ data }) => setMotoristas((data ?? []) as Motorista[]));
  }, []);

  const vL = (id: string) => veiculos.find(x => x.id === id)?.placa ?? "—";
  const mL = (id: string | null) => motoristas.find(x => x.id === id)?.nome ?? "—";

  // ----- form state -----
  const initial = {
    veiculo_id: "",
    motorista_id: "",
    data: new Date().toISOString().slice(0, 10),
    pneus_ok: true,
    luzes_ok: true,
    combustivel_ok: true,
    nivel_oleo_ok: true,
    limpadores_ok: true,
    documentos_ok: true,
    observacoes: "",
    fotos: [] as File[],
    fotos_urls: [] as string[],
  };
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  const autoStatus = useMemo(() => {
    const allOk = ITEMS.every(i => form[i.key] as boolean) && EXTRAS.every(e => (form as any)[e.key]);
    const obsCritica = /(quebrad|grave|urgente|vazamento|perigo)/i.test(form.observacoes || "");
    return allOk && !obsCritica ? "ok" : "problema";
  }, [form]);

  const handlePhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files).slice(0, 4 - form.fotos_urls.length);
    setUploading(true);
    try {
      const urls = await uploadFiles("checklists", arr);
      set("fotos_urls", [...form.fotos_urls, ...urls].slice(0, 4));
      toast({ title: `${urls.length} foto(s) enviadas` });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => set("fotos_urls", form.fotos_urls.filter(u => u !== url));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.veiculo_id) return toast({ title: "Selecione um veículo", variant: "destructive" });
    setSaving(true);
    try {
      await insert({
        veiculo_id: form.veiculo_id,
        motorista_id: form.motorista_id || null,
        data: form.data,
        pneus_ok: form.pneus_ok,
        luzes_ok: form.luzes_ok,
        combustivel_ok: form.combustivel_ok,
        nivel_oleo_ok: form.nivel_oleo_ok,
        observacoes: form.observacoes || null,
        fotos_urls: form.fotos_urls.length ? form.fotos_urls : null,
        status: autoStatus,
      } as any);
      setForm(initial);
      setOpen(false);
      await reload();
    } finally { setSaving(false); }
  };

  const Mark = ({ ok }: { ok: boolean }) => ok ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />;

  return (
    <>
      <PageHeader
        title="Checklists"
        subtitle="Inspeções pré-uso dos veículos"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm(initial); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" />Novo checklist</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>Novo checklist de inspeção</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Veículo *</Label>
                    <Select value={form.veiculo_id} onValueChange={(v) => set("veiculo_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} – {v.marca} {v.modelo}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motorista</Label>
                    <Select value={form.motorista_id} onValueChange={(v) => set("motorista_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{motoristas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data *</Label>
                    <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Itens de inspeção</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...ITEMS, ...EXTRAS].map(item => (
                      <div key={item.key} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.hint}</p>
                        </div>
                        <Switch
                          checked={!!(form as any)[item.key]}
                          onCheckedChange={(v) => set(item.key, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Anote qualquer detalhe relevante..." />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Camera className="h-4 w-4" />Fotos ({form.fotos_urls.length}/4)</Label>
                  {form.fotos_urls.length < 4 && (
                    <Input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => handlePhotos(e.target.files)} />
                  )}
                  {uploading && <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Upload className="h-3 w-3 animate-pulse" />Enviando...</p>}
                  {form.fotos_urls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {form.fotos_urls.map(url => (
                        <div key={url} className="relative group">
                          <img src={url} alt="checklist" className="h-20 w-full rounded-md border border-border object-cover" />
                          <button type="button" onClick={() => removePhoto(url)} className="absolute top-1 right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 group-hover:opacity-100 transition">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                  <span className="text-sm text-muted-foreground">Status automático:</span>
                  <StatusBadge status={autoStatus} />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving || uploading} className="bg-gradient-brand text-primary-foreground">{saving ? "Salvando..." : "Salvar checklist"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

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
          { header: "Fotos", cell: r => (
            r.fotos_urls?.length ? (
              <div className="flex gap-1">
                {r.fotos_urls.slice(0, 4).map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer">
                    <img src={u} alt="" className="h-10 w-10 rounded border border-border object-cover" />
                  </a>
                ))}
              </div>
            ) : <span className="text-muted-foreground text-xs">—</span>
          )},
        ]}
        onDelete={(r) => remove(r.id)}
      />
    </>
  );
}

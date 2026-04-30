import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
import type { Acidente, Veiculo, AcidenteContato, AcidenteStatus } from "@/lib/types";
import { Eye, Settings, Plus, Trash2, Users, AlertOctagon } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  colisao: "Colisão",
  atropelamento: "Atropelamento",
  capotamento: "Capotamento",
  outro: "Outro",
};

export default function AcidentesAdminList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [acidentes, setAcidentes] = useState<Acidente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState<AcidenteStatus | "all">("all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [openContatos, setOpenContatos] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [a, v] = await Promise.all([
      (supabase as any).from("acidentes").select("*").order("created_at", { ascending: false }),
      supabase.from("veiculos").select("*"),
    ]);
    setAcidentes((a?.data ?? []) as Acidente[]);
    setVeiculos((v?.data ?? []) as Veiculo[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const placa = (id: string | null) => veiculos.find(v => v.id === id)?.placa ?? "—";

  const filtrados = useMemo(() => {
    return acidentes.filter(a => {
      if (fStatus !== "all" && a.status !== fStatus) return false;
      const t = new Date(a.data_hora).getTime();
      if (de && t < new Date(de).getTime()) return false;
      if (ate && t > new Date(ate + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [acidentes, fStatus, de, ate]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Acidentes"
        subtitle="Ocorrências registradas pelos motoristas"
        actions={
          <Button variant="outline" onClick={() => setOpenContatos(true)}>
            <Users className="mr-2 h-4 w-4" /> Contatos de emergência
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Status</Label>
              <Select value={fStatus} onValueChange={v => setFStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>De</Label>
              <Input type="date" value={de} onChange={e => setDe(e.target.value)} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={ate} onChange={e => setAte(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <EmptyState icon={AlertOctagon} title="Sem ocorrências" description="Nenhum acidente registrado para os filtros atuais." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.protocolo}</TableCell>
                    <TableCell>{fmtDateTime(a.data_hora)}</TableCell>
                    <TableCell>{a.motorista_nome}</TableCell>
                    <TableCell>{placa(a.veiculo_id)}</TableCell>
                    <TableCell>{TIPO_LABEL[a.tipo] ?? a.tipo}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/acidentes/${a.id}`)}>
                        <Eye className="mr-1 h-3 w-3" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContatosDialog open={openContatos} onOpenChange={setOpenContatos} />
    </div>
  );
}

function ContatosDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [list, setList] = useState<AcidenteContato[]>([]);
  const [form, setForm] = useState({ nome: "", cargo: "", telefone: "", whatsapp: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("acidentes_contatos").select("*").order("ordem");
    setList((data ?? []) as AcidenteContato[]);
  };
  useEffect(() => { if (open) load(); }, [open]);

  async function add() {
    if (!form.nome || !form.cargo || !form.telefone) {
      toast({ title: "Preencha nome, cargo e telefone", variant: "destructive" });
      return;
    }
    setSaving(true);
    const ordem = list.length + 1;
    const { error } = await (supabase as any).from("acidentes_contatos").insert({ ...form, ordem });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setForm({ nome: "", cargo: "", telefone: "", whatsapp: "" });
    load();
  }

  async function remover(id: string) {
    const { error } = await (supabase as any).from("acidentes_contatos").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Contatos de emergência</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {list.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded border p-2">
                <div className="text-sm">
                  <div className="font-semibold">{c.nome} <span className="text-muted-foreground">— {c.cargo}</span></div>
                  <div className="text-xs text-muted-foreground">{c.telefone} {c.whatsapp ? `• WhatsApp: ${c.whatsapp}` : ""}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remover(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {list.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato cadastrado.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <Input placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            <Input placeholder="Cargo" value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} />
            <Input placeholder="Telefone" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
            <Input placeholder="WhatsApp (com DDI, ex: 5511...)" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={add} disabled={saving}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

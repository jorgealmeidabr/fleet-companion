import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTime } from "@/lib/format";
import type { Request, Veiculo, RequestType, RequestStatus } from "@/lib/types";
import { Wrench, Fuel, FileText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildRequestPdf, uploadRequestPdf, downloadBlob } from "@/lib/requestPdf";

const FUEL_OPTIONS = [
  { value: "Diesel",   label: "Diesel" },
  { value: "Gasolina", label: "Gasolina" },
  { value: "Etanol",   label: "Etanol" },
  { value: "GNV",      label: "GNV" },
];

const URG_OPTIONS = [
  { value: "low",    label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high",   label: "Alta" },
];

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: "requested", label: "Solicitado" },
  { value: "pending",   label: "Pendente"   },
  { value: "completed", label: "Concluído"  },
];

function TypePill({ type }: { type: RequestType }) {
  if (type === "maintenance") {
    return (
      <Badge variant="outline" className="border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-300">
        <Wrench className="mr-1 h-3 w-3" />Manutenção
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-teal-500/30 bg-teal-500/15 text-teal-600 dark:text-teal-300">
      <Fuel className="mr-1 h-3 w-3" />Abastecimento
    </Badge>
  );
}

export default function Solicitacoes() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // form state (user)
  const [activeTab, setActiveTab] = useState<RequestType>("maintenance");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    vehicle_id: string; km: string; urgency: "low" | "medium" | "high";
    problem_description: string; fuel_type: string; liters: string; observations: string;
  }>({
    vehicle_id: "", km: "", urgency: "medium",
    problem_description: "", fuel_type: "Diesel", liters: "", observations: "",
  });

  // filters
  const [fType, setFType] = useState<"all" | RequestType>("all");
  const [fStatus, setFStatus] = useState<"all" | RequestStatus>("all");

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar solicitações", description: error.message, variant: "destructive" });
    }
    setRows((data ?? []) as Request[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    supabase.from("veiculos").select("*").order("placa")
      .then(({ data }) => setVeiculos((data ?? []) as Veiculo[]));
    // solicitantes (admin)
    supabase.from("profiles").select("id,nome,email").then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.nome || p.email || "—"; });
      setUsersMap(map);
    });
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (fType !== "all" && r.type !== fType) return false;
    if (fStatus !== "all" && r.status !== fStatus) return false;
    return true;
  }), [rows, fType, fStatus]);

  const veicMap = useMemo(() => Object.fromEntries(veiculos.map(v => [v.id, v])), [veiculos]);

  // ========== SUBMIT ==========
  const submit = async () => {
    if (!user) return;
    if (!form.vehicle_id || !form.km) {
      toast({ title: "Preencha veículo e quilometragem", variant: "destructive" });
      return;
    }
    const kmNum = Number(form.km);
    if (!Number.isFinite(kmNum) || kmNum < 0) {
      toast({ title: "Quilometragem inválida", variant: "destructive" }); return;
    }
    if (activeTab === "maintenance" && !form.problem_description.trim()) {
      toast({ title: "Descreva o problema", variant: "destructive" }); return;
    }
    if (activeTab === "fuel") {
      const l = Number(form.liters);
      if (!Number.isFinite(l) || l <= 0) {
        toast({ title: "Informe a quantidade de litros", variant: "destructive" }); return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Partial<Request> = {
        user_id: user.id,
        vehicle_id: form.vehicle_id,
        type: activeTab,
        km: kmNum,
        observations: form.observations || null,
        status: "requested",
        urgency: activeTab === "maintenance" ? form.urgency : null,
        problem_description: activeTab === "maintenance" ? form.problem_description : null,
        fuel_type: activeTab === "fuel" ? form.fuel_type : null,
        liters: activeTab === "fuel" ? Number(form.liters) : null,
      };

      const { data: inserted, error } = await (supabase as any)
        .from("requests").insert(payload).select().single();
      if (error) throw error;

      const req = inserted as Request;

      // gera PDF e faz upload
      const veic = veicMap[req.vehicle_id] ?? null;
      const solicitante = usersMap[req.user_id] || user.email || "—";
      const blob = await buildRequestPdf({ request: req, veiculo: veic, solicitante });
      const url = await uploadRequestPdf(req, blob);
      if (url) {
        await (supabase as any).from("requests").update({ pdf_url: url }).eq("id", req.id);
      }

      toast({
        title: "Solicitação enviada",
        description: `Protocolo ${req.protocol}`,
      });
      setForm({
        vehicle_id: "", km: "", urgency: "medium",
        problem_description: "", fuel_type: "Diesel", liters: "", observations: "",
      });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro ao solicitar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== AÇÕES ADMIN ==========
  const setStatus = async (r: Request, next: RequestStatus) => {
    if (next === r.status) return;
    const { error } = await (supabase as any).from("requests").update({ status: next }).eq("id", r.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status atualizado" });
    await reload();
  };

  const downloadPdf = async (r: Request) => {
    const filename = `${r.protocol}.pdf`;
    try {
      // Tenta baixar o PDF salvo no storage via fetch (evita ERR_BLOCKED_BY_CLIENT
      // de adblockers quando se abre a URL do Supabase em nova aba).
      if (r.pdf_url) {
        const res = await fetch(r.pdf_url, { cache: "no-store" });
        if (res.ok) {
          const blob = await res.blob();
          downloadBlob(blob, filename);
          return;
        }
      }
    } catch {
      // cai para regeneração local
    }
    // regenera localmente como fallback
    const veic = veicMap[r.vehicle_id] ?? null;
    const solicitante = usersMap[r.user_id] || "—";
    const blob = await buildRequestPdf({ request: r, veiculo: veic, solicitante });
    downloadBlob(blob, filename);
  };


  // ========== MÉTRICAS ADMIN ==========
  const counts = useMemo(() => ({
    requested: rows.filter(r => r.status === "requested").length,
    pending:   rows.filter(r => r.status === "pending").length,
    completed: rows.filter(r => r.status === "completed").length,
  }), [rows]);

  return (
    <>
      <PageHeader
        title="Solicitações"
        subtitle={isAdmin ? "Gerencie solicitações de manutenção e abastecimento" : "Abra um chamado de manutenção ou abastecimento"}
      />

      {/* ============ VISÃO ADMIN ============ */}
      {isAdmin && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Solicitadas</div>
              <div className="mt-1 text-2xl font-bold text-info">{counts.requested}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Pendentes</div>
              <div className="mt-1 text-2xl font-bold text-warning">{counts.pending}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Concluídas</div>
              <div className="mt-1 text-2xl font-bold text-success">{counts.completed}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============ FORMULÁRIO (USER) ============ */}
      {!isAdmin && (
        <Card className="mb-6 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova solicitação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={activeTab === "maintenance" ? "brand" : "outline"}
                onClick={() => setActiveTab("maintenance")}
              >
                <Wrench className="mr-2 h-4 w-4" />Manutenção
              </Button>
              <Button
                type="button"
                variant={activeTab === "fuel" ? "brand" : "outline"}
                onClick={() => setActiveTab("fuel")}
              >
                <Fuel className="mr-2 h-4 w-4" />Abastecimento
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Veículo *</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm(s => ({ ...s, vehicle_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {veiculos.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="font-mono">{v.placa}</span> — {v.marca} {v.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quilometragem *</Label>
                <Input
                  type="number" inputMode="numeric" min={0}
                  value={form.km}
                  onChange={(e) => setForm(s => ({ ...s, km: e.target.value }))}
                  placeholder="Ex: 45000"
                />
              </div>

              {activeTab === "maintenance" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Urgência *</Label>
                    <Select value={form.urgency} onValueChange={(v: any) => setForm(s => ({ ...s, urgency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {URG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Descrição do problema *</Label>
                    <Textarea
                      rows={4}
                      value={form.problem_description}
                      onChange={(e) => setForm(s => ({ ...s, problem_description: e.target.value }))}
                      placeholder="Descreva o problema com o máximo de detalhes..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Tipo de combustível *</Label>
                    <Select value={form.fuel_type} onValueChange={(v) => setForm(s => ({ ...s, fuel_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FUEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Litros solicitados *</Label>
                    <Input
                      type="number" inputMode="decimal" min={0} step="0.01"
                      value={form.liters}
                      onChange={(e) => setForm(s => ({ ...s, liters: e.target.value }))}
                      placeholder="Ex: 50"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      rows={3}
                      value={form.observations}
                      onChange={(e) => setForm(s => ({ ...s, observations: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </>
              )}

              {activeTab === "maintenance" && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={form.observations}
                    onChange={(e) => setForm(s => ({ ...s, observations: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={submit}
                disabled={submitting}
                variant="brand"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar solicitação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ FILTROS + TABELA ============ */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {isAdmin ? "Solicitações recebidas" : "Meu histórico de solicitações"}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={fType} onValueChange={(v: any) => setFType(v)}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="fuel">Abastecimento</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fStatus} onValueChange={(v: any) => setFStatus(v)}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="requested">Solicitado</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-10 text-center text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhuma solicitação encontrada" description="Ajuste os filtros ou envie uma nova solicitação." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    {isAdmin && <TableHead>Solicitante</TableHead>}
                    <TableHead>Veículo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const v = veicMap[r.vehicle_id];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.protocol}</TableCell>
                        <TableCell><TypePill type={r.type} /></TableCell>
                        {isAdmin && <TableCell>{usersMap[r.user_id] ?? "—"}</TableCell>}
                        <TableCell className="text-sm">
                          {v ? <><span className="font-mono">{v.placa}</span> <span className="text-muted-foreground">{v.modelo}</span></> : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Select value={r.status} onValueChange={(v: RequestStatus) => setStatus(r, v)}>
                              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(o => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <StatusBadge status={r.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => downloadPdf(r)}>
                              <Download className="mr-1 h-3.5 w-3.5" />PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

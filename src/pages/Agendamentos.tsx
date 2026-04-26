import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import type { Agendamento, Veiculo, Motorista } from "@/lib/types";
import { Car, CheckCircle2, MapPin, RotateCcw, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Paleta determinística para colorir cada veículo no calendário
const PALETTE = [
  "hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--warning))",
  "hsl(var(--success))", "hsl(var(--destructive))",
  "hsl(262 83% 58%)", "hsl(173 80% 40%)", "hsl(24 95% 53%)",
  "hsl(330 81% 60%)", "hsl(199 89% 48%)",
];
const colorFor = (idx: number) => PALETTE[idx % PALETTE.length];



const inRange = (day: Date, start: string, end: string | null) => {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date(start);
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0);
  const s0 = new Date(s);  s0.setHours(0, 0, 0, 0);
  const e0 = new Date(e);  e0.setHours(0, 0, 0, 0);
  return d0 >= s0 && d0 <= e0;
};

export default function Agendamentos() {
  const { rows, loading, insert, update } = useTable<Agendamento>("agendamentos");
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [popupAg, setPopupAg] = useState<Agendamento | null>(null);

  // Novo agendamento
  const [pickedVeiculo, setPickedVeiculo] = useState<Veiculo | null>(null);
  const [form, setForm] = useState<Partial<Agendamento>>({});

  // Devolução
  const [returning, setReturning] = useState<Agendamento | null>(null);
  const [retForm, setRetForm] = useState<{ km_retorno?: number; observacoes?: string }>({});

  const reloadVeiculos = async () => {
    const { data } = await supabase.from("veiculos").select("*").order("placa");
    setVeiculos((data ?? []) as Veiculo[]);
  };

  useEffect(() => {
    reloadVeiculos();
    supabase.from("motoristas").select("*").eq("status", "ativo").order("nome")
      .then(({ data }) => setMotoristas((data ?? []) as Motorista[]));
  }, []);

  // Mapas auxiliares
  const veiculoMap = useMemo(() => Object.fromEntries(veiculos.map(v => [v.id, v])), [veiculos]);
  const motoristaMap = useMemo(() => Object.fromEntries(motoristas.map(m => [m.id, m])), [motoristas]);
  const colorByVeiculo = useMemo(() => {
    const m: Record<string, string> = {};
    veiculos.forEach((v, i) => { m[v.id] = colorFor(i); });
    return m;
  }, [veiculos]);

  const ativos = useMemo(
    () => rows.filter(r => r.status === "agendado" || r.status === "em_uso"),
    [rows]
  );

  const eventosNoDia = useMemo(() => {
    if (!selectedDay) return [];
    return ativos.filter(a => inRange(selectedDay, a.data_saida, a.data_retorno_prevista));
  }, [selectedDay, ativos]);

  const diasComEvento = useMemo(() => {
    const set = new Set<string>();
    ativos.forEach(a => {
      const start = new Date(a.data_saida);
      const end = new Date(a.data_retorno_prevista);
      const cur = new Date(start); cur.setHours(0, 0, 0, 0);
      const last = new Date(end); last.setHours(0, 0, 0, 0);
      while (cur <= last) {
        set.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return Array.from(set).map(s => new Date(s + "T00:00:00"));
  }, [ativos]);

  // ---- Confirmar novo agendamento
  const confirmarAgendamento = async () => {
    if (!pickedVeiculo) return;
    if (!form.motorista_id || !form.data_saida || !form.data_retorno_prevista) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    try {
      await insert({
        ...form,
        veiculo_id: pickedVeiculo.id,
        status: "agendado",
        km_saida: pickedVeiculo.km_atual,
      });
      await (supabase.from("veiculos") as any).update({ status: "reservado" }).eq("id", pickedVeiculo.id);
      await reloadVeiculos();
      setPickedVeiculo(null);
      setForm({});
      toast({ title: "Agendamento confirmado", description: `Veículo ${pickedVeiculo.placa} reservado.` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  // ---- Iniciar uso (agendado → em_uso)
  const iniciarUso = async (a: Agendamento) => {
    await update(a.id, { status: "em_uso" } as Partial<Agendamento>);
  };

  // ---- Devolução
  const confirmarDevolucao = async () => {
    if (!returning) return;
    if (retForm.km_retorno == null || retForm.km_retorno < (returning.km_saida ?? 0)) {
      toast({ title: "Km de retorno inválido", variant: "destructive" });
      return;
    }
    try {
      await update(returning.id, {
        km_retorno: retForm.km_retorno,
        data_retorno_real: new Date().toISOString(),
        observacoes: retForm.observacoes ?? returning.observacoes,
        status: "concluido",
      } as Partial<Agendamento>);
      await (supabase.from("veiculos") as any).update({
        status: "disponivel",
        km_atual: retForm.km_retorno,
      }).eq("id", returning.veiculo_id);
      await reloadVeiculos();
      setReturning(null);
      setRetForm({});
      toast({ title: "Devolução registrada", description: "Veículo disponível novamente." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const cancelar = async (a: Agendamento) => {
    await update(a.id, { status: "cancelado" } as Partial<Agendamento>);
    await (supabase.from("veiculos") as any).update({ status: "disponivel" }).eq("id", a.veiculo_id);
    await reloadVeiculos();
  };

  return (
    <>
      <PageHeader title="Agendamentos" subtitle="Reserve veículos, acompanhe usos e registre devoluções" />

      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="novo">Novo Agendamento</TabsTrigger>
          <TabsTrigger value="ativos">
            Ativos {ativos.length > 0 && <Badge variant="secondary" className="ml-2">{ativos.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ====================== CALENDÁRIO ====================== */}
        <TabsContent value="calendario">
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <Card className="shadow-card">
              <CardContent className="p-2">
                <Calendar
                  mode="single"
                  selected={selectedDay}
                  onSelect={setSelectedDay}
                  modifiers={{ hasEvent: diasComEvento }}
                  modifiersClassNames={{ hasEvent: "font-bold ring-2 ring-primary/40 rounded-md" }}
                  className={cn("p-3 pointer-events-auto")}
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Eventos em {selectedDay?.toLocaleDateString("pt-BR") ?? "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-muted-foreground">Carregando...</p>
                  ) : eventosNoDia.length === 0 ? (
                    <p className="text-muted-foreground">Sem agendamentos neste dia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {eventosNoDia.map(a => {
                        const v = veiculoMap[a.veiculo_id];
                        const m = motoristaMap[a.motorista_id];
                        const color = colorByVeiculo[a.veiculo_id];
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => setPopupAg(a)}
                              className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition hover:bg-accent"
                            >
                              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono font-medium">{v?.placa ?? "—"}</span>
                                  <span className="text-muted-foreground">—</span>
                                  <span>{m?.nome ?? "—"}</span>
                                  <StatusBadge status={a.status} />
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {fmtDateTime(a.data_saida)} → {fmtDateTime(a.data_retorno_prevista)}
                                  {a.destino && <> • {a.destino}</>}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-base">Legenda por veículo</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {veiculos.map(v => (
                      <div key={v.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                        <span className="h-3 w-3 rounded-full" style={{ background: colorByVeiculo[v.id] }} />
                        <span className="font-mono">{v.placa}</span>
                        <span className="text-muted-foreground">{v.modelo}</span>
                      </div>
                    ))}
                    {veiculos.length === 0 && <span className="text-muted-foreground text-sm">Nenhum veículo cadastrado.</span>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ====================== NOVO AGENDAMENTO ====================== */}
        <TabsContent value="novo">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Selecione um veículo</CardTitle>
            </CardHeader>
            <CardContent>
              {veiculos.length === 0 ? (
                <p className="text-muted-foreground">Nenhum veículo cadastrado.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {veiculos.map(v => {
                    const disponivel = v.status === "disponivel";
                    const motivo =
                      v.status === "manutencao" ? "Em manutenção" :
                      v.status === "reservado" ? "Já reservado" :
                      v.status === "inativo" ? "Veículo inativo" : "";
                    const card = (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!disponivel}
                        onClick={() => disponivel && setPickedVeiculo(v)}
                        className={cn(
                          "group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition",
                          disponivel ? "hover:border-primary hover:shadow-elevated cursor-pointer" : "cursor-not-allowed opacity-50 grayscale",
                        )}
                      >
                        <div className="flex h-32 items-center justify-center bg-muted">
                          {v.foto_url ? (
                            <img src={v.foto_url} alt={v.placa} className="h-full w-full object-cover" />
                          ) : (
                            <Car className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                        <div className="space-y-1 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold">{v.placa}</span>
                            <StatusBadge status={v.status} />
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{v.marca} {v.modelo}</p>
                          <p className="text-xs text-muted-foreground">{fmtNumber(v.km_atual)} km</p>
                        </div>
                      </button>
                    );
                    return disponivel ? card : (
                      <Tooltip key={v.id}>
                        <TooltipTrigger asChild><div>{card}</div></TooltipTrigger>
                        <TooltipContent>{motivo}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== ATIVOS ====================== */}
        <TabsContent value="ativos">
          <Card className="shadow-card">
            <CardContent className="p-0">
              {ativos.length === 0 ? (
                <p className="p-10 text-center text-muted-foreground">Nenhum agendamento ativo.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {ativos.map(a => {
                    const v = veiculoMap[a.veiculo_id];
                    const m = motoristaMap[a.motorista_id];
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                        <span className="h-3 w-3 rounded-full" style={{ background: colorByVeiculo[a.veiculo_id] }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-medium">{v?.placa ?? "—"}</span>
                            <span className="text-muted-foreground">—</span>
                            <span>{m?.nome ?? "—"}</span>
                            <StatusBadge status={a.status} />
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmtDateTime(a.data_saida)} → {fmtDateTime(a.data_retorno_prevista)}
                            {a.destino && <> • {a.destino}</>}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex flex-wrap gap-2">
                            {a.status === "agendado" && (
                              <Button size="sm" variant="outline" onClick={() => iniciarUso(a)}>
                                Iniciar uso
                              </Button>
                            )}
                            {a.status === "em_uso" && (
                              <Button size="sm" className="bg-gradient-brand text-primary-foreground"
                                onClick={() => { setReturning(a); setRetForm({ km_retorno: v?.km_atual }); }}>
                                <RotateCcw className="mr-1 h-3.5 w-3.5" />Registrar devolução
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => cancelar(a)}>Cancelar</Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============== Popup de evento ============== */}
      <Dialog open={!!popupAg} onOpenChange={(o) => !o && setPopupAg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do agendamento</DialogTitle>
            <DialogDescription className="sr-only">Informações completas da reserva selecionada.</DialogDescription>
          </DialogHeader>
          {popupAg && (() => {
            const v = veiculoMap[popupAg.veiculo_id];
            const m = motoristaMap[popupAg.motorista_id];
            return (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" /><span className="font-mono font-medium">{v?.placa}</span><span className="text-muted-foreground">{v?.marca} {v?.modelo}</span></div>
                <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{m?.nome ?? "—"}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{popupAg.destino ?? "—"}</div>
                <div className="rounded-md border border-border bg-muted/30 p-2">
                  <div><span className="text-muted-foreground">Saída:</span> {fmtDateTime(popupAg.data_saida)}</div>
                  <div><span className="text-muted-foreground">Retorno previsto:</span> {fmtDateTime(popupAg.data_retorno_prevista)}</div>
                  {popupAg.data_retorno_real && <div><span className="text-muted-foreground">Retorno real:</span> {fmtDateTime(popupAg.data_retorno_real)}</div>}
                </div>
                <div><StatusBadge status={popupAg.status} /></div>
                {popupAg.observacoes && <p className="text-muted-foreground">{popupAg.observacoes}</p>}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ============== Modal: novo agendamento (após pick) ============== */}
      <Dialog open={!!pickedVeiculo} onOpenChange={(o) => { if (!o) { setPickedVeiculo(null); setForm({}); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo agendamento — {pickedVeiculo?.placa}</DialogTitle>
            <DialogDescription className="sr-only">Formulário para reservar o veículo selecionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Motorista *</Label>
              <Select value={form.motorista_id ?? ""} onValueChange={(v) => setForm(s => ({ ...s, motorista_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{motoristas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Saída *</Label>
                <Input type="datetime-local" value={form.data_saida ?? ""} onChange={(e) => setForm(s => ({ ...s, data_saida: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Retorno previsto *</Label>
                <Input type="datetime-local" value={form.data_retorno_prevista ?? ""} onChange={(e) => setForm(s => ({ ...s, data_retorno_prevista: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Destino</Label>
              <Input value={form.destino ?? ""} onChange={(e) => setForm(s => ({ ...s, destino: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm(s => ({ ...s, observacoes: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Km saída: {fmtNumber(pickedVeiculo?.km_atual ?? 0)} (atual do veículo)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPickedVeiculo(null); setForm({}); }}>Cancelar</Button>
            <Button className="bg-gradient-brand text-primary-foreground" onClick={confirmarAgendamento}>
              <CheckCircle2 className="mr-1 h-4 w-4" />Confirmar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============== Modal: devolução ============== */}
      <Dialog open={!!returning} onOpenChange={(o) => { if (!o) { setReturning(null); setRetForm({}); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar devolução</DialogTitle>
            <DialogDescription className="sr-only">Confirme os dados de devolução do veículo.</DialogDescription>
          </DialogHeader>
          {returning && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Veículo <span className="font-mono font-medium text-foreground">{veiculoMap[returning.veiculo_id]?.placa}</span> •
                Km saída: {fmtNumber(returning.km_saida ?? 0)}
              </p>
              <div className="space-y-1.5">
                <Label>Km de retorno *</Label>
                <Input type="number" value={retForm.km_retorno ?? ""} onChange={(e) => setRetForm(s => ({ ...s, km_retorno: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={retForm.observacoes ?? ""} onChange={(e) => setRetForm(s => ({ ...s, observacoes: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReturning(null); setRetForm({}); }}>Cancelar</Button>
            <Button className="bg-gradient-brand text-primary-foreground" onClick={confirmarDevolucao}>Confirmar devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

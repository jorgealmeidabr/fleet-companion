import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { useChecklistPendente } from "@/hooks/useChecklistPendente";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import type { Agendamento, Veiculo, Motorista } from "@/lib/types";
import { AlertTriangle, Camera, Car, CheckCircle2, MapPin, RotateCcw, Upload, User, X, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { MotoristaAutocomplete } from "@/components/MotoristaAutocomplete";
import { uploadFiles } from "@/lib/storage";
import { HourTimeline, suggestFreeSlots } from "@/components/HourTimeline";
import { VeiculoChecklistStatus } from "@/components/VeiculoChecklistStatus";
import { janelaOcupada } from "@/lib/agendamento";

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

const fmtHHmm = (d: Date) =>
  `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

const toDatetimeLocal = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Agendamentos() {
  const { rows, loading, insert, update } = useTable<Agendamento>("agendamentos");
  const { isAdmin, perfil = null } = useAuth();
  const { toast } = useToast();
  const { pendentes: checklistPendentes } = useChecklistPendente();
  const temPendencia = !isAdmin && checklistPendentes.length > 0;
  const navigate = useNavigate();

  // Toca 3 bipes curtos via WebAudio + mensagem de voz (TTS)
  const playReturnBeeps = () => {
    // 1) Dispara a fala IMEDIATAMENTE no gesto do usuário (necessário em
    //    navegadores como Chrome/Safari que bloqueiam fala fora de gesto).
    //    A fala é "engatilhada" agora e segura por ~900ms via pause(),
    //    para tocar logo após os bipes.
    let utter: SpeechSynthesisUtterance | null = null;
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const synth = window.speechSynthesis;
        synth.cancel();
        utter = new SpeechSynthesisUtterance(
          "Finalize o checklist para concluir o processo de devolução do veículo."
        );
        utter.lang = "pt-BR";
        utter.rate = 1;
        utter.pitch = 1;
        utter.volume = 1;
        const pickVoice = () => {
          const voices = synth.getVoices();
          const ptVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("pt"));
          if (ptVoice && utter) utter.voice = ptVoice;
        };
        pickVoice();
        if (!synth.getVoices().length) {
          // Algumas plataformas carregam vozes de forma assíncrona
          synth.onvoiceschanged = () => pickVoice();
        }
        // Inicia (dentro do gesto) e pausa para sincronizar com o fim dos bipes
        synth.speak(utter);
        synth.pause();
        setTimeout(() => {
          try { synth.resume(); } catch { /* ignora */ }
        }, 950);
        // Fallback: se pause/resume não for suportado, força um novo speak
        setTimeout(() => {
          try {
            if (!synth.speaking && utter) {
              synth.cancel();
              synth.speak(utter);
            }
          } catch { /* ignora */ }
        }, 1100);
      }
    } catch { /* ignora */ }

    // 2) Bipes
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      const ctx = new Ctx();
      const beep = (start: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.15);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.16);
      };
      // 3 bipes com ~300ms de intervalo (0ms, 300ms, 600ms)
      beep(0); beep(0.3); beep(0.6);
      setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch { /* ignora */ }
  };

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [popupAg, setPopupAg] = useState<Agendamento | null>(null);

  // Novo agendamento
  const [pickedVeiculo, setPickedVeiculo] = useState<Veiculo | null>(null);
  const [form, setForm] = useState<Partial<Agendamento>>({});

  // Devolução
  const [returning, setReturning] = useState<Agendamento | null>(null);
  const [retForm, setRetForm] = useState<{ km_retorno?: number; observacoes?: string; foto_url?: string }>({});
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [savingDevolucao, setSavingDevolucao] = useState(false);

  const reloadVeiculos = async () => {
    const { data } = await supabase.from("veiculos").select("*").order("placa");
    setVeiculos((data ?? []) as Veiculo[]);
  };

  useEffect(() => {
    reloadVeiculos();
    supabase.from("motoristas").select("*").eq("status", "ativo").order("nome")
      .then(({ data }) => setMotoristas((data ?? []) as Motorista[]));

    const channel = supabase
      .channel("ag-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "veiculos" }, () => reloadVeiculos())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Mapas auxiliares
  const veiculoMap = useMemo(() => Object.fromEntries(veiculos.map(v => [v.id, v])), [veiculos]);
  const motoristaMap = useMemo(() => Object.fromEntries(motoristas.map(m => [m.id, m])), [motoristas]);
  const colorByVeiculo = useMemo(() => {
    const m: Record<string, string> = {};
    veiculos.forEach((v, i) => { m[v.id] = colorFor(i); });
    return m;
  }, [veiculos]);

  // Toda reserva que ocupa horário (exclui apenas canceladas e concluídas).
  // Usado no calendário/timeline para evitar conflitos — precisa ver TODOS.
  const ativos = useMemo(
    () => rows.filter(r => r.status !== "cancelado" && r.status !== "concluido"),
    [rows]
  );

  // Lista da aba "Ativos": cada usuário (inclusive admin) vê APENAS os próprios.
  const ativosVisiveis = useMemo(() => {
    if (!perfil?.motorista_id) return [];
    return ativos.filter(a => a.motorista_id === perfil.motorista_id);
  }, [ativos, perfil?.motorista_id]);

  const eventosNoDia = useMemo(() => {
    if (!selectedDay) return [];
    const d0 = new Date(selectedDay); d0.setHours(0, 0, 0, 0);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    return ativos.filter(a => {
      const { inicio, fim } = janelaOcupada(a);
      return inicio < d1 && fim > d0;
    });
  }, [selectedDay, ativos]);

  const diasComEvento = useMemo(() => {
    const set = new Set<string>();
    ativos.forEach(a => {
      const { inicio, fim } = janelaOcupada(a);
      const cur = new Date(inicio); cur.setHours(0, 0, 0, 0);
      const last = new Date(fim); last.setHours(0, 0, 0, 0);
      while (cur <= last) {
        set.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return Array.from(set).map(s => new Date(s + "T00:00:00"));
  }, [ativos]);

  // ---------- Detecção de conflito (form atual) ----------
  const conflito = useMemo(() => {
    if (!pickedVeiculo || !form.data_saida || !form.data_retorno_prevista) return null;
    const inicio = new Date(form.data_saida);
    const fim = new Date(form.data_retorno_prevista);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return null;
    if (fim <= inicio) return { tipo: "ordem" as const };
    const choque = ativos.find(a => {
      if (a.veiculo_id !== pickedVeiculo.id) return false;
      const j = janelaOcupada(a);
      return inicio < j.fim && fim > j.inicio;
    });
    return choque ? { tipo: "overlap" as const, agendamento: choque } : null;
  }, [pickedVeiculo, form.data_saida, form.data_retorno_prevista, ativos]);

  // Sugestões automáticas quando há conflito
  const sugestoes = useMemo(() => {
    if (!conflito || conflito.tipo !== "overlap" || !pickedVeiculo || !form.data_saida || !form.data_retorno_prevista) return [];
    const inicio = new Date(form.data_saida);
    const fim = new Date(form.data_retorno_prevista);
    const durMin = Math.max(30, Math.round((fim.getTime() - inicio.getTime()) / 60000));
    const dayRef = new Date(inicio); dayRef.setHours(0, 0, 0, 0);
    const agsDoVeiculo = ativos.filter(a => a.veiculo_id === pickedVeiculo.id);
    return suggestFreeSlots(agsDoVeiculo, dayRef, durMin, { max: 4 });
  }, [conflito, pickedVeiculo, form.data_saida, form.data_retorno_prevista, ativos]);

  // ---- Confirmar novo agendamento
  const confirmarAgendamento = async () => {
    if (!pickedVeiculo) return;
    if (temPendencia) {
      toast({
        title: "Checklist pós-uso pendente",
        description: "Finalize o checklist da última devolução antes de reservar outro veículo.",
        variant: "destructive",
      });
      navigate("/checklists");
      return;
    }
    if (!form.motorista_id || !form.data_saida || !form.data_retorno_prevista) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (conflito) {
      toast({
        title: conflito.tipo === "ordem" ? "Datas inválidas" : "Conflito de horário",
        description: conflito.tipo === "ordem"
          ? "A data de retorno deve ser posterior à de saída."
          : "Já existe um agendamento ativo neste intervalo. Escolha outro.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Dupla checagem server-side (em caso de corrida)
      const { data: conflitoSrv } = await (supabase.rpc as any)("check_agendamento_conflito", {
        _veiculo_id: pickedVeiculo.id,
        _inicio: form.data_saida,
        _fim: form.data_retorno_prevista,
        _ignore_id: null,
      });
      if (conflitoSrv === true) {
        toast({ title: "Horário já reservado", description: "Outro usuário acabou de reservar este intervalo.", variant: "destructive" });
        return;
      }

      await insert({
        ...form,
        veiculo_id: pickedVeiculo.id,
        status: "ativo",
        km_saida: pickedVeiculo.km_atual,
      });
      setPickedVeiculo(null);
      setForm({});
      toast({ title: "Agendamento confirmado", description: `Veículo ${pickedVeiculo.placa} reservado.` });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.toLowerCase().includes("conflito")) {
        toast({ title: "Conflito de horário", description: "O servidor bloqueou: já existe agendamento neste intervalo.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    }
  };

  // ---- Iniciar uso (sincroniza km_atual)
  const iniciarUso = async (a: Agendamento) => {
    if (a.km_saida != null) {
      await (supabase.from("veiculos") as any).update({ km_atual: a.km_saida }).eq("id", a.veiculo_id);
      await reloadVeiculos();
    }
    toast({ title: "Uso iniciado", description: "Boa viagem!" });
  };

  // ---- Upload da foto do hodômetro
  const handleFotoHodometro = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingFoto(true);
    try {
      const [url] = await uploadFiles("checklists", [files[0]]);
      setRetForm(s => ({ ...s, foto_url: url }));
      toast({ title: "Foto enviada" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploadingFoto(false);
    }
  };

  // ---- Devolução: encerra o agendamento (status = cancelado para sair do ativo)
  // NOTA: como simplificamos para 2 status, "cancelado" = encerrado (não conta mais).
  const confirmarDevolucao = async () => {
    if (!returning) return;
    if (retForm.km_retorno == null || retForm.km_retorno < (returning.km_saida ?? 0)) {
      toast({
        title: "Km de retorno inválido. O valor não pode ser menor que o Km de saída.",
        variant: "destructive",
      });
      return;
    }
    if (!retForm.foto_url) {
      toast({ title: "Foto do hodômetro obrigatória", variant: "destructive" });
      return;
    }
    setSavingDevolucao(true);
    try {
      const obsFinal = `[Foto hodômetro: ${retForm.foto_url}]${retForm.observacoes ? " " + retForm.observacoes : returning.observacoes ? " " + returning.observacoes : ""}`;
      await update(returning.id, {
        km_retorno: retForm.km_retorno,
        data_retorno_real: new Date().toISOString(),
        observacoes: obsFinal,
        status: "cancelado",
      } as Partial<Agendamento>);
      await (supabase.from("veiculos") as any).update({ km_atual: retForm.km_retorno }).eq("id", returning.veiculo_id);
      await reloadVeiculos();
      setReturning(null);
      setRetForm({});
      playReturnBeeps();
      toast({ title: "Devolução registrada", description: "Finalize o checklist para concluir o processo." });
      navigate("/checklists");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingDevolucao(false);
    }
  };

  const cancelar = async (a: Agendamento) => {
    await update(a.id, { status: "cancelado" } as Partial<Agendamento>);
  };

  // Veículo é selecionável se NÃO está em manutencao/inativo E o usuário não tem checklist pendente.
  const isVeiculoSelecionavel = (v: Veiculo) =>
    !temPendencia && v.status !== "manutencao" && v.status !== "inativo";

  return (
    <>
      <PageHeader title="Agendamentos" subtitle="Reserva Temporal com Controle de Disponibilidade e Conflitos" />

      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="novo">Novo Agendamento</TabsTrigger>
          <TabsTrigger value="ativos">
            Ativos {ativosVisiveis.length > 0 && <Badge variant="secondary" className="ml-2">{ativosVisiveis.length}</Badge>}
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
                <div className="mt-2 flex items-center justify-around gap-2 px-2 pb-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-success/40" />Livre</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-destructive/70" />Ocupado</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Timeline horária por veículo */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Disponibilidade por horário em {selectedDay?.toLocaleDateString("pt-BR") ?? "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {veiculos.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum veículo cadastrado.</p>
                  ) : selectedDay ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Exibindo reservas de <strong>todos os usuários</strong> para este dia. Use a visão para identificar horários livres.
                      </p>
                      {veiculos.map(v => {
                        const ags = ativos.filter(a => a.veiculo_id === v.id);
                        const agsNoDia = ags
                          .filter(a => inRange(selectedDay, a.data_saida, a.data_retorno_prevista))
                          .sort((a, b) => new Date(a.data_saida).getTime() - new Date(b.data_saida).getTime());
                        return (
                          <div key={v.id} className="space-y-1.5 pb-2 border-b border-border/40 last:border-b-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorByVeiculo[v.id] }} />
                              <span className="font-mono font-medium">{v.placa}</span>
                              <span className="text-muted-foreground">{v.marca} {v.modelo}</span>
                              {agsNoDia.length > 0 && (
                                <Badge variant="secondary" className="ml-auto text-[10px] py-0 h-4">
                                  {agsNoDia.length} reserva{agsNoDia.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <HourTimeline agendamentos={ags} day={selectedDay} />
                            {agsNoDia.length > 0 && (
                              <ul className="space-y-0.5 pl-4 pt-1">
                                {agsNoDia.map(a => {
                                  const m = motoristaMap[a.motorista_id];
                                  const s = new Date(a.data_saida);
                                  const e = new Date(a.data_retorno_prevista);
                                  return (
                                    <li key={a.id} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                      <span className="font-mono text-foreground">{fmtHHmm(s)}–{fmtHHmm(e)}</span>
                                      <span>·</span>
                                      <User className="h-3 w-3" />
                                      <span className="truncate">{m?.nome ?? "Motorista"}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </>
                  ) : null}
                </CardContent>
              </Card>

              {/* Lista textual */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Eventos do dia</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-muted-foreground">Carregando...</p>
                  ) : eventosNoDia.length === 0 ? (
                    <p className="text-muted-foreground">Sem agendamentos ativos neste dia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {eventosNoDia.map(a => {
                        const v = veiculoMap[a.veiculo_id];
                        const m = motoristaMap[a.motorista_id];
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => setPopupAg(a)}
                              className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition hover:bg-accent"
                            >
                              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorByVeiculo[a.veiculo_id] }} />
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
                    const selecionavel = isVeiculoSelecionavel(v);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!selecionavel}
                        onClick={() => selecionavel && setPickedVeiculo(v)}
                        className={cn(
                          "group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition",
                          selecionavel ? "hover:border-primary hover:shadow-elevated cursor-pointer" : "cursor-not-allowed opacity-50",
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
                            {!selecionavel && <StatusBadge status={v.status} />}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{v.marca} {v.modelo}</p>
                          <p className="text-xs text-muted-foreground">{fmtNumber(v.km_atual)} km</p>
                        </div>
                      </button>
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
              {ativosVisiveis.length === 0 ? (
                <p className="p-10 text-center text-muted-foreground">
                  Você não possui agendamentos ativos.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {ativosVisiveis.map(a => {
                    const v = veiculoMap[a.veiculo_id];
                    const m = motoristaMap[a.motorista_id];
                    const ehDono = a.motorista_id === perfil?.motorista_id;
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
                        <div className="flex flex-wrap gap-2">
                          {ehDono && (
                            <Button size="sm" variant="outline" onClick={() => iniciarUso(a)}>
                              Iniciar uso
                            </Button>
                          )}
                          {ehDono && (
                            <Button size="sm" variant="brand"
                              onClick={() => { setReturning(a); setRetForm({ km_retorno: veiculoMap[a.veiculo_id]?.km_atual }); }}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />Registrar devolução
                            </Button>
                          )}
                          {ehDono && (
                            <Button size="sm" variant="ghost" onClick={() => cancelar(a)}>Cancelar</Button>
                          )}
                        </div>
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
            <DialogDescription className="sr-only">Informações da reserva.</DialogDescription>
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

      {/* ============== Modal: novo agendamento ============== */}
      <Dialog open={!!pickedVeiculo} onOpenChange={(o) => { if (!o) { setPickedVeiculo(null); setForm({}); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo agendamento — {pickedVeiculo?.placa}</DialogTitle>
            <DialogDescription className="sr-only">Reservar o veículo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pickedVeiculo && <VeiculoChecklistStatus veiculoId={pickedVeiculo.id} />}
            <div className="space-y-1.5">
              <Label>Motorista *</Label>
              <MotoristaAutocomplete
                motoristas={motoristas}
                value={form.motorista_id ?? ""}
                onChange={(id) => setForm(s => ({ ...s, motorista_id: id }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Saída *</Label>
              <Input
                type="datetime-local"
                value={form.data_saida ?? ""}
                onChange={(e) => {
                  const saida = e.target.value;
                  let fim = "";
                  if (saida) {
                    const d = new Date(saida);
                    if (!isNaN(d.getTime())) {
                      d.setHours(d.getHours() + 24);
                      const pad = (n: number) => String(n).padStart(2, "0");
                      fim = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    }
                  }
                  setForm(s => ({ ...s, data_saida: saida, data_retorno_prevista: fim }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                O horário de retorno será registrado automaticamente na devolução do veículo.
              </p>
            </div>

            {/* Timeline visual do dia escolhido */}
            {pickedVeiculo && form.data_saida && (() => {
              const day = new Date(form.data_saida);
              if (isNaN(day.getTime())) return null;
              day.setHours(0, 0, 0, 0);
              const ags = ativos.filter(a => a.veiculo_id === pickedVeiculo.id);
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Disponibilidade em {day.toLocaleDateString("pt-BR")}
                  </Label>
                  <HourTimeline
                    agendamentos={ags}
                    day={day}
                    highlight={form.data_retorno_prevista ? { inicio: form.data_saida, fim: form.data_retorno_prevista } : null}
                  />
                </div>
              );
            })()}

            {/* Feedback de conflito */}
            {conflito?.tipo === "overlap" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">⚠️ Esse horário já está reservado para este veículo.</p>
                    <p className="text-xs text-muted-foreground">
                      Conflita com: {fmtDateTime(conflito.agendamento.data_saida)} → {fmtDateTime(conflito.agendamento.data_retorno_prevista)}
                    </p>
                  </div>
                </div>
                {sugestoes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium inline-flex items-center gap-1"><Lightbulb className="h-3 w-3" />Sugestões disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      {sugestoes.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, data_saida: toDatetimeLocal(s.inicio), data_retorno_prevista: toDatetimeLocal(s.fim) }))}
                          className="rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs text-success hover:bg-success/20 transition"
                        >
                          ✔ {fmtHHmm(s.inicio)} → {fmtHHmm(s.fim)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {conflito?.tipo === "ordem" && (
              <p className="text-xs text-destructive">A data de retorno deve ser posterior à de saída.</p>
            )}

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
            <Button
              variant="brand"
              disabled={!!conflito}
              onClick={confirmarAgendamento}
            >
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
            <DialogDescription className="sr-only">Confirme os dados de devolução.</DialogDescription>
          </DialogHeader>
          {returning && (() => {
            const kmSaida = returning.km_saida ?? 0;
            const kmRetorno = retForm.km_retorno;
            const kmInvalido = kmRetorno != null && !Number.isNaN(kmRetorno) && kmRetorno < kmSaida;
            return (
            <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Veículo <span className="font-mono font-medium text-foreground">{veiculoMap[returning.veiculo_id]?.placa}</span> •
                Km saída: {fmtNumber(kmSaida)}
              </p>
              <div className="space-y-1.5">
                <Label>Km de retorno (hodômetro) *</Label>
                <Input
                  type="number"
                  placeholder="Informe o KM atual"
                  value={retForm.km_retorno ?? ""}
                  onChange={(e) => setRetForm(s => ({ ...s, km_retorno: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  aria-invalid={kmInvalido}
                  className={kmInvalido ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {kmInvalido ? (
                  <p className="text-xs text-destructive">
                    Km de retorno inválido. O valor não pode ser menor que o Km de saída.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Esse KM virará o KM de saída do próximo agendamento.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><Camera className="h-4 w-4" />Foto do hodômetro *</Label>
                {!retForm.foto_url ? (
                  <Input type="file" accept="image/*" capture="environment" disabled={uploadingFoto}
                    onChange={(e) => handleFotoHodometro(e.target.files)} />
                ) : (
                  <div className="relative inline-block">
                    <img src={retForm.foto_url} alt="hodômetro" className="h-32 rounded-md border border-border object-cover" />
                    <button type="button" onClick={() => setRetForm(s => ({ ...s, foto_url: undefined }))}
                      className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {uploadingFoto && <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Upload className="h-3 w-3 animate-pulse" />Enviando...</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={retForm.observacoes ?? ""} onChange={(e) => setRetForm(s => ({ ...s, observacoes: e.target.value }))} />
              </div>
              <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs">
                ⏱️ O horário de retorno será registrado automaticamente <strong>agora</strong> ({fmtDateTime(new Date().toISOString())}). Confirme apenas após chegar com o veículo.
              </div>
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                ⚠️ Após a devolução, o checklist pós-uso é obrigatório antes de novas ações.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReturning(null); setRetForm({}); }}>Cancelar</Button>
              <Button
                variant="brand"
                disabled={savingDevolucao || uploadingFoto || kmInvalido || kmRetorno == null}
                onClick={confirmarDevolucao}
              >
                {savingDevolucao ? "Salvando..." : "Confirmar devolução"}
              </Button>
            </DialogFooter>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

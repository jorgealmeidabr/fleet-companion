import { useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { fmtNumber } from "@/lib/format";
import type { Veiculo } from "@/lib/types";
import { Plus, Search, MoreVertical, Car, Pencil, Eye, PowerOff } from "lucide-react";
import { validarPlaca, formatarPlaca, validarAno } from "@/lib/validators";
import { EmptyState } from "@/components/EmptyState";
import { CardGridSkeleton } from "@/components/Skeletons";
import { ConfirmDialog } from "@/components/ConfirmDialog";


const fields: FieldDef[] = [
  { name: "placa", label: "Placa", required: true,
    placeholder: "AAA-0000 ou AAA0A00",
    format: formatarPlaca, validate: validarPlaca },
  { name: "marca", label: "Marca", required: true },
  { name: "modelo", label: "Modelo", required: true },
  { name: "ano", label: "Ano", type: "number", required: true,
    validate: (v) => validarAno(v) },
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
  type AgInfo = { motoristaNome: string; dataSaida: string };
  const [agendamentosAtivos, setAgendamentosAtivos] = useState<Map<string, AgInfo>>(new Map());
  const [now, setNow] = useState(() => Date.now());

  // Tick a cada 60s para recalcular tempo decorrido e transição reservado→em_uso
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fonte de verdade: agendamentos ativos com nome do motorista e horário de saída
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("agendamentos")
        .select("veiculo_id,data_saida,motorista_id")
        .eq("status", "ativo");
      const ags = (data ?? []) as Array<{ veiculo_id: string; data_saida: string; motorista_id: string }>;
      const motoristaIds = Array.from(new Set(ags.map(a => a.motorista_id).filter(Boolean)));
      let nomes: Record<string, string> = {};
      if (motoristaIds.length) {
        const { data: ms } = await supabase
          .from("motoristas")
          .select("id,nome")
          .in("id", motoristaIds);
        nomes = Object.fromEntries(((ms ?? []) as Array<{ id: string; nome: string }>).map(m => [m.id, m.nome]));
      }
      const map = new Map<string, AgInfo>();
      // Em caso de múltiplos ativos por veículo (não deveria), pega o de saída mais recente
      ags.sort((a, b) => a.data_saida.localeCompare(b.data_saida));
      for (const a of ags) {
        map.set(a.veiculo_id, { motoristaNome: nomes[a.motorista_id] ?? "—", dataSaida: a.data_saida });
      }
      setAgendamentosAtivos(map);
    };
    load();
    const channel = supabase
      .channel("veiculos-agendamentos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos" }, () => load())
      .subscribe();
    // Polling a cada 15s para garantir atualização do status
    const pollId = setInterval(load, 15_000);
    return () => { supabase.removeChannel(channel); clearInterval(pollId); };
  }, []);

  // Deriva status efetivo: agendamento ativo vira "reservado" (futuro) ou "em_uso" (já saiu)
  const rowsEfetivos = useMemo<Veiculo[]>(() => rows.map(v => {
    if (v.status === "manutencao" || v.status === "inativo") return v;
    const info = agendamentosAtivos.get(v.id);
    if (!info) return v;
    const saida = new Date(info.dataSaida).getTime();
    const status: Veiculo["status"] = saida <= now ? ("em_uso" as Veiculo["status"]) : "reservado";
    return { ...v, status };
  }), [rows, agendamentosAtivos, now]);

  const formatHHmm = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatDuracao = (desdeISO: string, nowMs: number) => {
    const diff = Math.max(0, nowMs - new Date(desdeISO).getTime());
    const totalMin = Math.floor(diff / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2, "0")}m`;
  };

  // Notificações por voz (admin) — toca quando o status efetivo muda
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin) return;
    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
    const speak = (texto: string) => {
      if (!canSpeak) return;
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "pt-BR";
      u.rate = 1;
      window.speechSynthesis.speak(u);
    };
    const relevantes = new Set(["disponivel", "reservado", "em_uso"]);
    const prev = prevStatusRef.current;
    if (!initializedRef.current) {
      for (const v of rowsEfetivos) prev.set(v.id, v.status as string);
      initializedRef.current = true;
      return;
    }
    for (const v of rowsEfetivos) {
      const status = v.status as string;
      const anterior = prev.get(v.id);
      if (anterior === status) continue;
      prev.set(v.id, status);
      if (!relevantes.has(status)) continue;
      const info = agendamentosAtivos.get(v.id);
      const motorista = info?.motoristaNome ?? "";
      let frase = "";
      if (status === "reservado") {
        frase = `O veículo ${v.modelo}, placa ${v.placa}, foi reservado pelo condutor ${motorista}.`;
      } else if (status === "em_uso") {
        frase = `O veículo ${v.modelo}, placa ${v.placa}, está em uso pelo condutor ${motorista}.`;
      } else if (status === "disponivel") {
        frase = `O veículo ${v.modelo}, placa ${v.placa}, está disponível.`;
      }
      if (frase) speak(frase);
    }
  }, [rowsEfetivos, agendamentosAtivos, isAdmin]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rowsEfetivos.filter(v => {
      if (q && !v.placa.toLowerCase().includes(q) && !v.modelo.toLowerCase().includes(q)) return false;
      if (fStatus !== "todos" && v.status !== fStatus) return false;
      if (fTipo !== "todos" && v.tipo !== fTipo) return false;
      if (fComb !== "todos" && v.combustivel !== fComb) return false;
      return true;
    });
  }, [rowsEfetivos, busca, fStatus, fTipo, fComb]);

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle="Estado da frota em tempo real"
        actions={isAdmin && (
          <FormDialog<Veiculo>
            title="Novo veículo" fields={fields} onSubmit={insert}
            trigger={<Button variant="brand"><Plus className="mr-1 h-4 w-4" />Novo veículo</Button>}
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
        <CardGridSkeleton count={8} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Car} title="Nenhum veículo encontrado"
          description={busca || fStatus !== "todos" || fTipo !== "todos" || fComb !== "todos" ? "Ajuste os filtros para ver mais resultados." : "Cadastre o primeiro veículo da frota."} />
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
                        <ConfirmDialog
                          title="Inativar veículo"
                          description={`Confirma inativar o veículo ${v.placa}? Ele deixará de aparecer como disponível.`}
                          confirmLabel="Inativar"
                          destructive
                          onConfirm={() => update(v.id, { status: "inativo" })}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <PowerOff className="mr-2 h-4 w-4" />Inativar
                            </DropdownMenuItem>
                          }
                        />
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
                {(() => {
                  const info = agendamentosAtivos.get(v.id);
                  if (!info) return null;
                  if (v.status === "reservado") {
                    return (
                      <div className="text-xs text-muted-foreground">
                        Reservado para <span className="font-medium text-foreground">{info.motoristaNome}</span> · {formatHHmm(info.dataSaida)}
                      </div>
                    );
                  }
                  if (v.status === ("em_uso" as Veiculo["status"])) {
                    return (
                      <div className="text-xs text-muted-foreground">
                        Em uso por <span className="font-medium text-foreground">{info.motoristaNome}</span> · há {formatDuracao(info.dataSaida, now)}
                      </div>
                    );
                  }
                  return null;
                })()}
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

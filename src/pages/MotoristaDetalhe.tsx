import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import type { Agendamento, Motorista, Veiculo } from "@/lib/types";
import { ArrowLeft, AlertTriangle, Mail, Phone } from "lucide-react";

export default function MotoristaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [veiculos, setVeiculos] = useState<Record<string, Veiculo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [m, ag, v] = await Promise.all([
        supabase.from("motoristas").select("*").eq("id", id).maybeSingle(),
        supabase.from("agendamentos").select("*").eq("motorista_id", id).order("data_saida", { ascending: false }),
        supabase.from("veiculos").select("*"),
      ]);
      setMotorista((m.data as Motorista) ?? null);
      setAgendamentos((ag.data ?? []) as Agendamento[]);
      const map: Record<string, Veiculo> = {};
      ((v.data ?? []) as Veiculo[]).forEach(x => { map[x.id] = x; });
      setVeiculos(map);
      setLoading(false);
    })();
  }, [id]);

  const dias = useMemo(() => {
    if (!motorista) return 0;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const v = new Date(motorista.cnh_validade); v.setHours(0, 0, 0, 0);
    return Math.round((v.getTime() - hoje.getTime()) / 86400000);
  }, [motorista]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!motorista) return (
    <div className="text-center">
      <p className="text-muted-foreground">Motorista não encontrado.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/motoristas")}>Voltar</Button>
    </div>
  );

  const vencida = dias < 0, vencendo = !vencida && dias <= 30;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate("/motoristas")} className="mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar
      </Button>

      <Card className="mb-6">
        <CardContent className="flex flex-col items-start gap-6 p-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24">
            <AvatarImage src={motorista.foto_url ?? undefined} alt={motorista.nome} />
            <AvatarFallback className="text-2xl">{motorista.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{motorista.nome}</h1>
              <StatusBadge status={motorista.status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">CNH</dt><dd className="font-mono font-medium">{motorista.cnh_numero}</dd></div>
              <div><dt className="text-muted-foreground">Categoria</dt><dd className="font-medium">{motorista.cnh_categoria}</dd></div>
              <div><dt className="text-muted-foreground">Validade</dt><dd className="font-medium">{fmtDate(motorista.cnh_validade)}</dd></div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><dd className="font-medium">{motorista.telefone ?? "—"}</dd></div>
              <div className="col-span-2 flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><dd className="font-medium">{motorista.email ?? "—"}</dd></div>
            </dl>
            {(vencida || vencendo) && (
              <div className={`mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${vencida ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/10 text-warning"}`}>
                <AlertTriangle className="h-4 w-4" />
                {vencida ? `CNH vencida há ${Math.abs(dias)} dia(s)` : `CNH vence em ${dias} dia(s)`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Histórico de agendamentos ({agendamentos.length})</h2>
      {agendamentos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum agendamento registrado.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {agendamentos.map(a => {
              const v = veiculos[a.veiculo_id];
              return (
                <div key={a.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                  <div className="col-span-3 font-mono">{v?.placa ?? "—"} <span className="text-muted-foreground">{v?.modelo}</span></div>
                  <div className="col-span-3 text-muted-foreground">{fmtDateTime(a.data_saida)}</div>
                  <div className="col-span-4 truncate">{a.destino ?? "—"}</div>
                  <div className="col-span-1 text-right text-muted-foreground">{a.km_retorno && a.km_saida ? `${fmtNumber(a.km_retorno - a.km_saida)} km` : "—"}</div>
                  <div className="col-span-1 text-right"><StatusBadge status={a.status} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}

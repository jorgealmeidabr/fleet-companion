import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
import { Wrench, Fuel, ClipboardCheck, CalendarRange, AlertTriangle } from "lucide-react";

interface Item { tipo: string; data: string; titulo: string; subtitulo?: string; }

const icons: Record<string, any> = {
  Manutenção: Wrench, Abastecimento: Fuel, Checklist: ClipboardCheck, Agendamento: CalendarRange, Multa: AlertTriangle,
};

export default function Historico() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, a, c, ag, mu, v] = await Promise.all([
        supabase.from("manutencoes").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("abastecimentos").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("checklists").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("agendamentos").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("multas").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("veiculos").select("id, placa"),
      ]);
      const placa = (id: string) => (v.data ?? []).find((x: any) => x.id === id)?.placa ?? "—";
      const out: Item[] = [
        ...((m.data ?? []) as any[]).map(x => ({ tipo: "Manutenção", data: x.created_at, titulo: `${placa(x.veiculo_id)} – ${x.tipo}`, subtitulo: x.descricao ?? "" })),
        ...((a.data ?? []) as any[]).map(x => ({ tipo: "Abastecimento", data: x.created_at, titulo: `${placa(x.veiculo_id)} – ${x.litros}L`, subtitulo: `R$ ${x.valor_total}` })),
        ...((c.data ?? []) as any[]).map(x => ({ tipo: "Checklist", data: x.created_at, titulo: `${placa(x.veiculo_id)} – ${x.status}`, subtitulo: x.observacoes ?? "" })),
        ...((ag.data ?? []) as any[]).map(x => ({ tipo: "Agendamento", data: x.created_at, titulo: `${placa(x.veiculo_id)} – ${x.status}`, subtitulo: x.destino ?? "" })),
        ...((mu.data ?? []) as any[]).map(x => ({ tipo: "Multa", data: x.created_at, titulo: `${placa(x.veiculo_id)} – ${x.tipo_infracao}`, subtitulo: `R$ ${x.valor}` })),
      ].sort((p, q) => q.data.localeCompare(p.data)).slice(0, 100);
      setItems(out);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <PageHeader title="Histórico" subtitle="Linha do tempo de eventos da frota (últimos 100)" />
      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-10 text-center text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground">Nenhum registro.</p>
          ) : (
            <ol className="divide-y divide-border">
              {items.map((it, i) => {
                const Icon = icons[it.tipo] ?? Wrench;
                return (
                  <li key={i} className="flex items-start gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{it.tipo}</Badge>
                        <span className="font-medium">{it.titulo}</span>
                      </div>
                      {it.subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{it.subtitulo}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(it.data)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

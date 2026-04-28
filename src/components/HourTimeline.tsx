import { useMemo } from "react";
import type { Agendamento } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  agendamentos: Agendamento[]; // já filtrados para o veículo
  day: Date;
  /** Janela de horas exibida (default 6–22) */
  startHour?: number;
  endHour?: number;
  highlight?: { inicio: string; fim: string } | null;
}

/**
 * Timeline horária de um veículo em um dia específico.
 * 🟢 livre · 🔴 ocupado · 🟦 highlight (intervalo selecionado no form)
 */
export function HourTimeline({ agendamentos, day, startHour = 6, endHour = 22, highlight }: Props) {
  const totalMin = (endHour - startHour) * 60;

  const blocks = useMemo(() => {
    const dayStart = new Date(day); dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd   = new Date(day); dayEnd.setHours(endHour, 0, 0, 0);
    return agendamentos
      .filter(a => a.status !== "cancelado" && a.status !== "concluido")
      .map(a => {
        const s = new Date(a.data_saida);
        const e = new Date(a.data_retorno_prevista);
        if (e <= dayStart || s >= dayEnd) return null;
        const sClamped = s < dayStart ? dayStart : s;
        const eClamped = e > dayEnd ? dayEnd : e;
        const left  = ((sClamped.getTime() - dayStart.getTime()) / 60000 / totalMin) * 100;
        const width = ((eClamped.getTime() - sClamped.getTime()) / 60000 / totalMin) * 100;
        return { id: a.id, left, width, label: `${s.getHours().toString().padStart(2,"0")}:${s.getMinutes().toString().padStart(2,"0")} → ${e.getHours().toString().padStart(2,"0")}:${e.getMinutes().toString().padStart(2,"0")}` };
      })
      .filter(Boolean) as { id: string; left: number; width: number; label: string }[];
  }, [agendamentos, day, startHour, endHour, totalMin]);

  const highlightBlock = useMemo(() => {
    if (!highlight) return null;
    const s = new Date(highlight.inicio);
    const e = new Date(highlight.fim);
    const dayStart = new Date(day); dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd   = new Date(day); dayEnd.setHours(endHour, 0, 0, 0);
    if (e <= dayStart || s >= dayEnd || e <= s) return null;
    const sClamped = s < dayStart ? dayStart : s;
    const eClamped = e > dayEnd ? dayEnd : e;
    const left  = ((sClamped.getTime() - dayStart.getTime()) / 60000 / totalMin) * 100;
    const width = ((eClamped.getTime() - sClamped.getTime()) / 60000 / totalMin) * 100;
    return { left, width };
  }, [highlight, day, startHour, endHour, totalMin]);

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div className="space-y-1">
      <div className="relative h-8 rounded-md border border-border bg-success/15 overflow-hidden">
        {/* blocos ocupados */}
        {blocks.map(b => (
          <div
            key={b.id}
            title={b.label}
            className="absolute top-0 h-full bg-destructive/70 hover:bg-destructive transition border-x border-destructive"
            style={{ left: `${b.left}%`, width: `${b.width}%` }}
          />
        ))}
        {/* highlight do form */}
        {highlightBlock && (
          <div
            className="absolute top-0 h-full bg-primary/60 border-x-2 border-primary z-10"
            style={{ left: `${highlightBlock.left}%`, width: `${highlightBlock.width}%` }}
          />
        )}
        {/* grid horária */}
        <div className="absolute inset-0 flex pointer-events-none">
          {hours.slice(0, -1).map(h => (
            <div key={h} className="flex-1 border-r border-border/40 last:border-r-0" />
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
        {hours.map(h => (
          <span key={h}>{h.toString().padStart(2,"0")}h</span>
        ))}
      </div>
    </div>
  );
}

/** Calcula sugestões de slots livres (em minutos) para um dia/veículo. */
export function suggestFreeSlots(
  agendamentos: Agendamento[],
  day: Date,
  durationMin: number,
  opts: { startHour?: number; endHour?: number; max?: number } = {},
): Array<{ inicio: Date; fim: Date }> {
  const { startHour = 6, endHour = 22, max = 4 } = opts;
  const dayStart = new Date(day); dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd   = new Date(day); dayEnd.setHours(endHour, 0, 0, 0);

  const ocupados = agendamentos
    .filter(a => a.status === "ativo")
    .map(a => ({ s: new Date(a.data_saida), e: new Date(a.data_retorno_prevista) }))
    .filter(o => o.e > dayStart && o.s < dayEnd)
    .sort((a, b) => a.s.getTime() - b.s.getTime());

  const livres: Array<{ inicio: Date; fim: Date }> = [];
  let cursor = new Date(dayStart);

  for (const o of ocupados) {
    if (o.s > cursor) {
      const gap = (o.s.getTime() - cursor.getTime()) / 60000;
      if (gap >= durationMin) {
        livres.push({ inicio: new Date(cursor), fim: new Date(cursor.getTime() + durationMin * 60000) });
      }
    }
    if (o.e > cursor) cursor = new Date(o.e);
    if (livres.length >= max) break;
  }

  if (livres.length < max && cursor < dayEnd) {
    const gap = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (gap >= durationMin) {
      livres.push({ inicio: new Date(cursor), fim: new Date(cursor.getTime() + durationMin * 60000) });
    }
  }

  return livres.slice(0, max);
}

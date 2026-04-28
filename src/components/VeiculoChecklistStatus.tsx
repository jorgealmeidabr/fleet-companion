import { useEffect, useState } from "react";
import { Check, X, AlertCircle, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import type { Checklist } from "@/lib/types";
import { cn } from "@/lib/utils";

type FuelLevel = "vazio" | "meio" | "cheio";
const NIVEL_REGEX = /\[Nível combustível: (vazio|meio|cheio)\]/i;

const FUEL_INFO: Record<FuelLevel, { label: string; emoji: string; cls: string }> = {
  vazio: { label: "Quase vazio (0–25%)", emoji: "🟥", cls: "text-destructive" },
  meio:  { label: "Meio (25–75%)",        emoji: "🟨", cls: "text-warning" },
  cheio: { label: "Cheio (75–100%)",      emoji: "🟩", cls: "text-success" },
};

function Item({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-success font-medium">
          <Check className="h-4 w-4" /> OK
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-destructive font-medium">
          <X className="h-4 w-4" /> Problema
        </span>
      )}
    </div>
  );
}

export function VeiculoChecklistStatus({ veiculoId }: { veiculoId: string }) {
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<Checklist | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("checklists")
      .select("*")
      .eq("veiculo_id", veiculoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const row = (data?.[0] ?? null) as Checklist | null;
        setChecklist(row);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [veiculoId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Carregando status do veículo...
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning inline-flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Nenhum checklist registrado para este veículo.
      </div>
    );
  }

  const obs = checklist.observacoes ?? "";
  const nivelMatch = obs.match(NIVEL_REGEX);
  const nivel = (nivelMatch?.[1]?.toLowerCase() as FuelLevel | undefined) ?? null;
  const fuel = nivel ? FUEL_INFO[nivel] : null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4" />
          Status do veículo (último checklist)
        </span>
        <span className="text-xs text-muted-foreground">{fmtDate(checklist.data)}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Item label="Pneus" ok={checklist.pneus_ok} />
        <Item label="Faróis e lanternas" ok={checklist.luzes_ok} />
        <Item label="Limpadores de para-brisa" ok={checklist.nivel_oleo_ok} />
        <Item label="Veículo limpo" ok={checklist.combustivel_ok || checklist.status === "ok"} />
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Nível de combustível</span>
          {fuel ? (
            <span className={cn("inline-flex items-center gap-1 font-medium", fuel.cls)}>
              <span>{fuel.emoji}</span> {fuel.label}
            </span>
          ) : (
            <Item label="Combustível" ok={checklist.combustivel_ok} />
          )}
        </div>
      </div>
    </div>
  );
}

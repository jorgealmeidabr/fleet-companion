import { Badge } from "@/components/ui/badge";
import type { VeiculoStatus, MotoristaStatus, ManutencaoStatus, AgendamentoStatus, MultaStatus, ChecklistStatus } from "@/lib/types";

const map: Record<string, { label: string; className: string }> = {
  // veículos
  disponivel:   { label: "Disponível",   className: "bg-success/15 text-success border-success/20" },
  manutencao:   { label: "Manutenção",   className: "bg-warning/15 text-warning border-warning/20" },
  inativo:      { label: "Inativo",      className: "bg-destructive/15 text-destructive border-destructive/20" },
  reservado:    { label: "Reservado",    className: "bg-info/15 text-info border-info/20" },
  // motoristas
  ativo:        { label: "Ativo",        className: "bg-success/15 text-success border-success/20" },
  // manutenção
  agendada:     { label: "Agendada",     className: "bg-info/15 text-info border-info/20" },
  em_andamento: { label: "Em andamento", className: "bg-warning/15 text-warning border-warning/20" },
  concluida:    { label: "Concluída",    className: "bg-success/15 text-success border-success/20" },
  // checklist
  ok:           { label: "OK",           className: "bg-success/15 text-success border-success/20" },
  problema:     { label: "Problema",     className: "bg-destructive/15 text-destructive border-destructive/20" },
  // agendamento
  agendado:     { label: "Agendado",     className: "bg-info/15 text-info border-info/20" },
  em_uso:       { label: "Em uso",       className: "bg-warning/15 text-warning border-warning/20" },
  concluido:    { label: "Concluído",    className: "bg-success/15 text-success border-success/20" },
  cancelado:    { label: "Cancelado",    className: "bg-muted text-muted-foreground border-border" },
  // multa
  pendente:     { label: "Pendente",     className: "bg-warning/15 text-warning border-warning/20" },
  pago:         { label: "Pago",         className: "bg-success/15 text-success border-success/20" },
  contestado:   { label: "Contestado",   className: "bg-info/15 text-info border-info/20" },
};

type AnyStatus = VeiculoStatus | MotoristaStatus | ManutencaoStatus | AgendamentoStatus | MultaStatus | ChecklistStatus | string;

export function StatusBadge({ status }: { status: AnyStatus }) {
  const m = map[status] ?? { label: status, className: "" };
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
}

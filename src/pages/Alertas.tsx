import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAlerts, type AlertLevel } from "@/hooks/useAlerts";
import { AlertTriangle, AlertCircle, Info, ShieldCheck, ArrowRight } from "lucide-react";
import { ListSkeleton } from "@/components/Skeletons";

const STYLE: Record<AlertLevel, { icon: any; bar: string; badge: string; label: string }> = {
  critico: { icon: AlertCircle,    bar: "border-l-destructive", badge: "bg-destructive/15 text-destructive border-destructive/20", label: "Crítico" },
  atencao: { icon: AlertTriangle,  bar: "border-l-warning",     badge: "bg-warning/15 text-warning border-warning/20",             label: "Atenção" },
  info:    { icon: Info,           bar: "border-l-info",        badge: "bg-info/15 text-info border-info/20",                       label: "Info" },
};

export default function Alertas() {
  const { alerts, counts, loading } = useAlerts();

  return (
    <>
      <PageHeader
        title="Alertas"
        subtitle="Eventos que requerem ação ordenados por prioridade"
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={STYLE.critico.badge}>{counts.critico} críticos</Badge>
            <Badge variant="outline" className={STYLE.atencao.badge}>{counts.atencao} atenção</Badge>
            <Badge variant="outline" className={STYLE.info.badge}>{counts.info} info</Badge>
          </div>
        }
      />

      {loading ? (
        <ListSkeleton rows={6} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Tudo em ordem!" description="Nenhum alerta ativo no momento." />
      ) : (
        <div className="space-y-2">
          {alerts.map(a => {
            const s = STYLE[a.level];
            const Icon = s.icon;
            return (
              <Card key={a.id} className={`border-l-4 ${s.bar} shadow-card`}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={s.badge}>{s.label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{a.tipo}</Badge>
                      <span className="font-medium">{a.titulo}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.descricao}</p>
                  </div>
                  {a.link && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={a.link}>Abrir <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

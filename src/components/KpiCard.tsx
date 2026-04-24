import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "info" | "brand";
  trend?: { value: number; label?: string };
}

const toneStyles: Record<string, string> = {
  default: "bg-muted/50 text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  brand: "bg-gradient-brand text-primary-foreground",
};

export function KpiCard({ label, value, hint, icon: Icon, tone = "default", trend }: KpiCardProps) {
  return (
    <Card className="overflow-hidden shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            {trend && (
              <p className={cn("mt-1 text-xs font-medium", trend.value >= 0 ? "text-success" : "text-destructive")}>
                {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value).toFixed(1)}% {trend.label}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneStyles[tone])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

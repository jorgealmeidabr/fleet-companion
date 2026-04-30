import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Car, Users, Wrench, Fuel, CalendarRange, ClipboardCheck, AlertTriangle, History, LogOut, Moon, Sun, Bell, ShieldCheck, UserCircle2, FileText, AlertOctagon } from "lucide-react";
import brqLogo from "@/assets/brq-logo-app.jpg";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useAlerts } from "@/hooks/useAlerts";
import { usePermissions } from "@/hooks/usePermissions";
import { useRequestBadge } from "@/hooks/useRequestBadge";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { TopbarClock } from "@/components/TopbarClock";
import { ChecklistPendenteBlock } from "@/components/ChecklistPendenteBlock";
import { IdleScreen } from "@/components/IdleScreen";
import { useIdle } from "@/hooks/useIdle";

import { cn } from "@/lib/utils";
import type { ModuloPermissao } from "@/lib/types";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  perm?: ModuloPermissao;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Gestão",
    items: [
      { title: "Dashboard",    url: "/",             icon: LayoutDashboard, perm: "dashboard" },
      { title: "Pessoas",      url: "/motoristas",   icon: Users,           perm: "motoristas" },
      { title: "Solicitações", url: "/solicitacoes", icon: FileText,        perm: "solicitacoes" },
      { title: "Histórico",    url: "/historico",    icon: History,         perm: "historico" },
      { title: "Multas",       url: "/multas",       icon: AlertTriangle,   perm: "multas" },
      { title: "Usuários",     url: "/usuarios",     icon: ShieldCheck,     perm: "usuarios" },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Veículos",      url: "/veiculos",       icon: Car,    perm: "veiculos" },
      { title: "Manutenção",    url: "/manutencoes",    icon: Wrench, perm: "manutencao" },
      { title: "Abastecimento", url: "/abastecimentos", icon: Fuel,   perm: "abastecimento" },
    ],
  },
  {
    label: "Execução",
    items: [
      { title: "Agendamentos", url: "/agendamentos", icon: CalendarRange,  perm: "agendamentos" },
      { title: "Checklists",   url: "/checklists",   icon: ClipboardCheck, perm: "checklists" },
      { title: "Acidentes",    url: "/acidentes",    icon: AlertOctagon,   perm: "acidentes" },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Meu perfil", url: "/meu-perfil", icon: UserCircle2 },
      { title: "Alertas",    url: "/alertas",    icon: Bell, perm: "alertas" },
    ],
  },
];

function AppSidebar({ alertCount, requestCount }: { alertCount: number; requestCount: number }) {
  const { state } = useSidebar();
  const location = useLocation();
  const { canSee } = usePermissions();
  const collapsed = state === "collapsed";

  // CRÍTICO: itens sem acesso NÃO existem no DOM
  const visibleGroups = groups
    .map(g => ({ ...g, items: g.items.filter(i => !i.perm || canSee(i.perm)) }))
    .filter(g => g.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-elevated">
            <img src={brqLogo} alt="BRQ Frota Interna" className="h-full w-full object-contain text-primary bg-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">BRQ - Frota Interna</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">gestão de frota </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map(group => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => {
                  const active = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                  const badgeValue =
                    item.url === "/alertas" ? alertCount :
                    item.url === "/solicitacoes" ? requestCount : 0;
                  const badgeVariant: "destructive" | "default" =
                    item.url === "/alertas" ? "destructive" : "default";
                  const showBadge = badgeValue > 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink to={item.url} end={item.url === "/"} className="relative">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {showBadge && (
                            <Badge variant={badgeVariant} className={cn(
                              "h-5 min-w-[20px] justify-center px-1.5 text-[10px]",
                              item.url === "/solicitacoes" && "bg-info text-info-foreground hover:bg-info opacity-0",
                              collapsed && "absolute right-0 top-0 -translate-y-1 translate-x-1",
                            )}>
                              {item.url === "/solicitacoes" ? "​" : badgeValue}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border gap-0 px-0 py-0">
        {!collapsed && (
          <div className="px-2 py-1 text-[10px] text-sidebar-foreground/50 text-center">
            v1.0 • Sistema de Frotas
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const { user, signOut, tipoConta } = useAuth();
  const { isAdmin } = usePermissions();
  const { counts } = useAlerts();
  const alertCount = isAdmin ? counts.critico + counts.atencao : 0;
  const requestCount = useRequestBadge();
  const location = useLocation();
  // Desativa a tela de descanso enquanto o usuário estiver na página de Veículos
  const idleEnabled = !!user && location.pathname !== "/veiculos";
  const { idle, wake } = useIdle(50000, idleEnabled);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar alertCount={alertCount} requestCount={requestCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-12 items-center gap-2 border-b border-border bg-background/80 px-3 py-1 backdrop-blur">
            <SidebarTrigger />
            <div aria-hidden="true" className="mx-2" style={{ width: "1px", height: "28px", backgroundColor: "#2a2a2a" }} />
            <TopbarClock />
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch />
              {tipoConta && (
                <Badge variant={tipoConta === "admin" ? "brand" : "secondary"}>
                  {tipoConta === "admin" ? "Admin" : "Usuário"}
                </Badge>
              )}
              <span className="hidden text-xs text-muted-foreground md:inline">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Breadcrumbs />
            {children}
          </main>
        </div>
        <ChecklistPendenteBlock />
      </div>
      {idle && <IdleScreen onExit={wake} />}
    </SidebarProvider>
  );
}

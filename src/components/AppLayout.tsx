import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Car, Users, Wrench, Fuel, CalendarRange, ClipboardCheck, AlertTriangle, History, LogOut, Moon, Sun, Truck, Bell, ShieldCheck, UserCircle2 } from "lucide-react";
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
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";
import type { ModuloPermissao } from "@/lib/types";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  perm?: ModuloPermissao;
}

const items: NavItem[] = [
  { title: "Dashboard",     url: "/",              icon: LayoutDashboard, perm: "dashboard" },
  { title: "Veículos",      url: "/veiculos",      icon: Car,             perm: "veiculos" },
  { title: "Pessoas",       url: "/motoristas",    icon: Users,           perm: "motoristas" },
  { title: "Manutenção",    url: "/manutencoes",   icon: Wrench,          perm: "manutencao" },
  { title: "Abastecimento", url: "/abastecimentos", icon: Fuel,           perm: "abastecimento" },
  { title: "Agendamentos",  url: "/agendamentos",  icon: CalendarRange,   perm: "agendamentos" },
  { title: "Checklists",    url: "/checklists",    icon: ClipboardCheck,  perm: "checklists" },
  { title: "Multas",        url: "/multas",        icon: AlertTriangle,   perm: "multas" },
  { title: "Histórico",     url: "/historico",     icon: History,         perm: "historico" },
  { title: "Alertas",       url: "/alertas",       icon: Bell,            perm: "alertas" },
  { title: "Usuários",      url: "/usuarios",      icon: ShieldCheck,     perm: "usuarios" },
];

function AppSidebar({ alertCount }: { alertCount: number }) {
  const { state } = useSidebar();
  const location = useLocation();
  const { canSee } = usePermissions();
  const collapsed = state === "collapsed";

  // CRÍTICO: itens sem acesso NÃO existem no DOM
  const visible = items.filter(i => !i.perm || canSee(i.perm));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand shadow-elevated">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">BRQ - FROTA INTERNA</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">gestão de frotas</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map(item => {
                const active = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                const showBadge = item.url === "/alertas" && alertCount > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} end={item.url === "/"} className="relative">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {showBadge && (
                          <Badge variant="destructive" className={cn(
                            "h-5 min-w-[20px] justify-center px-1.5 text-[10px]",
                            collapsed && "absolute right-0 top-0 -translate-y-1 translate-x-1",
                          )}>
                            {alertCount}
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

        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/meu-perfil"}>
                  <NavLink to="/meu-perfil">
                    <UserCircle2 className="h-4 w-4" />
                    {!collapsed && <span>Meu perfil</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-1 text-[10px] text-sidebar-foreground/50">
            v1.0 • BRQ Digital Solutions
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar alertCount={alertCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-2 hidden text-sm font-medium text-muted-foreground md:block" />
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch />
              {tipoConta && (
                <Badge variant={tipoConta === "admin" ? "default" : "secondary"} className={tipoConta === "admin" ? "bg-gradient-brand text-primary-foreground" : ""}>
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
      </div>
    </SidebarProvider>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Car, Users, Wrench, Fuel, CalendarRange, ClipboardCheck, AlertTriangle, History, LogOut, Moon, Sun, Truck } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Veículos", url: "/veiculos", icon: Car },
  { title: "Motoristas", url: "/motoristas", icon: Users },
  { title: "Manutenção", url: "/manutencoes", icon: Wrench },
  { title: "Abastecimento", url: "/abastecimentos", icon: Fuel },
  { title: "Agendamentos", url: "/agendamentos", icon: CalendarRange },
  { title: "Checklists", url: "/checklists", icon: ClipboardCheck },
  { title: "Multas", url: "/multas", icon: AlertTriangle },
  { title: "Histórico", url: "/historico", icon: History },
];

function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand shadow-elevated">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">BRQ</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Frota Interna</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
                const active = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} end={item.url === "/"}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
  const { user, role, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-2 hidden text-sm font-medium text-muted-foreground md:block">
              BRQ – Frota Interna
            </div>
            <div className="ml-auto flex items-center gap-2">
              {role && (
                <Badge variant={role === "admin" ? "default" : "secondary"} className={role === "admin" ? "bg-gradient-brand text-primary-foreground" : ""}>
                  {role}
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
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

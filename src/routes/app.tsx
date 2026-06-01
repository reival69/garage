import { useEffect } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Car,
  ClipboardList,
  FileText,
  Receipt,
  Wrench,
  Boxes,
  MessageSquare,
  BellRing,
  Star,
  UsersRound,
  Settings,
  LogOut,
  MoreHorizontal,
  Home,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/app/NotificationBell";
import { useAuth } from "@/lib/auth/AuthContext";
import { can, moduleForPath } from "@/lib/permissions";
import { evaluateReminders } from "@/lib/reminders";
import { evaluateDocumentExpiries } from "@/lib/documents";
import { evaluateLowStock } from "@/lib/stock";
import { unreadMessagesCount } from "@/lib/inbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Inicio", icon: LayoutDashboard, exact: true, module: "dashboard" },
  { to: "/app/citas", label: "Citas", icon: Calendar, exact: false, module: "citas" },
  { to: "/app/clientes", label: "Clientes", icon: Users, exact: false, module: "clientes" },
  { to: "/app/vehiculos", label: "Vehículos", icon: Car, exact: false, module: "vehiculos" },
  { to: "/app/ordenes", label: "Órdenes", icon: ClipboardList, exact: false, module: "ordenes" },
  { to: "/app/presupuestos", label: "Presupuestos", icon: FileText, exact: false, module: "presupuestos" },
  { to: "/app/facturacion", label: "Facturación", icon: Receipt, exact: false, module: "facturacion" },
  { to: "/app/servicios", label: "Servicios", icon: Wrench, exact: false, module: "servicios" },
  { to: "/app/stock", label: "Stock", icon: Boxes, exact: false, module: "stock" },
  { to: "/app/mensajes", label: "Mensajes", icon: MessageSquare, exact: false, module: "mensajes" },
  { to: "/app/recordatorios", label: "Recordatorios", icon: BellRing, exact: false, module: "recordatorios" },
  { to: "/app/resenas", label: "Reseñas", icon: Star, exact: false, module: "resenas" },
  { to: "/app/equipo", label: "Equipo", icon: UsersRound, exact: false, module: "equipo" },
  { to: "/app/configuracion", label: "Configuración", icon: Settings, exact: false, module: "configuracion" },
] as const;

// Mobile bottom bar: key shortcuts only.
const BOTTOM = [
  { to: "/app", label: "Inicio", icon: Home, exact: true, module: "dashboard" },
  { to: "/app/ordenes", label: "Órdenes", icon: ClipboardList, exact: false, module: "ordenes" },
  { to: "/app/citas", label: "Citas", icon: Calendar, exact: false, module: "citas" },
  { to: "/app/clientes", label: "Clientes", icon: Users, exact: false, module: "clientes" },
  { to: "/app/configuracion", label: "Más", icon: MoreHorizontal, exact: false, module: "configuracion" },
] as const;

function AppLayout() {
  const { ready, user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Session guard: redirect to /login when there is no active session/tenant
  // (covers a full page reload landing directly on /app/*).
  useEffect(() => {
    if (ready && (!user || !tenant)) {
      navigate({ to: "/login" });
    }
  }, [ready, user, tenant, navigate]);

  // Permission guard: if the current role can't access this module, send it
  // back to the dashboard. Owner/superadmin are never restricted.
  useEffect(() => {
    if (!ready || !user || !tenant) return;
    const mod = moduleForPath(pathname);
    if (mod && !can(user.role, mod)) {
      navigate({ to: "/app" });
    }
  }, [ready, user, tenant, pathname, navigate]);

  // Maintenance reminders: on shop load, fire notifications for overdue
  // reminders that haven't notified yet (once each). Same sweep for upcoming /
  // expired vehicle documents.
  useEffect(() => {
    if (!ready || !tenant) return;
    evaluateReminders(tenant.id);
    evaluateDocumentExpiries(tenant.id);
    evaluateLowStock(tenant.id);
  }, [ready, tenant]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" />
    );
  }
  if (!user || !tenant) return null;

  const navItems = NAV.filter((item) => can(user.role, item.module));
  const bottomItems = BOTTOM.filter((item) => can(user.role, item.module));

  // Unread customer messages badge (recomputed on every navigation).
  const unreadMessages = unreadMessagesCount(tenant.id);

  const accentStyle = tenant
    ? ({ ["--talleo-accent" as string]: tenant.accentColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen bg-background" style={accentStyle}>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-start justify-between px-5 py-5">
          <div className="min-w-0">
            <Logo className="text-base" logoUrl={tenant.logoUrl} />
            {tenant && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {tenant.name}
              </p>
            )}
          </div>
          <NotificationBell variant="popover" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <item.icon strokeWidth={1.5} className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.module === "mensajes" && unreadMessages > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            to="/login"
            onClick={logout}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut strokeWidth={1.5} className="h-4 w-4" />
            Salir
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Logo className="text-base" logoUrl={tenant.logoUrl} />
          <div className="flex items-center gap-2">
            {tenant && (
              <span className="max-w-[40vw] truncate text-xs text-muted-foreground">
                {tenant.name}
              </span>
            )}
            <NotificationBell variant="sheet" />
          </div>
        </header>


        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
          {bottomItems.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon strokeWidth={1.5} className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

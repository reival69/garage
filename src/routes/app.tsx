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
  UsersRound,
  Settings,
  LogOut,
  MoreHorizontal,
  Home,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Inicio", icon: LayoutDashboard, exact: true },
  { to: "/app/citas", label: "Citas", icon: Calendar, exact: false },
  { to: "/app/clientes", label: "Clientes", icon: Users, exact: false },
  { to: "/app/vehiculos", label: "Vehículos", icon: Car, exact: false },
  { to: "/app/ordenes", label: "Órdenes", icon: ClipboardList, exact: false },
  { to: "/app/presupuestos", label: "Presupuestos", icon: FileText, exact: false },
  { to: "/app/facturacion", label: "Facturación", icon: Receipt, exact: false },
  { to: "/app/servicios", label: "Servicios", icon: Wrench, exact: false },
  { to: "/app/equipo", label: "Equipo", icon: UsersRound, exact: false },
  { to: "/app/configuracion", label: "Configuración", icon: Settings, exact: false },
] as const;

// Mobile bottom bar: key shortcuts only.
const BOTTOM = [
  { to: "/app", label: "Inicio", icon: Home, exact: true },
  { to: "/app/ordenes", label: "Órdenes", icon: ClipboardList, exact: false },
  { to: "/app/citas", label: "Citas", icon: Calendar, exact: false },
  { to: "/app/clientes", label: "Clientes", icon: Users, exact: false },
  { to: "/app/configuracion", label: "Más", icon: MoreHorizontal, exact: false },
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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" />
    );
  }
  if (!user || !tenant) return null;

  const accentStyle = tenant
    ? ({ ["--talleo-accent" as string]: tenant.accentColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen bg-background" style={accentStyle}>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="px-5 py-5">
          <Logo className="text-base" logoUrl={tenant.logoUrl} />
          {tenant && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {tenant.name}
            </p>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
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
                {item.label}
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
          {tenant && (
            <span className="truncate text-xs text-muted-foreground">
              {tenant.name}
            </span>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
          {BOTTOM.map((item) => {
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

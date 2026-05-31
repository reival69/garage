import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CreditCard,
  ClipboardList,
  Receipt,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { StatCard } from "@/components/base/StatCard";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  globalStats,
  mostActiveTenants,
  type GlobalStats,
  type TenantMetrics,
} from "@/lib/admin";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function formatRevenue(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return formatCurrency(0);
  return entries
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" · ");
}

function AdminDashboard() {
  const { ready } = useAuth();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [active, setActive] = useState<TenantMetrics[]>([]);

  useEffect(() => {
    if (!ready) return;
    setStats(globalStats());
    setActive(mostActiveTenants(5));
  }, [ready]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visión global del SaaS Talleo (todos los talleres)."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Talleres activos"
          value={stats?.activeTenants ?? 0}
          hint={
            stats && stats.suspendedTenants > 0
              ? `${stats.suspendedTenants} suspendido${stats.suspendedTenants > 1 ? "s" : ""}`
              : "Todos operativos"
          }
          icon={Building2}
        />
        <StatCard
          label="MRR"
          value={formatCurrency(stats?.mrr ?? 0)}
          hint="Ingreso mensual recurrente"
          icon={CreditCard}
        />
        <StatCard
          label="Órdenes totales"
          value={stats?.totalOrders ?? 0}
          hint="En toda la plataforma"
          icon={ClipboardList}
        />
        <StatCard
          label="Facturado"
          value={formatRevenue(stats?.revenueByCurrency ?? {})}
          hint="Facturas pagadas"
          icon={Receipt}
        />
      </div>

      <div className="mt-8">
        <DataCard
          title="Talleres más activos"
          description="Ordenados por número de órdenes registradas."
          bodyClassName="p-0"
        >
          {active.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No hay actividad todavía.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {active.map((m) => (
                <li
                  key={m.tenant.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border"
                      style={{
                        color: m.tenant.accentColor,
                        borderColor: m.tenant.accentColor,
                      }}
                    >
                      <Activity strokeWidth={1.5} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.tenant.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.plan?.name ?? "—"} · {m.tenant.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {m.orderCount}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        órdenes
                      </span>
                    </span>
                    <StatusBadge status={m.tenant.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </div>
    </div>
  );
}

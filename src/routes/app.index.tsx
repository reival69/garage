import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Car,
  Calendar,
  FileText,
  Banknote,
  BellRing,
  Star,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { StatCard } from "@/components/base/StatCard";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { averageRating } from "@/lib/reviews";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  appointmentsRepo,
  customersRepo,
  invoicesRepo,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { dueReminders } from "@/lib/reminders";
import { listNotifications, relativeTime } from "@/lib/notifications";
import { formatCurrency, formatTime, isToday } from "@/lib/format";
import type { Appointment, AppNotification } from "@/types";

export const Route = createFileRoute("/app/")({
  component: AppDashboard,
});

const IN_SHOP = new Set([
  "recibido",
  "diagnostico",
  "presupuesto_enviado",
  "aprobado",
  "en_reparacion",
  "listo",
]);

const NOTIF_ICON: Record<AppNotification["type"], LucideIcon> = {
  cita: Calendar,
  presupuesto: FileText,
  estado: Activity,
  recordatorio: BellRing,
  resena: Star,
};

function AppDashboard() {
  const { ready, tenant } = useAuth();
  const [stats, setStats] = useState({
    inShop: 0,
    todayAppointments: 0,
    pendingQuotes: 0,
    monthRevenue: 0,
    overdueReminders: 0,
    avgRating: 0,
  });
  const [agenda, setAgenda] = useState<Appointment[]>([]);
  const [activity, setActivity] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!ready || !tenant) return;
    const orders = workOrdersRepo.list(tenant.id);
    const appts = appointmentsRepo.list(tenant.id);
    const invoices = invoicesRepo.list(tenant.id);
    setStats({
      inShop: orders.filter((o) => IN_SHOP.has(o.status)).length,
      todayAppointments: appts.filter((a) => isToday(a.scheduledAt)).length,
      pendingQuotes: orders.filter((o) => o.status === "presupuesto_enviado")
        .length,
      monthRevenue: invoices
        .filter((i) => {
          if (i.status !== "paid") return false;
          const d = new Date(i.createdAt);
          const now = new Date();
          return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth()
          );
        })
        .reduce((s, i) => s + i.total, 0),
      overdueReminders: dueReminders(tenant.id).length,
      avgRating: averageRating(tenant.id),
    });
    setAgenda(
      appts
        .filter((a) => isToday(a.scheduledAt))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );
    setActivity(listNotifications(tenant.id).slice(0, 6));
  }, [ready, tenant]);

  const labelFor = (a: Appointment) => {
    if (!tenant) return { customer: "—", vehicle: "—" };
    const customer = a.customerId
      ? customersRepo.getById(tenant.id, a.customerId)
      : undefined;
    const vehicle = a.vehicleId
      ? vehiclesRepo.getById(tenant.id, a.vehicleId)
      : undefined;
    return {
      customer: customer?.name ?? "Cita sin cliente",
      vehicle: vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` : "—",
    };
  };

  return (
    <div>
      <PageHeader
        title="Inicio"
        description={tenant ? `Resumen de ${tenant.name}.` : "Resumen del taller."}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Coches en taller" value={stats.inShop} icon={Car} />
        <Link to="/app/citas" className="rounded-xl">
          <StatCard
            label="Citas de hoy"
            value={stats.todayAppointments}
            icon={Calendar}
          />
        </Link>
        <StatCard
          label="Presupuestos pendientes"
          value={stats.pendingQuotes}
          icon={FileText}
        />
        <StatCard
          label="Ingresos del mes"
          value={formatCurrency(stats.monthRevenue, tenant?.currency)}
          icon={Banknote}
        />
        <Link to="/app/recordatorios" className="rounded-xl">
          <StatCard
            label="Recordatorios vencidos"
            value={stats.overdueReminders}
            icon={BellRing}
          />
        </Link>
        <Link to="/app/resenas" className="rounded-xl">
          <StatCard
            label="Valoración media"
            value={stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} / 5` : "—"}
            icon={Star}
          />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DataCard title="Actividad reciente">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay actividad reciente todavía.
            </p>
          ) : (
            <ul className="-my-1 divide-y divide-border-subtle">
              {activity.map((n) => {
                const Icon = NOTIF_ICON[n.type] ?? Activity;
                const row = (
                  <div className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background-subtle text-muted-foreground">
                      <Icon strokeWidth={1.5} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        className="block rounded-lg transition-colors hover:bg-background-muted"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DataCard>
        <DataCard title="Agenda de hoy">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tienes citas ni entregas previstas para hoy.
            </p>
          ) : (
            <ul className="-my-1 divide-y divide-border-subtle">
              {agenda.map((a) => {
                const { customer, vehicle } = labelFor(a);
                return (
                  <li key={a.id}>
                    <Link
                      to="/app/citas"
                      className="flex items-center gap-3 rounded-lg py-3 transition-colors hover:bg-background-muted"
                    >
                      <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                        {formatTime(a.scheduledAt)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {customer}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {vehicle}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </DataCard>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Car, Calendar, FileText, Banknote } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { StatCard } from "@/components/base/StatCard";
import { DataCard } from "@/components/base/DataCard";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  appointmentsRepo,
  invoicesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { formatCurrency, isToday } from "@/lib/format";

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

function AppDashboard() {
  const { ready, tenant } = useAuth();
  const [stats, setStats] = useState({
    inShop: 0,
    todayAppointments: 0,
    pendingQuotes: 0,
    monthRevenue: 0,
  });

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
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + i.total, 0),
    });
  }, [ready, tenant]);

  return (
    <div>
      <PageHeader
        title="Inicio"
        description={tenant ? `Resumen de ${tenant.name}.` : "Resumen del taller."}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Coches en taller" value={stats.inShop} icon={Car} />
        <StatCard
          label="Citas de hoy"
          value={stats.todayAppointments}
          icon={Calendar}
        />
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
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DataCard title="Actividad reciente">
          <p className="text-sm text-muted-foreground">
            No hay actividad reciente todavía.
          </p>
        </DataCard>
        <DataCard title="Agenda de hoy">
          <p className="text-sm text-muted-foreground">
            No tienes citas ni entregas previstas para hoy.
          </p>
        </DataCard>
      </div>
    </div>
  );
}

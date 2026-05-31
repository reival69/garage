import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, CreditCard, ClipboardList, Users } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { StatCard } from "@/components/base/StatCard";
import { DataCard } from "@/components/base/DataCard";
import { useAuth } from "@/lib/auth/AuthContext";
import { plansRepo, tenantsRepo, usersRepo, workOrdersRepo } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { ready } = useAuth();
  const [stats, setStats] = useState({
    activeTenants: 0,
    mrr: 0,
    totalOrders: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    if (!ready) return;
    const tenants = tenantsRepo.list();
    const plans = plansRepo.list();
    let mrr = 0;
    let totalOrders = 0;
    for (const t of tenants) {
      if (t.status === "active") {
        const plan = plans.find((p) => p.id === t.planId);
        mrr += plan?.priceMonthly ?? 0;
      }
      totalOrders += workOrdersRepo.list(t.id).length;
    }
    setStats({
      activeTenants: tenants.filter((t) => t.status === "active").length,
      mrr,
      totalOrders,
      totalUsers: usersRepo.list().filter((u) => u.tenantId).length,
    });
  }, [ready]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visión global del SaaS Talleo."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Talleres activos"
          value={stats.activeTenants}
          icon={Building2}
        />
        <StatCard
          label="MRR (simulado)"
          value={formatCurrency(stats.mrr)}
          hint="Ingreso mensual recurrente"
          icon={CreditCard}
        />
        <StatCard
          label="Órdenes totales"
          value={stats.totalOrders}
          icon={ClipboardList}
        />
        <StatCard
          label="Usuarios"
          value={stats.totalUsers}
          icon={Users}
        />
      </div>

      <div className="mt-8">
        <DataCard
          title="Métricas globales"
          description="Resumen de la actividad de la plataforma."
        >
          <p className="text-sm text-muted-foreground">
            No hay métricas adicionales para mostrar todavía.
          </p>
        </DataCard>
      </div>
    </div>
  );
}

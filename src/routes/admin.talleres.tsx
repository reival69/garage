import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { EmptyState } from "@/components/base/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { plansRepo, tenantsRepo, workOrdersRepo } from "@/lib/db";
import type { Plan, Tenant } from "@/types";

export const Route = createFileRoute("/admin/talleres")({
  component: AdminTalleres,
});

function AdminTalleres() {
  const { ready } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!ready) return;
    setTenants(tenantsRepo.list());
    setPlans(plansRepo.list());
  }, [ready]);

  return (
    <div>
      <PageHeader title="Talleres" description="Tenants suscritos a Talleo." />
      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin talleres"
          description="Próximamente"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tenants.map((t) => {
            const plan = plans.find((p) => p.id === t.planId);
            return (
              <DataCard key={t.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
                      style={{ color: t.accentColor, borderColor: t.accentColor }}
                    >
                      <Building2 strokeWidth={1.5} className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {t.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.locations[0]?.name} · Plan {plan?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {workOrdersRepo.list(t.id).length} órdenes registradas
                </p>
              </DataCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

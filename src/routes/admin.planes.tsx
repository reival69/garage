import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Pencil, Building2 } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { DataCard } from "@/components/base/DataCard";
import { Button } from "@/components/ui/button";
import { PlanFormDialog } from "@/components/admin/PlanFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { planUsage, type PlanUsage } from "@/lib/admin";
import { formatCurrency } from "@/lib/format";
import type { Plan } from "@/types";

export const Route = createFileRoute("/admin/planes")({
  component: AdminPlanes,
});

function AdminPlanes() {
  const { ready } = useAuth();
  const [usage, setUsage] = useState<PlanUsage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const refresh = () => setUsage(planUsage());

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [ready]);

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Planes"
        description="Planes de suscripción de Talleo y su uso."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {usage.map(({ plan, tenantCount }) => (
          <DataCard key={plan.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {plan.name}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {plan.tier}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(plan)}
                title="Editar plan"
              >
                <Pencil strokeWidth={1.5} />
              </Button>
            </div>

            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {formatCurrency(plan.priceMonthly)}
              <span className="text-sm font-normal text-muted-foreground">
                /mes
              </span>
            </p>

            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <LimitRow label={`${plan.limits.maxOrders} órdenes/mes`} />
              <LimitRow label={`${plan.limits.maxUsers} usuarios`} />
              <LimitRow
                label={`${plan.limits.maxPhotosPerOrder} fotos por orden`}
              />
            </ul>

            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-foreground">
              <Building2 strokeWidth={1.5} className="h-4 w-4 text-muted-foreground" />
              {tenantCount} {tenantCount === 1 ? "taller" : "talleres"}
            </div>
          </DataCard>
        ))}
      </div>

      <PlanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editing}
        onSaved={refresh}
      />
    </div>
  );
}

function LimitRow({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check strokeWidth={1.5} className="h-4 w-4 text-[var(--success)]" />
      {label}
    </li>
  );
}

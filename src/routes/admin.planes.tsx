import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { DataCard } from "@/components/base/DataCard";
import { useAuth } from "@/lib/auth/AuthContext";
import { plansRepo } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import type { Plan } from "@/types";

export const Route = createFileRoute("/admin/planes")({
  component: AdminPlanes,
});

function AdminPlanes() {
  const { ready } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!ready) return;
    setPlans(plansRepo.list());
  }, [ready]);

  return (
    <div>
      <PageHeader title="Planes" description="Planes de suscripción de Talleo." />
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <DataCard key={p.id}>
            <p className="text-sm font-semibold text-foreground">{p.name}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {formatCurrency(p.priceMonthly)}
              <span className="text-sm font-normal text-muted-foreground">
                /mes
              </span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <LimitRow label={`${p.limits.maxOrders} órdenes/mes`} />
              <LimitRow label={`${p.limits.maxUsers} usuarios`} />
              <LimitRow label={`${p.limits.maxPhotosPerOrder} fotos por orden`} />
            </ul>
          </DataCard>
        ))}
      </div>
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

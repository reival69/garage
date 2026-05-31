// Talleo — Reseñas. Valoración media del taller y listado de reseñas de los
// clientes (estrellas, comentario, cliente, vehículo y fecha). Acceso owner/staff
// (gestionado por el guard de permisos). Todo local y simulado.

import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { DataCard } from "@/components/base/DataCard";
import { StatCard } from "@/components/base/StatCard";
import { EmptyState } from "@/components/base/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo } from "@/lib/db";
import { listReviews, averageRating } from "@/lib/reviews";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, Review, Vehicle } from "@/types";

export const Route = createFileRoute("/app/resenas")({
  component: ReviewsPage,
});

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          strokeWidth={1.5}
          className={cn(
            "h-4 w-4",
            n <= value ? "text-foreground" : "text-muted-foreground",
          )}
          fill={n <= value ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

interface Row {
  review: Review;
  customer?: Customer;
  vehicle?: Vehicle;
}

function ReviewsPage() {
  const { ready, tenant } = useAuth();

  const { rows, avg, count } = useMemo(() => {
    if (!ready || !tenant) return { rows: [] as Row[], avg: 0, count: 0 };
    const reviews = listReviews(tenant.id);
    const rows = reviews.map((review) => ({
      review,
      customer: customersRepo.getById(tenant.id, review.customerId),
      vehicle: vehiclesRepo.getById(tenant.id, review.vehicleId),
    }));
    return { rows, avg: averageRating(tenant.id), count: reviews.length };
  }, [ready, tenant]);

  if (!tenant) return null;

  return (
    <div>
      <PageHeader
        title="Reseñas"
        description="Valoraciones de tus clientes tras la entrega."
      />

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <StatCard
          label="Valoración media"
          value={avg > 0 ? `${avg.toFixed(1)} / 5` : "—"}
          icon={Star}
        />
        <StatCard label="Total reseñas" value={count} />
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Aún no hay reseñas"
            description="Cuando un cliente valore una orden entregada, aparecerá aquí."
          />
        ) : (
          <DataCard title="Todas las reseñas" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {rows.map(({ review, customer, vehicle }) => (
                <li key={review.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Stars value={review.rating} />
                      <p className="mt-1.5 text-sm font-medium text-foreground">
                        {customer?.name ?? "Cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle
                          ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate}`
                          : "Vehículo"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </DataCard>
        )}
      </div>
    </div>
  );
}

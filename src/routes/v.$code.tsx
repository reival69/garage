// Talleo — cartilla permanente del vehículo (/v/:code). Acceso público estable
// por vehículo, independiente de la orden: cabecera del coche, orden en curso
// con enlace a la vista en vivo, historial completo (vía VehicleHistory),
// próximas revisiones y garantías vigentes. Read-only, todo local y simulado.

import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  BellRing,
  Calendar,
  Car,
  ExternalLink,
  Gauge,
  History,
  Images,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { VehicleHistory } from "@/components/VehicleHistory";
import { useAuth } from "@/lib/auth/AuthContext";
import { findVehicleByAccessCode } from "@/lib/db";
import { listOrdersByVehicleId } from "@/lib/orders";
import { PHOTO_LABEL_TEXT } from "@/lib/orders";
import { listVehicleReminders } from "@/lib/reminders";
import {
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  buildKmHistory,
  computeVehicleSpend,
  coverPhoto,
  findActiveOrder,
  galleryPhotos,
  listActiveWarranties,
  type KmHistory,
  type VehicleSpend,
} from "@/lib/vehicles";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  MaintenanceReminder,
  Tenant,
  Vehicle,
  WorkOrder,
} from "@/types";

export const Route = createFileRoute("/v/$code")({
  component: CartillaView,
});

function CartillaView() {
  const { code } = Route.useParams();
  const { ready } = useAuth();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid" }
    | {
        kind: "ok";
        vehicle: Vehicle;
        tenant: Tenant;
        orders: WorkOrder[];
      }
  >({ kind: "loading" });

  const load = useCallback(() => {
    const found = findVehicleByAccessCode(code);
    if (!found) {
      setState({ kind: "invalid" });
      return;
    }
    const orders = listOrdersByVehicleId(found.tenant.id, found.vehicle.id);
    setState({ kind: "ok", vehicle: found.vehicle, tenant: found.tenant, orders });
  }, [code]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-subtle">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background-subtle px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-[var(--destructive)]">
          <AlertCircle strokeWidth={1.5} className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          Vehículo no encontrado
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          No encontramos ninguna cartilla con el código{" "}
          <span className="font-mono font-medium text-foreground">{code}</span>.
          Comprueba el enlace con tu taller.
        </p>
      </div>
    );
  }

  const { vehicle, tenant, orders } = state;
  const activeOrder = findActiveOrder(orders);
  const pendingReminders = listVehicleReminders(tenant.id, vehicle.id).filter(
    (r) => r.status === "pending",
  );
  const warranties = listActiveWarranties(tenant.id, vehicle, orders);
  const cover = coverPhoto(vehicle);
  const gallery = galleryPhotos(vehicle);
  const spend = computeVehicleSpend(tenant.id, orders);
  const kmHistory = buildKmHistory(vehicle, orders);
  const techSpecs: Array<[string, string]> = [];
  if (vehicle.vin) techSpecs.push(["VIN", vehicle.vin]);
  if (vehicle.color) techSpecs.push(["Color", vehicle.color]);
  if (vehicle.fuelType)
    techSpecs.push(["Combustible", FUEL_TYPE_LABELS[vehicle.fuelType]]);
  if (vehicle.transmission)
    techSpecs.push(["Transmisión", TRANSMISSION_LABELS[vehicle.transmission]]);
  if (vehicle.displacementCc)
    techSpecs.push(["Cilindrada", `${vehicle.displacementCc} cc`]);
  if (vehicle.powerHp) techSpecs.push(["Potencia", `${vehicle.powerHp} CV`]);

  return (
    <div
      className="min-h-screen bg-background-subtle"
      style={
        { ["--talleo-accent" as string]: tenant.accentColor } as React.CSSProperties
      }
    >
      {/* Branding */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="h-7 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tenant.accentColor }}
              />
              <span className="text-base font-bold tracking-tight text-foreground">
                {tenant.name}
              </span>
            </div>
          )}
          <span className="font-mono text-xs tracking-wider text-muted-foreground">
            {vehicle.accessCode}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-5 py-6">
        {/* Vehicle header */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground">
              <Car strokeWidth={1.5} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {`${vehicle.make} ${vehicle.model}`.trim() || "Vehículo"}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                {vehicle.plate}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Año</dt>
              <dd className="text-foreground">
                {vehicle.year ? String(vehicle.year) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kilómetros</dt>
              <dd className="flex items-center gap-1 text-foreground">
                <Gauge strokeWidth={1.5} className="h-3.5 w-3.5 text-muted-foreground" />
                {vehicle.km ? `${vehicle.km.toLocaleString("es-ES")} km` : "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Active order — link to the live view */}
        {activeOrder && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Orden en curso
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {activeOrder.problemDescription || "Trabajo en curso"}
                </p>
              </div>
              <StatusBadge status={activeOrder.status} />
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link
                to="/c/$code"
                params={{ code: activeOrder.accessCode }}
              >
                <ExternalLink strokeWidth={1.5} />
                Ver estado en vivo
              </Link>
            </Button>
          </section>
        )}

        {/* Upcoming maintenance (read only) */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BellRing strokeWidth={1.5} className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-foreground">
              Próximas revisiones
            </h2>
          </div>
          {pendingReminders.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay revisiones programadas.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingReminders.map((r) => (
                <ReminderRow key={r.id} reminder={r} />
              ))}
            </ul>
          )}
        </section>

        {/* Active warranties */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck strokeWidth={1.5} className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-foreground">
              Garantías vigentes
            </h2>
          </div>
          {warranties.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay garantías activas en este momento.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {warranties.map((w) => (
                <li
                  key={`${w.order.id}-${w.item.id}`}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {w.item.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background-muted px-2 py-0.5 font-medium">
                      <ShieldCheck strokeWidth={1.5} className="h-3 w-3" />
                      Garantía {w.label}
                    </span>
                    {w.untilDate && (
                      <span>Hasta {formatDate(w.untilDate)}</span>
                    )}
                    {w.untilKm != null && (
                      <span>
                        o {w.untilKm.toLocaleString("es-ES")} km
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Full service history */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History strokeWidth={1.5} className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-foreground">
              Historial del vehículo
            </h2>
          </div>
          <div className="mt-4">
            <VehicleHistory
              orders={orders}
              tenant={tenant}
              vehicle={vehicle}
              emptyText="Aún no hay visitas registradas para este vehículo."
            />
          </div>
        </section>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          <Logo showMark={false} className="text-xs font-semibold" />
        </p>
      </main>
    </div>
  );
}

function ReminderRow({ reminder }: { reminder: MaintenanceReminder }) {
  const parts: string[] = [];
  if (reminder.dueDate) parts.push(formatDate(reminder.dueDate));
  if (reminder.dueKm != null)
    parts.push(`${reminder.dueKm.toLocaleString("es-ES")} km`);

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{reminder.label}</p>
        {reminder.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{reminder.note}</p>
        )}
      </div>
      {parts.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Calendar strokeWidth={1.5} className="h-3.5 w-3.5" />
          {parts.join(" · ")}
        </span>
      )}
    </li>
  );
}

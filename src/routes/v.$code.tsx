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
  ClipboardCheck,
  ExternalLink,
  FileText,
  Gauge,
  History,
  Images,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicLoading } from "@/components/PublicLoading";
import { VehicleHistory } from "@/components/VehicleHistory";
import { DocumentStatusBadge } from "@/components/app/DocumentStatusBadge";
import { useAuth } from "@/lib/auth/AuthContext";
import { findVehicleByAccessCode } from "@/lib/db";
import { listOrdersByVehicleId } from "@/lib/orders";
import { PHOTO_LABEL_TEXT } from "@/lib/orders";
import { listVehicleReminders } from "@/lib/reminders";
import {
  documentLabel,
  documentStatus,
  listVehicleDocuments,
} from "@/lib/documents";
import {
  inspectionAttentionItems,
  inspectionSummary,
  latestVehicleInspection,
} from "@/lib/inspection";
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
    return <PublicLoading />;
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
  const documents = listVehicleDocuments(vehicle);
  const latestInspection = latestVehicleInspection(orders);
  const inspectionAttention = latestInspection
    ? inspectionAttentionItems(latestInspection.inspection)
    : [];
  const inspectionStats = latestInspection
    ? inspectionSummary(latestInspection.inspection.items)
    : null;
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
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {cover && (
            <img
              src={cover.url}
              alt={`${vehicle.make} ${vehicle.model}`.trim() || "Vehículo"}
              className="aspect-[16/9] w-full object-cover"
            />
          )}
          <div className="p-5">
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

          {techSpecs.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <Wrench strokeWidth={1.5} className="h-4 w-4" />
                <h2 className="text-sm font-semibold text-foreground">
                  Ficha técnica
                </h2>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {techSpecs.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="break-words text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          </div>
        </section>

        {/* Spend on the car */}
        {spend.total > 0 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet strokeWidth={1.5} className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-foreground">
                Gasto en el coche
              </h2>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {formatCurrency(spend.total, tenant.currency)}
            </p>
            <SpendBreakdown spend={spend} currency={tenant.currency} />
          </section>
        )}

        {/* Odometer history */}
        {kmHistory.points.length >= 2 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp strokeWidth={1.5} className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-foreground">
                Kilometraje
              </h2>
            </div>
            <KmChart history={kmHistory} />
          </section>
        )}

        {/* Vehicle photo gallery */}
        {gallery.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Images strokeWidth={1.5} className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-foreground">
                Galería del coche
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {gallery.map((p) => (
                <figure
                  key={p.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={p.url}
                    alt={PHOTO_LABEL_TEXT[p.label]}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </figure>
              ))}
            </div>
          </section>
        )}

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

        {/* Current condition from the latest DVI */}
        {latestInspection && inspectionStats && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ClipboardCheck strokeWidth={1.5} className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-foreground">
                Estado actual del coche
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Última revisión: {formatDate(latestInspection.inspection.createdAt)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border p-2">
                <p className="text-lg font-semibold text-[var(--success)]">
                  {inspectionStats.ok}
                </p>
                <p className="text-[11px] text-muted-foreground">OK</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-lg font-semibold text-[var(--warning)]">
                  {inspectionStats.atencion}
                </p>
                <p className="text-[11px] text-muted-foreground">Atención</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-lg font-semibold text-[var(--destructive)]">
                  {inspectionStats.critico}
                </p>
                <p className="text-[11px] text-muted-foreground">Crítico</p>
              </div>
            </div>

            {inspectionAttention.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Lo que tu coche necesita pronto
                </p>
                <ul className="mt-2 space-y-2">
                  {inspectionAttention.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {item.name}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      {item.note && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inspectionAttention.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Todo en orden en la última revisión. Sin puntos pendientes.
              </p>
            )}
          </section>
        )}

        {/* Vehicle documents (read only) */}
        {documents.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText strokeWidth={1.5} className="h-4 w-4" />
              <h2 className="text-sm font-semibold text-foreground">
                Documentos del coche
              </h2>
            </div>
            <ul className="mt-3 space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  {doc.fileBase64 ? (
                    <img
                      src={doc.fileBase64}
                      alt={documentLabel(doc)}
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                      <FileText strokeWidth={1.5} className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {documentLabel(doc)}
                      </span>
                      <DocumentStatusBadge status={documentStatus(doc)} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {doc.expiryDate
                        ? `Caduca ${formatDate(doc.expiryDate)}`
                        : "Sin fecha de caducidad"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}



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

/* ----------------------------- Spend breakdown ----------------------------- */

function SpendBreakdown({
  spend,
  currency,
}: {
  spend: VehicleSpend;
  currency: string;
}) {
  const typeRows: Array<{ label: string; value: number; color: string }> = [
    { label: "Mano de obra", value: spend.byType.labor, color: "var(--talleo-accent)" },
    { label: "Repuestos", value: spend.byType.part, color: "var(--foreground-subtle)" },
  ].filter((r) => r.value > 0);
  const typeMax = Math.max(1, ...typeRows.map((r) => r.value));
  const yearMax = Math.max(1, ...spend.byYear.map((y) => y.total));

  return (
    <div className="mt-4 space-y-4">
      {typeRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Por tipo</p>
          {typeRows.map((r) => (
            <div key={r.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{r.label}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(r.value, currency)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-background-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(r.value / typeMax) * 100}%`,
                    backgroundColor: r.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {spend.byYear.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Por año</p>
          <div className="flex items-end gap-2">
            {spend.byYear.map((y) => (
              <div key={y.year} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <div
                    className="w-full rounded-t bg-[var(--talleo-accent)]"
                    style={{ height: `${Math.max(6, (y.total / yearMax) * 100)}%` }}
                    title={formatCurrency(y.total, currency)}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{y.year}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Km sparkline ----------------------------- */

function KmChart({ history }: { history: KmHistory }) {
  const { points, delta, months } = history;
  const W = 320;
  const H = 80;
  const pad = 6;
  const kms = points.map((p) => p.km);
  const min = Math.min(...kms);
  const max = Math.max(...kms);
  const range = Math.max(1, max - min);
  const n = points.length;
  const coords = points.map((p, i) => {
    const x = pad + (i / (n - 1)) * (W - pad * 2);
    const y = H - pad - ((p.km - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${coords[n - 1].x.toFixed(1)} ${H - pad} L ${coords[0].x.toFixed(1)} ${H - pad} Z`;

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
      >
        <path d={area} fill="var(--talleo-accent)" opacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke="var(--talleo-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={2.5} fill="var(--talleo-accent)" />
        ))}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        {delta > 0
          ? `${delta.toLocaleString("es-ES")} km${
              months > 0 ? ` en los últimos ${months} meses` : ""
            }`
          : "Sin variación de kilometraje registrada"}
      </p>
    </div>
  );
}

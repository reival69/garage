import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Car, Camera, ScanLine, FileText, AlertCircle, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth/AuthContext";
import { findWorkOrderByAccessCode, vehiclesRepo } from "@/lib/db";
import { PHOTO_LABEL_TEXT } from "@/lib/orders";
import { formatDateTime } from "@/lib/format";
import type { Tenant, Vehicle, WorkOrder, WorkOrderStatus } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/c/$code")({
  component: GuestView,
});

// Customer-facing pipeline (cancelado handled separately).
const TIMELINE: Array<{ status: WorkOrderStatus; label: string }> = [
  { status: "recibido", label: "Recibido" },
  { status: "diagnostico", label: "Diagnóstico" },
  { status: "presupuesto_enviado", label: "Presupuesto enviado" },
  { status: "aprobado", label: "Aprobado" },
  { status: "en_reparacion", label: "En reparación" },
  { status: "listo", label: "Listo" },
  { status: "entregado", label: "Entregado" },
];

function GuestView() {
  const { code } = Route.useParams();
  const { ready } = useAuth();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid" }
    | { kind: "ok"; order: WorkOrder; tenant: Tenant; vehicle?: Vehicle }
  >({ kind: "loading" });

  useEffect(() => {
    if (!ready) return;
    const found = findWorkOrderByAccessCode(code);
    if (!found) {
      setState({ kind: "invalid" });
      return;
    }
    const vehicle = vehiclesRepo.getById(found.tenant.id, found.order.vehicleId);
    setState({ kind: "ok", ...found, vehicle });
  }, [ready, code]);

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
        <h1 className="text-lg font-semibold text-foreground">Código no válido</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          No encontramos ninguna reparación con el código{" "}
          <span className="font-mono font-medium text-foreground">{code}</span>.
          Comprueba el código con tu taller.
        </p>
      </div>
    );
  }

  const { order, tenant, vehicle } = state;
  const currentIdx = TIMELINE.findIndex((s) => s.status === order.status);

  return (
    <div
      className="min-h-screen bg-background-subtle"
      style={{ ["--talleo-accent" as string]: tenant.accentColor } as React.CSSProperties}
    >
      {/* Branding */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tenant.accentColor }}
            />
            <span className="text-base font-bold tracking-tight text-foreground">
              {tenant.name}
            </span>
          </div>
          <span className="font-mono text-xs tracking-wider text-muted-foreground">
            {order.accessCode}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-5 py-6">
        {/* Vehicle */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground">
              <Car strokeWidth={1.5} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">
                {vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehículo"}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                {vehicle?.plate ?? "—"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {order.problemDescription}
          </p>
        </section>

        {/* Timeline */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Estado de tu reparación
          </h2>
          <ol className="mt-4 space-y-0">
            {TIMELINE.map((step, i) => {
              const done = i < currentIdx;
              const current = i === currentIdx;
              const last = i === TIMELINE.length - 1;
              return (
                <li key={step.status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                        done && "border-transparent text-primary-foreground",
                        current && "border-transparent text-primary-foreground",
                        !done && !current &&
                          "border-border bg-background text-muted-foreground",
                      )}
                      style={
                        done || current
                          ? { backgroundColor: tenant.accentColor }
                          : undefined
                      }
                    >
                      {done ? <Check strokeWidth={2} className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    {!last && (
                      <span
                        className={cn(
                          "w-px flex-1",
                          i < currentIdx ? "" : "bg-border",
                        )}
                        style={
                          i < currentIdx
                            ? { backgroundColor: tenant.accentColor }
                            : undefined
                        }
                      />
                    )}
                  </div>
                  <div className={cn("pb-6", last && "pb-0")}>
                    <p
                      className={cn(
                        "text-sm",
                        current
                          ? "font-semibold text-foreground"
                          : done
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                    {current && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Paso actual
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Placeholders for next prompt */}
        <PlaceholderSection
          icon={Camera}
          title="Fotos del vehículo"
          body="Aquí verás las fotos de tu coche."
        />
        <PlaceholderSection
          icon={ScanLine}
          title="Inspección"
          body="El resultado de la inspección aparecerá aquí."
        />
        <PlaceholderSection
          icon={FileText}
          title="Presupuesto"
          body="Podrás ver y aprobar el presupuesto próximamente."
        />

        <p className="pt-2 text-center text-xs text-muted-foreground">
          <Logo showMark={false} className="text-xs font-semibold" /> · Demo local
        </p>
      </main>
    </div>
  );
}

function PlaceholderSection({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Camera;
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      <p className="mt-2 text-xs text-muted-foreground">Próximamente</p>
    </section>
  );
}

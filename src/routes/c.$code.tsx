import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Car, Camera, ScanLine, FileText, AlertCircle, MessageSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth/AuthContext";
import { findWorkOrderByAccessCode, vehiclesRepo } from "@/lib/db";
import { PHOTO_LABEL_TEXT } from "@/lib/orders";
import { formatDateTime } from "@/lib/format";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Photo, Tenant, Vehicle, WorkOrder, WorkOrderStatus } from "@/types";
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

  // Photos visible to the customer: all labels (recepción incluida).
  const photos = order.photos;
  // Customer timeline: only shop-authored messages, chronological.
  const shopMessages = order.messages
    .filter((m) => m.from === "shop")
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

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

        {/* Photos — real gallery, read only */}
        <PhotoGallery photos={photos} />

        {/* Messages — real shop timeline, read only */}
        <MessagesTimeline messages={shopMessages} />

        {/* Placeholders for next prompts */}
        <PlaceholderSection
          icon={ScanLine}
          title="Inspección"
          body="El resultado de la inspección aparecerá aquí."
        />
        <PlaceholderSection
          icon={FileText}
          title="Presupuesto"
          body="Aquí podrás ver y aprobar el presupuesto de tu reparación."
        />

        <p className="pt-2 text-center text-xs text-muted-foreground">
          <Logo showMark={false} className="text-xs font-semibold" />
        </p>
      </main>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState<Photo | null>(null);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Camera strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">Fotos del vehículo</h2>
      </div>

      {photos.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tu taller aún no ha subido fotos.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActive(photo)}
              className="group flex flex-col gap-1.5 text-left"
            >
              <span className="block aspect-square overflow-hidden rounded-lg border border-border bg-background-muted">
                <img
                  src={photo.url}
                  alt={PHOTO_LABEL_TEXT[photo.label]}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {PHOTO_LABEL_TEXT[photo.label]}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          {active && (
            <figure className="space-y-0">
              <img
                src={active.url}
                alt={PHOTO_LABEL_TEXT[active.label]}
                className="max-h-[70vh] w-full object-contain bg-background-muted"
              />
              <figcaption className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <span className="text-sm font-medium text-foreground">
                  {PHOTO_LABEL_TEXT[active.label]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(active.createdAt)}
                </span>
              </figcaption>
              {active.note && (
                <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  {active.note}
                </p>
              )}
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MessagesTimeline({
  messages,
}: {
  messages: WorkOrder["messages"];
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">Mensajes del taller</h2>
      </div>

      {messages.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Aún no hay mensajes de tu taller.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-border bg-background-subtle p-3"
            >
              <p className="text-sm text-foreground">{m.text}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatDateTime(m.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
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

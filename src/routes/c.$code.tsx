import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Car,
  Camera,
  ScanLine,
  FileText,
  AlertCircle,
  AlertTriangle,
  X,
  MessageSquare,
  Send,
  PenLine,
  Printer,
  ReceiptText,
  History,
  ChevronDown,
  ShieldCheck,
  Star,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicLoading } from "@/components/PublicLoading";
import { VehicleHistory } from "@/components/VehicleHistory";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, findWorkOrderByAccessCode, vehiclesRepo } from "@/lib/db";
import {
  PHOTO_LABEL_TEXT,
  addCustomerMessage,
  listOrdersByVehicleId,
  quoteTotals,
} from "@/lib/orders";
import {
  approvedTotals,
  confirmQuoteApproval,
  warrantyLabel,
  type ApprovalDecision,
} from "@/lib/quotes";
import { getInvoiceByWorkOrderId } from "@/lib/invoices";
import { createReview, getReviewByOrderId } from "@/lib/reviews";
import { inspectionSummary } from "@/lib/inspection";
import { isModuleEnabled } from "@/lib/permissions";
import { formatCurrencyCents, formatDate, formatDateTime } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/base/SignaturePad";
import { StatusBadge } from "@/components/base/StatusBadge";
import {
  InvoiceDocument,
  printInvoiceDocument,
} from "@/components/InvoiceDocument";
import type {
  InspectionItem,
  Invoice,
  Photo,
  QuoteItem,
  Tenant,
  Vehicle,
  WorkOrder,
  WorkOrderStatus,
} from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const SEMAPHORE: Record<
  InspectionItem["status"],
  { label: string; color: string; icon: typeof Check }
> = {
  ok: { label: "OK", color: "var(--success)", icon: Check },
  atencion: { label: "Atención", color: "var(--warning)", icon: AlertTriangle },
  critico: { label: "Crítico", color: "var(--destructive)", icon: X },
};

function GuestView() {
  const { code } = Route.useParams();
  const { ready } = useAuth();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "invalid" }
    | { kind: "ok"; order: WorkOrder; tenant: Tenant; vehicle?: Vehicle }
  >({ kind: "loading" });

  const load = useCallback(() => {
    const found = findWorkOrderByAccessCode(code);
    if (!found) {
      setState({ kind: "invalid" });
      return;
    }
    const vehicle = vehiclesRepo.getById(found.tenant.id, found.order.vehicleId);
    setState({ kind: "ok", ...found, vehicle });
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

  const photos = order.photos;
  const messages = order.messages
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

        {/* Inspection (DVI) — read only */}
        <InspectionSection order={order} />

        {/* Quote — approval with signature */}
        <QuoteSection
          order={order}
          tenant={tenant}
          accent={tenant.accentColor}
          onChanged={load}
        />

        {/* Invoice for this order (read only, printable) */}
        <OrderInvoiceSection order={order} tenant={tenant} vehicle={vehicle} />

        {/* Post-delivery review (only when delivered) */}
        {order.status === "entregado" && isModuleEnabled(tenant, "resenas") && (
          <ReviewSection
            order={order}
            tenant={tenant}
            accent={tenant.accentColor}
            onChanged={load}
          />
        )}

        {/* Vehicle service history */}
        <VehicleHistorySection
          order={order}
          tenant={tenant}
          vehicle={vehicle}
        />

        {/* Messages — two-way */}
        <MessagesTimeline
          messages={messages}
          onSend={(text) => {
            addCustomerMessage(tenant.id, order, text);
            toast.success("Mensaje enviado al taller");
            load();
          }}
        />

        <p className="pt-2 text-center text-xs text-muted-foreground">
          <Logo showMark={false} className="text-xs font-semibold" />
        </p>
      </main>
    </div>
  );
}

/* ----------------------------- Photo gallery ----------------------------- */

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

      <PhotoDialog active={active} onClose={() => setActive(null)} />
    </section>
  );
}

function PhotoDialog({
  active,
  onClose,
  caption,
}: {
  active: Photo | null;
  onClose: () => void;
  caption?: string;
}) {
  return (
    <Dialog open={!!active} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {active && (
          <figure className="space-y-0">
            <img
              src={active.url}
              alt={caption ?? PHOTO_LABEL_TEXT[active.label]}
              className="max-h-[70vh] w-full bg-background-muted object-contain"
            />
            <figcaption className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">
                {caption ?? PHOTO_LABEL_TEXT[active.label]}
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
  );
}

/* ----------------------------- Inspection ----------------------------- */

function InspectionSection({ order }: { order: WorkOrder }) {
  const [active, setActive] = useState<Photo | null>(null);
  const inspection = order.inspection;

  if (!inspection || inspection.items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ScanLine strokeWidth={1.5} className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">Inspección</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Aún no hay inspección disponible.
        </p>
      </section>
    );
  }

  const summary = inspectionSummary(inspection.items);
  const photoFor = (id?: string) =>
    id ? order.photos.find((p) => p.id === id) : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ScanLine strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">Inspección</h2>
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SummaryTile label="OK" count={summary.ok} color="var(--success)" />
        <SummaryTile
          label="Atención"
          count={summary.atencion}
          color="var(--warning)"
        />
        <SummaryTile
          label="Crítico"
          count={summary.critico}
          color="var(--destructive)"
        />
      </div>

      {/* Points */}
      <ul className="mt-4 space-y-3">
        {inspection.items.map((item) => {
          const s = SEMAPHORE[item.status];
          const photo = photoFor(item.photoId);
          const Icon = s.icon;
          return (
            <li
              key={item.id}
              className="flex gap-3 rounded-lg border border-border p-3"
            >
              {photo ? (
                <button
                  type="button"
                  onClick={() => setActive(photo)}
                  className="shrink-0"
                >
                  <img
                    src={photo.url}
                    alt={item.name}
                    loading="lazy"
                    className="h-14 w-14 rounded-md border border-border object-cover"
                  />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{
                      color: s.color,
                      backgroundColor: `color-mix(in oklab, ${s.color} 12%, transparent)`,
                    }}
                  >
                    <Icon strokeWidth={1.5} className="h-3.5 w-3.5" />
                    {s.label}
                  </span>
                </div>
                {item.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <PhotoDialog
        active={active}
        onClose={() => setActive(null)}
        caption={active ? "Detalle de inspección" : undefined}
      />
    </section>
  );
}

function SummaryTile({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-foreground">{count}</p>
    </div>
  );
}

/* ----------------------------- Quote approval ----------------------------- */

function QuoteSection({
  order,
  tenant,
  accent,
  onChanged,
}: {
  order: WorkOrder;
  tenant: Tenant;
  accent: string;
  onChanged: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, ApprovalDecision>>(
    {},
  );
  const [signOpen, setSignOpen] = useState(false);
  const [signature, setSignature] = useState<string | undefined>();

  const items = order.items;
  const pending = items.filter((i) => i.approval === "pending");
  const decided = items.filter((i) => i.approval !== "pending");
  const totals = quoteTotals(items, tenant.taxRate);
  const approved = approvedTotals(items, tenant.taxRate, decisions);
  const taxPct = Math.round(tenant.taxRate * 100);

  const allDecided = pending.every((i) => decisions[i.id]);

  const setDecision = (id: string, d: ApprovalDecision) =>
    setDecisions((prev) => ({
      ...prev,
      [id]: prev[id] === d ? prev[id] : d,
    }));

  const confirm = () => {
    if (!signature) {
      toast.error("Firma para confirmar tu decisión.");
      return;
    }
    confirmQuoteApproval(tenant, order, decisions, signature);
    setSignOpen(false);
    setSignature(undefined);
    setDecisions({});
    toast.success("Decisión registrada");
    onChanged();
  };

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText strokeWidth={1.5} className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">Presupuesto</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tu taller aún no ha preparado un presupuesto.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">Presupuesto</h2>
      </div>

      {/* Decided lines (read only) */}
      {decided.length > 0 && (
        <div className="mt-4 space-y-2">
          {decided.map((it) => (
            <QuoteLine key={it.id} item={it} currency={tenant.currency}>
              <ApprovalTag approval={it.approval} />
            </QuoteLine>
          ))}
        </div>
      )}

      {/* Pending lines (actionable) */}
      {pending.length > 0 && (
        <div className="mt-4 space-y-2">
          {pending.map((it) => {
            const choice = decisions[it.id];
            return (
              <QuoteLine key={it.id} item={it} currency={tenant.currency}>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision(it.id, "approved")}
                    aria-pressed={choice === "approved"}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                      choice === "approved"
                        ? "text-[color:var(--c)]"
                        : "border-border text-muted-foreground hover:bg-background-muted",
                    )}
                    style={
                      choice === "approved"
                        ? ({
                            borderColor: "var(--success)",
                            backgroundColor:
                              "color-mix(in oklab, var(--success) 12%, transparent)",
                            "--c": "var(--success)",
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <Check strokeWidth={1.5} className="h-4 w-4" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision(it.id, "rejected")}
                    aria-pressed={choice === "rejected"}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                      choice === "rejected"
                        ? "text-[color:var(--c)]"
                        : "border-border text-muted-foreground hover:bg-background-muted",
                    )}
                    style={
                      choice === "rejected"
                        ? ({
                            borderColor: "var(--destructive)",
                            backgroundColor:
                              "color-mix(in oklab, var(--destructive) 12%, transparent)",
                            "--c": "var(--destructive)",
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <X strokeWidth={1.5} className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </QuoteLine>
            );
          })}
        </div>
      )}

      {/* Totals */}
      <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        <Row
          label="Subtotal"
          value={formatCurrencyCents(totals.subtotal, tenant.currency)}
        />
        <Row
          label={`IVA (${taxPct}%)`}
          value={formatCurrencyCents(totals.tax, tenant.currency)}
        />
        <div className="flex items-center justify-between pt-1 text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyCents(totals.total, tenant.currency)}</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-sm">
          <span className="text-muted-foreground">Total aprobado</span>
          <span className="font-medium" style={{ color: "var(--success)" }}>
            {formatCurrencyCents(approved.total, tenant.currency)}
          </span>
        </div>
      </div>

      {/* Action / final state */}
      {pending.length > 0 ? (
        <Button
          className="mt-4 w-full text-primary-foreground"
          style={{ backgroundColor: accent }}
          disabled={!allDecided}
          onClick={() => setSignOpen(true)}
        >
          <PenLine strokeWidth={1.5} />
          Confirmar y firmar
        </Button>
      ) : order.quoteApproval ? (
        <div className="mt-4 rounded-lg border border-border bg-background-subtle p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Check strokeWidth={1.5} className="h-4 w-4" style={{ color: "var(--success)" }} />
            Presupuesto firmado el {formatDate(order.quoteApproval.decidedAt)}
          </p>
          <img
            src={order.quoteApproval.signature}
            alt="Firma de aprobación"
            className="mt-3 w-full max-w-[220px] rounded-md border border-border bg-background"
          />
        </div>
      ) : null}

      {/* Signature dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firma tu decisión</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Aprobado: {formatCurrencyCents(approved.total, tenant.currency)}. Firma
            para confirmar.
          </p>
          <SignaturePad initial={signature} onChange={setSignature} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="text-primary-foreground"
              style={{ backgroundColor: accent }}
              onClick={confirm}
              disabled={!signature}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function QuoteLine({
  item,
  currency,
  children,
}: {
  item: QuoteItem;
  currency: string;
  children?: React.ReactNode;
}) {
  const warranty = warrantyLabel(item);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground">{item.description}</p>
          <p className="text-xs text-muted-foreground">
            {item.qty} × {formatCurrencyCents(item.unitPrice, currency)}
          </p>
          {warranty && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-border bg-background-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <ShieldCheck strokeWidth={1.5} className="h-3 w-3" />
              Garantía {warranty}
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm font-medium text-foreground">
          {formatCurrencyCents(item.qty * item.unitPrice, currency)}
        </span>
      </div>
      {children}
    </div>
  );
}

function ApprovalTag({ approval }: { approval: QuoteItem["approval"] }) {
  if (approval === "approved") {
    return (
      <span
        className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
        style={{
          color: "var(--success)",
          backgroundColor: "color-mix(in oklab, var(--success) 12%, transparent)",
        }}
      >
        <Check strokeWidth={1.5} className="h-3.5 w-3.5" />
        Aprobado
      </span>
    );
  }
  return (
    <span
      className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: "var(--destructive)",
        backgroundColor: "color-mix(in oklab, var(--destructive) 12%, transparent)",
      }}
    >
      <X strokeWidth={1.5} className="h-3.5 w-3.5" />
      Rechazado
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ----------------------------- Messages ----------------------------- */

function MessagesTimeline({
  messages,
  onSend,
}: {
  messages: WorkOrder["messages"];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">Mensajes</h2>
      </div>

      {messages.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Aún no hay mensajes.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-lg p-3",
                m.from === "customer"
                  ? "ml-8 border border-border bg-background-subtle"
                  : "mr-8 border border-border bg-card",
              )}
            >
              <p className="text-sm text-foreground">{m.text}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {m.from === "customer" ? "Tú" : "Taller"} ·{" "}
                {formatDateTime(m.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje a tu taller…"
          className="min-h-[40px]"
          maxLength={500}
        />
        <Button size="icon" onClick={send} className="shrink-0">
          <Send strokeWidth={1.5} />
        </Button>
      </div>
    </section>
  );
}

/* ----------------------------- Review ----------------------------- */

function StarRating({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "h-7 w-7" : "h-4 w-4";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <Star
            strokeWidth={1.5}
            className={cn(dim, filled ? "text-foreground" : "text-muted-foreground")}
            fill={filled ? "currentColor" : "none"}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            className="transition-transform hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

function ReviewSection({
  order,
  tenant,
  accent,
  onChanged,
}: {
  order: WorkOrder;
  tenant: Tenant;
  accent: string;
  onChanged: () => void;
}) {
  const existing = getReviewByOrderId(tenant.id, order.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState<number | null>(null);

  // Already reviewed (persisted) → thank-you with the saved stars.
  if (existing) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Star strokeWidth={1.5} className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">
            Tu valoración
          </h2>
        </div>
        <p className="mt-3 text-sm text-foreground">Gracias por tu valoración.</p>
        <div className="mt-2">
          <StarRating value={existing.rating} size="sm" />
        </div>
        {existing.comment && (
          <p className="mt-2 text-sm text-muted-foreground">{existing.comment}</p>
        )}
      </section>
    );
  }

  // Just submitted in this session → confirmation + conditional CTA.
  if (sent != null) {
    const high = sent >= 4;
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Star strokeWidth={1.5} className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">
            ¡Gracias por tu valoración!
          </h2>
        </div>
        <div className="mt-3">
          <StarRating value={sent} size="sm" />
        </div>
        {high ? (
          tenant.googleReviewUrl ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                ¿Nos ayudas a crecer? Comparte tu experiencia en Google.
              </p>
              <Button
                asChild
                className="mt-3 w-full text-primary-foreground"
                style={{ backgroundColor: accent }}
              >
                <a
                  href={tenant.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Star strokeWidth={1.5} />
                  Déjanos una reseña en Google
                </a>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              ¡Nos alegra que tu experiencia haya sido positiva!
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Gracias por tu sinceridad. El taller revisará tu valoración para
            mejorar.
          </p>
        )}
      </section>
    );
  }

  const submit = () => {
    if (rating < 1) {
      toast.error("Elige una valoración de 1 a 5 estrellas.");
      return;
    }
    createReview(tenant.id, {
      orderId: order.id,
      customerId: order.customerId,
      vehicleId: order.vehicleId,
      rating,
      comment,
    });
    toast.success("¡Gracias por tu valoración!");
    setSent(rating);
    onChanged();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Star strokeWidth={1.5} className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-foreground">
          ¿Cómo fue tu experiencia?
        </h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Tu opinión ayuda al taller a mejorar.
      </p>

      <div className="mt-4">
        <StarRating value={rating} onChange={setRating} />
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Cuéntanos qué tal fue (opcional)…"
        className="mt-4 min-h-[80px]"
        maxLength={500}
      />

      <Button
        className="mt-4 w-full text-primary-foreground"
        style={{ backgroundColor: accent }}
        onClick={submit}
      >
        Enviar valoración
      </Button>
    </section>
  );
}

/* ----------------------------- Invoice (this order) ----------------------------- */

function OrderInvoiceSection({
  order,
  tenant,
  vehicle,
}: {
  order: WorkOrder;
  tenant: Tenant;
  vehicle?: Vehicle;
}) {
  const invoice = getInvoiceByWorkOrderId(tenant.id, order.id);
  // No invoice yet → hide the section entirely.
  if (!invoice) return null;

  const customer = customersRepo.getById(tenant.id, order.customerId);
  const location =
    tenant.locations.find((l) => l.id === order.locationId) ??
    tenant.locations[0];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ReceiptText strokeWidth={1.5} className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">Factura</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => printInvoiceDocument("invoice-customer")}
        >
          <Printer strokeWidth={1.5} />
          Imprimir / PDF
        </Button>
      </div>

      <div className="mt-4">
        <InvoiceDocument
          invoice={invoice}
          tenant={tenant}
          customer={customer}
          vehicle={vehicle}
          location={location}
          printId="invoice-customer"
        />
      </div>
    </section>
  );
}

/* ----------------------------- Vehicle history ----------------------------- */

function VehicleHistorySection({
  order,
  tenant,
  vehicle,
}: {
  order: WorkOrder;
  tenant: Tenant;
  vehicle?: Vehicle;
}) {
  // Other orders for this vehicle (most recent first), excluding the current one.
  const history = vehicle
    ? listOrdersByVehicleId(tenant.id, vehicle.id).filter(
        (o) => o.id !== order.id,
      )
    : [];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History strokeWidth={1.5} className="h-4 w-4" />
          <h2 className="text-sm font-semibold text-foreground">
            Historial del vehículo
          </h2>
        </div>
        {vehicle?.accessCode && (
          <Link
            to="/v/$code"
            params={{ code: vehicle.accessCode }}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
          >
            Ver cartilla del coche
            <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="mt-4">
        <VehicleHistory
          orders={history}
          tenant={tenant}
          vehicle={vehicle}
          emptyText="Esta es la primera visita registrada de este vehículo."
        />
      </div>
    </section>
  );
}


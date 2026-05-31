// Talleo — ficha de orden (hub central). Cabecera, control de pipeline, notas,
// mensajes al cliente, fotos y resumen de presupuesto (solo lectura), compartir.
// Inspección y Check-in quedan como placeholders para el siguiente prompt.

import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Car,
  User,
  Wrench,
  Send,
  Camera,
  Copy,
  Share2,
  Loader2,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo, workOrdersRepo } from "@/lib/db";
import {
  PHOTO_LABELS,
  PHOTO_LABEL_TEXT,
  STATUS_LABELS,
  addOrderPhoto,
  addShopMessage,
  changeOrderStatus,
  listMechanics,
  nextStatuses,
  removeOrderPhoto,
  updateOrder,
} from "@/lib/orders";
import { QuoteEditor } from "@/components/app/QuoteEditor";
import { InspectionEditor } from "@/components/app/InspectionEditor";
import { CheckInEditor } from "@/components/app/CheckInEditor";
import {
  generateInvoiceFromOrder,
  getInvoiceByWorkOrderId,
} from "@/lib/invoices";
import { compressImage } from "@/lib/image";
import { formatDateTime } from "@/lib/format";
import type { Photo, Tenant, WorkOrder } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ordenes/$id")({
  component: OrderDetail,
});

const MAX_PHOTOS = 12;

function OrderDetail() {
  const { id } = Route.useParams();
  const { ready, tenant } = useAuth();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const order = useMemo(() => {
    if (!ready || !tenant) return null;
    return workOrdersRepo.getById(tenant.id, id) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, id, version]);

  if (!tenant) return null;
  if (!order) {
    return (
      <div>
        <BackLink />
        <EmptyState
          title="Orden no encontrada"
          description="Es posible que se haya eliminado."
        />
      </div>
    );
  }

  const vehicle = vehiclesRepo.getById(tenant.id, order.vehicleId);
  const customer = customersRepo.getById(tenant.id, order.customerId);
  const mechanics = listMechanics(tenant.id);
  const transitions = nextStatuses(order.status);

  const move = (next: string) => {
    changeOrderStatus(tenant, order, next as WorkOrder["status"]);
    toast.success(`Estado: ${STATUS_LABELS[next as WorkOrder["status"]]}`);
    bump();
  };

  const setMechanic = (mid: string) => {
    updateOrder(tenant.id, order.id, { mechanicId: mid });
    bump();
  };

  return (
    <div>
      <BackLink />
      <PageHeader
        title={
          vehicle ? `${vehicle.make} ${vehicle.model}` : "Orden de reparación"
        }
        description={`Código ${order.accessCode}`}
        actions={<StatusBadge status={order.status} className="px-3 py-1 text-sm" />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Header info */}
          <DataCard title="Resumen">
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoRow icon={Car} label="Vehículo">
                {vehicle ? (
                  <Link
                    to="/app/vehiculos/$id"
                    params={{ id: vehicle.id }}
                    className="text-foreground hover:underline"
                  >
                    {vehicle.make} {vehicle.model}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {vehicle.plate}
                    </span>
                  </Link>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow icon={User} label="Cliente">
                {customer ? (
                  <Link
                    to="/app/clientes/$id"
                    params={{ id: customer.id }}
                    className="text-foreground hover:underline"
                  >
                    {customer.name}
                    <span className="block text-xs text-muted-foreground">
                      {customer.phone}
                    </span>
                  </Link>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow icon={Wrench} label="Mecánico">
                <Select
                  value={order.mechanicId ?? ""}
                  onValueChange={setMechanic}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {mechanics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InfoRow>
            </div>
          </DataCard>

          {/* Pipeline control */}
          <DataCard title="Control de pipeline">
            <p className="text-sm text-muted-foreground">
              Estado actual:{" "}
              <span className="font-medium text-foreground">
                {STATUS_LABELS[order.status]}
              </span>
            </p>
            {transitions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Esta orden está en un estado final.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {transitions.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "cancelado" ? "outline" : "default"}
                    className={
                      s === "cancelado"
                        ? "text-[var(--destructive)]"
                        : undefined
                    }
                    onClick={() => move(s)}
                  >
                    {STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            )}
          </DataCard>

          <ProblemNotes order={order} tenantId={tenant.id} onSaved={bump} />
          <Messages order={order} tenantId={tenant.id} onSaved={bump} />
          <Photos order={order} tenantId={tenant.id} onSaved={bump} />

          {/* Quote editor */}
          <QuoteEditor order={order} tenant={tenant} onSaved={bump} />


          {/* Digital inspection */}
          <InspectionEditor order={order} tenant={tenant} onSaved={bump} />

          {/* Reception check-in */}
          <CheckInEditor order={order} tenant={tenant} onSaved={bump} />
        </div>

        {/* Sidebar: share */}
        <div className="space-y-4 lg:col-span-1">
          <ShareCard order={order} tenantName={tenant.name} />
        </div>
      </div>
    </div>
  );
}

function ProblemNotes({
  order,
  tenantId,
  onSaved,
}: {
  order: WorkOrder;
  tenantId: string;
  onSaved: () => void;
}) {
  const [problem, setProblem] = useState(order.problemDescription);
  const [notes, setNotes] = useState(order.internalNotes ?? "");

  const save = () => {
    updateOrder(tenantId, order.id, {
      problemDescription: problem.trim(),
      internalNotes: notes.trim(),
    });
    toast.success("Cambios guardados");
    onSaved();
  };

  const dirty =
    problem !== order.problemDescription ||
    notes !== (order.internalNotes ?? "");

  return (
    <DataCard title="Descripción y notas">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Problema / motivo</Label>
          <Textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            maxLength={600}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Notas internas (no visibles al cliente)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Solo para el equipo del taller…"
            maxLength={600}
          />
        </div>
        <Button size="sm" onClick={save} disabled={!dirty}>
          Guardar
        </Button>
      </div>
    </DataCard>
  );
}

function Messages({
  order,
  tenantId,
  onSaved,
}: {
  order: WorkOrder;
  tenantId: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    addShopMessage(tenantId, order, text.trim());
    setText("");
    toast.success("Mensaje enviado al cliente");
    onSaved();
  };

  return (
    <DataCard title="Mensajes al cliente">
      <div className="space-y-2">
        {order.messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin mensajes todavía.</p>
        )}
        {order.messages.map((m) => (
          <div
            key={m.id}
            className={
              m.from === "shop"
                ? "ml-8 rounded-lg bg-secondary px-3 py-2"
                : "mr-8 rounded-lg border border-border px-3 py-2"
            }
          >
            <p className="text-sm text-foreground">{m.text}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {m.from === "shop" ? "Taller" : "Cliente"} ·{" "}
              {formatDateTime(m.createdAt)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje para el cliente…"
          className="min-h-[40px]"
          maxLength={500}
        />
        <Button size="icon" onClick={send} className="shrink-0">
          <Send strokeWidth={1.5} />
        </Button>
      </div>
    </DataCard>
  );
}

function Photos({
  order,
  tenantId,
  onSaved,
}: {
  order: WorkOrder;
  tenantId: string;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState<Photo["label"]>("recepcion");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (order.photos.length >= MAX_PHOTOS) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos por orden.`);
      return;
    }
    setBusy(true);
    try {
      const url = await compressImage(file);
      addOrderPhoto(tenantId, order, { url, label });
      toast.success("Foto añadida");
      onSaved();
    } catch {
      toast.error("No se pudo procesar la imagen.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (photoId: string) => {
    removeOrderPhoto(tenantId, order, photoId);
    onSaved();
  };

  return (
    <DataCard title={`Fotos (${order.photos.length}/${MAX_PHOTOS})`}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={label} onValueChange={(v) => setLabel(v as Photo["label"])}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_LABELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Camera strokeWidth={1.5} />
          )}
          Añadir foto
        </Button>
      </div>

      {order.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {order.photos.map((p) => (
            <figure
              key={p.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <img
                src={p.url}
                alt={PHOTO_LABEL_TEXT[p.label]}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                {PHOTO_LABEL_TEXT[p.label]}
              </figcaption>
              <button
                onClick={() => remove(p.id)}
                className="absolute right-1 top-1 hidden rounded-md bg-background/90 p-1 text-[var(--destructive)] group-hover:block"
                aria-label="Eliminar foto"
              >
                <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5" />
              </button>
            </figure>
          ))}
        </div>
      )}
    </DataCard>
  );
}

function ShareCard({
  order,
  tenantName,
}: {
  order: WorkOrder;
  tenantName: string;
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/c/${order.accessCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const whatsapp = () => {
    const msg = `Hola, soy ${tenantName}. Puedes seguir el estado de tu vehículo aquí: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <DataCard title="Compartir con el cliente">
      <p className="text-xs text-muted-foreground">Código de acceso</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-foreground">
        {order.accessCode}
      </p>
      <p className="mt-3 break-all rounded-lg border border-border bg-background-subtle px-3 py-2 text-xs text-muted-foreground">
        {link}
      </p>
      <div className="mt-3 grid gap-2">
        <Button variant="outline" onClick={copy}>
          <Copy strokeWidth={1.5} />
          Copiar enlace
        </Button>
        <Button variant="outline" onClick={whatsapp}>
          <Share2 strokeWidth={1.5} />
          Compartir por WhatsApp
        </Button>
        <Link
          to="/c/$code"
          params={{ code: order.accessCode }}
          className="text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Ver como cliente →
        </Link>
      </div>
    </DataCard>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Car;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon strokeWidth={1.5} className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}


function BackLink() {
  return (
    <Link
      to="/app/ordenes"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft strokeWidth={1.5} className="h-4 w-4" />
      Órdenes
    </Link>
  );
}

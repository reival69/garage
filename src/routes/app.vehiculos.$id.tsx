// Talleo — ficha de vehículo. Datos, dueño, historial de servicio y galería de
// fotos acumuladas (de todas sus órdenes). Botón «Nueva orden» precargado.

import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Plus,
  User,
  ClipboardList,
  BellRing,
  CalendarClock,
  Gauge,
  Check,
  MoreHorizontal,
  Trash2,
  MessageCircle,
  Share2,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VehicleFormDialog } from "@/components/app/VehicleFormDialog";
import { VehiclePhotosCard } from "@/components/app/VehiclePhotosCard";
import { OrderFormDialog } from "@/components/app/OrderFormDialog";
import { ReminderFormDialog } from "@/components/app/ReminderFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo, workOrdersRepo } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PHOTO_LABEL_TEXT } from "@/lib/orders";
import {
  dismiss,
  isReminderDue,
  listVehicleReminders,
  markDone,
  removeReminder,
  whatsappReminderUrl,
} from "@/lib/reminders";
import { canEdit } from "@/lib/permissions";
import {
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  cartillaUrl,
  whatsappCartillaUrl,
} from "@/lib/vehicles";
import { toast } from "sonner";
import type { MaintenanceReminder, Photo } from "@/types";

export const Route = createFileRoute("/app/vehiculos/$id")({
  component: VehicleDetail,
});

function VehicleDetail() {
  const { id } = Route.useParams();
  const { ready, user, tenant } = useAuth();
  const router = useRouter();

  const [version, setVersion] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] =
    useState<MaintenanceReminder | null>(null);
  const [reminderToDelete, setReminderToDelete] =
    useState<MaintenanceReminder | null>(null);

  const data = useMemo(() => {
    if (!ready || !tenant) return null;
    const vehicle = vehiclesRepo.getById(tenant.id, id);
    if (!vehicle) return null;
    const customer = customersRepo.getById(tenant.id, vehicle.customerId);
    const orders = workOrdersRepo
      .list(tenant.id)
      .filter((o) => o.vehicleId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const photos: Array<Photo & { orderCode: string; orderId: string }> = [];
    orders.forEach((o) =>
      o.photos.forEach((p) =>
        photos.push({ ...p, orderCode: o.accessCode, orderId: o.id }),
      ),
    );
    const reminders = listVehicleReminders(tenant.id, id);
    return { vehicle, customer, orders, photos, reminders };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, id, version]);

  if (!tenant || !user) return null;

  if (!data) {
    return (
      <div>
        <BackLink />
        <EmptyState
          title="Vehículo no encontrado"
          description="Es posible que se haya eliminado."
        />
      </div>
    );
  }

  const { vehicle, customer, orders, photos, reminders } = data;
  const remindersEditable = canEdit(user.role, "recordatorios");

  const bump = () => {
    setVersion((v) => v + 1);
    router.invalidate();
  };
  const onReminderDone = (r: MaintenanceReminder) => {
    markDone(tenant.id, r.id);
    toast.success("Recordatorio marcado como hecho");
    bump();
  };
  const onReminderDismiss = (r: MaintenanceReminder) => {
    dismiss(tenant.id, r.id);
    toast.success("Recordatorio descartado");
    bump();
  };
  const confirmDeleteReminder = () => {
    if (!reminderToDelete) return;
    removeReminder(tenant.id, reminderToDelete.id);
    toast.success("Recordatorio eliminado");
    setReminderToDelete(null);
    bump();
  };
  const notifyReminder = (r: MaintenanceReminder) => {
    const url = whatsappReminderUrl({
      phone: customer?.phone,
      tenantName: tenant.name,
      customerName: customer?.name,
      vehicleLabel: `${vehicle.make} ${vehicle.model}`.trim(),
      label: r.label,
    });
    window.open(url, "_blank");
  };
  const copyCartilla = async () => {
    const url = cartillaUrl(vehicle.accessCode);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace de la cartilla copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };
  const shareCartillaWhatsapp = () => {
    const url = whatsappCartillaUrl({
      phone: customer?.phone,
      tenantName: tenant.name,
      customerName: customer?.name,
      vehicleLabel: `${vehicle.make} ${vehicle.model}`.trim(),
      code: vehicle.accessCode,
    });
    window.open(url, "_blank");
  };

  const specs: Array<[string, string]> = [
    ["Marca", vehicle.make || "—"],
    ["Modelo", vehicle.model || "—"],
    ["Año", vehicle.year ? String(vehicle.year) : "—"],
    ["Kilómetros", vehicle.km ? `${vehicle.km.toLocaleString("es-ES")} km` : "—"],
    ["Color", vehicle.color ?? "—"],
    ["VIN", vehicle.vin ?? "—"],
    ["Combustible", vehicle.fuelType ? FUEL_TYPE_LABELS[vehicle.fuelType] : "—"],
    [
      "Transmisión",
      vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : "—",
    ],
    [
      "Cilindrada",
      vehicle.displacementCc ? `${vehicle.displacementCc} cc` : "—",
    ],
    ["Potencia", vehicle.powerHp ? `${vehicle.powerHp} CV` : "—"],
  ];

  return (
    <div>
      <BackLink />
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`.trim() || vehicle.plate}
        description={vehicle.plate}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Share2 strokeWidth={1.5} />
                  Compartir cartilla
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copyCartilla}>
                  <Copy strokeWidth={1.5} />
                  Copiar enlace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareCartillaWhatsapp}>
                  <MessageCircle strokeWidth={1.5} />
                  Enviar por WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil strokeWidth={1.5} />
              Editar
            </Button>
            <Button onClick={() => setOrderOpen(true)}>
              <Plus strokeWidth={1.5} />
              Nueva orden
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {/* Specs */}
          <DataCard title="Datos del vehículo">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {specs.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </DataCard>

          {/* Owner */}
          <DataCard title="Dueño" bodyClassName="p-0">
            {customer ? (
              <Link
                to="/app/clientes/$id"
                params={{ id: customer.id }}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-background-subtle"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
                  <User strokeWidth={1.5} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {customer.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {customer.phone}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                Sin dueño.
              </p>
            )}
          </DataCard>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {/* Service history */}
          <DataCard title="Historial de servicio" bodyClassName="p-0">
            {orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Sin órdenes registradas para este vehículo.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      to="/app/ordenes/$id"
                      params={{ id: o.id }}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-background-subtle"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
                        <ClipboardList strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {o.problemDescription}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(o.createdAt)} · {o.accessCode}
                        </span>
                      </span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>

          {/* Vehicle-level photos (cover + own gallery) */}
          <VehiclePhotosCard
            tenantId={tenant.id}
            vehicle={vehicle}
            onSaved={bump}
          />

          {/* Photos collected from the work orders */}
          <DataCard title={`Fotos por orden (${photos.length})`}>
            {photos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay fotos de este vehículo.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {photos.map((p) => (
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
                    <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                      {PHOTO_LABEL_TEXT[p.label]}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </DataCard>

          {/* Maintenance reminders */}
          <DataCard
            title="Recordatorios"
            bodyClassName="p-0"
            actions={
              remindersEditable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingReminder(null);
                    setReminderOpen(true);
                  }}
                >
                  <Plus strokeWidth={1.5} />
                  Programar
                </Button>
              ) : undefined
            }
          >
            {reminders.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                Sin recordatorios para este vehículo.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {reminders.map((r) => {
                  const due = isReminderDue(r, vehicle);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <span
                        className={
                          due
                            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]"
                            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
                        }
                      >
                        <BellRing strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate text-sm font-medium text-foreground">
                            {r.label}
                          </span>
                          {r.status !== "pending" && (
                            <span className="rounded-md bg-background-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {r.status === "done" ? "Hecho" : "Descartado"}
                            </span>
                          )}
                          {due && (
                            <span className="rounded-md bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--destructive)]">
                              Vencido
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {r.dueDate && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock
                                strokeWidth={1.5}
                                className="h-3.5 w-3.5"
                              />
                              {formatDate(r.dueDate)}
                            </span>
                          )}
                          {r.dueKm != null && (
                            <span className="inline-flex items-center gap-1">
                              <Gauge strokeWidth={1.5} className="h-3.5 w-3.5" />
                              {r.dueKm.toLocaleString("es-ES")} km
                            </span>
                          )}
                          {!r.dueDate && r.dueKm == null && (
                            <span>Sin disparador</span>
                          )}
                        </div>
                        {r.note && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.note}
                          </p>
                        )}
                      </div>

                      {remindersEditable && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                            >
                              <MoreHorizontal
                                strokeWidth={1.5}
                                className="h-4 w-4"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.status === "pending" && (
                              <DropdownMenuItem onClick={() => onReminderDone(r)}>
                                <Check strokeWidth={1.5} className="h-4 w-4" />
                                Marcar como hecho
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingReminder(r);
                                setReminderOpen(true);
                              }}
                            >
                              <Pencil strokeWidth={1.5} className="h-4 w-4" />
                              Posponer / editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => notifyReminder(r)}>
                              <MessageCircle
                                strokeWidth={1.5}
                                className="h-4 w-4"
                              />
                              Avisar al cliente
                            </DropdownMenuItem>
                            {r.status === "pending" && (
                              <DropdownMenuItem
                                onClick={() => onReminderDismiss(r)}
                              >
                                <BellRing strokeWidth={1.5} className="h-4 w-4" />
                                Descartar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setReminderToDelete(r)}
                              className="text-[var(--destructive)] focus:text-[var(--destructive)]"
                            >
                              <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </DataCard>
        </div>
      </div>

      <VehicleFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenant.id}
        vehicle={vehicle}
        onSaved={() => {
          setVersion((v) => v + 1);
          router.invalidate();
        }}
      />
      <OrderFormDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        tenant={tenant}
        defaultCustomerId={vehicle.customerId}
        defaultVehicleId={vehicle.id}
        onCreated={() => setVersion((v) => v + 1)}
      />

      <ReminderFormDialog
        open={reminderOpen}
        onOpenChange={(o) => {
          setReminderOpen(o);
          if (!o) setEditingReminder(null);
        }}
        tenantId={tenant.id}
        vehicleId={vehicle.id}
        customerId={vehicle.customerId}
        reminder={editingReminder}
        onSaved={bump}
      />

      <AlertDialog
        open={!!reminderToDelete}
        onOpenChange={(o) => !o && setReminderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar recordatorio</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteReminder}
              className="bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/app/vehiculos"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft strokeWidth={1.5} className="h-4 w-4" />
      Vehículos
    </Link>
  );
}

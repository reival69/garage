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
import { toast } from "sonner";
import type { Customer, MaintenanceReminder, Photo, Vehicle } from "@/types";

export const Route = createFileRoute("/app/vehiculos/$id")({
  component: VehicleDetail,
});

function VehicleDetail() {
  const { id } = Route.useParams();
  const { ready, tenant } = useAuth();
  const router = useRouter();

  const [version, setVersion] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

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
    return { vehicle, customer, orders, photos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, id, version]);

  if (!tenant) return null;

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

  const { vehicle, customer, orders, photos } = data;

  const specs: Array<[string, string]> = [
    ["Marca", vehicle.make || "—"],
    ["Modelo", vehicle.model || "—"],
    ["Año", vehicle.year ? String(vehicle.year) : "—"],
    ["Kilómetros", vehicle.km ? `${vehicle.km.toLocaleString("es-ES")} km` : "—"],
    ["Color", vehicle.color ?? "—"],
    ["VIN", vehicle.vin ?? "—"],
  ];

  return (
    <div>
      <BackLink />
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`.trim() || vehicle.plate}
        description={vehicle.plate}
        actions={
          <>
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

          {/* Photo gallery */}
          <DataCard title={`Galería de fotos (${photos.length})`}>
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

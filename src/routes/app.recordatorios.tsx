// Garage — Recordatorios de mantenimiento. Lista de recordatorios vencidos y
// próximos (por fecha y/o kilómetros), con acciones por item. Solo lectura para
// roles sin permiso de edición; el owner siempre tiene acceso total.

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Car,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  MessageCircle,
  CalendarClock,
  Gauge,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { DataCard } from "@/components/base/DataCard";
import { EmptyState } from "@/components/base/EmptyState";
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
import { ReminderFormDialog } from "@/components/app/ReminderFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo } from "@/lib/db";
import {
  dismiss,
  isReminderDue,
  listReminders,
  markDone,
  removeReminder,
  whatsappReminderUrl,
} from "@/lib/reminders";
import { canEdit } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { Customer, MaintenanceReminder, Vehicle } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/recordatorios")({
  component: RemindersPage,
});

interface Row {
  reminder: MaintenanceReminder;
  vehicle?: Vehicle;
  customer?: Customer;
  due: boolean;
}

function RemindersPage() {
  const { ready, user, tenant } = useAuth();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [editing, setEditing] = useState<MaintenanceReminder | null>(null);
  const [toDelete, setToDelete] = useState<MaintenanceReminder | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!ready || !tenant) return [];
    return listReminders(tenant.id)
      .filter((r) => r.status === "pending")
      .map((reminder) => {
        const vehicle = vehiclesRepo.getById(tenant.id, reminder.vehicleId);
        const customer = customersRepo.getById(tenant.id, reminder.customerId);
        return {
          reminder,
          vehicle,
          customer,
          due: isReminderDue(reminder, vehicle),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, version]);

  if (!tenant || !user) return null;

  const editable = canEdit(user.role, "recordatorios");
  const overdue = rows.filter((r) => r.due);
  const upcoming = rows.filter((r) => !r.due);

  const onDone = (r: MaintenanceReminder) => {
    markDone(tenant.id, r.id);
    toast.success("Recordatorio marcado como hecho");
    bump();
  };
  const onDismiss = (r: MaintenanceReminder) => {
    dismiss(tenant.id, r.id);
    toast.success("Recordatorio descartado");
    bump();
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    removeReminder(tenant.id, toDelete.id);
    toast.success("Recordatorio eliminado");
    setToDelete(null);
    bump();
  };
  const notifyCustomer = (row: Row) => {
    const url = whatsappReminderUrl({
      phone: row.customer?.phone,
      tenantName: tenant.name,
      customerName: row.customer?.name,
      vehicleLabel: row.vehicle
        ? `${row.vehicle.make} ${row.vehicle.model}`
        : undefined,
      label: row.reminder.label,
    });
    window.open(url, "_blank");
  };

  return (
    <div>
      <PageHeader
        title="Recordatorios"
        description="Próximas revisiones por fecha y kilómetros."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="Sin recordatorios"
          description="Programa la próxima revisión desde la ficha de un vehículo o de una orden entregada."
        />
      ) : (
        <div className="space-y-6">
          <DataCard
            title={`Vencidos${overdue.length ? ` (${overdue.length})` : ""}`}
            bodyClassName="p-0"
          >
            {overdue.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                No hay recordatorios vencidos.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {overdue.map((row) => (
                  <ReminderRow
                    key={row.reminder.id}
                    row={row}
                    editable={editable}
                    onDone={onDone}
                    onDismiss={onDismiss}
                    onEdit={setEditing}
                    onDelete={setToDelete}
                    onNotify={notifyCustomer}
                  />
                ))}
              </ul>
            )}
          </DataCard>

          <DataCard
            title={`Próximos${upcoming.length ? ` (${upcoming.length})` : ""}`}
            bodyClassName="p-0"
          >
            {upcoming.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                No hay recordatorios próximos.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((row) => (
                  <ReminderRow
                    key={row.reminder.id}
                    row={row}
                    editable={editable}
                    onDone={onDone}
                    onDismiss={onDismiss}
                    onEdit={setEditing}
                    onDelete={setToDelete}
                    onNotify={notifyCustomer}
                  />
                ))}
              </ul>
            )}
          </DataCard>
        </div>
      )}

      {editing && (
        <ReminderFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          tenantId={tenant.id}
          vehicleId={editing.vehicleId}
          customerId={editing.customerId}
          reminder={editing}
          onSaved={bump}
        />
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
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
              onClick={confirmDelete}
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

function ReminderRow({
  row,
  editable,
  onDone,
  onDismiss,
  onEdit,
  onDelete,
  onNotify,
}: {
  row: Row;
  editable: boolean;
  onDone: (r: MaintenanceReminder) => void;
  onDismiss: (r: MaintenanceReminder) => void;
  onEdit: (r: MaintenanceReminder) => void;
  onDelete: (r: MaintenanceReminder) => void;
  onNotify: (row: Row) => void;
}) {
  const { reminder, vehicle, customer, due } = row;

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span
        className={
          due
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
        }
      >
        <Car strokeWidth={1.5} className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {reminder.label}
          </span>
          {due && (
            <span className="rounded-md bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--destructive)]">
              Vencido
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {vehicle ? (
            <Link
              to="/app/vehiculos/$id"
              params={{ id: vehicle.id }}
              className="hover:text-foreground hover:underline"
            >
              {vehicle.make} {vehicle.model} · {vehicle.plate}
            </Link>
          ) : (
            <span>Vehículo</span>
          )}
          {customer && <span>{customer.name}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {reminder.dueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock strokeWidth={1.5} className="h-3.5 w-3.5" />
              {formatDate(reminder.dueDate)}
            </span>
          )}
          {reminder.dueKm != null && (
            <span className="inline-flex items-center gap-1">
              <Gauge strokeWidth={1.5} className="h-3.5 w-3.5" />
              {reminder.dueKm.toLocaleString("es-ES")} km
              {vehicle ? ` · actual ${vehicle.km.toLocaleString("es-ES")}` : ""}
            </span>
          )}
        </div>
        {reminder.note && (
          <p className="mt-1 text-xs text-muted-foreground">{reminder.note}</p>
        )}
      </div>

      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <MoreHorizontal strokeWidth={1.5} className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDone(reminder)}>
              <Check strokeWidth={1.5} className="h-4 w-4" />
              Marcar como hecho
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(reminder)}>
              <Pencil strokeWidth={1.5} className="h-4 w-4" />
              Posponer / editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNotify(row)}>
              <MessageCircle strokeWidth={1.5} className="h-4 w-4" />
              Avisar al cliente
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDismiss(reminder)}>
              <BellRing strokeWidth={1.5} className="h-4 w-4" />
              Descartar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(reminder)}
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
}

// Talleo — Citas (agenda). Day view with prev/next + "Hoy" + date picker, and a
// week strip on desktop. Lists the day's appointments chronologically with
// customer, vehicle, services, estimated duration and status. Bridges an
// appointment into a work order. Everything is local & simulated.

import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Car,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppointmentFormDialog } from "@/components/app/AppointmentFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { appointmentsRepo, customersRepo, vehiclesRepo } from "@/lib/db";
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentDuration,
  changeAppointmentStatus,
  createOrderFromAppointment,
  formatDuration,
  listServiceNames,
  nextAppointmentStatuses,
} from "@/lib/appointments";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Appointment,
  AppointmentStatus,
  Customer,
  Vehicle,
} from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/citas")({
  component: CitasPage,
});

// ---- date helpers (local, day-scoped) -------------------------------------

function toKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sameDay(iso: string, key: string): boolean {
  return toKey(new Date(iso)) === key;
}

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

function startOfWeek(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toKey(d);
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function longDate(key: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${key}T00:00:00`));
}

interface Enriched {
  appt: Appointment;
  customer?: Customer;
  vehicle?: Vehicle;
  services: string[];
  duration: number;
}

function CitasPage() {
  const { ready, tenant } = useAuth();
  const navigate = useNavigate();
  const todayKey = toKey(new Date());
  const [dayKey, setDayKey] = useState(todayKey);
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const dayAppointments = useMemo<Enriched[]>(() => {
    if (!ready || !tenant) return [];
    const cById = new Map<string, Customer>();
    customersRepo.list(tenant.id).forEach((c) => cById.set(c.id, c));
    const vById = new Map<string, Vehicle>();
    vehiclesRepo.list(tenant.id).forEach((v) => vById.set(v.id, v));
    return appointmentsRepo
      .list(tenant.id)
      .filter((a) => sameDay(a.scheduledAt, dayKey))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((appt) => ({
        appt,
        customer: appt.customerId ? cById.get(appt.customerId) : undefined,
        vehicle: appt.vehicleId ? vById.get(appt.vehicleId) : undefined,
        services: listServiceNames(tenant.id, appt.serviceIds),
        duration: appointmentDuration(tenant.id, appt.serviceIds),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, dayKey, version]);

  // Week counts for the desktop strip.
  const weekStart = startOfWeek(dayKey);
  const weekCounts = useMemo<Record<string, number>>(() => {
    if (!ready || !tenant) return {};
    const out: Record<string, number> = {};
    const list = appointmentsRepo.list(tenant.id);
    for (let i = 0; i < 7; i++) {
      const k = addDays(weekStart, i);
      out[k] = list.filter((a) => sameDay(a.scheduledAt, k)).length;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, weekStart, version]);

  if (!tenant) return null;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (appt: Appointment) => {
    setEditing(appt);
    setDialogOpen(true);
  };

  const changeStatus = (appt: Appointment, next: AppointmentStatus) => {
    changeAppointmentStatus(tenant, appt, next);
    setVersion((v) => v + 1);
  };

  const receiveCar = (appt: Appointment) => {
    if (!appt.customerId || !appt.vehicleId) {
      toast.error("La cita necesita cliente y vehículo para crear la orden.");
      return;
    }
    const order = createOrderFromAppointment(tenant, appt);
    if (!order) {
      toast.error("No se pudo crear la orden.");
      return;
    }
    toast.success(`Orden creada · ${order.accessCode}`);
    navigate({ to: "/app/ordenes/$id", params: { id: order.id } });
  };

  return (
    <div>
      <PageHeader
        title="Citas"
        description="Agenda diaria del taller."
        actions={
          <Button onClick={openNew}>
            <Plus strokeWidth={1.5} />
            Nueva cita
          </Button>
        }
      />

      {/* Day navigation */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border border-border">
          <button
            onClick={() => setDayKey((k) => addDays(k, -1))}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Día anterior"
          >
            <ChevronLeft strokeWidth={1.5} className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDayKey((k) => addDays(k, 1))}
            className="flex h-9 w-9 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Día siguiente"
          >
            <ChevronRight strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => setDayKey(todayKey)}
          disabled={dayKey === todayKey}
        >
          Hoy
        </Button>
        <Input
          type="date"
          value={dayKey}
          onChange={(e) => e.target.value && setDayKey(e.target.value)}
          className="h-9 w-auto"
        />
        <span className="ml-auto text-sm capitalize text-muted-foreground">
          {longDate(dayKey)}
        </span>
      </div>

      {/* Desktop week strip */}
      <div className="mb-6 hidden grid-cols-7 gap-2 md:grid">
        {Array.from({ length: 7 }).map((_, i) => {
          const k = addDays(weekStart, i);
          const active = k === dayKey;
          const isToday = k === todayKey;
          const d = new Date(`${k}T00:00:00`);
          const count = weekCounts[k] ?? 0;
          return (
            <button
              key={k}
              onClick={() => setDayKey(k)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:border-border-strong",
              )}
            >
              <span
                className={cn(
                  "text-xs",
                  active ? "text-background/70" : "text-muted-foreground",
                )}
              >
                {WEEKDAYS[i]}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tracking-tight",
                  isToday && !active && "text-[var(--talleo-accent)]",
                )}
              >
                {d.getDate()}
              </span>
              <span
                className={cn(
                  "text-xs",
                  active ? "text-background/70" : "text-muted-foreground",
                )}
              >
                {count > 0 ? `${count} cita${count > 1 ? "s" : ""}` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day list */}
      {dayAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin citas este día"
          description="No hay citas programadas para la fecha seleccionada."
          action={
            <Button onClick={openNew}>
              <Plus strokeWidth={1.5} />
              Nueva cita
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {dayAppointments.map((e) => (
            <AppointmentCard
              key={e.appt.id}
              enriched={e}
              onEdit={() => openEdit(e.appt)}
              onChangeStatus={(s) => changeStatus(e.appt, s)}
              onReceive={() => receiveCar(e.appt)}
              onOpenOrder={() =>
                e.appt.workOrderId &&
                navigate({
                  to: "/app/ordenes/$id",
                  params: { id: e.appt.workOrderId },
                })
              }
            />
          ))}
        </div>
      )}

      <AppointmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={tenant}
        appointment={editing}
        defaultDate={dayKey}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

function AppointmentCard({
  enriched,
  onEdit,
  onChangeStatus,
  onReceive,
  onOpenOrder,
}: {
  enriched: Enriched;
  onEdit: () => void;
  onChangeStatus: (s: AppointmentStatus) => void;
  onReceive: () => void;
  onOpenOrder: () => void;
}) {
  const { appt, customer, vehicle, services, duration } = enriched;
  const transitions = nextAppointmentStatuses(appt.status);
  const canReceive = !!customer && !!vehicle;

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground">
          <Clock strokeWidth={1.5} className="h-4 w-4 text-muted-foreground" />
          <span className="text-base font-semibold tracking-tight">
            {formatTime(appt.scheduledAt)}
          </span>
        </div>
        <StatusBadge status={appt.status} />
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="font-medium text-foreground">
          {customer?.name ?? "Sin cliente"}
        </p>
        <p className="text-sm text-muted-foreground">
          {vehicle
            ? `${vehicle.make} ${vehicle.model} · `
            : "Sin vehículo"}
          {vehicle && (
            <span className="font-mono text-xs">{vehicle.plate}</span>
          )}
        </p>
      </div>

      {services.length > 0 && (
        <p className="mt-2 text-sm text-foreground">{services.join(", ")}</p>
      )}
      {duration > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Duración estimada: {formatDuration(duration)}
        </p>
      )}
      {appt.notes && (
        <p className="mt-2 text-sm text-muted-foreground">{appt.notes}</p>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
          <Pencil strokeWidth={1.5} className="h-3.5 w-3.5" />
          Editar
        </Button>

        {transitions.length > 0 && (
          <Select value="" onValueChange={(v) => onChangeStatus(v as AppointmentStatus)}>
            <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              {transitions.map((s) => (
                <SelectItem key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {appt.workOrderId ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8"
            onClick={onOpenOrder}
          >
            Ver orden
            <ArrowRight strokeWidth={1.5} className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="ml-auto h-8"
            onClick={onReceive}
            disabled={!canReceive}
            title={
              canReceive
                ? undefined
                : "La cita necesita cliente y vehículo"
            }
          >
            <Car strokeWidth={1.5} className="h-3.5 w-3.5" />
            Recibir coche
          </Button>
        )}
      </div>
    </div>
  );
}

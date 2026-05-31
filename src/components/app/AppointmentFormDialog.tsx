// Talleo — create/edit appointment dialog. Customer + vehicle are optional and
// reuse the searchable EntityCombobox. Services are a multi-select from the
// catalog. Date & time use native inputs (mobile-first, predictable in dialogs).

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EntityCombobox } from "@/components/app/EntityCombobox";
import { customersRepo, servicesRepo, vehiclesRepo } from "@/lib/db";
import {
  appointmentDuration,
  createAppointment,
  formatDuration,
  updateAppointment,
} from "@/lib/appointments";
import { formatCurrency } from "@/lib/format";
import type { Appointment, Tenant } from "@/types";
import { toast } from "sonner";

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant;
  /** When set, the dialog edits this appointment instead of creating one. */
  appointment?: Appointment | null;
  /** Default date (yyyy-mm-dd) for new appointments. */
  defaultDate?: string;
  onSaved?: () => void;
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  tenant,
  appointment,
  defaultDate,
  onSaved,
}: AppointmentFormDialogProps) {
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const customers = useMemo(
    () => (open ? customersRepo.list(tenant.id) : []),
    [open, tenant.id],
  );
  const allVehicles = useMemo(
    () => (open ? vehiclesRepo.list(tenant.id) : []),
    [open, tenant.id],
  );
  const services = useMemo(
    () => (open ? servicesRepo.list(tenant.id) : []),
    [open, tenant.id],
  );

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      const { date: d, time: t } = splitDateTime(appointment.scheduledAt);
      setCustomerId(appointment.customerId ?? "");
      setVehicleId(appointment.vehicleId ?? "");
      setServiceIds(appointment.serviceIds ?? []);
      setDate(d);
      setTime(t);
      setNotes(appointment.notes ?? "");
    } else {
      setCustomerId("");
      setVehicleId("");
      setServiceIds([]);
      setDate(defaultDate ?? splitDateTime(new Date().toISOString()).date);
      setTime("09:00");
      setNotes("");
    }
    setError("");
  }, [open, appointment, defaultDate]);

  const vehiclesForCustomer = customerId
    ? allVehicles.filter((v) => v.customerId === customerId)
    : allVehicles;

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
    sub: c.phone,
  }));
  const vehicleOptions = vehiclesForCustomer.map((v) => ({
    value: v.id,
    label: `${v.make} ${v.model}`.trim() || v.plate,
    sub: v.plate,
  }));

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const duration = appointmentDuration(tenant.id, serviceIds);

  const submit = () => {
    setError("");
    if (!date || !time) {
      setError("Indica fecha y hora.");
      return;
    }
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const payload = {
      customerId: customerId || undefined,
      vehicleId: vehicleId || undefined,
      serviceIds,
      scheduledAt,
      notes,
    };

    if (appointment) {
      updateAppointment(tenant.id, appointment.id, payload);
      toast.success("Cita actualizada");
    } else {
      createAppointment(tenant, payload);
      toast.success("Cita creada");
    }
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? "Editar cita" : "Nueva cita"}</DialogTitle>
          <DialogDescription>
            Cliente y vehículo son opcionales. Selecciona los servicios del
            catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <EntityCombobox
              options={customerOptions}
              value={customerId}
              onChange={(v) => {
                setCustomerId(v);
                setVehicleId("");
              }}
              placeholder="Sin cliente"
              emptyText="No hay clientes"
            />
          </div>

          {/* Vehicle */}
          <div className="space-y-1.5">
            <Label>Vehículo</Label>
            <EntityCombobox
              options={vehicleOptions}
              value={vehicleId}
              onChange={setVehicleId}
              placeholder={
                customerId ? "Seleccionar vehículo…" : "Sin vehículo"
              }
              emptyText="Sin vehículos para este cliente"
            />
          </div>

          {/* Date & time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-date">Fecha *</Label>
              <Input
                id="a-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-time">Hora *</Label>
              <Input
                id="a-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Services */}
          <div className="space-y-1.5">
            <Label>Servicios</Label>
            <div className="space-y-1.5 rounded-lg border border-border p-2">
              {services.length === 0 && (
                <p className="px-1 py-2 text-sm text-muted-foreground">
                  No hay servicios en el catálogo.
                </p>
              )}
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <Checkbox
                    checked={serviceIds.includes(s.id)}
                    onCheckedChange={() => toggleService(s.id)}
                  />
                  <span className="flex-1 text-sm text-foreground">
                    {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.estimatedMinutes} min ·{" "}
                    {formatCurrency(s.basePrice, tenant.currency)}
                  </span>
                </label>
              ))}
            </div>
            {duration > 0 && (
              <p className="text-xs text-muted-foreground">
                Duración estimada: {formatDuration(duration)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="a-notes">Notas</Label>
            <Textarea
              id="a-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional…"
              maxLength={600}
            />
          </div>

          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            {appointment ? "Guardar cambios" : "Crear cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

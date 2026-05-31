// Talleo — create/edit vehicle dialog. Writes go through vehiclesRepo.
// The owner can be locked (when adding from a customer profile).

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
import { EntityCombobox } from "@/components/app/EntityCombobox";
import { customersRepo, vehiclesRepo } from "@/lib/db";
import type { Vehicle } from "@/types";
import { toast } from "sonner";

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  vehicle?: Vehicle | null;
  lockedCustomerId?: string;
  defaultCustomerId?: string;
  onSaved?: (vehicle: Vehicle) => void;
}

interface FormState {
  customerId: string;
  plate: string;
  make: string;
  model: string;
  year: string;
  km: string;
  vin: string;
  color: string;
  notes: string;
}

const EMPTY: FormState = {
  customerId: "",
  plate: "",
  make: "",
  model: "",
  year: "",
  km: "",
  vin: "",
  color: "",
  notes: "",
};

export function VehicleFormDialog({
  open,
  onOpenChange,
  tenantId,
  vehicle,
  lockedCustomerId,
  defaultCustomerId,
  onSaved,
}: VehicleFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );

  const customers = useMemo(
    () => (open ? customersRepo.list(tenantId) : []),
    [open, tenantId],
  );

  useEffect(() => {
    if (!open) return;
    if (vehicle) {
      setForm({
        customerId: vehicle.customerId,
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        year: String(vehicle.year ?? ""),
        km: String(vehicle.km ?? ""),
        vin: vehicle.vin ?? "",
        color: vehicle.color ?? "",
        notes: vehicle.notes ?? "",
      });
    } else {
      setForm({
        ...EMPTY,
        customerId: lockedCustomerId ?? defaultCustomerId ?? "",
      });
    }
    setErrors({});
  }, [open, vehicle, lockedCustomerId, defaultCustomerId]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.customerId) next.customerId = "Selecciona un dueño.";
    if (!form.plate.trim()) next.plate = "La matrícula es obligatoria.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      customerId: form.customerId,
      plate: form.plate.trim().toUpperCase(),
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year) || 0,
      km: Number(form.km) || 0,
      vin: form.vin.trim() || undefined,
      color: form.color.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    let saved: Vehicle | undefined;
    if (vehicle) {
      saved = vehiclesRepo.update(tenantId, vehicle.id, payload);
      toast.success("Vehículo actualizado");
    } else {
      saved = vehiclesRepo.create(tenantId, {
        tenantId,
        ...payload,
      } as Omit<Vehicle, "id">);
      toast.success("Vehículo creado");
    }
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
    sub: c.phone,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Actualiza los datos del vehículo."
              : "Registra un vehículo y vincúlalo a su dueño."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Dueño *</Label>
            {lockedCustomerId ? (
              <Input
                value={
                  customers.find((c) => c.id === lockedCustomerId)?.name ?? "—"
                }
                disabled
              />
            ) : (
              <EntityCombobox
                options={customerOptions}
                value={form.customerId}
                onChange={(v) => set("customerId", v)}
                placeholder="Seleccionar cliente…"
                emptyText="No hay clientes"
              />
            )}
            {errors.customerId && (
              <p className="text-xs text-[var(--destructive)]">
                {errors.customerId}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="v-plate">Matrícula *</Label>
              <Input
                id="v-plate"
                value={form.plate}
                onChange={(e) => set("plate", e.target.value)}
                placeholder="1234 ABC"
                maxLength={15}
              />
              {errors.plate && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.plate}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-color">Color</Label>
              <Input
                id="v-color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="Gris"
                maxLength={30}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="v-make">Marca</Label>
              <Input
                id="v-make"
                value={form.make}
                onChange={(e) => set("make", e.target.value)}
                placeholder="Seat"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-model">Modelo</Label>
              <Input
                id="v-model"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder="León"
                maxLength={40}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="v-year">Año</Label>
              <Input
                id="v-year"
                type="number"
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
                placeholder="2020"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-km">Kilómetros</Label>
              <Input
                id="v-km"
                type="number"
                value={form.km}
                onChange={(e) => set("km", e.target.value)}
                placeholder="80000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-vin">VIN</Label>
            <Input
              id="v-vin"
              value={form.vin}
              onChange={(e) => set("vin", e.target.value)}
              placeholder="Número de bastidor (opcional)"
              maxLength={30}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-notes">Notas</Label>
            <Textarea
              id="v-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Información adicional…"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{vehicle ? "Guardar" : "Crear vehículo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Talleo — create/edit service dialog. All writes go through servicesRepo.

import { useEffect, useState } from "react";
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
import { servicesRepo } from "@/lib/db";
import type { Service } from "@/types";
import { toast } from "sonner";

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  service?: Service | null;
  onSaved?: (service: Service) => void;
}

interface FormState {
  name: string;
  basePrice: string;
  estimatedMinutes: string;
}

const EMPTY: FormState = { name: "", basePrice: "", estimatedMinutes: "" };

export function ServiceFormDialog({
  open,
  onOpenChange,
  tenantId,
  service,
  onSaved,
}: ServiceFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  useEffect(() => {
    if (!open) return;
    if (service) {
      setForm({
        name: service.name,
        basePrice: String(service.basePrice),
        estimatedMinutes: String(service.estimatedMinutes),
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, service]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    const price = Number(form.basePrice);
    if (form.basePrice === "" || Number.isNaN(price) || price < 0)
      next.basePrice = "Introduce un precio válido.";
    const minutes = Number(form.estimatedMinutes);
    if (
      form.estimatedMinutes === "" ||
      Number.isNaN(minutes) ||
      minutes < 0
    )
      next.estimatedMinutes = "Introduce un tiempo válido.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: form.name.trim(),
      basePrice: Math.round(price),
      estimatedMinutes: Math.round(minutes),
    };

    let saved: Service | undefined;
    if (service) {
      saved = servicesRepo.update(tenantId, service.id, payload);
      toast.success("Servicio actualizado");
    } else {
      saved = servicesRepo.create(tenantId, {
        tenantId,
        ...payload,
      } as Omit<Service, "id">);
      toast.success("Servicio creado");
    }
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          <DialogDescription>
            {service
              ? "Actualiza los datos del servicio."
              : "Añade un servicio al catálogo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Nombre *</Label>
            <Input
              id="s-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Cambio de aceite y filtro"
              maxLength={120}
            />
            {errors.name && (
              <p className="text-xs text-[var(--destructive)]">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-price">Precio base *</Label>
              <Input
                id="s-price"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.basePrice}
                onChange={(e) => set("basePrice", e.target.value)}
                placeholder="0"
              />
              {errors.basePrice && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.basePrice}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-minutes">Tiempo estimado (min) *</Label>
              <Input
                id="s-minutes"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.estimatedMinutes}
                onChange={(e) => set("estimatedMinutes", e.target.value)}
                placeholder="60"
              />
              {errors.estimatedMinutes && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.estimatedMinutes}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{service ? "Guardar" : "Crear servicio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

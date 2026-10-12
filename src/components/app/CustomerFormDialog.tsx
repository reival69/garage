// Garage — create/edit customer dialog. All writes go through customersRepo.

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
import { Textarea } from "@/components/ui/textarea";
import { customersRepo } from "@/lib/db";
import type { Customer } from "@/types";
import { toast } from "sonner";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  customer?: Customer | null;
  defaultName?: string;
  onSaved?: (customer: Customer) => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY: FormState = { name: "", phone: "", email: "", notes: "" };

export function CustomerFormDialog({
  open,
  onOpenChange,
  tenantId,
  customer,
  defaultName,
  onSaved,
}: CustomerFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? "",
        notes: customer.notes ?? "",
      });
    } else {
      setForm({ ...EMPTY, name: defaultName ?? "" });
    }
    setErrors({});
  }, [open, customer, defaultName]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    if (!form.phone.trim()) next.phone = "El teléfono es obligatorio.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    let saved: Customer | undefined;
    if (customer) {
      saved = customersRepo.update(tenantId, customer.id, payload);
      toast.success("Cliente actualizado");
    } else {
      saved = customersRepo.create(tenantId, {
        tenantId,
        ...payload,
        createdAt: new Date().toISOString(),
      } as Omit<Customer, "id">);
      toast.success("Cliente creado");
    }
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {customer
              ? "Actualiza los datos de contacto."
              : "Añade un nuevo cliente al taller."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Nombre *</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nombre y apellidos"
              maxLength={120}
            />
            {errors.name && (
              <p className="text-xs text-[var(--destructive)]">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Teléfono *</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="600 000 000"
                maxLength={30}
              />
              {errors.phone && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.phone}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="cliente@email.es"
                maxLength={150}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notas</Label>
            <Textarea
              id="c-notes"
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
          <Button onClick={submit}>{customer ? "Guardar" : "Crear cliente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

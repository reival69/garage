// Talleo — create/edit part dialog. All writes go through partsRepo.

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
import { partsRepo } from "@/lib/db";
import type { Part } from "@/types";
import { toast } from "sonner";

interface PartFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  part?: Part | null;
  onSaved?: (part: Part) => void;
}

interface FormState {
  name: string;
  price: string;
  sku: string;
}

const EMPTY: FormState = { name: "", price: "", sku: "" };

export function PartFormDialog({
  open,
  onOpenChange,
  tenantId,
  part,
  onSaved,
}: PartFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  useEffect(() => {
    if (!open) return;
    if (part) {
      setForm({
        name: part.name,
        price: String(part.price),
        sku: part.sku ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, part]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    const price = Number(form.price);
    if (form.price === "" || Number.isNaN(price) || price < 0)
      next.price = "Introduce un precio válido.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: form.name.trim(),
      price: Math.round(price),
      sku: form.sku.trim() || undefined,
    };

    let saved: Part | undefined;
    if (part) {
      saved = partsRepo.update(tenantId, part.id, payload);
      toast.success("Repuesto actualizado");
    } else {
      saved = partsRepo.create(tenantId, {
        tenantId,
        ...payload,
      } as Omit<Part, "id">);
      toast.success("Repuesto creado");
    }
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{part ? "Editar repuesto" : "Nuevo repuesto"}</DialogTitle>
          <DialogDescription>
            {part
              ? "Actualiza los datos del repuesto."
              : "Añade un repuesto al catálogo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre *</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Filtro de aceite"
              maxLength={120}
            />
            {errors.name && (
              <p className="text-xs text-[var(--destructive)]">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Precio *</Label>
              <Input
                id="p-price"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0"
              />
              {errors.price && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.price}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="Opcional"
                maxLength={60}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{part ? "Guardar" : "Crear repuesto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Talleo — create/edit maintenance reminder dialog. All writes go through the
// reminders helpers (remindersRepo under the hood). A reminder must have a label
// plus at least one trigger: a due date and/or a target odometer reading.

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
import { createReminder, updateReminder } from "@/lib/reminders";
import type { MaintenanceReminder } from "@/types";
import { toast } from "sonner";

interface ReminderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  vehicleId: string;
  customerId: string;
  reminder?: MaintenanceReminder | null;
  onSaved?: () => void;
}

interface FormState {
  label: string;
  dueDate: string;
  dueKm: string;
  note: string;
}

const EMPTY: FormState = { label: "", dueDate: "", dueKm: "", note: "" };

export function ReminderFormDialog({
  open,
  onOpenChange,
  tenantId,
  vehicleId,
  customerId,
  reminder,
  onSaved,
}: ReminderFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState> & { trigger?: string }>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    if (reminder) {
      setForm({
        label: reminder.label,
        dueDate: reminder.dueDate ? reminder.dueDate.slice(0, 10) : "",
        dueKm: reminder.dueKm != null ? String(reminder.dueKm) : "",
        note: reminder.note ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, reminder]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const next: Partial<FormState> & { trigger?: string } = {};
    if (!form.label.trim()) next.label = "Indica de qué es el recordatorio.";

    let km: number | undefined;
    if (form.dueKm.trim() !== "") {
      const n = Number(form.dueKm);
      if (Number.isNaN(n) || n < 0) next.dueKm = "Introduce un kilometraje válido.";
      else km = Math.round(n);
    }
    if (!form.dueDate && km == null && !next.dueKm) {
      next.trigger = "Añade una fecha y/o un kilometraje objetivo.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (reminder) {
      updateReminder(tenantId, reminder.id, {
        label: form.label.trim(),
        dueDate: form.dueDate || undefined,
        dueKm: km,
        note: form.note.trim() || undefined,
        // Re-arm the notification when the trigger is edited.
        notified: false,
        status: "pending",
      });
      toast.success("Recordatorio actualizado");
    } else {
      createReminder(tenantId, {
        vehicleId,
        customerId,
        label: form.label.trim(),
        dueDate: form.dueDate || undefined,
        dueKm: km,
        note: form.note.trim() || undefined,
      });
      toast.success("Recordatorio creado");
    }
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {reminder ? "Editar recordatorio" : "Programar recordatorio"}
          </DialogTitle>
          <DialogDescription>
            Avisaremos al taller cuando llegue la fecha o el kilometraje.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-label">Recordatorio *</Label>
            <Input
              id="r-label"
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="Cambio de aceite"
              maxLength={120}
            />
            {errors.label && (
              <p className="text-xs text-[var(--destructive)]">{errors.label}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-date">Fecha objetivo</Label>
              <Input
                id="r-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-km">Kilómetros objetivo</Label>
              <Input
                id="r-km"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.dueKm}
                onChange={(e) => set("dueKm", e.target.value)}
                placeholder="120000"
              />
              {errors.dueKm && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.dueKm}
                </p>
              )}
            </div>
          </div>
          {errors.trigger && (
            <p className="text-xs text-[var(--destructive)]">{errors.trigger}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="r-note">Nota</Label>
            <Textarea
              id="r-note"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Detalles opcionales…"
              maxLength={300}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            {reminder ? "Guardar" : "Crear recordatorio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

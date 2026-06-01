// Talleo — create/edit vehicle document dialog. Captures the document type,
// optional custom name (for "otro"), expiry date, note and an optional
// compressed image. All writes go through the documents helpers; everything is
// local & simulated.

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/image";
import {
  DOCUMENT_TYPES,
  addVehicleDocument,
  updateVehicleDocument,
} from "@/lib/documents";
import type { VehicleDocument, VehicleDocumentType } from "@/types";
import { toast } from "sonner";

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  vehicleId: string;
  document?: VehicleDocument | null;
  onSaved?: () => void;
}

interface FormState {
  type: VehicleDocumentType;
  label: string;
  expiryDate: string;
  note: string;
  fileBase64?: string;
  fileName?: string;
}

const EMPTY: FormState = {
  type: "itv",
  label: "",
  expiryDate: "",
  note: "",
  fileBase64: undefined,
  fileName: undefined,
};

export function DocumentFormDialog({
  open,
  onOpenChange,
  tenantId,
  vehicleId,
  document,
  onSaved,
}: DocumentFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{ label?: string }>({});
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (document) {
      setForm({
        type: document.type,
        label: document.label ?? "",
        expiryDate: document.expiryDate ? document.expiryDate.slice(0, 10) : "",
        note: document.note ?? "",
        fileBase64: document.fileBase64,
        fileName: document.fileName,
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, document]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await compressImage(file);
      setForm((f) => ({ ...f, fileBase64: url, fileName: file.name }));
    } catch {
      toast.error("No se pudo procesar la imagen.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (form.type === "otro" && !form.label.trim()) {
      setErrors({ label: "Indica el nombre del documento." });
      return;
    }
    const input = {
      type: form.type,
      label: form.label.trim() || undefined,
      expiryDate: form.expiryDate || undefined,
      note: form.note.trim() || undefined,
      fileBase64: form.fileBase64,
      fileName: form.fileName,
    };
    if (document) {
      updateVehicleDocument(tenantId, vehicleId, document.id, input);
      toast.success("Documento actualizado");
    } else {
      addVehicleDocument(tenantId, vehicleId, input);
      toast.success("Documento añadido");
    }
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {document ? "Editar documento" : "Añadir documento"}
          </DialogTitle>
          <DialogDescription>
            Guarda la fecha de caducidad y, si quieres, una foto del documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-type">Tipo *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set("type", v as VehicleDocumentType)}
              >
                <SelectTrigger id="d-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-date">Fecha de caducidad</Label>
              <Input
                id="d-date"
                type="date"
                value={form.expiryDate}
                onChange={(e) => set("expiryDate", e.target.value)}
              />
            </div>
          </div>

          {form.type === "otro" && (
            <div className="space-y-1.5">
              <Label htmlFor="d-label">Nombre del documento *</Label>
              <Input
                id="d-label"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="p. ej. Garantía del fabricante"
                maxLength={120}
              />
              {errors.label && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.label}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="d-note">Nota</Label>
            <Textarea
              id="d-note"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Detalles opcionales…"
              maxLength={300}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Imagen del documento</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            {form.fileBase64 ? (
              <div className="flex items-center gap-3">
                <img
                  src={form.fileBase64}
                  alt={form.fileName ?? "Documento"}
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--destructive)]"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      fileBase64: undefined,
                      fileName: undefined,
                    }))
                  }
                >
                  <Trash2 strokeWidth={1.5} />
                  Quitar imagen
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? (
                  <Loader2 strokeWidth={1.5} className="animate-spin" />
                ) : (
                  <Camera strokeWidth={1.5} />
                )}
                Subir imagen
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{document ? "Guardar" : "Añadir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Garage — upload / edit a Biblioteca PDF. Upload extracts the text in the
// browser (pdf.js) with a progress bar. All writes go through lib/library.

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIBRARY_CATEGORIES,
  MAX_PDF_BYTES,
  addLibraryDocument,
  formatBytes,
  updateLibraryDocument,
  type UploadProgress,
} from "@/lib/library";
import type { LibraryCategory, LibraryDocument } from "@/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userName?: string;
  doc?: LibraryDocument | null; // edit mode when present
  onSaved?: () => void;
}

interface FormState {
  title: string;
  category: LibraryCategory;
  make: string;
  model: string;
  engine: string;
  yearFrom: string;
  yearTo: string;
}

const EMPTY: FormState = {
  title: "",
  category: "manual_taller",
  make: "",
  model: "",
  engine: "",
  yearFrom: "",
  yearTo: "",
};

// Reading pages = first 70 % of the bar, uploading = the rest.
function progressPercent(p: UploadProgress): number {
  if (p.stage === "read") return p.total ? (p.done / p.total) * 70 : 3;
  return 70 + p.fraction * 30;
}

function progressLabel(p: UploadProgress): string {
  if (p.stage === "upload") {
    return p.fraction >= 1 ? "Guardando…" : `Subiendo al servidor… ${Math.round(p.fraction * 100)} %`;
  }
  return p.total ? `Leyendo página ${p.done} de ${p.total}…` : "Abriendo PDF…";
}

const toYear = (v: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : undefined;
};

export function LibraryDocFormDialog({
  open,
  onOpenChange,
  tenantId,
  userName,
  doc,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  useEffect(() => {
    if (!open) return;
    setForm(
      doc
        ? {
            title: doc.title,
            category: doc.category,
            make: doc.make ?? "",
            model: doc.model ?? "",
            engine: doc.engine ?? "",
            yearFrom: doc.yearFrom ? String(doc.yearFrom) : "",
            yearTo: doc.yearTo ? String(doc.yearTo) : "",
          }
        : EMPTY,
    );
    setFile(null);
    setAccepted(false);
    setError(null);
    setProgress(null);
  }, [open, doc]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickFile = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setError("Solo se admiten archivos PDF.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError(`El PDF pesa ${formatBytes(f.size)}; el máximo es 60 MB.`);
      return;
    }
    setFile(f);
    if (!form.title) set("title", f.name.replace(/\.pdf$/i, ""));
  };

  const meta = () => ({
    title: form.title,
    category: form.category,
    make: form.make,
    model: form.model,
    engine: form.engine,
    yearFrom: toYear(form.yearFrom),
    yearTo: toYear(form.yearTo),
  });

  const submit = async () => {
    if (doc) {
      updateLibraryDocument(tenantId, doc.id, meta());
      toast.success("Documento actualizado");
      onSaved?.();
      onOpenChange(false);
      return;
    }
    if (!file) return setError("Elige un PDF.");
    if (!accepted) return setError("Confirma que tienes derecho a usar este documento.");
    setError(null);
    setProgress({ stage: "read", done: 0, total: 0 });
    try {
      const saved = await addLibraryDocument(tenantId, file, meta(), userName, setProgress);
      if (saved.textPages === 0) {
        toast.warning("PDF subido, pero no tiene texto buscable", {
          description: "Parece un documento escaneado. Se puede abrir, pero no aparecerá en las búsquedas.",
        });
      } else {
        toast.success(`«${saved.title}» añadido`, {
          description: `${saved.pageCount} páginas indexadas.`,
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message
          ? `No se pudo procesar el PDF: ${err.message}`
          : "No se pudo procesar el PDF.",
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc ? "Editar documento" : "Subir PDF"}</DialogTitle>
          <DialogDescription>
            {doc
              ? "Cambia el título, el tipo o el vehículo al que aplica."
              : "Se guarda en el servidor de tu taller y podrás buscar dentro desde cualquier dispositivo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!doc && (
            <div className="space-y-1.5">
              <Label>Archivo PDF *</Label>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-left text-sm transition-colors hover:border-border-strong disabled:opacity-60"
              >
                <FileUp strokeWidth={1.5} className="h-5 w-5 shrink-0 text-muted-foreground" />
                {file ? (
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Elige un PDF (máx. 60 MB)</span>
                )}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lib-title">Título</Label>
            <Input
              id="lib-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Manual de taller Peugeot 308"
              maxLength={140}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v)}
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIBRARY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="space-y-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs text-muted-foreground">
              Vehículo al que aplica (opcional; sirve para sugerirlo en las órdenes)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lib-make">Marca</Label>
                <Input id="lib-make" value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="Peugeot" maxLength={40} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lib-model">Modelo</Label>
                <Input id="lib-model" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="308" maxLength={40} disabled={busy} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="lib-engine">Motor</Label>
                <Input id="lib-engine" value={form.engine} onChange={(e) => set("engine", e.target.value)} placeholder="1.6 HDi" maxLength={40} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lib-yf">Desde año</Label>
                <Input id="lib-yf" type="number" inputMode="numeric" value={form.yearFrom} onChange={(e) => set("yearFrom", e.target.value)} placeholder="2013" disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lib-yt">Hasta año</Label>
                <Input id="lib-yt" type="number" inputMode="numeric" value={form.yearTo} onChange={(e) => set("yearTo", e.target.value)} placeholder="2021" disabled={busy} />
              </div>
            </div>
          </fieldset>

          {!doc && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                disabled={busy}
                className="mt-0.5"
              />
              <span>
                Confirmo que este taller tiene derecho a usar este documento. La biblioteca es privada
                de tu taller y no se comparte con nadie.
              </span>
            </label>
          )}

          {progress && (
            <div className="space-y-1.5">
              <Progress value={progressPercent(progress)} />
              <p className="text-xs text-muted-foreground">{progressLabel(progress)}</p>
            </div>
          )}

          {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {doc ? "Guardar" : busy ? "Procesando…" : "Subir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

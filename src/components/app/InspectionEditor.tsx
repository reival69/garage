// Talleo — módulo de inspección digital (DVI) dentro de la ficha de orden.
// Plantilla multipunto con selector semáforo (ok / atención / crítico), nota y
// foto opcional por punto, puntos personalizables y resumen de recuento. Todo
// pasa por src/lib/inspection.ts; mobile-first, monocromático salvo el semáforo.

import { useMemo, useRef, useState } from "react";
import {
  ScanLine,
  Plus,
  Trash2,
  Camera,
  Loader2,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { DataCard } from "@/components/base/DataCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { workOrdersRepo } from "@/lib/db";
import {
  addDetailPhoto,
  inspectionSummary,
  removeDetailPhoto,
  saveInspection,
  startInspection,
  makeInspectionItem,
} from "@/lib/inspection";
import { formatDateTime } from "@/lib/format";
import type {
  Inspection,
  InspectionItem,
  Photo,
  Tenant,
  WorkOrder,
} from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Status = InspectionItem["status"];

const SEMAPHORE: Array<{
  value: Status;
  label: string;
  icon: typeof Check;
  color: string;
}> = [
  { value: "ok", label: "OK", icon: Check, color: "var(--success)" },
  { value: "atencion", label: "Atención", icon: AlertTriangle, color: "var(--warning)" },
  { value: "critico", label: "Crítico", icon: X, color: "var(--destructive)" },
];

export function InspectionEditor({
  order,
  tenant,
  onSaved,
}: {
  order: WorkOrder;
  tenant: Tenant;
  onSaved: () => void;
}) {
  // Local draft is the source of truth while editing; persisted on changes.
  const [items, setItems] = useState<InspectionItem[] | null>(
    () => order.inspection?.items ?? null,
  );
  const [createdAt, setCreatedAt] = useState<string | null>(
    () => order.inspection?.createdAt ?? null,
  );
  const [photos, setPhotos] = useState<Photo[]>(() => order.photos);

  const refreshPhotos = () => {
    const fresh = workOrdersRepo.getById(tenant.id, order.id);
    if (fresh) setPhotos(fresh.photos);
  };

  const persist = (nextItems: InspectionItem[], ts: string) => {
    const inspection: Inspection = { items: nextItems, createdAt: ts };
    saveInspection(tenant.id, order.id, inspection);
  };

  const start = () => {
    const { inspection } = startInspection(tenant.id, order.id);
    setItems(inspection.items);
    setCreatedAt(inspection.createdAt);
    toast.success("Inspección iniciada");
    onSaved();
  };

  const summary = useMemo(
    () => inspectionSummary(items ?? []),
    [items],
  );

  if (!items || !createdAt) {
    return (
      <DataCard title="Inspección (DVI)">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <ScanLine strokeWidth={1.5} className="h-8 w-8 text-foreground-subtle" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Inicia una inspección multipunto para revisar el estado del vehículo
            con su semáforo, notas y fotos.
          </p>
          <Button onClick={start}>
            <ScanLine strokeWidth={1.5} />
            Iniciar inspección
          </Button>
        </div>
      </DataCard>
    );
  }

  const updateItem = (id: string, patch: Partial<InspectionItem>) => {
    setItems((prev) => {
      const next = (prev ?? []).map((it) =>
        it.id === id ? { ...it, ...patch } : it,
      );
      persist(next, createdAt);
      return next;
    });
  };

  const addCustom = () => {
    setItems((prev) => {
      const next = [...(prev ?? []), makeInspectionItem("Punto personalizado")];
      persist(next, createdAt);
      return next;
    });
    toast.success("Punto añadido");
  };

  const removeItem = (item: InspectionItem) => {
    if (item.photoId) removeDetailPhoto(tenant.id, order.id, item.photoId);
    setItems((prev) => {
      const next = (prev ?? []).filter((it) => it.id !== item.id);
      persist(next, createdAt);
      return next;
    });
    refreshPhotos();
    onSaved();
  };

  const onPhotoPicked = async (item: InspectionItem, file: File) => {
    try {
      const photoId = await addDetailPhoto(tenant.id, order.id, file);
      if (!photoId) {
        toast.error("No se pudo añadir la foto.");
        return;
      }
      // If replacing an existing photo, drop the old one.
      if (item.photoId) removeDetailPhoto(tenant.id, order.id, item.photoId);
      updateItem(item.id, { photoId });
      refreshPhotos();
      onSaved();
      toast.success("Foto añadida");
    } catch {
      toast.error("No se pudo procesar la imagen.");
    }
  };

  const handleSave = () => {
    persist(items, createdAt);
    onSaved();
    toast.success("Inspección guardada");
  };

  return (
    <DataCard
      title="Inspección (DVI)"
      actions={
        <Button size="sm" variant="outline" onClick={addCustom}>
          <Plus strokeWidth={1.5} />
          Añadir punto
        </Button>
      }
    >
      {/* Summary card */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="OK" count={summary.ok} color="var(--success)" />
        <SummaryTile
          label="Atención"
          count={summary.atencion}
          color="var(--warning)"
        />
        <SummaryTile
          label="Crítico"
          count={summary.critico}
          color="var(--destructive)"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Iniciada el {formatDateTime(createdAt)} · {summary.total}{" "}
        {summary.total === 1 ? "punto" : "puntos"}
      </p>

      {/* Points */}
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <InspectionRow
            key={item.id}
            item={item}
            photoUrl={
              item.photoId
                ? photos.find((p) => p.id === item.photoId)?.url
                : undefined
            }
            onName={(name) => updateItem(item.id, { name })}
            onStatus={(status) => updateItem(item.id, { status })}
            onNote={(note) => updateItem(item.id, { note })}
            onPhoto={(file) => onPhotoPicked(item, file)}
            onRemove={() => removeItem(item)}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Button size="sm" onClick={handleSave}>
          Guardar inspección
        </Button>
      </div>
    </DataCard>
  );
}

function SummaryTile({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-foreground">{count}</p>
    </div>
  );
}

function InspectionRow({
  item,
  photoUrl,
  onName,
  onStatus,
  onNote,
  onPhoto,
  onRemove,
}: {
  item: InspectionItem;
  photoUrl?: string;
  onName: (name: string) => void;
  onStatus: (status: Status) => void;
  onNote: (note: string) => void;
  onPhoto: (file: File) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await onPhoto(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim();
            if (v && v !== item.name) onName(v);
            else setName(item.name);
          }}
          className="h-9 flex-1"
          maxLength={60}
          aria-label="Nombre del punto"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-[var(--destructive)]"
          onClick={onRemove}
          aria-label="Eliminar punto"
        >
          <Trash2 strokeWidth={1.5} className="h-4 w-4" />
        </Button>
      </div>

      {/* Traffic-light selector — large touch targets */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {SEMAPHORE.map((s) => {
          const active = item.status === s.value;
          const Icon = s.icon;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onStatus(s.value)}
              aria-pressed={active}
              className={cn(
                "flex h-12 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                active
                  ? "text-[color:var(--btn-color)]"
                  : "border-border text-muted-foreground hover:bg-background-muted",
              )}
              style={
                active
                  ? ({
                      borderColor: s.color,
                      backgroundColor: `color-mix(in oklab, ${s.color} 12%, transparent)`,
                      "--btn-color": s.color,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <Icon strokeWidth={1.5} className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Note */}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (note !== (item.note ?? "")) onNote(note.trim());
        }}
        placeholder="Nota (opcional)…"
        className="mt-3 min-h-[40px]"
        maxLength={240}
      />

      {/* Photo */}
      <div className="mt-3 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pick}
        />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Foto de ${item.name}`}
            loading="lazy"
            className="h-14 w-14 rounded-md border border-border object-cover"
          />
        ) : null}
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
          {photoUrl ? "Cambiar foto" : "Añadir foto"}
        </Button>
      </div>
    </div>
  );
}

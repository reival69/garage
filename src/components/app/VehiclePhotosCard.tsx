// Garage — vehicle-level photo gallery editor (ficha de vehículo). Lets the shop
// upload (compressed), label, delete and pick a cover photo for the cartilla.
// All writes go through vehicles.ts helpers; everything is local & simulated.

import { useRef, useState } from "react";
import { Camera, Loader2, Star, Trash2 } from "lucide-react";
import { DataCard } from "@/components/base/DataCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compressImage } from "@/lib/image";
import { PHOTO_LABELS, PHOTO_LABEL_TEXT } from "@/lib/orders";
import {
  addVehiclePhoto,
  removeVehiclePhoto,
  setVehicleCoverPhoto,
} from "@/lib/vehicles";
import { cn } from "@/lib/utils";
import type { Photo, Vehicle } from "@/types";
import { toast } from "sonner";

const MAX_VEHICLE_PHOTOS = 12;

export function VehiclePhotosCard({
  tenantId,
  vehicle,
  onSaved,
}: {
  tenantId: string;
  vehicle: Vehicle;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState<Photo["label"]>("detalle");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const photos = vehicle.photos ?? [];

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photos.length >= MAX_VEHICLE_PHOTOS) {
      toast.error(`Máximo ${MAX_VEHICLE_PHOTOS} fotos por vehículo.`);
      return;
    }
    setBusy(true);
    try {
      const url = await compressImage(file);
      addVehiclePhoto(tenantId, vehicle, { url, label });
      toast.success("Foto añadida");
      onSaved();
    } catch {
      toast.error("No se pudo procesar la imagen.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (photoId: string) => {
    removeVehiclePhoto(tenantId, vehicle, photoId);
    toast.success("Foto eliminada");
    onSaved();
  };

  const setCover = (photoId: string) => {
    setVehicleCoverPhoto(tenantId, vehicle, photoId);
    toast.success("Portada actualizada");
    onSaved();
  };

  return (
    <DataCard title={`Fotos del vehículo (${photos.length})`}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={label}
          onValueChange={(v) => setLabel(v as Photo["label"])}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_LABELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
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
          Añadir foto
        </Button>
      </div>

      {photos.length === 0 ? (
        <p className="mt-4 py-2 text-sm text-muted-foreground">
          Aún no hay fotos propias del vehículo. La portada y la galería se
          mostrarán en la cartilla pública.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((p) => {
            const isCover = (vehicle.coverPhotoId ?? photos[0]?.id) === p.id;
            return (
              <figure
                key={p.id}
                className={cn(
                  "group relative overflow-hidden rounded-lg border",
                  isCover ? "border-foreground" : "border-border",
                )}
              >
                <img
                  src={p.url}
                  alt={PHOTO_LABEL_TEXT[p.label]}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <figcaption className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="truncate">{PHOTO_LABEL_TEXT[p.label]}</span>
                  {isCover && (
                    <span className="shrink-0 font-medium text-foreground">
                      Portada
                    </span>
                  )}
                </figcaption>
                <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                  {!isCover && (
                    <button
                      onClick={() => setCover(p.id)}
                      className="rounded-md bg-background/90 p-1 text-foreground"
                      aria-label="Marcar como portada"
                    >
                      <Star strokeWidth={1.5} className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(p.id)}
                    className="rounded-md bg-background/90 p-1 text-[var(--destructive)]"
                    aria-label="Eliminar foto"
                  >
                    <Trash2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                  </button>
                </div>
              </figure>
            );
          })}
        </div>
      )}
    </DataCard>
  );
}

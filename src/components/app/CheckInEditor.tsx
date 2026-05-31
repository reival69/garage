// Talleo — módulo de check-in de recepción dentro de la ficha de orden.
// Km (sincroniza con el vehículo), nivel de combustible tipo gauge, diagrama
// de daños interactivo (marcas con coordenadas relativas) y firma del cliente
// en canvas (puntero táctil + ratón). Todo pasa por src/lib/checkin.ts.

import { useRef, useState } from "react";
import {
  ClipboardCheck,
  Trash2,
  Fuel,
  Gauge,
  Pencil,
} from "lucide-react";
import { DataCard } from "@/components/base/DataCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SignaturePad } from "@/components/base/SignaturePad";
import { vehiclesRepo } from "@/lib/db";
import { fuelLabel, saveCheckIn, type CheckInInput } from "@/lib/checkin";
import { formatDateTime } from "@/lib/format";
import type { BodyDamageMark, Tenant, WorkOrder } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CheckInEditor({
  order,
  tenant,
  onSaved,
}: {
  order: WorkOrder;
  tenant: Tenant;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const vehicle = vehiclesRepo.getById(tenant.id, order.vehicleId);

  if (order.checkIn && !editing) {
    return (
      <CheckInSummary order={order} onEdit={() => setEditing(true)} />
    );
  }

  if (!order.checkIn && !editing) {
    return (
      <DataCard title="Check-in de recepción">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <ClipboardCheck
            strokeWidth={1.5}
            className="h-8 w-8 text-foreground-subtle"
          />
          <p className="max-w-sm text-sm text-muted-foreground">
            Registra el estado del vehículo a la recepción: kilometraje, nivel de
            combustible, daños y firma del cliente.
          </p>
          <Button onClick={() => setEditing(true)}>
            <ClipboardCheck strokeWidth={1.5} />
            Registrar recepción
          </Button>
        </div>
      </DataCard>
    );
  }

  return (
    <CheckInForm
      key={order.checkIn?.createdAt ?? "new"}
      order={order}
      tenant={tenant}
      vehicleKm={vehicle?.km ?? 0}
      onCancel={() => setEditing(false)}
      onSaved={() => {
        setEditing(false);
        onSaved();
      }}
    />
  );
}

/* ----------------------------- Form ----------------------------- */

function CheckInForm({
  order,
  tenant,
  vehicleKm,
  onCancel,
  onSaved,
}: {
  order: WorkOrder;
  tenant: Tenant;
  vehicleKm: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const existing = order.checkIn;
  const [km, setKm] = useState(String(existing?.km ?? vehicleKm));
  const [fuel, setFuel] = useState(existing?.fuelLevel ?? 50);
  const [marks, setMarks] = useState<BodyDamageMark[]>(
    existing?.bodyDamage ?? [],
  );
  const [signature, setSignature] = useState<string | undefined>(
    existing?.customerSignature,
  );

  const addMark = (x: number, y: number) => {
    setMarks((prev) => [...prev, { x, y }]);
  };
  const updateMarkNote = (idx: number, note: string) => {
    setMarks((prev) => prev.map((m, i) => (i === idx ? { ...m, note } : m)));
  };
  const removeMark = (idx: number) => {
    setMarks((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = () => {
    const kmNum = Math.max(0, Math.round(Number(km) || 0));
    const input: CheckInInput = {
      km: kmNum,
      fuelLevel: fuel,
      bodyDamage: marks.map((m) => ({
        x: m.x,
        y: m.y,
        note: m.note?.trim() || undefined,
      })),
      customerSignature: signature,
    };
    saveCheckIn(tenant.id, order, input);
    toast.success("Recepción registrada");
    onSaved();
  };

  return (
    <DataCard title="Check-in de recepción">
      <div className="space-y-6">
        {/* Km */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Gauge strokeWidth={1.5} className="h-3.5 w-3.5" />
            Kilometraje actual
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              className="max-w-[180px]"
            />
            <span className="text-sm text-muted-foreground">km</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Al guardar se actualizará el kilometraje del vehículo.
          </p>
        </div>

        {/* Fuel */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Fuel strokeWidth={1.5} className="h-3.5 w-3.5" />
            Nivel de combustible
          </Label>
          <FuelGauge value={fuel} />
          <Slider
            value={[fuel]}
            onValueChange={(v) => setFuel(v[0])}
            min={0}
            max={100}
            step={1}
            className="py-2"
          />
        </div>

        {/* Body damage */}
        <div className="space-y-2">
          <Label>Daños en carrocería</Label>
          <p className="text-xs text-muted-foreground">
            Toca el diagrama para añadir una marca de daño.
          </p>
          <CarDiagram marks={marks} interactive onAddMark={addMark} />
          {marks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin marcas de daño.
            </p>
          ) : (
            <ul className="space-y-2">
              {marks.map((m, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-foreground text-xs font-medium text-foreground">
                    {i + 1}
                  </span>
                  <Input
                    value={m.note ?? ""}
                    onChange={(e) => updateMarkNote(i, e.target.value)}
                    placeholder="Nota del daño (opcional)…"
                    className="h-9 flex-1"
                    maxLength={120}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-[var(--destructive)]"
                    onClick={() => removeMark(i)}
                    aria-label="Eliminar marca"
                  >
                    <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <Label>Firma del cliente</Label>
          <SignaturePad initial={signature} onChange={setSignature} />
        </div>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button onClick={save}>Guardar recepción</Button>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </DataCard>
  );
}

/* ----------------------------- Summary ----------------------------- */

function CheckInSummary({
  order,
  onEdit,
}: {
  order: WorkOrder;
  onEdit: () => void;
}) {
  const c = order.checkIn!;
  return (
    <DataCard
      title="Check-in de recepción"
      actions={
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil strokeWidth={1.5} />
          Editar
        </Button>
      }
    >
      <p className="text-xs text-muted-foreground">
        Registrado el {formatDateTime(c.createdAt)}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge strokeWidth={1.5} className="h-3.5 w-3.5" />
            Kilometraje
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {c.km.toLocaleString("es-ES")} km
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Fuel strokeWidth={1.5} className="h-3.5 w-3.5" />
            Combustible
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {fuelLabel(c.fuelLevel)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({c.fuelLevel}%)
            </span>
          </p>
          <div className="mt-2">
            <FuelGauge value={c.fuelLevel} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Daños en carrocería</p>
          <CarDiagram marks={c.bodyDamage} />
          {c.bodyDamage.length > 0 && (
            <ul className="mt-2 space-y-1">
              {c.bodyDamage.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground text-[11px] font-medium">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">
                    {m.note?.trim() || "Sin nota"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Firma del cliente</p>
          {c.customerSignature ? (
            <img
              src={c.customerSignature}
              alt="Firma del cliente"
              className="w-full max-w-xs rounded-lg border border-border bg-background"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin firma.</p>
          )}
        </div>
      </div>
    </DataCard>
  );
}

/* ----------------------------- Fuel gauge ----------------------------- */

function FuelGauge({ value }: { value: number }) {
  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-background-muted">
        <div
          className="absolute inset-y-0 left-0 bg-foreground transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-medium text-muted-foreground">
        <span>E</span>
        <span>1/2</span>
        <span>F</span>
      </div>
    </div>
  );
}

/* ----------------------------- Car diagram ----------------------------- */

function CarDiagram({
  marks,
  interactive = false,
  onAddMark,
}: {
  marks: BodyDamageMark[];
  interactive?: boolean;
  onAddMark?: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onAddMark || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onAddMark(x, y);
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={cn(
        "relative mx-auto w-full max-w-[220px] rounded-lg border border-border bg-background-subtle p-3",
        interactive && "cursor-crosshair",
      )}
    >
      <svg
        viewBox="0 0 200 380"
        className="h-auto w-full text-foreground-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      >
        {/* Wheels */}
        <rect x="14" y="78" width="16" height="44" rx="7" />
        <rect x="170" y="78" width="16" height="44" rx="7" />
        <rect x="14" y="258" width="16" height="44" rx="7" />
        <rect x="170" y="258" width="16" height="44" rx="7" />
        {/* Body */}
        <rect x="30" y="20" width="140" height="340" rx="52" />
        {/* Windshield (front) */}
        <path d="M52 118 Q100 96 148 118 L140 150 Q100 138 60 150 Z" />
        {/* Rear window */}
        <path d="M60 250 Q100 262 140 250 L148 280 Q100 302 52 280 Z" />
        {/* Roof / cabin */}
        <rect x="58" y="156" width="84" height="88" rx="16" />
      </svg>

      {marks.map((m, i) => (
        <span
          key={i}
          className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-[var(--destructive)] text-xs font-semibold text-white shadow"
          style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}


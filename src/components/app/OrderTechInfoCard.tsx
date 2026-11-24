// Garage — "Info técnica" card inside a work order. Suggests the Biblioteca
// documents tagged for this vehicle and lets the mechanic search them (or the
// whole library) without leaving the order.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, FileText } from "lucide-react";
import { DataCard } from "@/components/base/DataCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LibrarySearch, openDocSafe } from "@/components/app/LibrarySearch";
import {
  LIBRARY_CATEGORY_LABELS,
  docMatchesVehicle,
  listLibrary,
  vehicleTagLabel,
} from "@/lib/library";
import type { Vehicle } from "@/types";

export function OrderTechInfoCard({ tenantId, vehicle }: { tenantId: string; vehicle: Vehicle }) {
  const all = useMemo(() => listLibrary(tenantId), [tenantId]);
  const matching = useMemo(() => all.filter((d) => docMatchesVehicle(d, vehicle)), [all, vehicle]);
  const [searchAll, setSearchAll] = useState(matching.length === 0);
  const vehicleLabel = `${vehicle.make} ${vehicle.model}`;

  if (all.length === 0) {
    return (
      <DataCard title="Info técnica">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <BookOpen strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Sube tus manuales en PDF a la{" "}
            <Link to="/app/biblioteca" className="text-foreground underline underline-offset-2">
              Biblioteca
            </Link>{" "}
            y aquí verás los del {vehicleLabel} y podrás buscar dentro de ellos.
          </p>
        </div>
      </DataCard>
    );
  }

  const scope = searchAll ? all : matching;

  return (
    <DataCard
      title="Info técnica"
      description={
        matching.length > 0
          ? `${matching.length} ${matching.length === 1 ? "documento" : "documentos"} para ${vehicleLabel}`
          : `Ningún documento etiquetado para ${vehicleLabel}`
      }
    >
      <div className="space-y-4">
        {matching.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {matching.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => openDocSafe(d.id)}
                  title={vehicleTagLabel(d) ?? undefined}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-border-strong"
                >
                  <FileText strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">{d.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    · {LIBRARY_CATEGORY_LABELS[d.category]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <LibrarySearch
          docs={scope}
          limit={5}
          placeholder={`Buscar en ${searchAll ? "toda la biblioteca" : `manuales del ${vehicleLabel}`}…`}
        />

        {matching.length > 0 && (
          <div className="flex items-center gap-2">
            <Switch id="lib-scope" checked={searchAll} onCheckedChange={setSearchAll} />
            <Label htmlFor="lib-scope" className="text-xs font-normal text-muted-foreground">
              Buscar en toda la biblioteca ({all.length} documentos)
            </Label>
          </div>
        )}
      </div>
    </DataCard>
  );
}

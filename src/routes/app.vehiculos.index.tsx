// Garage — Vehículos (listado). Buscador por matrícula, marca, modelo o dueño.
// Tarjetas en móvil, tabla en escritorio.

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Car } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleFormDialog } from "@/components/app/VehicleFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo } from "@/lib/db";
import type { Customer } from "@/types";

export const Route = createFileRoute("/app/vehiculos/")({
  component: VehiclesPage,
});

function VehiclesPage() {
  const { ready, tenant } = useAuth();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const data = useMemo(() => {
    if (!ready || !tenant)
      return { vehicles: [], customerById: new Map<string, Customer>() };
    const vehicles = vehiclesRepo
      .list(tenant.id)
      .sort((a, b) => a.plate.localeCompare(b.plate));
    const customerById = new Map<string, Customer>();
    customersRepo.list(tenant.id).forEach((c) => customerById.set(c.id, c));
    return { vehicles, customerById };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.vehicles;
    return data.vehicles.filter((v) => {
      const owner = data.customerById.get(v.customerId)?.name ?? "";
      return (
        v.plate.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        owner.toLowerCase().includes(q)
      );
    });
  }, [query, data]);

  if (!tenant) return null;

  return (
    <div>
      <PageHeader
        title="Vehículos"
        description="Vehículos registrados en el taller."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus strokeWidth={1.5} />
            Nuevo vehículo
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por matrícula, marca, modelo o dueño…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title={query ? "Sin resultados" : "Aún no hay vehículos"}
          description={
            query
              ? "Prueba con otro término de búsqueda."
              : "Registra el primer vehículo del taller."
          }
          action={
            !query && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus strokeWidth={1.5} />
                Nuevo vehículo
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((v) => (
              <Link
                key={v.id}
                to="/app/vehiculos/$id"
                params={{ id: v.id }}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
                    {v.make} {v.model}
                  </p>
                  <span className="font-mono text-xs text-muted-foreground">
                    {v.plate}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.customerById.get(v.customerId)?.name ?? "—"} ·{" "}
                  {v.year || "—"} · {v.km ? `${v.km.toLocaleString("es-ES")} km` : "—"}
                </p>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Matrícula</th>
                  <th className="px-4 py-3 font-medium">Vehículo</th>
                  <th className="px-4 py-3 font-medium">Dueño</th>
                  <th className="px-4 py-3 font-medium">Año</th>
                  <th className="px-4 py-3 font-medium">Km</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-background-subtle"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/app/vehiculos/$id"
                        params={{ id: v.id }}
                        className="font-mono font-medium text-foreground hover:underline"
                      >
                        {v.plate}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {v.make} {v.model}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {data.customerById.get(v.customerId)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.year || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.km ? v.km.toLocaleString("es-ES") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <VehicleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenant.id}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

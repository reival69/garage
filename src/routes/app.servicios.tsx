// Garage — Catálogo (Servicios y Repuestos). Two tabs, each with a search box,
// a desktop table / mobile cards layout and full CRUD. Prices are formatted in
// the active tenant's currency. Deleting a service handles orphaned appointment
// references gracefully (the agenda shows "Servicio eliminado"). Everything is
// local & simulated.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Wrench,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ServiceFormDialog } from "@/components/app/ServiceFormDialog";
import { PartFormDialog } from "@/components/app/PartFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { servicesRepo, partsRepo } from "@/lib/db";
import {
  listServices,
  listParts,
  futureAppointmentsUsingService,
} from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { formatDuration } from "@/lib/appointments";
import { canEdit } from "@/lib/permissions";
import type { Service, Part } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/servicios")({
  component: CatalogoPage,
});

function CatalogoPage() {
  const { ready, tenant, user } = useAuth();
  const [version, setVersion] = useState(0);

  if (!tenant || !user) return null;
  const editable = canEdit(user.role, "servicios");
  const currency = tenant.currency;

  return (
    <div>
      <PageHeader
        title="Catálogo"
        description="Servicios y repuestos del taller."
      />

      <Tabs defaultValue="servicios">
        <TabsList className="mb-4">
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="repuestos">Repuestos</TabsTrigger>
        </TabsList>

        <TabsContent value="servicios">
          <ServicesTab
            key={`s-${version}`}
            tenantId={tenant.id}
            currency={currency}
            editable={editable}
            onChanged={() => setVersion((v) => v + 1)}
          />
        </TabsContent>

        <TabsContent value="repuestos">
          <PartsTab
            key={`p-${version}`}
            tenantId={tenant.id}
            currency={currency}
            editable={editable}
            onChanged={() => setVersion((v) => v + 1)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Servicios ───────────────────────────────────────────────────────────────

function ServicesTab({
  tenantId,
  currency,
  editable,
  onChanged,
}: {
  tenantId: string;
  currency: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const services = useMemo(() => listServices(tenantId), [tenantId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, services]);

  const futureUses = toDelete
    ? futureAppointmentsUsingService(tenantId, toDelete.id)
    : 0;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: Service) => {
    setEditing(s);
    setDialogOpen(true);
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    servicesRepo.remove(tenantId, toDelete.id);
    toast.success("Servicio eliminado");
    setToDelete(null);
    onChanged();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar servicio…"
            className="pl-9"
          />
        </div>
        {editable && (
          <Button onClick={openNew}>
            <Plus strokeWidth={1.5} />
            Nuevo servicio
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={query ? "Sin resultados" : "Aún no hay servicios"}
          description={
            query
              ? "Prueba con otro término de búsqueda."
              : "Crea tu primer servicio para el catálogo."
          }
          action={
            !query && editable ? (
              <Button onClick={openNew}>
                <Plus strokeWidth={1.5} />
                Nuevo servicio
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{s.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatCurrency(s.basePrice, currency)}</span>
                      <span className="flex items-center gap-1">
                        <Clock strokeWidth={1.5} className="h-3.5 w-3.5" />
                        {formatDuration(s.estimatedMinutes)}
                      </span>
                    </div>
                  </div>
                  {editable && (
                    <RowMenu
                      onEdit={() => openEdit(s)}
                      onDelete={() => setToDelete(s)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Precio base</th>
                  <th className="px-4 py-3 font-medium">Tiempo estimado</th>
                  {editable && <th className="w-12 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-background-subtle"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatCurrency(s.basePrice, currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDuration(s.estimatedMinutes)}
                    </td>
                    {editable && (
                      <td className="px-4 py-3 text-right">
                        <RowMenu
                          onEdit={() => openEdit(s)}
                          onDelete={() => setToDelete(s)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenantId}
        service={editing}
        onSaved={onChanged}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
            <AlertDialogDescription>
              {futureUses > 0
                ? `${toDelete?.name} está en ${futureUses} cita${
                    futureUses === 1 ? "" : "s"
                  } futura${
                    futureUses === 1 ? "" : "s"
                  }. Esas citas seguirán funcionando y mostrarán «Servicio eliminado». ¿Eliminar de todos modos?`
                : `¿Seguro que quieres eliminar «${toDelete?.name}»? Los presupuestos ya creados no se verán afectados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Repuestos ─────────────────────────────────────────────────────────────

function PartsTab({
  tenantId,
  currency,
  editable,
  onChanged,
}: {
  tenantId: string;
  currency: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [toDelete, setToDelete] = useState<Part | null>(null);

  const parts = useMemo(() => listParts(tenantId), [tenantId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [query, parts]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: Part) => {
    setEditing(p);
    setDialogOpen(true);
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    partsRepo.remove(tenantId, toDelete.id);
    toast.success("Repuesto eliminado");
    setToDelete(null);
    onChanged();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar repuesto o SKU…"
            className="pl-9"
          />
        </div>
        {editable && (
          <Button onClick={openNew}>
            <Plus strokeWidth={1.5} />
            Nuevo repuesto
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={query ? "Sin resultados" : "Aún no hay repuestos"}
          description={
            query
              ? "Prueba con otro término de búsqueda."
              : "Crea tu primer repuesto para el catálogo."
          }
          action={
            !query && editable ? (
              <Button onClick={openNew}>
                <Plus strokeWidth={1.5} />
                Nuevo repuesto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatCurrency(p.price, currency)}</span>
                      {p.sku && (
                        <span className="font-mono text-xs">{p.sku}</span>
                      )}
                    </div>
                  </div>
                  {editable && (
                    <RowMenu
                      onEdit={() => openEdit(p)}
                      onDelete={() => setToDelete(p)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  {editable && <th className="w-12 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-background-subtle"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatCurrency(p.price, currency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.sku ?? "—"}
                    </td>
                    {editable && (
                      <td className="px-4 py-3 text-right">
                        <RowMenu
                          onEdit={() => openEdit(p)}
                          onDelete={() => setToDelete(p)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PartFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenantId}
        part={editing}
        onSaved={onChanged}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar repuesto</AlertDialogTitle>
            <AlertDialogDescription>
              {`¿Seguro que quieres eliminar «${toDelete?.name}»? Los presupuestos ya creados no se verán afectados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Shared row actions ──────────────────────────────────────────────────────

function RowMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal strokeWidth={1.5} className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil strokeWidth={1.5} className="h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-[var(--destructive)] focus:text-[var(--destructive)]"
        >
          <Trash2 strokeWidth={1.5} className="h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

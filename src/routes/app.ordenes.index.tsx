// Talleo — Órdenes (listado). Toggle Lista / Tablero. Filtro por estado (chips),
// buscador por matrícula/cliente/código. Tarjetas en móvil, tabla en escritorio.

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, ClipboardList, List, Columns3 } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderFormDialog } from "@/components/app/OrderFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, usersRepo, vehiclesRepo, workOrdersRepo } from "@/lib/db";
import {
  PIPELINE,
  STATUS_LABELS,
  changeOrderStatus,
  nextStatuses,
} from "@/lib/orders";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, User, Vehicle, WorkOrder, WorkOrderStatus } from "@/types";

export const Route = createFileRoute("/app/ordenes/")({
  component: OrdersPage,
});

const FILTER_STATUSES: WorkOrderStatus[] = [...PIPELINE, "cancelado"];

interface Enriched {
  order: WorkOrder;
  vehicle?: Vehicle;
  customer?: Customer;
  mechanic?: User;
}

function OrdersPage() {
  const { ready, tenant } = useAuth();
  const [view, setView] = useState<"list" | "board">("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">(
    "all",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const enriched = useMemo<Enriched[]>(() => {
    if (!ready || !tenant) return [];
    const vById = new Map<string, Vehicle>();
    vehiclesRepo.list(tenant.id).forEach((v) => vById.set(v.id, v));
    const cById = new Map<string, Customer>();
    customersRepo.list(tenant.id).forEach((c) => cById.set(c.id, c));
    const uById = new Map<string, User>();
    usersRepo.list().forEach((u) => uById.set(u.id, u));
    return workOrdersRepo
      .list(tenant.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((order) => ({
        order,
        vehicle: vById.get(order.vehicleId),
        customer: cById.get(order.customerId),
        mechanic: order.mechanicId ? uById.get(order.mechanicId) : undefined,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((e) => {
      if (statusFilter !== "all" && e.order.status !== statusFilter)
        return false;
      if (!q) return true;
      return (
        (e.vehicle?.plate ?? "").toLowerCase().includes(q) ||
        (e.customer?.name ?? "").toLowerCase().includes(q) ||
        e.order.accessCode.toLowerCase().includes(q)
      );
    });
  }, [enriched, query, statusFilter]);

  if (!tenant) return null;

  const move = (e: Enriched, next: WorkOrderStatus) => {
    changeOrderStatus(tenant, e.order, next);
    setVersion((v) => v + 1);
  };

  return (
    <div>
      <PageHeader
        title="Órdenes"
        description="Órdenes de reparación del taller."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus strokeWidth={1.5} />
            Nueva orden
          </Button>
        }
      />

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por matrícula, cliente o código…"
              className="pl-9"
            />
          </div>
          <div className="flex shrink-0 rounded-md border border-border p-0.5">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors",
                view === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List strokeWidth={1.5} className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setView("board")}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors",
                view === "board"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Columns3 strokeWidth={1.5} className="h-4 w-4" />
              <span className="hidden sm:inline">Tablero</span>
            </button>
          </div>
        </div>

        {view === "list" && (
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              Todas
            </Chip>
            {FILTER_STATUSES.map((s) => (
              <Chip
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_LABELS[s]}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {view === "list" ? (
        <ListView items={filtered} />
      ) : (
        <BoardView items={enriched} onMove={move} />
      )}

      <OrderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={tenant}
        onCreated={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ListView({ items }: { items: Enriched[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin órdenes"
        description="No hay órdenes que coincidan con el filtro."
      />
    );
  }
  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {items.map((e) => (
          <Link
            key={e.order.id}
            to="/app/ordenes/$id"
            params={{ id: e.order.id }}
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                {e.order.accessCode}
              </span>
              <StatusBadge status={e.order.status} />
            </div>
            <p className="mt-1.5 font-medium text-foreground">
              {e.vehicle ? `${e.vehicle.make} ${e.vehicle.model}` : "Vehículo"}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {e.vehicle?.plate}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {e.customer?.name ?? "—"} · {e.mechanic?.name ?? "Sin mecánico"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(e.order.createdAt)}
            </p>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Vehículo</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Mecánico</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr
                key={e.order.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-background-subtle"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/app/ordenes/$id"
                    params={{ id: e.order.id }}
                    className="font-mono font-medium text-foreground hover:underline"
                  >
                    {e.order.accessCode}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">
                  {e.vehicle ? `${e.vehicle.make} ${e.vehicle.model}` : "—"}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {e.vehicle?.plate}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.customer?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.mechanic?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={e.order.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(e.order.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BoardView({
  items,
  onMove,
}: {
  items: Enriched[];
  onMove: (e: Enriched, next: WorkOrderStatus) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE.map((status) => {
        const cards = items.filter((e) => e.order.status === status);
        return (
          <div
            key={status}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-background-subtle"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">
                {STATUS_LABELS[status]}
              </span>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                {cards.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {cards.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  —
                </p>
              )}
              {cards.map((e) => (
                <div
                  key={e.order.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <Link
                    to="/app/ordenes/$id"
                    params={{ id: e.order.id }}
                    className="block"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {e.vehicle
                        ? `${e.vehicle.make} ${e.vehicle.model}`
                        : "Vehículo"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {e.vehicle?.plate}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {e.customer?.name ?? "—"} · {e.order.accessCode}
                    </p>
                  </Link>
                  {nextStatuses(e.order.status).length > 0 && (
                    <div className="mt-2">
                      <Select
                        value=""
                        onValueChange={(v) =>
                          onMove(e, v as WorkOrderStatus)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Mover a…" />
                        </SelectTrigger>
                        <SelectContent>
                          {nextStatuses(e.order.status).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

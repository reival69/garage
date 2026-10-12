// Garage — Facturación (listado). Buscador por número/cliente/matrícula, filtro
// por estado de cobro. Tarjetas en móvil, tabla en escritorio. Todo local.

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt, Search } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  customersRepo,
  invoicesRepo,
  vehiclesRepo,
  workOrdersRepo,
} from "@/lib/db";
import { formatCurrencyCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, Invoice, Vehicle } from "@/types";

export const Route = createFileRoute("/app/facturacion/")({
  component: InvoicesPage,
});

type PayFilter = "all" | Invoice["status"];

interface Enriched {
  invoice: Invoice;
  customer?: Customer;
  vehicle?: Vehicle;
}

const FILTERS: Array<{ value: PayFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendiente" },
  { value: "partial", label: "Parcial" },
  { value: "paid", label: "Pagada" },
];

function InvoicesPage() {
  const { ready, tenant } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PayFilter>("all");

  const enriched = useMemo<Enriched[]>(() => {
    if (!ready || !tenant) return [];
    const cById = new Map<string, Customer>();
    customersRepo.list(tenant.id).forEach((c) => cById.set(c.id, c));
    const vById = new Map<string, Vehicle>();
    vehiclesRepo.list(tenant.id).forEach((v) => vById.set(v.id, v));
    return invoicesRepo
      .list(tenant.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((invoice) => {
        const order = workOrdersRepo.getById(tenant.id, invoice.workOrderId);
        return {
          invoice,
          customer: order ? cById.get(order.customerId) : undefined,
          vehicle: order ? vById.get(order.vehicleId) : undefined,
        };
      });
  }, [ready, tenant]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((e) => {
      if (filter !== "all" && e.invoice.status !== filter) return false;
      if (!q) return true;
      return (
        e.invoice.number.toLowerCase().includes(q) ||
        (e.customer?.name ?? "").toLowerCase().includes(q) ||
        (e.vehicle?.plate ?? "").toLowerCase().includes(q)
      );
    });
  }, [enriched, query, filter]);

  if (!tenant) return null;

  return (
    <div>
      <PageHeader title="Facturación" description="Facturas del taller." />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, cliente o matrícula…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay facturas"
          description="Genera una factura desde una orden aprobada."
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((e) => (
              <Link
                key={e.invoice.id}
                to="/app/facturacion/$id"
                params={{ id: e.invoice.id }}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {e.invoice.number}
                  </span>
                  <StatusBadge status={e.invoice.status} />
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  {e.customer?.name ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {e.vehicle
                    ? `${e.vehicle.make} ${e.vehicle.model} · ${e.vehicle.plate}`
                    : "—"}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(e.invoice.createdAt)}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrencyCents(e.invoice.total, tenant.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Vehículo</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.invoice.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-background-subtle"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/app/facturacion/$id"
                        params={{ id: e.invoice.id }}
                        className="font-mono font-medium text-foreground hover:underline"
                      >
                        {e.invoice.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {e.customer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {e.vehicle
                        ? `${e.vehicle.make} ${e.vehicle.model}`
                        : "—"}
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {e.vehicle?.plate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(e.invoice.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatCurrencyCents(e.invoice.total, tenant.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.invoice.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

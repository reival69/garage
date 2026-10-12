// Garage — Clientes (listado). Buscador en tiempo real por nombre, teléfono,
// email o matrícula de sus vehículos. Tarjetas en móvil, tabla en escritorio.

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Users, Phone, Mail, Car } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerFormDialog } from "@/components/app/CustomerFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo, workOrdersRepo } from "@/lib/db";
import type { Customer, Vehicle } from "@/types";

export const Route = createFileRoute("/app/clientes/")({
  component: ClientesPage,
});

function ClientesPage() {
  const { ready, tenant } = useAuth();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const data = useMemo(() => {
    if (!ready || !tenant) return { customers: [], vehiclesByCustomer: new Map<string, Vehicle[]>(), ordersByCustomer: new Map<string, number>() };
    const customers = customersRepo
      .list(tenant.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    const vehicles = vehiclesRepo.list(tenant.id);
    const orders = workOrdersRepo.list(tenant.id);
    const vehiclesByCustomer = new Map<string, Vehicle[]>();
    vehicles.forEach((v) => {
      const arr = vehiclesByCustomer.get(v.customerId) ?? [];
      arr.push(v);
      vehiclesByCustomer.set(v.customerId, arr);
    });
    const ordersByCustomer = new Map<string, number>();
    orders.forEach((o) =>
      ordersByCustomer.set(
        o.customerId,
        (ordersByCustomer.get(o.customerId) ?? 0) + 1,
      ),
    );
    return { customers, vehiclesByCustomer, ordersByCustomer };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.customers;
    return data.customers.filter((c) => {
      const plates = (data.vehiclesByCustomer.get(c.id) ?? [])
        .map((v) => v.plate.toLowerCase())
        .join(" ");
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        plates.includes(q)
      );
    });
  }, [query, data]);

  if (!tenant) return null;

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Base de clientes del taller."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus strokeWidth={1.5} />
            Nuevo cliente
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
          placeholder="Buscar por nombre, teléfono, email o matrícula…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "Sin resultados" : "Aún no hay clientes"}
          description={
            query
              ? "Prueba con otro término de búsqueda."
              : "Crea tu primer cliente para empezar."
          }
          action={
            !query && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus strokeWidth={1.5} />
                Nuevo cliente
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                vehicleCount={(data.vehiclesByCustomer.get(c.id) ?? []).length}
                orderCount={data.ordersByCustomer.get(c.id) ?? 0}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Vehículos</th>
                  <th className="px-4 py-3 font-medium">Órdenes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-background-subtle"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/app/clientes/$id"
                        params={{ id: c.id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(data.vehiclesByCustomer.get(c.id) ?? []).length}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {data.ordersByCustomer.get(c.id) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CustomerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenant.id}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

function CustomerCard({
  customer,
  vehicleCount,
  orderCount,
}: {
  customer: Customer;
  vehicleCount: number;
  orderCount: number;
}) {
  return (
    <Link
      to="/app/clientes/$id"
      params={{ id: customer.id }}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
    >
      <p className="font-medium text-foreground">{customer.name}</p>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <Phone strokeWidth={1.5} className="h-3.5 w-3.5" />
          {customer.phone}
        </p>
        {customer.email && (
          <p className="flex items-center gap-2">
            <Mail strokeWidth={1.5} className="h-3.5 w-3.5" />
            {customer.email}
          </p>
        )}
        <p className="flex items-center gap-2">
          <Car strokeWidth={1.5} className="h-3.5 w-3.5" />
          {vehicleCount} vehículo(s) · {orderCount} orden(es)
        </p>
      </div>
    </Link>
  );
}

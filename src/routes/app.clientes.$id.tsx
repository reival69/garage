// Garage — ficha de cliente. Datos editables, sus vehículos (con alta vinculada)
// y su historial de órdenes. Eliminar bloqueado si tiene órdenes asociadas.

import { useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Car,
  ClipboardList,
  Phone,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { DataCard } from "@/components/base/DataCard";
import { StatusBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
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
import { CustomerFormDialog } from "@/components/app/CustomerFormDialog";
import { VehicleFormDialog } from "@/components/app/VehicleFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { customersRepo, vehiclesRepo, workOrdersRepo } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clientes/$id")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { ready, tenant } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  const [version, setVersion] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const data = useMemo(() => {
    if (!ready || !tenant) return null;
    const customer = customersRepo.getById(tenant.id, id);
    if (!customer) return null;
    const vehicles = vehiclesRepo
      .list(tenant.id)
      .filter((v) => v.customerId === id);
    const orders = workOrdersRepo
      .list(tenant.id)
      .filter((o) => o.customerId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { customer, vehicles, orders };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tenant, id, version]);

  if (!tenant) return null;

  if (!data) {
    return (
      <div>
        <BackLink />
        <EmptyState
          title="Cliente no encontrado"
          description="Es posible que se haya eliminado."
        />
      </div>
    );
  }

  const { customer, vehicles, orders } = data;
  const vehicleName = (vid: string) => {
    const v = vehicles.find((x) => x.id === vid);
    return v ? `${v.make} ${v.model} · ${v.plate}` : "Vehículo";
  };

  const doDelete = () => {
    if (orders.length > 0) {
      toast.error("No se puede eliminar: el cliente tiene órdenes asociadas.");
      setDeleteOpen(false);
      return;
    }
    // Remove vehicles first, then the customer.
    vehicles.forEach((v) => vehiclesRepo.remove(tenant.id, v.id));
    customersRepo.remove(tenant.id, customer.id);
    toast.success("Cliente eliminado");
    navigate({ to: "/app/clientes" });
  };

  return (
    <div>
      <BackLink />
      <PageHeader
        title={customer.name}
        description="Ficha de cliente"
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil strokeWidth={1.5} />
              Editar
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="text-[var(--destructive)]"
            >
              <Trash2 strokeWidth={1.5} />
              Eliminar
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contact */}
        <DataCard title="Datos de contacto" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone strokeWidth={1.5} className="h-4 w-4" />
              <span className="text-foreground">{customer.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail strokeWidth={1.5} className="h-4 w-4" />
              <span className="text-foreground">{customer.email ?? "—"}</span>
            </div>
            {customer.notes && (
              <div className="border-t border-border pt-3 text-muted-foreground">
                {customer.notes}
              </div>
            )}
          </dl>
        </DataCard>

        <div className="space-y-4 lg:col-span-2">
          {/* Vehicles */}
          <DataCard
            title="Vehículos"
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVehicleOpen(true)}
              >
                <Plus strokeWidth={1.5} />
                Añadir vehículo
              </Button>
            }
            bodyClassName="p-0"
          >
            {vehicles.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Sin vehículos registrados.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <Link
                      to="/app/vehiculos/$id"
                      params={{ id: v.id }}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-background-subtle"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
                        <Car strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {v.make} {v.model}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {v.plate}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>

          {/* Order history */}
          <DataCard title="Historial de órdenes" bodyClassName="p-0">
            {orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Sin órdenes todavía.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      to="/app/ordenes/$id"
                      params={{ id: o.id }}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-background-subtle"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
                        <ClipboardList strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {vehicleName(o.vehicleId)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(o.createdAt)} · {o.accessCode}
                        </span>
                      </span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
        </div>
      </div>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenant.id}
        customer={customer}
        onSaved={() => {
          setVersion((v) => v + 1);
          router.invalidate();
        }}
      />
      <VehicleFormDialog
        open={vehicleOpen}
        onOpenChange={setVehicleOpen}
        tenantId={tenant.id}
        lockedCustomerId={customer.id}
        onSaved={() => setVersion((v) => v + 1)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              {orders.length > 0
                ? `Este cliente tiene ${orders.length} orden(es) asociada(s). No se puede eliminar mientras existan.`
                : "Se eliminarán el cliente y sus vehículos. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              disabled={orders.length > 0}
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

function BackLink() {
  return (
    <Link
      to="/app/clientes"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft strokeWidth={1.5} className="h-4 w-4" />
      Clientes
    </Link>
  );
}

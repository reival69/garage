import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Plus, Pencil, LogIn, Power, KeyRound, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { StatusBadge } from "@/components/base/StatusBadge";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteTenantDialog } from "@/components/admin/DeleteTenantDialog";
import { OwnerAccessDialog } from "@/components/admin/OwnerAccessDialog";
import { TenantFormDialog } from "@/components/admin/TenantFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { plansRepo } from "@/lib/db";
import {
  ownerUserForTenant,
  tenantMetrics,
  toggleTenantStatus,
  type TenantMetrics,
} from "@/lib/admin";
import { billingState } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { Plan, Tenant } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/talleres")({
  component: AdminTalleres,
});

function AdminTalleres() {
  const { ready, login, reload } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<TenantMetrics[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [accessFor, setAccessFor] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState<Tenant | null>(null);

  const refresh = () => {
    setMetrics(tenantMetrics());
    setPlans(plansRepo.list());
  };

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [ready]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditing(tenant);
    setDialogOpen(true);
  };

  const handleToggle = (tenant: Tenant) => {
    toggleTenantStatus(tenant.id);
    toast.success(
      tenant.status === "active" ? "Taller suspendido" : "Taller activado",
    );
    refresh();
  };

  const enterAs = async (tenant: Tenant) => {
    const owner = ownerUserForTenant(tenant.id);
    if (!owner) {
      toast.error("Este taller no tiene un usuario asociado.");
      return;
    }
    await login(owner);
    navigate({ to: "/app" });
  };

  return (
    <div>
      <PageHeader
        title="Talleres"
        description="Tenants suscritos a Garage."
        actions={
          <Button onClick={openCreate}>
            <Plus strokeWidth={1.5} />
            Nuevo taller
          </Button>
        }
      />

      {metrics.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin talleres"
          description="No hay talleres registrados todavía."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taller</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map(({ tenant, plan, orderCount }) => (
                <TableRow
                  key={tenant.id}
                  className={tenant.status === "suspended" ? "opacity-60" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border"
                        style={{
                          color: tenant.accentColor,
                          borderColor: tenant.accentColor,
                        }}
                      >
                        <Building2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tenant.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tenant.locations[0]?.name ?? "—"}
                          {" · "}
                          {ownerUserForTenant(tenant.id)?.email ?? "sin responsable"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tenant.status} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {billingLabel(tenant)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tenant.currency}
                  </TableCell>
                  <TableCell className="text-right text-sm text-foreground">
                    {orderCount}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(tenant.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void enterAs(tenant)}
                        title="Entrar como este taller"
                      >
                        <LogIn strokeWidth={1.5} />
                        <span className="hidden lg:inline">Entrar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAccessFor(tenant)}
                        title="Email y contraseña del responsable"
                      >
                        <KeyRound strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(tenant)}
                        title="Editar"
                      >
                        <Pencil strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(tenant)}
                        title={
                          tenant.status === "active" ? "Suspender" : "Activar"
                        }
                      >
                        <Power strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(tenant)}
                        title="Eliminar taller"
                        className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                      >
                        <Trash2 strokeWidth={1.5} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TenantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plans={plans}
        tenant={editing}
        onSaved={refresh}
      />
      <DeleteTenantDialog
        tenant={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={async () => {
          await reload();
          refresh();
        }}
      />
      <OwnerAccessDialog
        open={!!accessFor}
        onOpenChange={(o) => !o && setAccessFor(null)}
        tenant={accessFor}
        onSaved={refresh}
      />
    </div>
  );
}

/** Short payment state for the workshops list. */
function billingLabel(tenant: Tenant): string {
  const state = billingState(tenant);
  switch (state.kind) {
    case "exempt":
      return "Gratis siempre";
    case "paid":
      return state.cancelAtPeriodEnd ? "Pagando (cancelado)" : "Pagando con tarjeta";
    case "trial":
      return `Prueba: ${state.daysLeft} ${state.daysLeft === 1 ? "día" : "días"}`;
    case "blocked":
      return state.reason === "payment_failed" ? "Pago fallido" : "Sin pagar (bloqueado)";
  }
}

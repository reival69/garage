// Garage — Equipo. Lista los usuarios del taller activo, permite crear/editar,
// activar/desactivar, eliminar (con guardas) e «iniciar sesión como» para
// demostrar permisos en clase. Todo local y simulado.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  UsersRound,
  Plus,
  MoreHorizontal,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { Button } from "@/components/ui/button";
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
import { TeamMemberFormDialog } from "@/components/app/TeamMemberFormDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { usersRepo } from "@/lib/db";
import {
  ROLE_LABELS,
  countActiveOwners,
  countOwners,
  listTeam,
  mechanicOrderCount,
} from "@/lib/team";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/equipo")({
  component: TeamPage,
});

function TeamPage() {
  const { user, tenant } = useAuth();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  const members = useMemo(() => {
    if (!tenant) return [];
    const order: Record<User["role"], number> = {
      owner: 0,
      staff: 1,
      mechanic: 2,
      superadmin: 3,
    };
    return listTeam(tenant.id)
      .slice()
      .sort(
        (a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, version]);

  if (!tenant || !user) return null;

  const locations = tenant.locations;
  const locName = (id?: string) =>
    locations.find((l) => l.id === id)?.name ?? "—";

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (m: User) => {
    setEditing(m);
    setFormOpen(true);
  };

  const toggleActive = (m: User) => {
    const deactivating = m.active !== false;
    if (
      deactivating &&
      m.role === "owner" &&
      countActiveOwners(tenant.id) <= 1
    ) {
      toast.error("Debe quedar al menos un propietario activo.");
      return;
    }
    usersRepo.update(m.id, { active: !deactivating });
    toast.success(deactivating ? "Usuario desactivado" : "Usuario activado");
    bump();
  };

  const askDelete = (m: User) => {
    if (m.role === "owner" && countOwners(tenant.id) <= 1) {
      toast.error("No puedes eliminar al último propietario del taller.");
      return;
    }
    setToDelete(m);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    usersRepo.remove(toDelete.id);
    toast.success("Usuario eliminado");
    setToDelete(null);
    bump();
  };

  const deleteOrders =
    toDelete && toDelete.role === "mechanic"
      ? mechanicOrderCount(tenant.id, toDelete.id)
      : 0;

  return (
    <div>
      <PageHeader
        title="Equipo"
        description="Usuarios y permisos del taller."
        actions={
          <Button onClick={openNew}>
            <Plus strokeWidth={1.5} />
            Nuevo usuario
          </Button>
        }
      />

      {members.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No hay usuarios"
          description="Añade el primer miembro del equipo."
          action={
            <Button onClick={openNew} size="sm">
              <Plus strokeWidth={1.5} />
              Nuevo usuario
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const inactive = m.active === false;
            const isSelf = m.id === user.id;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background-subtle text-sm font-medium text-foreground">
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.name}
                    </p>
                    {isSelf && (
                      <span className="rounded-md border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Tú
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm text-foreground">{ROLE_LABELS[m.role]}</p>
                  <p className="text-xs text-muted-foreground">
                    {locName(m.locationId)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                    inactive
                      ? "border-border bg-background-muted text-muted-foreground"
                      : "border-transparent text-[var(--success)]",
                  )}
                  style={
                    inactive
                      ? undefined
                      : {
                          backgroundColor:
                            "color-mix(in srgb, var(--success) 12%, transparent)",
                        }
                  }
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: inactive
                        ? "var(--foreground-subtle)"
                        : "var(--success)",
                    }}
                  />
                  {inactive ? "Inactivo" : "Activo"}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal strokeWidth={1.5} className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(m)}>
                      <Pencil strokeWidth={1.5} className="h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(m)}>
                      <Power strokeWidth={1.5} className="h-4 w-4" />
                      {inactive ? "Activar" : "Desactivar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => askDelete(m)}
                      className="text-[var(--destructive)] focus:text-[var(--destructive)]"
                    >
                      <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <TeamMemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenant.id}
        locations={locations}
        member={editing}
        currentUserId={user.id}
        onSaved={bump}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteOrders > 0
                ? `${toDelete?.name} está asignado a ${deleteOrders} orden${
                    deleteOrders === 1 ? "" : "es"
                  }. Las órdenes conservarán el histórico del mecánico. ¿Eliminar de todos modos?`
                : `¿Seguro que quieres eliminar a ${toDelete?.name}? Esta acción no se puede deshacer.`}
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

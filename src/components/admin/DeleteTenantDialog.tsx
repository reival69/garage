// Garage — superadmin: delete a workshop for good, after typing its name.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteTenant } from "@/lib/api/admin.functions";
import { flush } from "@/lib/db/storage";
import type { Tenant } from "@/types";
import { toast } from "sonner";

interface DeleteTenantDialogProps {
  tenant: Tenant | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => Promise<void> | void;
}

export function DeleteTenantDialog({ tenant, onOpenChange, onDeleted }: DeleteTenantDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName("");
    setError("");
  }, [tenant]);

  if (!tenant) return null;
  const matches = name.trim() === tenant.name.trim();

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await flush();
      const result = await deleteTenant({ data: { tenantId: tenant.id, confirmName: name } });
      if (!result.ok) {
        setError(result.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success(`Taller «${tenant.name}» eliminado.`);
      onOpenChange(false);
      await onDeleted();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar taller</DialogTitle>
          <DialogDescription>
            Se borrarán para siempre todos los datos de <strong>{tenant.name}</strong>: clientes,
            vehículos, órdenes, facturas, fotos y usuarios. Si paga con tarjeta, se cancela su
            suscripción.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) void remove();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="del-name">
              Para confirmar, escribe el nombre del taller: {tenant.name}
            </Label>
            <Input
              id="del-name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Si solo quieres que no pueda entrar, usa mejor «Suspender»: se puede deshacer.
          </p>
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || deleting}>
              {deleting ? "Eliminando…" : "Eliminar para siempre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

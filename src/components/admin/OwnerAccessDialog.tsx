// Garage — superadmin: see and change a workshop owner's login (email and password).
// If the workshop has no owner yet, it creates one.

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
import { ownerUserForTenant } from "@/lib/admin";
import { setPassword } from "@/lib/api/data.functions";
import { usersRepo } from "@/lib/db";
import { flush } from "@/lib/db/storage";
import type { Tenant } from "@/types";
import { toast } from "sonner";

interface OwnerAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSaved?: () => void;
}

export function OwnerAccessDialog({ open, onOpenChange, tenant, onSaved }: OwnerAccessDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const owner = tenant ? ownerUserForTenant(tenant.id) : undefined;

  useEffect(() => {
    if (!open) return;
    setName(owner?.name ?? "");
    setEmail(owner?.email ?? "");
    setPw("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenant]);

  if (!tenant) return null;

  const save = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError("Indica el nombre del responsable.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("Indica un email válido.");
    if (!owner && password.length < 10) return setError("La contraseña debe tener al menos 10 caracteres.");
    if (password && password.length < 10) return setError("La contraseña debe tener al menos 10 caracteres.");
    const taken = usersRepo
      .list()
      .some((u) => u.id !== owner?.id && u.email.toLowerCase() === cleanEmail);
    if (taken) return setError("Ese email ya lo usa otro usuario.");

    setSaving(true);
    setError("");
    try {
      let userId = owner?.id;
      if (owner) {
        if (owner.email !== cleanEmail || owner.name !== name.trim() || owner.active === false) {
          usersRepo.update(owner.id, { email: cleanEmail, name: name.trim(), active: true });
        }
      } else {
        userId = usersRepo.create({
          tenantId: tenant.id,
          name: name.trim(),
          email: cleanEmail,
          role: "owner",
          active: true,
          locationId: tenant.locations[0]?.id,
        }).id;
      }
      // The user must be saved on the server before it can get a password
      await flush();
      if (password && userId) {
        const result = await setPassword({ data: { userId, password } });
        if (!result.ok) return setError(result.error ?? "No se pudo guardar la contraseña.");
      }
      toast.success(password ? "Acceso guardado. Ya puede entrar con la nueva contraseña." : "Datos guardados.");
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Acceso del responsable</DialogTitle>
          <DialogDescription>
            {tenant.name}:{" "}
            {owner ? "email con el que entra y nueva contraseña." : "este taller aún no tiene responsable; créalo aquí."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="oa-name">Nombre</Label>
            <Input id="oa-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oa-email">Email para entrar</Label>
            <Input
              id="oa-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oa-password">{owner ? "Nueva contraseña" : "Contraseña"}</Label>
            <Input
              id="oa-password"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPw(e.target.value)}
              placeholder={owner ? "Déjala vacía para no cambiarla" : "Mínimo 10 caracteres"}
            />
            <p className="text-xs text-muted-foreground">
              Se muestra mientras la escribes para que puedas copiarla y dársela al responsable.
            </p>
          </div>
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

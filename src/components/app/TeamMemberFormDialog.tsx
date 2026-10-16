// Garage — create/edit team member dialog. Writes go through usersRepo.
// The superadmin role is never assignable here. The password is stored on the
// server only (setPassword), never in the user document.

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setPassword } from "@/lib/api/data.functions";
import { usersRepo } from "@/lib/db";
import { flush } from "@/lib/db/storage";
import { ROLE_LABELS } from "@/lib/team";
import type { Location, Role, User } from "@/types";
import { toast } from "sonner";

interface TeamMemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  locations: Location[];
  member?: User | null;
  /** The person using the dialog: they change their own password in Configuración. */
  currentUserId?: string;
  onSaved?: (user: User) => void;
}

const ASSIGNABLE_ROLES: Role[] = ["owner", "staff", "mechanic"];
const NO_LOCATION = "__none__";

interface FormState {
  name: string;
  email: string;
  role: Role;
  locationId: string;
  password: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  role: "mechanic",
  locationId: NO_LOCATION,
  password: "",
};

export function TeamMemberFormDialog({
  open,
  onOpenChange,
  tenantId,
  locations,
  member,
  currentUserId,
  onSaved,
}: TeamMemberFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const isSelf = !!member && member.id === currentUserId;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    if (member) {
      setForm({
        name: member.name,
        email: member.email,
        role: member.role === "superadmin" ? "staff" : member.role,
        locationId: member.locationId ?? NO_LOCATION,
        password: "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, member]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    if (!form.email.trim()) next.email = "El email es obligatorio.";
    else {
      const taken = usersRepo
        .list()
        .some(
          (u) =>
            u.id !== member?.id &&
            u.email.toLowerCase() === form.email.trim().toLowerCase(),
        );
      if (taken) next.email = "Ya existe un usuario con ese email.";
    }
    if (!member && form.password.length < 10)
      next.password = "Mínimo 10 caracteres.";
    else if (member && form.password && form.password.length < 10)
      next.password = "Mínimo 10 caracteres (o déjala vacía para no cambiarla).";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      locationId:
        form.locationId === NO_LOCATION ? undefined : form.locationId,
    };

    let saved: User | undefined;
    if (member) {
      saved = usersRepo.update(member.id, payload);
    } else {
      saved = usersRepo.create({
        tenantId,
        active: true,
        ...payload,
      } as Omit<User, "id">);
    }
    if (saved && form.password && !isSelf) {
      setSaving(true);
      try {
        // The user must exist on the server before it can get a password
        await flush();
        const result = await setPassword({
          data: { userId: saved.id, password: form.password },
        });
        if (!result.ok) {
          toast.error(`Usuario guardado, pero no la contraseña: ${result.error}`);
          if (saved) onSaved?.(saved);
          onOpenChange(false);
          return;
        }
      } finally {
        setSaving(false);
      }
    }
    toast.success(member ? "Usuario actualizado" : "Usuario creado");
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {member
              ? "Actualiza los datos y el rol del miembro."
              : "Añade un nuevo miembro al equipo del taller."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Nombre *</Label>
            <Input
              id="t-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nombre y apellidos"
              maxLength={120}
            />
            {errors.name && (
              <p className="text-xs text-[var(--destructive)]">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-email">Email *</Label>
            <Input
              id="t-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="persona@taller.es"
              maxLength={150}
            />
            {errors.email && (
              <p className="text-xs text-[var(--destructive)]">{errors.email}</p>
            )}
          </div>

          {!isSelf && (
            <div className="space-y-1.5">
              <Label htmlFor="t-password">
                {member ? "Nueva contraseña" : "Contraseña *"}
              </Label>
              <Input
                id="t-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder={
                  member
                    ? "Déjala vacía para no cambiarla"
                    : "Mínimo 10 caracteres"
                }
                maxLength={200}
              />
              {errors.password && (
                <p className="text-xs text-[var(--destructive)]">
                  {errors.password}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => set("role", v as Role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Select
                value={form.locationId}
                onValueChange={(v) => set("locationId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LOCATION}>Sin ubicación</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Guardando…" : member ? "Guardar" : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

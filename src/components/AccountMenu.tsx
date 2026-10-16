// Garage — the signed-in person's menu: change password and log out.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CreditCard, KeyRound, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword } from "@/lib/api/data.functions";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  /** "sidebar": full-width row with the user's name; "icon": compact button for mobile headers. */
  variant?: "sidebar" | "icon";
}

export function AccountMenu({ variant = "sidebar" }: AccountMenuProps) {
  const { user, impersonating, logout } = useAuth();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!user) return null;

  const signOut = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mi cuenta">
              <UserRound strokeWidth={1.5} className="h-4 w-4" />
            </Button>
          ) : (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <UserRound strokeWidth={1.5} className="h-4 w-4 shrink-0" />
              <span className="truncate">{user.name}</span>
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user.role === "owner" && (
            <DropdownMenuItem onClick={() => navigate({ to: "/app/suscripcion" })}>
              <CreditCard strokeWidth={1.5} className="h-4 w-4" />
              Suscripción
            </DropdownMenuItem>
          )}
          {!impersonating && (
            <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
              <KeyRound strokeWidth={1.5} className="h-4 w-4" />
              Cambiar contraseña
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut strokeWidth={1.5} className="h-4 w-4" />
            Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} userId={user.id} />
    </>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const close = (value: boolean) => {
    if (!value) {
      setCurrent("");
      setNext("");
      setRepeat("");
      setError("");
    }
    onOpenChange(value);
  };

  const submit = async () => {
    if (next.length < 10) return setError("La nueva contraseña debe tener al menos 10 caracteres.");
    if (next !== repeat) return setError("Las contraseñas nuevas no coinciden.");
    setSaving(true);
    try {
      const result = await setPassword({
        data: { userId, password: next, currentPassword: current },
      });
      if (!result.ok) return setError(result.error ?? "No se pudo cambiar la contraseña.");
      toast.success("Contraseña cambiada");
      close(false);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>Se cerrará la sesión en tus otros dispositivos.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Contraseña actual</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">Nueva contraseña</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 10 caracteres"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-repeat">Repite la nueva contraseña</Label>
            <Input
              id="pw-repeat"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Cambiar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, RotateCcw, Shield, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listAllAccessCodes,
  resetDemo,
  tenantsRepo,
  usersRepo,
} from "@/lib/db";
import { cn } from "@/lib/utils";

/** Event name used to open the hidden control panel from anywhere (logo long-press, /panel route). */
export const OPEN_PANEL_EVENT = "talleo:open-panel";

/** Dispatch to open the hidden control panel. */
export function openControlPanel() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_PANEL_EVENT));
  }
}

type View = "menu" | "taller" | "cliente";

/**
 * Hidden internal control panel for presentations. No visible trigger.
 * Open via: Ctrl/Cmd + Shift + K, long-press on the Talleo logo, or /panel.
 */
export function ControlPanel() {
  const { ready, login, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "k" || e.key === "K")
      ) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PANEL_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PANEL_EVENT, onOpen);
    };
  }, []);

  const tenants = useMemo(() => (open ? tenantsRepo.list() : []), [open]);
  const codes = useMemo(() => (open ? listAllAccessCodes() : []), [open]);

  if (!ready || !open) return null;

  const close = () => {
    setOpen(false);
    setView("menu");
  };

  const enterSuperadmin = () => {
    const admin = usersRepo.list().find((u) => u.role === "superadmin");
    if (admin) login(admin);
    close();
    navigate({ to: "/admin" });
  };

  const enterTenant = (tenantId: string) => {
    const owner =
      usersRepo.list().find((u) => u.tenantId === tenantId && u.role === "owner") ??
      usersRepo.list().find((u) => u.tenantId === tenantId);
    if (owner) login(owner);
    close();
    navigate({ to: "/app" });
  };

  const enterCustomer = (code: string) => {
    close();
    navigate({ to: "/c/$code", params: { code } });
  };

  const doReset = () => {
    resetDemo();
    refresh();
    close();
    navigate({ to: "/login" });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 p-4"
      onClick={close}
    >
      <div
        className="w-[min(92vw,24rem)] rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo className="text-base" />
            <span className="text-xs text-muted-foreground">Panel de control</span>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Cerrar"
          >
            <X strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {view === "menu" && (
            <div className="space-y-2">
              <p className="px-1 pb-1 text-xs text-muted-foreground">
                Cambiar de vista
              </p>
              <SwitchRow
                icon={Shield}
                title="Superadmin"
                subtitle="Panel del SaaS"
                onClick={enterSuperadmin}
              />
              <SwitchRow
                icon={Building2}
                title="Taller"
                subtitle="Vista del taller"
                onClick={() => setView("taller")}
              />
              <SwitchRow
                icon={Smartphone}
                title="Cliente"
                subtitle="Vista del cliente final"
                onClick={() => setView("cliente")}
              />

              <div className="pt-2">
                <Button variant="outline" className="w-full" onClick={doReset}>
                  <RotateCcw strokeWidth={1.5} />
                  Reiniciar datos
                </Button>
              </div>
            </div>
          )}

          {view === "taller" && (
            <div className="space-y-2">
              <BackRow onClick={() => setView("menu")} label="Elegir taller" />
              {tenants.map((t) => (
                <SwitchRow
                  key={t.id}
                  icon={Building2}
                  title={t.name}
                  subtitle={t.locations[0]?.name}
                  accent={t.accentColor}
                  onClick={() => enterTenant(t.id)}
                />
              ))}
            </div>
          )}

          {view === "cliente" && (
            <div className="space-y-2">
              <BackRow
                onClick={() => setView("menu")}
                label="Elegir código de acceso"
              />
              {codes.map((c) => (
                <SwitchRow
                  key={`${c.tenantId}-${c.code}`}
                  icon={Smartphone}
                  title={c.code}
                  subtitle={`${c.tenantName} · ${c.vehicle}`}
                  mono
                  onClick={() => enterCustomer(c.code)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SwitchRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  accent,
  mono,
}: {
  icon: typeof Shield;
  title: string;
  subtitle?: string;
  onClick: () => void;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-background-subtle"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
        style={accent ? { color: accent, borderColor: accent } : undefined}
      >
        <Icon strokeWidth={1.5} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium text-foreground",
            mono && "font-mono tracking-wider",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

function BackRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-2 px-1 pb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      ← {label}
    </button>
  );
}

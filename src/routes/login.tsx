import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Shield, Smartphone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthContext";
import { listAllAccessCodes, tenantsRepo, usersRepo } from "@/lib/db";
import type { Tenant } from "@/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acceder · Talleo" },
      { name: "description", content: "Accede a tu cuenta de Talleo." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [firstCode, setFirstCode] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setTenants(tenantsRepo.list());
    const codes = listAllAccessCodes();
    setFirstCode(codes[0]?.code ?? null);
  }, [ready]);

  // Simulated login: any credentials are accepted.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = usersRepo.list().find((u) => u.email === email.trim());
    if (match) {
      login(match);
      navigate({ to: match.role === "superadmin" ? "/admin" : "/app" });
      return;
    }
    const owner = usersRepo.list().find((u) => u.role === "owner");
    if (owner) {
      login(owner);
      navigate({ to: "/app" });
    }
  };

  const enterSuperadmin = () => {
    const admin = usersRepo.list().find((u) => u.role === "superadmin");
    if (admin) login(admin);
    navigate({ to: "/admin" });
  };

  const enterTenant = (tenantId: string) => {
    const owner = usersRepo.list().find((u) => u.tenantId === tenantId);
    if (owner) login(owner);
    navigate({ to: "/app" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background-subtle">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link to="/">
          <Logo className="text-lg" />
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Inicio
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Inicia sesión
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demo: cualquier acceso es válido.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@taller.es"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Acceder
              </Button>
            </form>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-card p-4">
            <p className="px-1 pb-2 text-xs text-muted-foreground">
              Accesos rápidos
            </p>
            <div className="space-y-2">
              <QuickRow
                icon={Shield}
                title="Superadmin"
                subtitle="Panel del SaaS"
                onClick={enterSuperadmin}
              />
              {tenants.map((t) => (
                <QuickRow
                  key={t.id}
                  icon={Building2}
                  title={t.name}
                  subtitle="Vista del taller"
                  accent={t.accentColor}
                  onClick={() => enterTenant(t.id)}
                />
              ))}
              {firstCode && (
                <QuickRow
                  icon={Smartphone}
                  title={`Cliente · ${firstCode}`}
                  subtitle="Vista del cliente final"
                  mono
                  onClick={() =>
                    navigate({ to: "/c/$code", params: { code: firstCode } })
                  }
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function QuickRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  accent,
  mono,
}: {
  icon: typeof Shield;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-border-strong"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
        style={accent ? { color: accent, borderColor: accent } : undefined}
      >
        <Icon strokeWidth={1.5} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-medium text-foreground ${mono ? "font-mono tracking-wider" : ""}`}
        >
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

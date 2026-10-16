import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthContext";
import { usersRepo } from "@/lib/db";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acceder · Garage" },
      { name: "description", content: "Accede a tu cuenta de Garage." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const problem = await signIn(email.trim(), password);
      if (problem) {
        setError(problem);
        return;
      }
      // The superadmin lands on the SaaS panel; workshop users on their workshop
      const me = usersRepo.list().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      navigate({ to: me?.role === "superadmin" ? "/admin" : "/app" });
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
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
              Accede con tu cuenta de Garage.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  autoComplete="email"
                  required
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
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Accediendo…" : "Acceder"}
              </Button>
              <p className="text-xs text-muted-foreground">
                ¿Olvidaste tu contraseña? Pide al responsable de tu taller que te asigne una nueva.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

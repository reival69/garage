import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthContext";
import { usersRepo } from "@/lib/db";
import { toast } from "sonner";

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
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = usersRepo.list().find((u) => u.email === email.trim());
    if (match && match.active === false) {
      toast.error("Esta cuenta está desactivada. Contacta con el taller.");
      return;
    }
    if (match && match.role !== "superadmin") {
      login(match);
      navigate({ to: "/app" });
      return;
    }
    const owner = usersRepo
      .list()
      .find((u) => u.role === "owner" && u.active !== false);
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
              Accede con tu cuenta de Garage.
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
        </div>
      </main>
    </div>
  );
}

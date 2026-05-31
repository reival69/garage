import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  MessageSquareText,
  ScanLine,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Talleo — Software para talleres mecánicos" },
      {
        name: "description",
        content:
          "Gestiona órdenes de reparación, citas e inspección digital. Tus clientes siguen el estado de su coche con un código, sin registro.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Gestión de órdenes",
    body: "Controla cada reparación de principio a fin: estado, presupuesto, fotos y entrega en un solo lugar.",
  },
  {
    icon: MessageSquareText,
    title: "Comunicación por código",
    body: "Tu cliente entra con un código de 6 dígitos desde el móvil y sigue su coche en tiempo real. Sin registro.",
  },
  {
    icon: ScanLine,
    title: "Inspección digital",
    body: "Documenta el estado del vehículo con un semáforo claro: OK, atención y crítico. Todo con fotos.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo className="text-lg" />
        <Button asChild size="sm" variant="outline">
          <Link to="/login">Acceder</Link>
        </Button>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-md border border-border bg-background-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
              Software para talleres mecánicos
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              El taller, ordenado.
              <br />
              El cliente, informado.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Talleo reúne órdenes de reparación, citas y la comunicación con tus
              clientes en una sola herramienta clara y rápida.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/login">
                  Acceder <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
            </div>

          </div>
        </section>

        {/* Features */}
        <section className="border-y border-border bg-background-subtle">
          <div className="mx-auto grid max-w-6xl gap-4 px-6 py-16 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-border-strong"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground">
                  <f.icon strokeWidth={1.5} className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <span>© {new Date().getFullYear()} Talleo</span>
        </div>
      </footer>
    </div>
  );
}


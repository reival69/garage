import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Reveal } from "@/components/marketing/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Solicitar demo · Talleo" },
      {
        name: "description",
        content:
          "Pide una demo de Talleo. Cuéntanos sobre tu taller y te mostramos cómo ordenar el trabajo y mantener al cliente informado.",
      },
      { property: "og:title", content: "Solicitar demo · Talleo" },
      {
        property: "og:description",
        content: "Pide una demo de Talleo y descubre cómo ordenar tu taller.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", workshop: "", message: "" });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Envío simulado: nada sale del navegador.
    setSent(true);
  };

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-2xl px-6 py-16">
        {sent ? (
          <Reveal className="rounded-2xl border border-border bg-card p-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" strokeWidth={1.5} />
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
              ¡Gracias, {form.name || "te hemos recibido"}!
            </h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Hemos recibido tu solicitud de demo (envío simulado, nada sale del navegador). Te
              contactaríamos en breve en {form.email || "tu email"}.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/">
                  <ArrowLeft strokeWidth={1.5} /> Volver al inicio
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setSent(false)}>
                Enviar otra solicitud
              </Button>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal className="max-w-xl">
              <span className="inline-flex items-center rounded-md border border-border bg-background-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
                Contacto
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Solicita una demo
              </h1>
              <p className="mt-4 text-muted-foreground">
                Cuéntanos sobre tu taller y te enseñamos Talleo en acción. Sin compromiso.
              </p>
            </Reveal>

            <Reveal delay={100} className="mt-10">
              <form
                onSubmit={handleSubmit}
                className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={update("name")}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={update("email")}
                    placeholder="tu@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workshop">Taller</Label>
                  <Input
                    id="workshop"
                    value={form.workshop}
                    onChange={update("workshop")}
                    placeholder="Nombre de tu taller"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    required
                    rows={4}
                    value={form.message}
                    onChange={update("message")}
                    placeholder="¿Qué te gustaría mejorar en tu taller?"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full">
                  Enviar solicitud
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Envío simulado. Todo es local: nada sale de tu navegador.
                </p>
              </form>
            </Reveal>
          </>
        )}
      </section>
    </MarketingLayout>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, BookOpen, Newspaper, Mail, ArrowRight } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Reveal } from "@/components/marketing/Reveal";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos · Talleo" },
      {
        name: "description",
        content:
          "Centro de ayuda, documentación, blog y contacto de Talleo. Todo lo que necesitas para sacar partido al software de tu taller.",
      },
      { property: "og:title", content: "Recursos · Talleo" },
      {
        property: "og:description",
        content: "Centro de ayuda, documentación, blog y contacto de Talleo.",
      },
    ],
  }),
  component: ResourcesPage,
});

const RESOURCES = [
  {
    icon: LifeBuoy,
    title: "Centro de ayuda",
    body: "Guías rápidas y respuestas a las dudas más frecuentes del taller.",
    to: "/contacto" as const,
    cta: "Explorar ayuda",
  },
  {
    icon: BookOpen,
    title: "Documentación",
    body: "Cómo configurar tu taller, órdenes, inspección, presupuestos y más.",
    to: "/contacto" as const,
    cta: "Ver documentación",
  },
  {
    icon: Newspaper,
    title: "Blog",
    body: "Ideas y buenas prácticas para gestionar tu taller y fidelizar clientes.",
    to: "/contacto" as const,
    cta: "Leer el blog",
  },
  {
    icon: Mail,
    title: "Contacto",
    body: "¿Tienes dudas? Escríbenos y te respondemos lo antes posible.",
    to: "/contacto" as const,
    cta: "Contactar",
  },
];

function ResourcesPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal className="max-w-2xl">
          <span className="inline-flex items-center rounded-md border border-border bg-background-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
            Recursos
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Aprende a sacar partido a Talleo
          </h1>
          <p className="mt-4 text-muted-foreground">
            Ayuda, documentación, novedades y contacto, todo en un solo sitio. Esta es una demo:
            las secciones enlazan a contacto como placeholders.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {RESOURCES.map((r, i) => (
            <Reveal key={r.title} delay={i * 90}>
              <Link
                to={r.to}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-border-strong"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground">
                  <r.icon strokeWidth={1.5} className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{r.title}</h2>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{r.body}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  {r.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}

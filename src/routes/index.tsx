import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  MessageSquareText,
  ScanLine,
  FileSignature,
  CalendarClock,
  Receipt,
  BellRing,
  Building2,
  Check,
  Star,
  Clock,
  ShieldCheck,
  PhoneOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Reveal } from "@/components/marketing/Reveal";
import {
  KanbanMockup,
  PhoneClientView,
  InspectionCard,
  FlowDiagram,
} from "@/components/marketing/graphics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Talleo — Gestiona tu taller y mantén al cliente informado" },
      {
        name: "description",
        content:
          "Talleo reúne órdenes, inspección digital, presupuestos con aprobación, reserva online y facturación. Tus clientes siguen su coche en tiempo real con un código.",
      },
      { property: "og:title", content: "Talleo — Software para talleres mecánicos" },
      {
        property: "og:description",
        content:
          "Órdenes, DVI, presupuestos con firma, reserva online y facturación. El cliente sigue su coche con un código, sin registro.",
      },
    ],
  }),
  component: Landing,
});

/* -------------------------------------------------------------------------- */

const TRUST = ["Garaje Norte", "AutoExprés", "Talleres Vega", "MecaPro", "RuedaViva", "BoxCar"];

const PAINS = [
  {
    icon: PhoneOff,
    title: "El teléfono no para",
    body: "«¿Está listo mi coche?» Talleo informa al cliente en tiempo real y bajan las llamadas.",
  },
  {
    icon: ClipboardList,
    title: "Órdenes desordenadas",
    body: "Pierdes el hilo entre papeles y WhatsApp. Un tablero claro de Recibido a Entregado.",
  },
  {
    icon: ShieldCheck,
    title: "Presupuestos sin aprobar",
    body: "Trabajos sin OK por escrito. El cliente aprueba y firma desde el móvil, con registro.",
  },
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Órdenes con pipeline",
    body: "Cada reparación de Recibido a Entregado, con estado, fotos y responsable.",
  },
  {
    icon: MessageSquareText,
    title: "Vista cliente por código",
    body: "Tu cliente entra con un código de 6 dígitos desde el móvil. Sin registro.",
  },
  {
    icon: ScanLine,
    title: "Inspección digital (DVI)",
    body: "Semáforo OK / atención / crítico con fotos por cada punto revisado.",
  },
  {
    icon: FileSignature,
    title: "Presupuestos con firma",
    body: "El cliente aprueba y firma desde el móvil. Garantía por línea.",
  },
  {
    icon: CalendarClock,
    title: "Reserva online",
    body: "Tu página pública recibe citas que entran directas a la agenda del taller.",
  },
  {
    icon: Receipt,
    title: "Facturación",
    body: "De la orden a la factura imprimible en un clic, con historial del vehículo.",
  },
  {
    icon: BellRing,
    title: "Recordatorios de mantenimiento",
    body: "Avisos por fecha o kilómetros para que el cliente vuelva a tiempo.",
  },
  {
    icon: Building2,
    title: "Multi-taller y multi-moneda",
    body: "Gestiona varios talleres y monedas desde una sola plataforma.",
  },
];

const AUDIENCES = [
  {
    title: "Para el taller",
    body: "Ordena el trabajo del día, reparte tareas y entrega más rápido con menos fricción.",
  },
  {
    title: "Para el cliente",
    body: "Sigue su coche en tiempo real, aprueba presupuestos y guarda sus facturas.",
  },
  {
    title: "Para la plataforma",
    body: "Administra varios talleres, planes y límites desde un único panel central.",
  },
];

const PLANS = [
  {
    name: "Básico",
    price: 29,
    featured: false,
    blurb: "Para empezar a ordenar el taller.",
    limits: ["Hasta 50 órdenes/mes", "3 usuarios", "6 fotos por orden"],
  },
  {
    name: "Pro",
    price: 79,
    featured: true,
    blurb: "El equilibrio ideal para talleres en marcha.",
    limits: ["Hasta 300 órdenes/mes", "10 usuarios", "15 fotos por orden", "Reserva online"],
  },
  {
    name: "Premium",
    price: 149,
    featured: false,
    blurb: "Para talleres grandes y multi-sede.",
    limits: ["Hasta 2.000 órdenes/mes", "50 usuarios", "40 fotos por orden", "Multi-taller"],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Desde que usamos Talleo, las llamadas de «¿está listo?» han bajado a la mitad. El cliente lo ve todo.",
    name: "Marta Ruiz",
    role: "Garaje Norte",
  },
  {
    quote:
      "La inspección con semáforo y fotos nos ha hecho ganar confianza. Aprueban presupuestos sin discutir.",
    name: "Diego Fernández",
    role: "AutoExprés",
  },
  {
    quote: "Montar la reserva online fue inmediato. Ahora las citas entran solas en la agenda.",
    name: "Lucía Ortega",
    role: "Talleres Vega",
  },
];

const FAQ = [
  {
    q: "¿Necesito instalar algo?",
    a: "No. Talleo funciona en el navegador, desde el ordenador del taller o el móvil. Esta es una demo local y simulada que se guarda en tu navegador.",
  },
  {
    q: "¿Cómo ve el cliente su coche?",
    a: "Le compartes un código de 6 dígitos. Con él entra desde su móvil y sigue el estado, ve la inspección con fotos, aprueba presupuestos y guarda sus facturas. Sin registro.",
  },
  {
    q: "¿Puedo usar mi marca?",
    a: "Sí. Puedes personalizar el logo y el color de acento de tu taller para que la vista del cliente y tu página pública luzcan tu identidad.",
  },
  {
    q: "¿Puedo recibir citas online?",
    a: "Sí. Tu página pública permite a los clientes pedir cita; la reserva entra directa en la agenda del taller con su aviso.",
  },
  {
    q: "¿Gestiono varios talleres?",
    a: "Con el plan adecuado, sí. La plataforma soporta multi-taller y multi-moneda desde un panel central.",
  },
  {
    q: "¿Mis datos salen del navegador?",
    a: "En esta demo, no. Todo es local y simulado: nada se envía a ningún servidor.",
  },
];

/* -------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-background-subtle px-3 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function Landing() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-2 lg:pt-20">
          <Reveal>
            <SectionLabel>Software para talleres mecánicos</SectionLabel>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              El taller, ordenado.
              <br />
              El cliente, informado.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
              Talleo reúne órdenes, inspección digital, presupuestos con aprobación, reserva online
              y facturación. Tus clientes siguen su coche en tiempo real con un código.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/contacto">
                  Solicitar demo <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Acceder</Link>
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-success" /> Sin instalación
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-success" /> El cliente sin registro
              </span>
            </div>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div className="relative">
              <KanbanMockup />
              <PhoneClientView className="absolute -bottom-10 -right-2 hidden sm:block lg:-right-6" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border bg-background-subtle">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
            Talleres que confían en Talleo
          </p>
          <div className="mt-5 grid grid-cols-2 items-center gap-6 opacity-60 sm:grid-cols-3 lg:grid-cols-6">
            {TRUST.map((name) => (
              <div
                key={name}
                className="text-center text-sm font-semibold tracking-tight text-muted-foreground"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem -> solution */}
      <section id="producto" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>El problema</SectionLabel>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              El día a día del taller, sin caos
            </h2>
            <p className="mt-4 text-muted-foreground">
              Talleo sustituye papeles, llamadas y mensajes sueltos por un flujo claro que tu equipo
              y tus clientes entienden a la primera.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PAINS.map((p, i) => (
              <Reveal as="article" key={p.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 transition-colors hover:border-border-strong">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground">
                    <p.icon strokeWidth={1.5} className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* product visual */}
          <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
            <Reveal>
              <InspectionCard />
            </Reveal>
            <Reveal delay={120}>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                Inspección que genera confianza
              </h3>
              <p className="mt-3 text-muted-foreground">
                Documenta cada punto con un semáforo claro y fotos. El cliente entiende qué urge y
                qué puede esperar, y aprueba sin dudas.
              </p>
              <ul className="mt-5 space-y-2.5">
                {["Semáforo OK, atención y crítico", "Fotos por cada punto", "Visible para el cliente al instante"].map(
                  (li) => (
                    <li key={li} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-success" /> {li}
                    </li>
                  ),
                )}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="scroll-mt-20 border-y border-border bg-background-subtle">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>Funciones</SectionLabel>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Todo lo que el taller necesita
            </h2>
            <p className="mt-4 text-muted-foreground">
              Un sistema completo, del primer contacto a la entrega y el seguimiento.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal as="article" key={f.title} delay={(i % 4) * 80}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 transition-transform hover:-translate-y-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground">
                    <f.icon strokeWidth={1.5} className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — dark band */}
      <section id="como-funciona" className="scroll-mt-20 bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="max-w-2xl">
            <span className="inline-flex items-center rounded-md border border-background/20 px-3 py-1 text-xs font-medium text-background/70">
              Cómo funciona
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Cuatro pasos, de la recepción al cobro
            </h2>
            <p className="mt-4 text-background/70">
              Un flujo simple que tu equipo aprende en minutos y tus clientes siguen sin esfuerzo.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-10 [&_*]:!border-background/15">
            <div className="rounded-3xl bg-background/[0.03] p-1">
              <FlowDiagram className="[&_.bg-card]:bg-background/5 [&_.text-foreground]:text-background [&_.text-muted-foreground]:text-background/60" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="max-w-2xl">
          <SectionLabel>Para quién</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Una herramienta, tres vistas
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={i * 100}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="scroll-mt-20 border-y border-border bg-background-subtle">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionLabel>Precios</SectionLabel>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Planes claros, sin sorpresas
            </h2>
            <p className="mt-4 text-muted-foreground">
              Elige el plan según el tamaño de tu taller. Cambia cuando lo necesites.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border bg-card p-6",
                    plan.featured
                      ? "border-primary shadow-xl shadow-primary/10 lg:-translate-y-2"
                      : "border-border",
                  )}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Recomendado
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">
                      {plan.price} €
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">/ mes</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.limits.map((l) => (
                      <li key={l} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 shrink-0 text-success" /> {l}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-6"
                    variant={plan.featured ? "default" : "outline"}
                  >
                    <Link to="/contacto">Solicitar demo</Link>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="max-w-2xl">
          <SectionLabel>Testimonios</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Talleres que ya trabajan mejor
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                <div className="flex gap-0.5 text-foreground">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-current" strokeWidth={0} />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm text-foreground">“{t.quote}”</blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <span className="block text-muted-foreground">{t.role}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border bg-background-subtle">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <Reveal className="text-center">
            <SectionLabel>Preguntas frecuentes</SectionLabel>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Resolvemos tus dudas
            </h2>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <Accordion type="single" collapsible className="w-full">
              {FAQ.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-base">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <Reveal>
            <Clock className="mx-auto h-8 w-8 text-background/70" strokeWidth={1.5} />
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Ordena tu taller esta semana
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-background/70">
              Pide una demo y descubre cómo Talleo reduce llamadas, acelera entregas y mejora la
              experiencia de tus clientes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link to="/contacto">
                  Solicitar demo <ArrowRight strokeWidth={1.5} />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
              >
                <Link to="/login">Acceder</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}

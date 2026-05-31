import {
  Car,
  Wrench,
  CheckCircle2,
  CircleDot,
  Camera,
  PenLine,
  ClipboardList,
  Smartphone,
  HandCoins,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Traffic-light dot                                                          */
/* -------------------------------------------------------------------------- */

function SemaphoreDot({ state }: { state: "ok" | "warn" | "crit" }) {
  const color =
    state === "ok" ? "bg-success" : state === "warn" ? "bg-warning" : "bg-destructive";
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", color)} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Kanban order board mockup                                                  */
/* -------------------------------------------------------------------------- */

const KANBAN: Array<{ title: string; tone: string; cards: Array<{ plate: string; car: string }> }> =
  [
    {
      title: "Recibido",
      tone: "text-muted-foreground",
      cards: [
        { plate: "4821 KLM", car: "Seat León" },
        { plate: "7390 BCD", car: "VW Golf" },
      ],
    },
    {
      title: "Diagnóstico",
      tone: "text-muted-foreground",
      cards: [{ plate: "1145 FGH", car: "Renault Clio" }],
    },
    {
      title: "Reparación",
      tone: "text-muted-foreground",
      cards: [
        { plate: "9087 JKL", car: "Audi A3" },
        { plate: "5521 PQR", car: "Ford Focus" },
      ],
    },
    {
      title: "Entregado",
      tone: "text-success",
      cards: [{ plate: "3344 XYZ", car: "BMW Serie 1" }],
    },
  ];

export function KanbanMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-xl shadow-foreground/5",
        className,
      )}
      aria-hidden
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
          Órdenes de hoy
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KANBAN.map((col) => (
          <div key={col.title} className="rounded-xl bg-background-subtle p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className={cn("text-[11px] font-semibold uppercase tracking-wide", col.tone)}>
                {col.title}
              </span>
              <span className="text-[11px] text-muted-foreground">{col.cards.length}</span>
            </div>
            <div className="space-y-2">
              {col.cards.map((c) => (
                <div
                  key={c.plate}
                  className="rounded-lg border border-border bg-card p-2 transition-transform hover:-translate-y-0.5"
                >
                  <div className="text-[11px] font-semibold text-foreground">{c.plate}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Car className="h-3 w-3" strokeWidth={1.75} />
                    {c.car}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Phone — client view                                                        */
/* -------------------------------------------------------------------------- */

const TIMELINE = [
  { label: "Recepción", done: true },
  { label: "Inspección", done: true },
  { label: "En reparación", done: true, current: true },
  { label: "Entrega", done: false },
];

export function PhoneClientView({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-[200px] rounded-[2rem] border-[6px] border-foreground bg-foreground p-1.5 shadow-2xl shadow-foreground/20",
        className,
      )}
      aria-hidden
    >
      <div className="overflow-hidden rounded-[1.5rem] bg-background">
        {/* status bar */}
        <div className="flex items-center justify-between px-4 pb-1 pt-2 text-[9px] text-muted-foreground">
          <span>9:41</span>
          <span className="h-1 w-10 rounded-full bg-foreground/80" />
          <span>100%</span>
        </div>
        <div className="px-4 pb-4">
          <div className="text-[10px] text-muted-foreground">Tu coche · 9087 JKL</div>
          <div className="text-sm font-semibold text-foreground">Audi A3 Sportback</div>

          {/* timeline */}
          <div className="mt-3 space-y-2.5">
            {TIMELINE.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[8px]",
                      step.done
                        ? "bg-primary text-primary-foreground"
                        : "border border-border-strong bg-card text-muted-foreground",
                    )}
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-[10px]",
                    step.current
                      ? "font-semibold text-foreground"
                      : step.done
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* DVI semaphore */}
          <div className="mt-3 rounded-lg border border-border bg-background-subtle p-2">
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              Inspección
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-foreground">
                <SemaphoreDot state="ok" /> Frenos
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-foreground">
                <SemaphoreDot state="warn" /> Neumáticos
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-foreground">
                <SemaphoreDot state="crit" /> Pastillas
              </div>
            </div>
          </div>

          {/* approve button */}
          <button className="mt-3 w-full rounded-lg bg-primary py-2 text-[10px] font-semibold text-primary-foreground">
            Aprobar presupuesto · 248 €
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inspection mini-card                                                       */
/* -------------------------------------------------------------------------- */

export function InspectionCard({ className }: { className?: string }) {
  const items: Array<{ label: string; state: "ok" | "warn" | "crit" }> = [
    { label: "Aceite y filtros", state: "ok" },
    { label: "Suspensión", state: "ok" },
    { label: "Neumáticos", state: "warn" },
    { label: "Pastillas de freno", state: "crit" },
  ];
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-lg shadow-foreground/5", className)}
      aria-hidden
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Camera className="h-4 w-4" strokeWidth={1.75} />
        Inspección digital (DVI)
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-center justify-between rounded-lg bg-background-subtle px-3 py-2"
          >
            <span className="text-xs text-foreground">{it.label}</span>
            <SemaphoreDot state={it.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Flow diagram — 4 steps                                                     */
/* -------------------------------------------------------------------------- */

const FLOW = [
  { icon: Car, title: "Recibes el coche", body: "Creas la orden en segundos." },
  { icon: ClipboardList, title: "Inspección + presupuesto", body: "DVI con fotos y semáforo." },
  { icon: Smartphone, title: "El cliente aprueba", body: "Desde el móvil, con su código." },
  { icon: HandCoins, title: "Entregas y cobras", body: "Factura y reseña al instante." },
];

export function FlowDiagram({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {FLOW.map((step, i) => (
        <div key={step.title} className="relative">
          <div className="h-full rounded-2xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground">
              <step.icon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paso {i + 1}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
          </div>
          {i < FLOW.length - 1 && (
            <ArrowRight
              className="absolute -right-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border-strong lg:block"
              strokeWidth={1.5}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export { SemaphoreDot };

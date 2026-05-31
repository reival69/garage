import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

interface StatusMeta {
  label: string;
  tone: Tone;
}

// Central dictionary: every domain status -> Spanish label + visual tone.
const STATUS_MAP: Record<string, StatusMeta> = {
  // WorkOrderStatus
  recibido: { label: "Recibido", tone: "neutral" },
  diagnostico: { label: "Diagnóstico", tone: "accent" },
  presupuesto_enviado: { label: "Presupuesto enviado", tone: "warning" },
  aprobado: { label: "Aprobado", tone: "accent" },
  en_reparacion: { label: "En reparación", tone: "accent" },
  listo: { label: "Listo", tone: "success" },
  entregado: { label: "Entregado", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "danger" },
  // AppointmentStatus
  programada: { label: "Programada", tone: "neutral" },
  confirmada: { label: "Confirmada", tone: "accent" },
  en_taller: { label: "En taller", tone: "accent" },
  completada: { label: "Completada", tone: "success" },
  no_show: { label: "No presentado", tone: "danger" },
  // Invoice status
  pending: { label: "Pendiente", tone: "warning" },
  paid: { label: "Pagada", tone: "success" },
  partial: { label: "Parcial", tone: "warning" },
  // Tenant / generic
  active: { label: "Activo", tone: "success" },
  suspended: { label: "Suspendido", tone: "danger" },
  // Inspection severity
  ok: { label: "OK", tone: "success" },
  atencion: { label: "Atención", tone: "warning" },
  critico: { label: "Crítico", tone: "danger" },
};

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-background-subtle text-muted-foreground border-border",
  success:
    "border-transparent text-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
  warning:
    "border-transparent text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]",
  danger:
    "border-transparent text-[var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]",
  accent:
    "border-transparent text-[var(--talleo-accent)] bg-[color-mix(in_srgb,var(--talleo-accent)_12%,transparent)]",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_MAP[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

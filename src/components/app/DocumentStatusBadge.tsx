// Talleo — traffic-light badge for a vehicle document's expiry status
// (vigente / por vencer / vencido). Shared between the management view and the
// public cartilla so the colours stay consistent.

import { cn } from "@/lib/utils";
import { DOCUMENT_STATUS_LABELS, type DocumentStatus } from "@/lib/documents";

const TONE: Record<DocumentStatus, string> = {
  vigente:
    "border-transparent text-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
  por_vencer:
    "border-transparent text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]",
  vencido:
    "border-transparent text-[var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]",
};

export function DocumentStatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        TONE[status],
        className,
      )}
    >
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

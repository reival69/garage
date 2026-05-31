import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Generic surface card with optional header. */
export function DataCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: DataCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card transition-colors hover:border-border-strong",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="space-y-0.5">
            {title && (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

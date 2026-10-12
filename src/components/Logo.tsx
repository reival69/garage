import { useRef } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Optional dot color (defaults to brand accent). */
  showMark?: boolean;
  /** Optional tenant logo (base64). When set, it replaces the wordmark. */
  logoUrl?: string | null;
}

const LONG_PRESS_MS = 1000;

/** Garage wordmark — Plus Jakarta Sans 700, monochrome. */
export function Logo({ className, logoUrl }: LogoProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    clear();
    timer.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("talleo:open-panel"));
      }
    }, LONG_PRESS_MS);
  };

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo del taller"
        onPointerDown={start}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        className={cn("h-7 w-auto max-w-[140px] object-contain select-none", className)}
      />
    );
  }

  return (
    <span
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      className={cn(
        "inline-flex items-center gap-1.5 text-foreground select-none",
        className,
      )}
    >
      <span className="text-[1.35rem] font-bold leading-none tracking-tight">Garage</span>
    </span>
  );
}

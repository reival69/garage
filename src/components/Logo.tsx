import { useRef } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Optional dot color (defaults to brand accent). */
  showMark?: boolean;
}

const LONG_PRESS_MS = 1000;

/** Talleo wordmark — Plus Jakarta Sans 700, monochrome. */
export function Logo({ className, showMark = true }: LogoProps) {
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

  return (
    <span
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      className={cn(
        "inline-flex items-center gap-1.5 font-bold tracking-tight text-foreground select-none",
        className,
      )}
    >
      {showMark && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--talleo-accent)" }}
          aria-hidden
        />
      )}
      Talleo
    </span>
  );
}

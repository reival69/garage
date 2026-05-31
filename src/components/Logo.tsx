import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Optional dot color (defaults to brand accent). */
  showMark?: boolean;
}

/** Talleo wordmark — Plus Jakarta Sans 700, monochrome. */
export function Logo({ className, showMark = true }: LogoProps) {
  return (
    <span
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

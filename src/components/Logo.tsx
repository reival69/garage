import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Optional dot color (defaults to brand accent). */
  showMark?: boolean;
  /** Optional tenant logo. When set, it replaces the wordmark. */
  logoUrl?: string | null;
}

/** Garage wordmark — Plus Jakarta Sans 700, monochrome. */
export function Logo({ className, logoUrl }: LogoProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo del taller"
        className={cn("h-7 w-auto max-w-[140px] object-contain select-none", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-foreground select-none",
        className,
      )}
    >
      <span className="text-[1.35rem] font-bold leading-none tracking-tight">Garage</span>
    </span>
  );
}

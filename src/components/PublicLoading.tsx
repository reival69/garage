// Talleo — branded loading state for public routes (/t/:slug, /c/:code,
// /v/:code). Shown until the client has mounted and the localStorage lookup
// has run, so we never flash the "not found" error during SSR/hydration.

import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export function PublicLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-subtle px-6 text-center">
      <Logo className="text-lg" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 strokeWidth={1.5} className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}

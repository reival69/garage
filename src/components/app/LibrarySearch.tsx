// Garage — Biblioteca search box + results. Used in /app/biblioteca and inside
// a work order ("Info técnica"). Each result cites document + page and opens
// the PDF at that page.

import { useState } from "react";
import { FileText, Loader2, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LIBRARY_CATEGORY_LABELS,
  openLibraryDocument,
  searchLibrary,
  type LibraryHit,
} from "@/lib/library";
import type { LibraryDocument } from "@/types";
import { toast } from "sonner";

interface Props {
  docs: LibraryDocument[];
  placeholder?: string;
  /** Short note under the box, e.g. which documents are being searched. */
  scopeLabel?: string;
  limit?: number;
}

export function openDocSafe(id: string, page?: number) {
  try {
    openLibraryDocument(id, page);
  } catch {
    toast.error("No se pudo abrir el PDF.");
  }
}

export function LibrarySearch({ docs, placeholder, scopeLabel, limit = 10 }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<LibraryHit[] | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      setHits(await searchLibrary(docs, q, limit));
      setLastQuery(q);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error && err.message
          ? `No se pudo buscar: ${err.message}`
          : "No se pudo buscar en la biblioteca.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={run} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder ?? "Ej.: par de apriete culata, capacidad aceite…"}
            className="pl-9"
            aria-label="Buscar en la biblioteca"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <Search strokeWidth={1.5} />}
          Buscar
        </Button>
      </form>
      {scopeLabel && <p className="text-xs text-muted-foreground">{scopeLabel}</p>}

      {hits && hits.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nada encontrado para «{lastQuery}». Prueba con otras palabras (p. ej. el código de motor
          o el nombre de la pieza).
        </p>
      )}

      {hits && hits.length > 0 && (
        <ul className="space-y-2">
          {hits.map((h) => (
            <li key={`${h.doc.id}-${h.page}`}>
              <button
                type="button"
                onClick={() => openDocSafe(h.doc.id, h.page)}
                className="group w-full rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-border-strong"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium text-foreground">{h.doc.title}</span>
                  <span className="shrink-0">· pág. {h.page}</span>
                  <span className="hidden shrink-0 sm:inline">
                    · {LIBRARY_CATEGORY_LABELS[h.doc.category]}
                  </span>
                  <ExternalLink
                    strokeWidth={1.5}
                    className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {h.snippet.map((s, i) =>
                    s.hit ? (
                      <mark
                        key={i}
                        className="rounded bg-primary/15 px-0.5 font-medium text-foreground"
                      >
                        {s.text}
                      </mark>
                    ) : (
                      <span key={i}>{s.text}</span>
                    ),
                  )}
                </p>
                {h.matched < h.totalTerms && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Coinciden {h.matched} de {h.totalTerms} palabras
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

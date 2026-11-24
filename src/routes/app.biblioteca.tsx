// Garage — Biblioteca técnica. The shop's own PDFs (manuals it has licensed,
// technical bulletins, wiring diagrams, notes) with page-level keyword search.
// Text extraction and storage happen in the browser (pdf.js + IndexedDB).
// Phase 1 demo: no LLM — results are the best-matching pages with a snippet.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, FileText, MoreHorizontal, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";
import { DataCard } from "@/components/base/DataCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LibraryDocFormDialog } from "@/components/app/LibraryDocFormDialog";
import { LibrarySearch, openDocSafe } from "@/components/app/LibrarySearch";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  LIBRARY_CATEGORY_LABELS,
  formatBytes,
  listLibrary,
  removeLibraryDocument,
  vehicleTagLabel,
} from "@/lib/library";
import { formatDate } from "@/lib/format";
import { canEdit } from "@/lib/permissions";
import type { LibraryDocument } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/biblioteca")({
  component: LibraryPage,
});

function LibraryPage() {
  const { tenant, user } = useAuth();
  const [version, setVersion] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryDocument | null>(null);
  const [deleting, setDeleting] = useState<LibraryDocument | null>(null);

  const docs = useMemo(
    () => (tenant ? listLibrary(tenant.id) : []),
    [tenant?.id, version],
  );

  if (!tenant || !user) return null;
  const editable = canEdit(user.role, "biblioteca");
  const refresh = () => setVersion((v) => v + 1);
  const totalPages = docs.reduce((n, d) => n + d.pageCount, 0);

  const confirmDelete = async () => {
    if (!deleting) return;
    const title = deleting.title;
    setDeleting(null);
    try {
      await removeLibraryDocument(tenant.id, deleting.id);
      toast.success(`«${title}» eliminado`);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar el archivo.");
    }
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Biblioteca"
        description="Tus manuales y documentos técnicos en PDF, con buscador por página."
        actions={
          editable && (
            <Button onClick={() => setUploadOpen(true)}>
              <Plus strokeWidth={1.5} />
              Subir PDF
            </Button>
          )
        }
      />

      {docs.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Tu biblioteca está vacía"
          description="Sube los manuales de taller, boletines o esquemas que ya tienes. Podrás buscar dentro de ellos y verlos sugeridos en cada orden según el vehículo."
          action={
            editable && (
              <Button onClick={() => setUploadOpen(true)}>
                <Plus strokeWidth={1.5} />
                Subir el primer PDF
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          <DataCard title="Buscar en la biblioteca" bodyClassName="p-5">
            <LibrarySearch
              docs={docs}
              scopeLabel={`${docs.length} ${docs.length === 1 ? "documento" : "documentos"} · ${totalPages} páginas`}
            />
          </DataCard>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Documentos</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {docs.map((d) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  editable={editable}
                  onOpen={() => openDocSafe(d.id)}
                  onEdit={() => setEditing(d)}
                  onDelete={() => setDeleting(d)}
                />
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            La biblioteca es privada de tu taller: solo la ve tu equipo con su usuario.
          </p>
        </div>
      )}

      <LibraryDocFormDialog
        open={uploadOpen || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setUploadOpen(false);
            setEditing(null);
          }
        }}
        tenantId={tenant.id}
        userName={user.name}
        doc={editing}
        onSaved={refresh}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{deleting?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará el PDF y su texto de la biblioteca. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocCard({
  doc,
  editable,
  onOpen,
  onEdit,
  onDelete,
}: {
  doc: LibraryDocument;
  editable: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tag = vehicleTagLabel(doc);
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-subtle">
        <FileText strokeWidth={1.5} className="h-4 w-4 text-muted-foreground" />
      </div>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{doc.title}</p>
        <p className="text-xs text-muted-foreground">
          {LIBRARY_CATEGORY_LABELS[doc.category]} · {doc.pageCount} pág. · {formatBytes(doc.sizeBytes)}
        </p>
        {tag && <p className="mt-1 truncate text-xs text-foreground">{tag}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDate(doc.uploadedAt)}
          {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
        </p>
        {doc.textPages === 0 && (
          <p className="mt-1 text-[11px] text-[var(--warning)]">
            Sin texto buscable (PDF escaneado)
          </p>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Acciones">
            <MoreHorizontal strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>
            <ExternalLink strokeWidth={1.5} />
            Abrir PDF
          </DropdownMenuItem>
          {editable && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil strokeWidth={1.5} />
                Editar datos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-[var(--destructive)]">
                <Trash2 strokeWidth={1.5} />
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

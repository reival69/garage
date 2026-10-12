// Garage — vehicle documents & expiries manager (ficha de vehículo). Lists the
// vehicle's documents with a traffic-light expiry badge and lets the shop
// add / edit / delete them (including an optional compressed image). All writes
// go through the documents helpers; everything is local & simulated.

import { useState } from "react";
import {
  CalendarClock,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { DataCard } from "@/components/base/DataCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { DocumentFormDialog } from "@/components/app/DocumentFormDialog";
import { DocumentStatusBadge } from "@/components/app/DocumentStatusBadge";
import {
  documentLabel,
  documentStatus,
  listVehicleDocuments,
  removeVehicleDocument,
} from "@/lib/documents";
import { formatDate } from "@/lib/format";
import type { Vehicle, VehicleDocument } from "@/types";
import { toast } from "sonner";

export function VehicleDocumentsCard({
  tenantId,
  vehicle,
  editable,
  onSaved,
}: {
  tenantId: string;
  vehicle: Vehicle;
  editable: boolean;
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDocument | null>(null);
  const [toDelete, setToDelete] = useState<VehicleDocument | null>(null);

  const documents = listVehicleDocuments(vehicle);

  const confirmDelete = () => {
    if (!toDelete) return;
    removeVehicleDocument(tenantId, vehicle.id, toDelete.id);
    toast.success("Documento eliminado");
    setToDelete(null);
    onSaved();
  };

  return (
    <DataCard
      title="Documentos y vencimientos"
      bodyClassName="p-0"
      actions={
        editable ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus strokeWidth={1.5} />
            Añadir
          </Button>
        ) : undefined
      }
    >
      {documents.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">
          Sin documentos. Añade la ITV, el seguro o el impuesto para no perder
          sus vencimientos.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
              {doc.fileBase64 ? (
                <img
                  src={doc.fileBase64}
                  alt={documentLabel(doc)}
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                  <FileText strokeWidth={1.5} className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {documentLabel(doc)}
                  </span>
                  <DocumentStatusBadge status={documentStatus(doc)} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {doc.expiryDate ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock strokeWidth={1.5} className="h-3.5 w-3.5" />
                      Caduca {formatDate(doc.expiryDate)}
                    </span>
                  ) : (
                    <span>Sin fecha de caducidad</span>
                  )}
                </div>
                {doc.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{doc.note}</p>
                )}
              </div>

              {editable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreHorizontal strokeWidth={1.5} className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(doc);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil strokeWidth={1.5} className="h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setToDelete(doc)}
                      className="text-[var(--destructive)] focus:text-[var(--destructive)]"
                    >
                      <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}

      <DocumentFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        tenantId={tenantId}
        vehicleId={vehicle.id}
        document={editing}
        onSaved={onSaved}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DataCard>
  );
}

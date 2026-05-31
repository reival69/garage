import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/presupuestos")({
  component: () => (
    <div>
      <PageHeader title="Presupuestos" description="Presupuestos enviados y pendientes." />
      <EmptyState icon={FileText} title="No hay presupuestos" description="Aún no se ha creado ningún presupuesto." />
    </div>
  ),
});

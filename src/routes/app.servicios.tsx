import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/servicios")({
  component: () => (
    <div>
      <PageHeader title="Servicios" description="Catálogo de servicios y repuestos." />
      <EmptyState icon={Wrench} title="No hay servicios" description="Aún no se han añadido servicios ni repuestos." />
    </div>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/citas")({
  component: () => (
    <div>
      <PageHeader title="Citas" description="Agenda y reservas del taller." />
      <EmptyState icon={Calendar} title="Próximamente" description="La gestión de citas llegará en el siguiente prompt." />
    </div>
  ),
});

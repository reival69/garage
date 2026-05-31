import { createFileRoute } from "@tanstack/react-router";
import { UsersRound } from "lucide-react";
import { PageHeader } from "@/components/base/PageHeader";
import { EmptyState } from "@/components/base/EmptyState";

export const Route = createFileRoute("/app/equipo")({
  component: () => (
    <div>
      <PageHeader title="Equipo" description="Usuarios del taller." />
      <EmptyState icon={UsersRound} title="Próximamente" description="La gestión del equipo llegará en el siguiente prompt." />
    </div>
  ),
});

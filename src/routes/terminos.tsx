import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y condiciones · Garage" },
      {
        name: "description",
        content: "Condiciones generales de uso del servicio Garage. Plantilla de ejemplo.",
      },
      { property: "og:title", content: "Términos y condiciones · Garage" },
      {
        property: "og:description",
        content: "Condiciones generales de uso del servicio Garage. Plantilla de ejemplo.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="31 de mayo de 2026"
      intro="Estas condiciones regulan, de forma general, el acceso y uso del servicio Garage."
      sections={[
        {
          heading: "Objeto",
          body: (
            <p>
              Garage es un software de gestión para talleres mecánicos que permite administrar
              órdenes, inspecciones, presupuestos, citas y la comunicación con los clientes.
            </p>
          ),
        },
        {
          heading: "Uso del servicio",
          body: (
            <p>
              El usuario se compromete a hacer un uso lícito del servicio, a facilitar información
              veraz y a no realizar acciones que puedan dañar el funcionamiento de la plataforma.
            </p>
          ),
        },
        {
          heading: "Cuentas y acceso",
          body: (
            <p>
              El usuario es responsable de la confidencialidad de sus credenciales y de la actividad
              que se realice a través de su cuenta.
            </p>
          ),
        },
        {
          heading: "Planes y pagos",
          body: (
            <p>
              Los planes contratados determinan los límites de uso. Cualquier cambio de plan surte
              efecto según las condiciones aplicables en el momento de la contratación.
            </p>
          ),
        },
        {
          heading: "Responsabilidad",
          body: (
            <p>
              El servicio se presta «tal cual». En la medida permitida por la ley, no asumimos
              responsabilidad por daños indirectos derivados del uso del servicio.
            </p>
          ),
        },
        {
          heading: "Modificaciones",
          body: (
            <p>
              Podemos actualizar estas condiciones para reflejar cambios en el servicio o en la
              normativa. Publicaremos la versión vigente con su fecha de actualización.
            </p>
          ),
        },
      ]}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Política de cookies · Garage" },
      {
        name: "description",
        content: "Información sobre el uso de cookies en Garage. Plantilla de ejemplo.",
      },
      { property: "og:title", content: "Política de cookies · Garage" },
      {
        property: "og:description",
        content: "Información sobre el uso de cookies en Garage. Plantilla de ejemplo.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalPage
      title="Política de cookies"
      updated="31 de mayo de 2026"
      intro="Esta política explica, de forma general, qué son las cookies y cómo se utilizan en Garage."
      sections={[
        {
          heading: "¿Qué son las cookies?",
          body: (
            <p>
              Las cookies son pequeños archivos que un sitio web guarda en tu dispositivo para
              recordar información sobre tu visita y mejorar tu experiencia.
            </p>
          ),
        },
        {
          heading: "Cookies que utilizamos",
          body: (
            <p>
              Cookies técnicas necesarias para el funcionamiento del servicio y, en su caso, cookies
              de medición para entender el uso del sitio de forma agregada.
            </p>
          ),
        },
        {
          heading: "Almacenamiento local",
          body: (
            <p>
              Esta demo de Garage guarda datos en el almacenamiento local de tu navegador para
              simular la aplicación. Esa información no sale de tu dispositivo.
            </p>
          ),
        },
        {
          heading: "Gestión de cookies",
          body: (
            <p>
              Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que
              algunas funciones podrían no estar disponibles si las desactivas.
            </p>
          ),
        },
        {
          heading: "Actualizaciones",
          body: (
            <p>
              Podemos actualizar esta política cuando cambie nuestra forma de usar cookies. La
              versión vigente siempre indicará su fecha de actualización.
            </p>
          ),
        },
      ]}
    />
  );
}

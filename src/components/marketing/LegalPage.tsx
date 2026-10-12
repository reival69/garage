import type { ReactNode } from "react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}

export function LegalPage({ title, intro, updated, sections }: LegalPageProps) {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <header className="border-b border-border pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-4 text-muted-foreground">{intro}</p>
          <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
            Última actualización: {updated}
          </p>
        </header>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold text-foreground">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 rounded-xl border border-border bg-background-subtle p-4 text-xs text-muted-foreground">
          Este texto es una plantilla genérica de ejemplo y no constituye asesoramiento legal ni
          tiene validez jurídica. Garage es una demo local y simulada; ningún dato sale de tu
          navegador.
        </p>
      </article>
    </MarketingLayout>
  );
}

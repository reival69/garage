// Talleo — public per-shop online booking page (/t/:slug). No login. Branded
// with the tenant's logo, accent color, name, address/phone and opening hours.
// Submitting reuses/creates the customer (by phone) and vehicle, then creates an
// online appointment with a notification. Everything is local & simulated.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  MapPin,
  Phone,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findTenantBySlug, servicesRepo } from "@/lib/db";
import { requestOnlineAppointment } from "@/lib/appointments";
import { cn } from "@/lib/utils";
import type { Service, Tenant } from "@/types";

export const Route = createFileRoute("/t/$slug")({
  component: PublicBookingPage,
});

const DAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function PublicBookingPage() {
  const { slug } = Route.useParams();
  const tenant = useMemo(() => findTenantBySlug(slug), [slug]);

  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background-subtle px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
          <AlertCircle strokeWidth={1.5} className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          Taller no encontrado
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          No existe ningún taller en esta dirección. Comprueba el enlace.
        </p>
      </div>
    );
  }

  return <BookingFlow tenant={tenant} />;
}

function BookingFlow({ tenant }: { tenant: Tenant }) {
  const services = useMemo<Service[]>(
    () => servicesRepo.list(tenant.id).sort((a, b) => a.name.localeCompare(b.name)),
    [tenant.id],
  );

  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accentStyle = {
    ["--talleo-accent" as string]: tenant.accentColor,
  } as React.CSSProperties;

  const toggleService = (id: string) =>
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Indica tu nombre.";
    if (!phone.trim()) next.phone = "Indica un teléfono de contacto.";
    if (!date) next.date = "Elige una fecha.";
    if (!time) next.time = "Elige una hora.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    requestOnlineAppointment(tenant, {
      name,
      phone,
      email: email || undefined,
      plate: plate || undefined,
      make: make || undefined,
      model: model || undefined,
      serviceIds,
      scheduledAt,
      notes: notes || undefined,
    });
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background-subtle" style={accentStyle}>
      {/* Branding */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <Logo className="text-base" logoUrl={tenant.logoUrl} />
          <span className="truncate text-sm font-medium text-foreground">
            {tenant.name}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 py-6">
        {done ? (
          <Confirmation tenant={tenant} />
        ) : (
          <>
            <ShopInfo tenant={tenant} />

            <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar strokeWidth={1.5} className="h-4 w-4" />
                <span className="text-xs font-medium">Pedir cita online</span>
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Reserva tu cita
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Te confirmaremos la cita lo antes posible.
              </p>

              <div className="mt-5 space-y-4">
                <Field label="Nombre *" error={errors.name}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre y apellidos"
                    maxLength={120}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Teléfono *" error={errors.phone}>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="600 000 000"
                      maxLength={30}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="opcional"
                      maxLength={150}
                    />
                  </Field>
                </div>

                <Field label="Matrícula">
                  <Input
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="1234 ABC"
                    maxLength={15}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Marca">
                    <Input
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="opcional"
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Modelo">
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="opcional"
                      maxLength={40}
                    />
                  </Field>
                </div>

                {services.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Servicios deseados</Label>
                    <div className="flex flex-wrap gap-2">
                      {services.map((s) => {
                        const active = serviceIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleService(s.id)}
                            className={cn(
                              "rounded-md border px-3 py-1.5 text-sm transition-colors",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-border-strong",
                            )}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Fecha preferida *" error={errors.date}>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Hora preferida *" error={errors.time}>
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Descripción">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Cuéntanos qué necesitas…"
                    maxLength={500}
                  />
                </Field>

                <Button className="w-full" onClick={submit}>
                  Solicitar cita
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ShopInfo({ tenant }: { tenant: Tenant }) {
  const location = tenant.locations[0];
  const address = location?.address ?? tenant.locations[0]?.address;
  const phone = tenant.phone ?? location?.phone;
  const hours = tenant.businessHours;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">{tenant.name}</h2>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {address && (
          <p className="flex items-center gap-2">
            <MapPin strokeWidth={1.5} className="h-4 w-4 shrink-0" />
            {address}
          </p>
        )}
        {phone && (
          <p className="flex items-center gap-2">
            <Phone strokeWidth={1.5} className="h-4 w-4 shrink-0" />
            {phone}
          </p>
        )}
      </div>

      {hours && hours.length === 7 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
            <Clock strokeWidth={1.5} className="h-3.5 w-3.5" />
            Horario
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {hours.map((day, i) => (
              <li key={i} className="flex justify-between">
                <span>{DAY_LABELS[i]}</span>
                <span>
                  {day.open ? `${day.from} – ${day.to}` : "Cerrado"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Confirmation({ tenant }: { tenant: Tenant }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border text-[var(--success)]">
        <Check strokeWidth={1.5} className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        Hemos recibido tu solicitud
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
        {tenant.name} revisará tu petición y te confirmará la cita lo antes
        posible. Gracias.
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

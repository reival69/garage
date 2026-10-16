// Garage — public per-shop online booking page (/t/:slug). No login. Branded
// with the tenant's logo, accent color, name, address/phone and opening hours.
// The booking is a multi-step wizard (services → vehicle → date → details →
// summary). Submitting reuses/creates the customer (by phone) and vehicle, then
// creates an online appointment with a notification, on the server (bookOnline).
// The shop location is shown as a keyless Google Maps embed.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicLoading } from "@/components/PublicLoading";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findTenantBySlug, servicesRepo } from "@/lib/db";
import { bookOnline } from "@/lib/api/data.functions";
import { toast } from "sonner";
import { isModuleEnabled } from "@/lib/permissions";
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

const STEPS = ["Servicio", "Vehículo", "Fecha", "Tus datos", "Resumen"] as const;

function PublicBookingPage() {
  const { slug } = Route.useParams();
  const { ready } = useAuth();
  const tenant = useMemo(
    () => (ready ? findTenantBySlug(slug) : null),
    [ready, slug],
  );

  // Until the workshop's public data has been loaded from the server
  // (signalled by `ready`), show a branded loading state instead
  // of flashing the "not found" error during SSR/hydration.
  if (!ready) {
    return <PublicLoading />;
  }

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
  const [step, setStep] = useState(0);

  // Persistent wizard state (kept across steps).
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [unsure, setUnsure] = useState(false);
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accentStyle = {
    ["--talleo-accent" as string]: tenant.accentColor,
  } as React.CSSProperties;

  const toggleService = (id: string) => {
    setUnsure(false);
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const chooseUnsure = () => {
    setServiceIds([]);
    setUnsure((u) => !u);
  };

  // Per-step validation. Returns true if the current step is complete.
  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 0 && serviceIds.length === 0 && !unsure) {
      next.services = "Elige al menos un servicio o «No estoy seguro».";
    }
    if (s === 1 && !plate.trim()) {
      next.plate = "La matrícula es obligatoria.";
    }
    if (s === 2) {
      if (!date) next.date = "Elige una fecha.";
      if (!time) next.time = "Elige una hora.";
    }
    if (s === 3) {
      if (!name.trim()) next.name = "Indica tu nombre.";
      if (!phone.trim()) next.phone = "Indica un teléfono de contacto.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const [sending, setSending] = useState(false);

  const submit = async () => {
    // Re-validate the required steps before sending.
    for (let s = 0; s < 4; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    setSending(true);
    try {
      // The server matches the customer and vehicle: visitors never see the shop's data
      const result = await bookOnline({
        data: {
          slug: tenant.slug,
          name,
          phone,
          email: email || undefined,
          plate: plate || undefined,
          make: make || undefined,
          model: model || undefined,
          serviceIds,
          scheduledAt,
          notes: notes || undefined,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo enviar la reserva.");
        return;
      }
      setDone(true);
    } catch {
      toast.error("No se pudo enviar la reserva. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
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
            <ShopMap tenant={tenant} />

            {isModuleEnabled(tenant, "reserva_online") ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar strokeWidth={1.5} className="h-4 w-4" />
                <span className="text-xs font-medium">Pedir cita online</span>
              </div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Reserva tu cita
              </h1>

              <Progress step={step} />

              <div className="mt-5">
                {step === 0 && (
                  <StepServices
                    services={services}
                    serviceIds={serviceIds}
                    unsure={unsure}
                    onToggle={toggleService}
                    onUnsure={chooseUnsure}
                    error={errors.services}
                  />
                )}
                {step === 1 && (
                  <StepVehicle
                    plate={plate}
                    make={make}
                    model={model}
                    setPlate={setPlate}
                    setMake={setMake}
                    setModel={setModel}
                    error={errors.plate}
                  />
                )}
                {step === 2 && (
                  <StepDate
                    tenant={tenant}
                    date={date}
                    time={time}
                    setDate={setDate}
                    setTime={setTime}
                    errors={errors}
                  />
                )}
                {step === 3 && (
                  <StepDetails
                    name={name}
                    phone={phone}
                    email={email}
                    notes={notes}
                    setName={setName}
                    setPhone={setPhone}
                    setEmail={setEmail}
                    setNotes={setNotes}
                    errors={errors}
                  />
                )}
                {step === 4 && (
                  <StepSummary
                    tenant={tenant}
                    services={services}
                    serviceIds={serviceIds}
                    unsure={unsure}
                    plate={plate}
                    make={make}
                    model={model}
                    date={date}
                    time={time}
                    name={name}
                    phone={phone}
                    email={email}
                    notes={notes}
                  />
                )}
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center gap-3">
                {step > 0 && (
                  <Button variant="outline" className="flex-1" onClick={goBack}>
                    <ArrowLeft strokeWidth={1.5} className="h-4 w-4" />
                    Atrás
                  </Button>
                )}
                {step < STEPS.length - 1 ? (
                  <Button className="flex-1" onClick={goNext}>
                    Siguiente
                    <ArrowRight strokeWidth={1.5} className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={() => void submit()} disabled={sending}>
                    Solicitar cita
                  </Button>
                )}
              </div>
            </div>
            ) : (
              <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6 text-center">
                <Calendar
                  strokeWidth={1.5}
                  className="mx-auto mb-2 h-6 w-6 text-muted-foreground"
                />
                <p className="text-sm font-medium text-foreground">
                  Reservas online no disponibles
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este taller no acepta citas online por el momento. Puedes
                  contactar directamente con los datos de arriba.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Paso {step + 1} de {STEPS.length} · {STEPS[step]}
      </p>
    </div>
  );
}

function StepServices({
  services,
  serviceIds,
  unsure,
  onToggle,
  onUnsure,
  error,
}: {
  services: Service[];
  serviceIds: string[];
  unsure: boolean;
  onToggle: (id: string) => void;
  onUnsure: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">
          ¿Qué necesitas?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige uno o varios servicios. Si no lo tienes claro, no pasa nada.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {services.map((s) => {
          const active = serviceIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
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
        <button
          type="button"
          onClick={onUnsure}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            unsure
              ? "border-foreground bg-foreground text-background"
              : "border-dashed border-border text-muted-foreground hover:border-border-strong",
          )}
        >
          No estoy seguro
        </button>
      </div>
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

function StepVehicle({
  plate,
  make,
  model,
  setPlate,
  setMake,
  setModel,
  error,
}: {
  plate: string;
  make: string;
  model: string;
  setPlate: (v: string) => void;
  setMake: (v: string) => void;
  setModel: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-4">
      <Field label="Matrícula *" error={error}>
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
    </div>
  );
}

function StepDate({
  tenant,
  date,
  time,
  setDate,
  setTime,
  errors,
}: {
  tenant: Tenant;
  date: string;
  time: string;
  setDate: (v: string) => void;
  setTime: (v: string) => void;
  errors: Record<string, string>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha preferida *" error={errors.date}>
          <Input
            type="date"
            min={today}
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
      <HoursHint tenant={tenant} />
    </div>
  );
}

function HoursHint({ tenant }: { tenant: Tenant }) {
  const hours = tenant.businessHours;
  if (!hours || hours.length !== 7) return null;
  return (
    <div className="rounded-md border border-border bg-background-subtle p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
        <Clock strokeWidth={1.5} className="h-3.5 w-3.5" />
        Horario del taller
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {hours.map((day, i) => (
          <li key={i} className="flex justify-between">
            <span>{DAY_LABELS[i]}</span>
            <span>{day.open ? `${day.from} – ${day.to}` : "Cerrado"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepDetails({
  name,
  phone,
  email,
  notes,
  setName,
  setPhone,
  setEmail,
  setNotes,
  errors,
}: {
  name: string;
  phone: string;
  email: string;
  notes: string;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setEmail: (v: string) => void;
  setNotes: (v: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
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
      <Field label="Descripción">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cuéntanos qué necesitas…"
          maxLength={500}
        />
      </Field>
    </div>
  );
}

function StepSummary({
  tenant,
  services,
  serviceIds,
  unsure,
  plate,
  make,
  model,
  date,
  time,
  name,
  phone,
  email,
  notes,
}: {
  tenant: Tenant;
  services: Service[];
  serviceIds: string[];
  unsure: boolean;
  plate: string;
  make: string;
  model: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
}) {
  const serviceNames = services
    .filter((s) => serviceIds.includes(s.id))
    .map((s) => s.name);
  const dateLabel =
    date && time
      ? new Date(`${date}T${time}`).toLocaleString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const vehicleLabel = [plate, [make, model].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">Revisa tu solicitud</h2>
      <dl className="divide-y divide-border rounded-md border border-border">
        <SummaryRow
          label="Servicio"
          value={
            unsure
              ? "No estoy seguro"
              : serviceNames.length
                ? serviceNames.join(", ")
                : "—"
          }
        />
        <SummaryRow label="Vehículo" value={vehicleLabel || "—"} />
        <SummaryRow label="Fecha y hora" value={dateLabel} />
        <SummaryRow label="Nombre" value={name || "—"} />
        <SummaryRow label="Teléfono" value={phone || "—"} />
        {email && <SummaryRow label="Email" value={email} />}
        {notes && <SummaryRow label="Descripción" value={notes} />}
      </dl>
      <p className="text-xs text-muted-foreground">
        {tenant.name} revisará tu petición y te confirmará la cita lo antes
        posible.
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ShopInfo({ tenant }: { tenant: Tenant }) {
  const location = tenant.locations[0];
  const address = location?.address;
  const phone = tenant.phone ?? location?.phone;

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
    </div>
  );
}

// Keyless Google Maps embed of the shop location, persistent across steps.
// Hidden gracefully when the tenant has no address configured.
function ShopMap({ tenant }: { tenant: Tenant }) {
  const address = tenant.locations[0]?.address;
  if (!address) return null;

  const query = encodeURIComponent(address);
  const embedSrc = `https://www.google.com/maps?q=${query}&output=embed`;
  const directionsUrl = `https://www.google.com/maps?q=${query}`;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
      <iframe
        title={`Ubicación de ${tenant.name}`}
        src={embedSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-44 w-full border-0"
      />
      <a
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-background-muted"
      >
        <Navigation strokeWidth={1.5} className="h-4 w-4" />
        Cómo llegar
      </a>
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

// Talleo — Configuración del taller. Edita datos generales, fiscales, moneda/IVA,
// marca (acento + logo) y horario de atención del tenant activo. Guarda vía
// tenantsRepo.update y refresca la sesión para que el cambio se propague a
// cabecera, factura y vista cliente. Todo local y simulado.

import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/base/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/AuthContext";
import { tenantsRepo } from "@/lib/db";
import { compressImage } from "@/lib/image";
import {
  TOGGLEABLE_MODULES,
  isModuleEnabled,
  type ToggleableModule,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { BusinessDay } from "@/types";

export const Route = createFileRoute("/app/configuracion")({
  component: ConfigPage,
});

const CURRENCIES = ["EUR", "MXN", "USD", "GBP", "ARS", "COP", "ZAR"];

const ACCENT_PRESETS = [
  "#101010",
  "#2F6FED",
  "#0F766E",
  "#B45309",
  "#7C3AED",
  "#DC2626",
];

const DAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

// Labels + helper text for the optional, toggleable modules.
const MODULE_INFO: Record<
  ToggleableModule,
  { label: string; description: string }
> = {
  stock: { label: "Stock", description: "Inventario de repuestos y avisos de bajo stock." },
  mensajes: { label: "Mensajes", description: "Bandeja de chat con los clientes por orden." },
  recordatorios: { label: "Recordatorios", description: "Mantenimientos y vencimientos de documentos." },
  resenas: { label: "Reseñas", description: "Valoraciones de clientes tras la entrega." },
  reserva_online: { label: "Reserva online", description: "Asistente de cita en la página pública del taller." },
};

// Core modules — always active (informative, no switch).
const CORE_MODULE_LABELS = [
  "Inicio",
  "Órdenes",
  "Clientes",
  "Vehículos",
  "Citas",
  "Presupuestos",
  "Facturación",
  "Servicios",
  "Equipo",
  "Configuración",
];

function defaultHours(): BusinessDay[] {
  return DAY_LABELS.map((_, i) => ({
    open: i < 5,
    from: "09:00",
    to: "18:00",
  }));
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ConfigPage() {
  const { tenant, refresh } = useAuth();

  const primaryLocation = tenant?.locations[0];

  const [name, setName] = useState(tenant?.name ?? "");
  const [address, setAddress] = useState(primaryLocation?.address ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? primaryLocation?.phone ?? "");
  const [email, setEmail] = useState(tenant?.email ?? "");
  const [legalName, setLegalName] = useState(tenant?.legalName ?? "");
  const [taxId, setTaxId] = useState(tenant?.taxId ?? "");
  const [currency, setCurrency] = useState(tenant?.currency ?? "EUR");
  const [taxPct, setTaxPct] = useState(
    String(Math.round((tenant?.taxRate ?? 0.21) * 100)),
  );
  const [accentColor, setAccentColor] = useState(tenant?.accentColor ?? "#101010");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(tenant?.logoUrl);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(
    tenant?.googleReviewUrl ?? "",
  );
  const [hours, setHours] = useState<BusinessDay[]>(
    tenant?.businessHours && tenant.businessHours.length === 7
      ? tenant.businessHours
      : defaultHours(),
  );
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!tenant) return null;

  const setDay = (i: number, patch: Partial<BusinessDay>) => {
    setHours((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const onLogoFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setLogoUrl(compressed);
    } catch {
      toast.error("No se pudo procesar la imagen.");
    }
  };

  const save = () => {
    if (!name.trim()) {
      toast.error("El nombre del taller es obligatorio.");
      return;
    }
    setSaving(true);
    const taxRate = Math.min(100, Math.max(0, Number(taxPct) || 0)) / 100;
    const locations = tenant.locations.map((loc, idx) =>
      idx === 0
        ? { ...loc, address: address.trim() || undefined, phone: phone.trim() || undefined }
        : loc,
    );
    tenantsRepo.update(tenant.id, {
      name: name.trim(),
      legalName: legalName.trim() || undefined,
      taxId: taxId.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      currency,
      taxRate,
      accentColor,
      logoUrl,
      googleReviewUrl: googleReviewUrl.trim() || undefined,
      businessHours: hours,
      locations,
    });
    refresh();
    setSaving(false);
    toast.success("Configuración guardada.");
  };

  return (
    <div
      style={{ ["--talleo-accent" as string]: accentColor } as React.CSSProperties}
    >
      <PageHeader
        title="Configuración"
        description="Datos del taller, facturación y marca."
        actions={
          <Button onClick={save} disabled={saving}>
            <Check strokeWidth={1.5} />
            Guardar cambios
          </Button>
        }
      />

      <div className="space-y-5">
        <Section title="Datos del taller">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Dirección">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, ciudad"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="taller@ejemplo.com"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Datos fiscales"
          description="Se mostrarán en las facturas."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razón social">
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Nombre legal de la empresa"
              />
            </Field>
            <Field label="NIF / CIF / RFC">
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section
          title="Moneda e IVA"
          description="Afecta a presupuestos, facturas y vista de cliente."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moneda">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="IVA (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Marca" description="Acento y logotipo del taller.">
          <Field label="Color de acento">
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-md border-2 transition-colors",
                    accentColor.toLowerCase() === c.toLowerCase()
                      ? "border-foreground"
                      : "border-border",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-border bg-background"
                aria-label="Color personalizado"
              />
            </div>
          </Field>

          <div className="flex items-center gap-3 rounded-md border border-border bg-background-subtle p-3">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-sm font-medium text-foreground">
              Vista previa del acento
            </span>
            <Button size="sm" className="ml-auto">
              Ejemplo
            </Button>
          </div>

          <Field label="Logotipo">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Talleo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onLogoFile(e.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload strokeWidth={1.5} />
                  Subir logo
                </Button>
                {logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl(undefined)}
                  >
                    <Trash2 strokeWidth={1.5} />
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </Field>
        </Section>

        <Section
          title="Reseñas"
          description="Enlace de Google que se ofrece a los clientes satisfechos (valoración alta) en su vista."
        >
          <Field label="Enlace de reseña de Google">
            <Input
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/..."
            />
          </Field>
        </Section>



        <Section
          title="Horario de atención"
          description="Días y horas de apertura del taller."
        >
          <div className="space-y-2">
            {hours.map((day, i) => (
              <div
                key={DAY_LABELS[i]}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle px-3 py-2"
              >
                <div className="flex w-28 items-center gap-2">
                  <Switch
                    checked={day.open}
                    onCheckedChange={(v) => setDay(i, { open: v })}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {DAY_LABELS[i]}
                  </span>
                </div>
                {day.open ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.from}
                      onChange={(e) => setDay(i, { from: e.target.value })}
                      className="h-9 w-28"
                    />
                    <span className="text-sm text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={day.to}
                      onChange={(e) => setDay(i, { to: e.target.value })}
                      className="h-9 w-28"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Cerrado</span>
                )}
              </div>
            ))}
          </div>
        </Section>

        <div className="flex justify-end pb-4">
          <Button onClick={save} disabled={saving}>
            <Check strokeWidth={1.5} />
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}

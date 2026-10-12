// Garage — formatting helpers (display only).
// Currency formatting is centralized here: every amount in the app must pass
// through formatCurrency / formatCurrencyCents with the active tenant's currency
// so a MXN shop shows pesos and an EUR shop shows euros, etc.

// Pick a sensible locale per currency so the symbol/format reads naturally
// (e.g. MXN → "$1,234.00" in es-MX, EUR → "1.234,00 €" in es-ES).
const LOCALE_BY_CURRENCY: Record<string, string> = {
  EUR: "es-ES",
  MXN: "es-MX",
  USD: "en-US",
  GBP: "en-GB",
  ARS: "es-AR",
  COP: "es-CO",
  ZAR: "en-ZA",
};

function localeFor(currency: string): string {
  return LOCALE_BY_CURRENCY[currency] ?? "es-ES";
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyCents(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

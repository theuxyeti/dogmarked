/** Weight and currency display helpers. Storage is always kg + ISO 4217. */

export type WeightUnit = "kg" | "lb";

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function convertWeight(
  value: number,
  from: WeightUnit,
  to: WeightUnit,
): number {
  if (from === to) return value;
  return from === "kg" ? kgToLb(value) : lbToKg(value);
}

export function formatWeight(
  kg: number | null | undefined,
  unit: WeightUnit = "kg",
  options?: { maximumFractionDigits?: number; locale?: string },
): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  const value = unit === "kg" ? kg : kgToLb(kg);
  const digits = options?.maximumFractionDigits ?? (unit === "kg" ? 1 : 0);
  const formatted = new Intl.NumberFormat(options?.locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
  return `${formatted} ${unit}`;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = "USD",
  locale?: string,
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}

export function parseWeightInput(
  raw: string,
  unit: WeightUnit,
): number | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === "kg" ? n : lbToKg(n);
}

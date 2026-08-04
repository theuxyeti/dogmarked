import en from "@/lib/i18n/messages/en.json";

export type MessageKey = keyof typeof en;

const catalogs: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
};

let activeLocale = "en";

/**
 * Minimal i18n helper (no next-intl required).
 * Nested keys are flat dotted strings in JSON (e.g. "nav.explore").
 */
export function setLocale(locale: string): void {
  activeLocale = catalogs[locale] ? locale : "en";
}

export function getLocale(): string {
  return activeLocale;
}

export function t(
  key: MessageKey | string,
  vars?: Record<string, string | number>,
  locale = activeLocale,
): string {
  const catalog = catalogs[locale] ?? catalogs.en;
  let template = catalog[key] ?? catalogs.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replaceAll(`{${k}}`, String(v));
    }
  }

  return template;
}

export function hasMessage(key: string, locale = activeLocale): boolean {
  const catalog = catalogs[locale] ?? catalogs.en;
  return key in catalog;
}

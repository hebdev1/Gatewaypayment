import { cookies, headers } from "next/headers";
import { LOCALES, messages, type Locale } from "./dict";

export { LOCALES, LOCALE_LABELS } from "./dict";
export type { Locale };

const DEFAULT_LOCALE: Locale = "fr";
const COOKIE_NAME = "hp_locale";

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

/**
 * Resolve the locale for the current request. Priority:
 * 1. `?lang=` query parameter
 * 2. `hp_locale` cookie
 * 3. `Accept-Language` header (best match among supported locales)
 * 4. DEFAULT_LOCALE (fr)
 */
export async function resolveLocale(searchParams?: URLSearchParams): Promise<Locale> {
  const fromQuery = searchParams?.get("lang");
  if (isLocale(fromQuery)) return fromQuery;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const headerList = await headers();
  const accept = headerList.get("accept-language");
  if (accept) {
    const ranked = accept
      .split(",")
      .map((part) => part.trim().split(";")[0].slice(0, 2).toLowerCase())
      .filter(Boolean);
    for (const tag of ranked) {
      if (isLocale(tag)) return tag;
    }
  }

  return DEFAULT_LOCALE;
}

function lookup(locale: Locale, key: string): string {
  return messages[locale]?.[key] ?? messages.en[key] ?? key;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function getTranslator(locale: Locale): Translator {
  return (key, vars) => interpolate(lookup(locale, key), vars);
}

export async function getT(searchParams?: URLSearchParams): Promise<{
  locale: Locale;
  t: Translator;
}> {
  const locale = await resolveLocale(searchParams);
  return { locale, t: getTranslator(locale) };
}

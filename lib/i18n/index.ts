import { es, type Messages } from "./es";
import { en } from "./en";
import {
  type Locale,
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  parseLocale,
} from "./locale";

export type { Messages } from "./es";
export type { Locale };
export { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, parseLocale };
export { es } from "./es";
export { en } from "./en";

export const dictionaries: Record<Locale, Messages> = { es, en };

export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale];
}

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? ""),
  );
}

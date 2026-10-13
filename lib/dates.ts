import { formatInTimeZone } from "date-fns-tz";
import { enUS, es } from "date-fns/locale";

import { fill, getDictionary, type Locale, type Messages } from "@/lib/i18n";

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Costa_Rica";

// due_date is a plain date, so "today" has to be resolved in the organisation's
// timezone. Using the server's clock would roll the day over at the wrong hour
// and show tasks as overdue in the evening.
export function todayISO(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A short human label for a due date, relative where that reads better. */
export function formatDueLabel(
  due: string | null,
  today = todayISO(),
  locale: Locale = "es",
): { text: string; tone: "overdue" | "soon" | "normal" | "none" } {
  const t = getDictionary(locale);
  if (!due) return { text: t.dates.none, tone: "none" };

  if (due === today) return { text: t.dates.today, tone: "soon" };
  if (due === addDaysISO(today, 1)) return { text: t.dates.tomorrow, tone: "soon" };
  if (due === addDaysISO(today, -1))
    return { text: t.dates.yesterday, tone: "overdue" };

  const [y, m, d] = due.split("-").map(Number);
  const label = `${d} ${t.dates.months[m - 1]}`;
  const tone = due < today ? "overdue" : "normal";

  const thisYear = Number(today.slice(0, 4));
  return { text: y === thisYear ? label : `${label} ${y}`, tone };
}

/** Elapsed time for the notification list: "hace 5 min", "hace 3 horas". */
export function formatRelativeTime(iso: string, t: Messages): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return t.dates.justNow;
  if (minutes < 60) return fill(t.dates.minutesAgo, { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1
      ? t.dates.hourAgo
      : fill(t.dates.hoursAgo, { n: hours });
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? t.dates.dayAgo : fill(t.dates.daysAgo, { n: days });
}

/** Absolute created time on the full task page, in the organisation timezone. */
export function formatCreatedStamp(iso: string, locale: Locale): string {
  return formatInTimeZone(
    new Date(iso),
    APP_TIMEZONE,
    "d MMM yyyy, H:mm",
    { locale: locale === "en" ? enUS : es },
  );
}

export function priorityLabel(priority: string, t: Messages) {
  return t.priority[priority as keyof Messages["priority"]] ?? priority;
}

export function statusLabel(status: string, t: Messages) {
  return t.status[status as keyof Messages["status"]] ?? status;
}

export const PRIORITY_KEYS = ["low", "medium", "high", "urgent"] as const;
export const STATUS_KEYS = [
  "open",
  "in_progress",
  "done",
  "cancelled",
] as const;

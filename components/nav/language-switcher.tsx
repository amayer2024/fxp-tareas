"use client";

import { useI18n } from "@/components/i18n/provider";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { locale: Locale; labelKey: "langEs" | "langEn" }[] = [
  { locale: "es", labelKey: "langEs" },
  { locale: "en", labelKey: "langEn" },
];

export function LanguageSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "compact" | "login";
}) {
  const { locale, t, setLocale, pending } = useI18n();

  return (
    <div aria-label={t.nav.language}>
      {variant === "sidebar" ? (
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          {t.nav.language}
        </p>
      ) : null}
      <div
        className={cn(
          "flex rounded-[10px] border border-white/20 p-0.5",
          variant === "compact" && "rounded-[8px]",
        )}
      >
        {OPTIONS.map((option) => {
          const on = locale === option.locale;
          return (
            <button
              key={option.locale}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => setLocale(option.locale)}
              className={cn(
                "flex-1 font-medium tracking-[0.08em] transition-colors disabled:opacity-50",
                variant === "compact"
                  ? "rounded-[6px] px-2 py-1 text-[11px]"
                  : "rounded-[8px] py-1.5 text-[12px]",
                on
                  ? "bg-white text-pitch"
                  : "text-white/70 hover:text-white",
              )}
            >
              {t.nav[option.labelKey]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

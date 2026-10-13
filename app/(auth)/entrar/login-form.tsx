"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/provider";
import { loginToEmail } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/client";

const field =
  "h-14 w-full rounded-[10px] border border-white/[0.12] bg-[#243a6a] px-4 text-[16px] text-white caret-lime outline-none focus-visible:border-lime md:h-16";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = loginToEmail(String(form.get("username") ?? ""));
    const password = String(form.get("password") ?? "");

    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signError) {
        setError(t.auth.error);
        setPending(false);
        return;
      }

      const destination =
        typeof next === "string" && next.startsWith("/") ? next : "/hoy";
      window.location.assign(destination);
    } catch {
      setError(t.auth.retry);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-12 w-full">
      <label className="block" htmlFor="username">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {t.auth.username}
        </span>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder={t.auth.usernamePlaceholder}
          className={field}
        />
      </label>
      <label className="mt-5 block" htmlFor="password">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {t.auth.password}
        </span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-[#ff8a7a]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-10 h-14 w-full rounded-[10px] bg-lime text-[16px] font-semibold text-white disabled:opacity-50 md:h-16"
      >
        {pending ? t.auth.submitting : t.auth.submit}
      </button>
    </form>
  );
}

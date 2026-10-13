import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { getMessages } from "@/lib/i18n/server";

export const metadata = { title: "Entrar · FxP Tareas" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, t] = await Promise.all([searchParams, getMessages()]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-pitch px-6 text-white">
      <h1 className="sr-only">{t.auth.title}</h1>
      <div className="flex w-full max-w-[420px] flex-1 flex-col items-center pt-[10vh] md:max-w-[480px]">
        <BrandMark size="lg" />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-lime">
          {t.appName}
        </p>
        <LoginForm next={next} />
        <p className="mt-4 text-center text-[13px] leading-relaxed text-white/55">
          {t.auth.hint}
        </p>
        <div className="mt-8 w-full">
          <LanguageSwitcher variant="login" />
        </div>
      </div>
    </main>
  );
}

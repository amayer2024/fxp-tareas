"use client";

import {
  CalendarCheck,
  ClipboardCheck,
  ListChecks,
  Lock,
  LogOut,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { useI18n } from "@/components/i18n/provider";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import {
  NotificationBell,
  NotificationInbox,
} from "@/components/nav/notification-bell";
import type { Notice } from "@/lib/notifications";
import type { SessionProfile } from "@/lib/session";
import type { Space } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof CalendarCheck;
  isPrivate?: boolean;
};

export function AppShell({
  profile,
  spaces,
  notifications,
  children,
}: {
  profile: SessionProfile;
  spaces: Space[];
  notifications: Notice[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const items: NavItem[] = [
    { href: "/hoy", label: t.nav.hoy, icon: CalendarCheck },
    { href: "/tareas", label: t.nav.tareas, icon: ListChecks },
    { href: "/asistencia", label: t.nav.asistencia, icon: ClipboardCheck },
    ...spaces.map((space) => ({
      href: `/espacios/${space.slug}`,
      label: space.name,
      icon: space.is_private ? Lock : Folder,
      isPrivate: space.is_private,
    })),
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <NotificationInbox items={notifications} viewerId={profile.id}>
      <div className="min-h-dvh md:flex">
        <aside className="hidden w-60 shrink-0 flex-col bg-pitch text-white md:flex">
          <div className="flex items-start justify-between gap-2 px-5 py-6">
            <Link href="/hoy" className="min-w-0">
              <BrandMark size="md" />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-lime">
                {t.appName}
              </p>
            </Link>
            <NotificationBell tone="dark" />
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-lime text-white"
                    : "text-white/85 hover:bg-white/10",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 px-5 py-4">
            <LanguageSwitcher />
            <p className="mt-3 truncate text-sm font-medium text-white">
              {profile.full_name}
            </p>
            <p className="truncate text-xs text-white/55">
              {profile.title ??
                (profile.role === "admin" ? t.nav.admin : t.nav.staff)}
            </p>
            <form action="/auth/salir" method="post">
              <button
                type="submit"
                className="mt-3 flex items-center gap-1.5 text-xs text-white/55 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t.nav.salir}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 bg-pitch px-4 py-3 text-white md:hidden">
            <Link href="/hoy" className="min-w-0">
              <BrandMark size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell tone="dark" />
              <LanguageSwitcher variant="compact" />
              <form action="/auth/salir" method="post">
                <button
                  type="submit"
                  aria-label={t.nav.salir}
                  className="text-white/70 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-sheet md:hidden">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]",
                  isActive(item.href) ? "text-lime" : "text-muted",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </NotificationInbox>
  );
}

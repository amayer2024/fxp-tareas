import { redirect } from "next/navigation";

import { AppShell } from "@/components/nav/app-shell";
import { listNotifications } from "@/lib/notifications";
import { getSessionProfile } from "@/lib/session";
import { listSpaces } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/entrar");

  const [spaces, notifications] = await Promise.all([
    listSpaces(),
    listNotifications(),
  ]);

  return (
    <AppShell
      profile={profile}
      spaces={spaces}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}

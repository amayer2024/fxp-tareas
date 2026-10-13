"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

function revalidateNav() {
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(id: string) {
  const profile = await getSessionProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  revalidateNav();
}

export async function markAllNotificationsReadAction() {
  const profile = await getSessionProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);

  revalidateNav();
}

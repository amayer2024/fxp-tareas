import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  full_name: string;
  title: string | null;
  role: "admin" | "staff";
};

// cache() dedupes this across a single render pass, so a layout and the page it
// wraps do not each pay for the round trip.
export const getSessionProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, title, role")
      .eq("id", user.id)
      .single();

    if (!data || !data.role) return null;

    return {
      id: data.id,
      full_name: data.full_name,
      title: data.title,
      role: data.role,
    };
  },
);

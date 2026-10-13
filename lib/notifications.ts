import { NOTICE_SELECT, shapeNotices, type Notice } from "@/lib/notice";
import { createClient } from "@/lib/supabase/server";

export type { Notice };

export async function listNotifications(limit = 30): Promise<Notice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select(NOTICE_SELECT)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  return shapeNotices(data as unknown as Parameters<typeof shapeNotices>[0]);
}

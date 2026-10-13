import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type Assignee = { id: string; full_name: string };

export type TaskRowData = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  created_by: string;
  created_at: string;
  space: { id: string; slug: string; name: string; is_private: boolean } | null;
  sede: { id: string; name: string } | null;
  assignees: Assignee[];
};

const TASK_SELECT = `
  id, title, notes, due_date, priority, status, created_by, created_at,
  space:spaces!inner(id, slug, name, is_private),
  sede:sedes(id, name),
  assignees:task_assignees(user:profiles(id, full_name))
` as const;

type RawTask = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: TaskRowData["priority"];
  status: TaskRowData["status"];
  created_by: string;
  created_at: string;
  space: { id: string; slug: string; name: string; is_private: boolean } | null;
  sede: { id: string; name: string } | null;
  assignees: { user: Assignee | null }[] | null;
};

function shape(row: RawTask): TaskRowData {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    due_date: row.due_date,
    priority: row.priority,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    space: row.space,
    sede: row.sede,
    assignees: (row.assignees ?? [])
      .map((a) => a.user)
      .filter((u): u is Assignee => u !== null)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "es")),
  };
}

const OPEN_STATUSES = ["open", "in_progress"] as const;

const STATUSES = ["open", "in_progress", "done", "cancelled"] as const;

/**
 * Tasks that are mine: assigned to me, or created by me. Resolved as two
 * queries rather than one `.or()` across an embedded table, because filtering
 * on an embedded relation would also trim the returned assignee list down to
 * just the matching row, and the UI needs the whole set.
 */
export async function listMyOpenTasks(userId: string): Promise<TaskRowData[]> {
  const supabase = await createClient();

  const { data: mine } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", userId);

  const assignedIds = (mine ?? []).map((r) => r.task_id);

  const [assigned, created] = await Promise.all([
    assignedIds.length
      ? supabase
          .from("tasks")
          .select(TASK_SELECT)
          .in("id", assignedIds)
          .in("status", OPEN_STATUSES)
      : Promise.resolve({ data: [] as RawTask[] }),
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("created_by", userId)
      .in("status", OPEN_STATUSES),
  ]);

  const byId = new Map<string, TaskRowData>();
  for (const row of [
    ...((assigned.data ?? []) as unknown as RawTask[]),
    ...((created.data ?? []) as unknown as RawTask[]),
  ]) {
    byId.set(row.id, shape(row));
  }

  return [...byId.values()].sort(compareByDueThenPriority);
}

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function compareByDueThenPriority(a: TaskRowData, b: TaskRowData) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export type TaskFilters = {
  spaceId?: string;
  spaceSlug?: string;
  assigneeId?: string;
  status?: string;
  sedeId?: string;
};

export async function listTasks(filters: TaskFilters): Promise<TaskRowData[]> {
  const supabase = await createClient();

  let assignedIds: string[] | null = null;
  if (filters.assigneeId) {
    const { data } = await supabase
      .from("task_assignees")
      .select("task_id")
      .eq("user_id", filters.assigneeId);
    assignedIds = (data ?? []).map((r) => r.task_id);
    if (assignedIds.length === 0) return [];
  }

  let query = supabase.from("tasks").select(TASK_SELECT);

  if (filters.spaceId) query = query.eq("space_id", filters.spaceId);
  if (filters.spaceSlug) query = query.eq("space.slug", filters.spaceSlug);
  if (filters.sedeId) query = query.eq("sede_id", filters.sedeId);
  if (assignedIds) query = query.in("id", assignedIds);

  if (filters.status === "open") {
    query = query.in("status", OPEN_STATUSES);
  } else if (filters.status && filters.status !== "all") {
    // The value arrives from a query string, so narrow it before trusting it as
    // a status rather than passing an arbitrary string to the database.
    const status = STATUSES.find((s) => s === filters.status);
    if (status) query = query.eq("status", status);
  }

  const { data } = await query.limit(500);

  return ((data ?? []) as unknown as RawTask[])
    .map(shape)
    .sort(compareByDueThenPriority);
}

export async function getTask(id: string): Promise<TaskRowData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();

  return data ? shape(data as unknown as RawTask) : null;
}

export type TaskComment = {
  id: string;
  body: string;
  created_at: string;
  author: Assignee | null;
};

export async function listComments(taskId: string): Promise<TaskComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_comments")
    .select("id, body, created_at, author:profiles(id, full_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as TaskComment[];
}

// Reference data ------------------------------------------------------------

export type Space = {
  id: string;
  slug: string;
  name: string;
  is_private: boolean;
};

/**
 * The only source of truth for which spaces a person can see. RLS removes
 * private spaces the caller does not belong to, so callers — including the
 * sidebar — must never filter or hardcode on top of this.
 */
export async function listSpaces(): Promise<Space[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, slug, name, is_private")
    .order("sort_order", { ascending: true });

  return (data ?? []) as Space[];
}

type RawMember = {
  space_id: string;
  user: { id: string; full_name: string; active: boolean } | null;
};

function uniquePeople(
  rows: RawMember[],
  spaceId?: string,
): Assignee[] {
  const byId = new Map<string, Assignee>();
  for (const row of rows) {
    if (spaceId && row.space_id !== spaceId) continue;
    const user = row.user;
    if (!user || !user.active) continue;
    byId.set(user.id, { id: user.id, full_name: user.full_name });
  }
  return [...byId.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "es"),
  );
}

async function loadMemberships(): Promise<RawMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select("space_id, user:profiles(id, full_name, active)");
  return (data ?? []) as unknown as RawMember[];
}

/**
 * People who share at least one space with the caller. RLS on space_members
 * already hides Dirección (and any other space) the caller does not belong to.
 */
export async function listPeople(): Promise<Assignee[]> {
  return uniquePeople(await loadMemberships());
}

export async function listSpaceMembers(spaceId: string): Promise<Assignee[]> {
  return uniquePeople(await loadMemberships(), spaceId);
}

export async function listMembersBySpace(): Promise<Record<string, Assignee[]>> {
  const rows = await loadMemberships();
  const grouped: Record<string, Assignee[]> = {};
  for (const row of rows) {
    if (!grouped[row.space_id]) grouped[row.space_id] = uniquePeople(rows, row.space_id);
  }
  return grouped;
}

export async function listSedes(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sedes")
    .select("id, name")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []) as { id: string; name: string }[];
}

// Schemas -------------------------------------------------------------------

const uuid = z.string().uuid();
const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || uuid.safeParse(v).success, "badUuid");

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "titleRequired").max(200),
  notes: z.string().trim().max(4000).optional().default(""),
  space_id: uuid,
  sede_id: optionalUuid.optional().default(null),
  due_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine(
      (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "badDate",
    )
    .optional()
    .default(null),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignee_ids: z.array(uuid).default([]),
});

export const updateTaskSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  sede_id: z.string().uuid().nullable().optional(),
  assignee_ids: z.array(uuid).optional(),
});

export const commentSchema = z.object({
  task_id: uuid,
  body: z.string().trim().min(1, "commentRequired").max(4000),
});

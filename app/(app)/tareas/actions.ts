"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n";
import { safeBackPath } from "@/lib/paths";
import { getSessionProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, createTaskSchema, updateTaskSchema } from "@/lib/tasks";

type Result =
  | { ok: true; id?: string }
  | { ok: false; detail: string };

function revalidateAll() {
  revalidatePath("/hoy");
  revalidatePath("/tareas");
  revalidatePath("/espacios", "layout");
  revalidatePath("/", "layout");
}

export async function createTaskAction(formData: FormData): Promise<Result> {
  const t = await getMessages();
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, detail: t.errors.session };

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") ?? "",
    space_id: formData.get("space_id"),
    sede_id: formData.get("sede_id") ?? "",
    due_date: formData.get("due_date") ?? "",
    priority: formData.get("priority") ?? "medium",
    assignee_ids: formData.getAll("assignee_ids").filter(Boolean) as string[],
  });

  if (!parsed.success) {
    return { ok: false, detail: zodDetail(parsed.error.issues[0].message, t) };
  }

  const { title, notes, space_id, sede_id, due_date, priority, assignee_ids } =
    parsed.data;

  // Omit the empty optionals rather than sending null: the RPC defaults them,
  // which keeps this call type-safe without casting.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_task", {
    p_title: title,
    p_space_id: space_id,
    p_priority: priority,
    p_assignee_ids: assignee_ids,
    ...(notes ? { p_notes: notes } : {}),
    ...(sede_id ? { p_sede_id: sede_id } : {}),
    ...(due_date ? { p_due_date: due_date } : {}),
  });

  if (error) return { ok: false, detail: translate(error.message, t) };

  revalidateAll();
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function updateTaskAction(formData: FormData): Promise<Result> {
  const t = await getMessages();
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, detail: t.errors.session };

  const raw: Record<string, unknown> = { id: formData.get("id") };
  for (const key of ["title", "notes", "priority", "status", "due_date", "sede_id"]) {
    if (formData.has(key)) {
      const value = formData.get(key);
      raw[key] =
        typeof value === "string" && value.trim() === "" && key !== "title"
          ? null
          : value;
    }
  }
  if (formData.has("assignee_ids")) {
    raw.assignee_ids = formData.getAll("assignee_ids").filter(Boolean);
  }

  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, detail: zodDetail(parsed.error.issues[0].message, t) };
  }

  const { id, assignee_ids, ...patch } = parsed.data;
  const supabase = await createClient();

  if (Object.keys(patch).length > 0) {
    // completed_at is maintained by a trigger, so it is never set from here.
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) return { ok: false, detail: translate(error.message, t) };
  }

  if (assignee_ids) {
    const { error } = await supabase.rpc("set_task_assignees", {
      p_task_id: id,
      p_assignee_ids: assignee_ids,
    });
    if (error) return { ok: false, detail: translate(error.message, t) };
  }

  revalidateAll();
  revalidatePath(`/tareas/${id}`);
  return { ok: true, id };
}

export async function addCommentAction(formData: FormData): Promise<Result> {
  const t = await getMessages();
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, detail: t.errors.session };

  const parsed = commentSchema.safeParse({
    task_id: formData.get("task_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, detail: zodDetail(parsed.error.issues[0].message, t) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: parsed.data.task_id,
    author_id: profile.id,
    body: parsed.data.body,
  });

  if (error) return { ok: false, detail: translate(error.message, t) };

  revalidatePath(`/tareas/${parsed.data.task_id}`);
  return { ok: true };
}

export async function deleteTaskAction(
  id: string,
  after = "/tareas",
): Promise<Result> {
  const t = await getMessages();
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, detail: t.errors.session };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return { ok: false, detail: translate(error.message, t) };
  if (!count) return { ok: false, detail: t.errors.cannotDelete };

  revalidateAll();
  redirect(safeBackPath(after, "/tareas"));
}

function zodDetail(code: string, t: Messages): string {
  if (code in t.errors) return t.errors[code as keyof Messages["errors"]];
  return t.errors.cannotSave;
}

function translate(message: string, t: Messages): string {
  if (message.includes("can only be assigned to members")) {
    return t.errors.privateAssignee;
  }
  if (message.includes("must be created by a member")) {
    return t.errors.privateCreate;
  }
  if (message.includes("assigned to non-members")) {
    return t.errors.moveWithOutsiders;
  }
  if (message.includes("cannot be made public")) {
    return t.errors.cannotUnprivate;
  }
  if (message.includes("row-level security")) {
    return t.errors.rls;
  }
  return t.errors.cannotSave;
}

import { Lock } from "lucide-react";
import { notFound } from "next/navigation";

import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskRow } from "@/components/tasks/task-row";
import { todayISO } from "@/lib/dates";
import { getMessages } from "@/lib/i18n/server";
import { listBackHref } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import {
  listSedes,
  listSpaceMembers,
  listSpaces,
  listTasks,
} from "@/lib/tasks";

/**
 * One route serves every space, including the private one. There is no
 * special-cased `/privado` page and no membership check in this file: RLS
 * returns no row for a private space the caller does not belong to, so the
 * lookup below misses and Next renders a plain 404.
 *
 * A 404 and not a 403 — a 403 would confirm the space exists.
 */
export default async function EspacioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ assignee?: string; status?: string; sede?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: space } = await supabase
    .from("spaces")
    .select("id, slug, name, is_private")
    .eq("slug", slug)
    .maybeSingle();

  if (!space) notFound();

  const today = todayISO();
  const t = await getMessages();
  const [tasks, spaces, assignable, sedes] = await Promise.all([
    listTasks({
      spaceId: space.id,
      assigneeId: sp.assignee,
      status: sp.status ?? "open",
      sedeId: sp.sede,
    }),
    listSpaces(),
    listSpaceMembers(space.id),
    listSedes(),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          {space.is_private ? (
            <Lock className="h-4 w-4 text-grass" aria-hidden />
          ) : null}
          {space.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {space.is_private ? t.space.privateHint : t.space.membersHint}
        </p>
      </header>

      <QuickAdd
        spaces={[space]}
        people={assignable}
        sedes={sedes}
        defaultSpaceId={space.id}
      />

      <TaskFilters
        spaces={spaces}
        people={assignable}
        sedes={sedes}
        showSpace={false}
      />

      {tasks.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-sheet px-4 py-10 text-center text-sm text-muted">
          {t.space.empty}
        </p>
      ) : (
        <ul className="rounded-card border border-line bg-sheet px-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              backHref={listBackHref(`/espacios/${slug}`, sp)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

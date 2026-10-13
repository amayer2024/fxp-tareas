import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Comments } from "@/components/tasks/comments";
import { TaskDetailForm } from "@/components/tasks/task-detail-form";
import { formatCreatedStamp } from "@/lib/dates";
import { fill } from "@/lib/i18n";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { safeBackPath } from "@/lib/paths";
import { getSessionProfile } from "@/lib/session";
import { getTask, listComments, listSedes, listSpaceMembers } from "@/lib/tasks";

export default async function TareaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;

  // RLS already hides tasks in spaces the caller cannot see, so an unreadable
  // task is indistinguishable from one that does not exist. That is the point.
  const task = await getTask(id);
  if (!task) notFound();

  const t = await getMessages();
  const locale = await getLocale();
  const profile = await getSessionProfile();
  const { back } = await searchParams;

  const [comments, assignable, sedes] = await Promise.all([
    listComments(id),
    task.space ? listSpaceMembers(task.space.id) : Promise.resolve([]),
    listSedes(),
  ]);

  const canDelete = Boolean(
    profile &&
      (profile.id === task.created_by ||
        profile.role === "admin" ||
        task.space?.is_private),
  );
  const fallbackHref = task.space ? `/espacios/${task.space.slug}` : "/tareas";
  const backHref = safeBackPath(back, fallbackHref);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-pitch"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {task.space?.name ?? t.tareas.title}
        </Link>
        {task.space?.is_private ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-grass">
            <Lock className="h-3 w-3" aria-hidden />
            {t.space.privateBadge}
          </p>
        ) : null}
        <time dateTime={task.created_at} className="mt-2 block text-xs text-muted">
          {fill(t.task.createdOn, {
            when: formatCreatedStamp(task.created_at, locale),
          })}
        </time>
      </div>

      <TaskDetailForm
        task={task}
        people={assignable}
        sedes={sedes}
        canDelete={canDelete}
        backHref={backHref}
      />

      <Comments taskId={task.id} comments={comments} />
    </div>
  );
}

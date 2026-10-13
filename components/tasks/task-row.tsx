"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

import { ToggleDone } from "./toggle-done";
import { useI18n } from "@/components/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { formatDueLabel, priorityLabel } from "@/lib/dates";
import type { TaskRowData } from "@/lib/tasks";

export function TaskRow({
  task,
  today,
  showSpace = false,
  backHref = "/tareas",
}: {
  task: TaskRowData;
  today: string;
  showSpace?: boolean;
  backHref?: string;
}) {
  const { locale, t } = useI18n();
  const due = formatDueLabel(task.due_date, today, locale);
  const isDone = task.status === "done";

  return (
    <li className="flex items-start gap-3 border-b border-line px-1 py-3 last:border-b-0">
      <ToggleDone taskId={task.id} status={task.status} />

      <div className="min-w-0 flex-1">
        <Link
          href={`/tareas/${task.id}?back=${encodeURIComponent(backHref)}`}
          className="block text-sm font-medium leading-snug hover:underline"
        >
          <span className={isDone ? "text-muted line-through" : "text-ink"}>
            {task.title}
          </span>
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {task.due_date ? (
            <span
              className={
                due.tone === "overdue"
                  ? "font-medium text-overdue"
                  : due.tone === "soon"
                    ? "font-medium text-soon"
                    : undefined
              }
            >
              {due.text}
            </span>
          ) : null}

          {task.assignees.length > 0 ? (
            <span className="truncate">
              {task.assignees.map((a) => firstName(a.full_name)).join(", ")}
            </span>
          ) : (
            <span className="italic">{t.task.noAssignee}</span>
          )}

          {task.sede ? <span>· {task.sede.name}</span> : null}

          {showSpace && task.space ? (
            <span className="inline-flex items-center gap-1">
              ·{" "}
              {task.space.is_private ? (
                <Lock className="h-3 w-3" aria-hidden />
              ) : null}
              {task.space.name}
            </span>
          ) : null}
        </div>
      </div>

      {task.priority === "urgent" || task.priority === "high" ? (
        <Badge tone={task.priority === "urgent" ? "overdue" : "soon"}>
          {priorityLabel(task.priority, t)}
        </Badge>
      ) : null}
    </li>
  );
}

function firstName(full: string) {
  return full.split(" ")[0];
}

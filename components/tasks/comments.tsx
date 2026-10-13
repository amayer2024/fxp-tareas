"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { addCommentAction } from "@/app/(app)/tareas/actions";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { TaskComment } from "@/lib/tasks";

export function Comments({
  taskId,
  comments,
}: {
  taskId: string;
  comments: TaskComment[];
}) {
  const { locale, t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    startTransition(async () => {
      const result = await addCommentAction(formData);
      if (result.ok) formRef.current?.reset();
      else toast.error(result.detail);
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {t.task.followUp}
        {comments.length > 0 ? (
          <span className="ml-1.5 font-normal text-muted">
            {comments.length}
          </span>
        ) : null}
      </h2>

      {comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-card border border-line bg-sheet p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {c.author?.full_name ?? t.task.someone}
                </p>
                <time className="text-xs text-muted">
                  {formatStamp(c.created_at, locale)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <form ref={formRef} action={onSubmit} className="space-y-2">
        <input type="hidden" name="task_id" value={taskId} />
        <Textarea
          name="body"
          placeholder={t.task.commentPlaceholder}
          maxLength={4000}
          className="min-h-[72px]"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? t.task.sending : t.task.comment}
        </Button>
      </form>
    </section>
  );
}

function formatStamp(iso: string, locale: "es" | "en") {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-CR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

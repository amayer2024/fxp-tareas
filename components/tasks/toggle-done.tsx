"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateTaskAction } from "@/app/(app)/tareas/actions";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";

export function ToggleDone({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const isDone = status === "done";

  function toggle() {
    startTransition(async () => {
      const form = new FormData();
      form.set("id", taskId);
      form.set("status", isDone ? "open" : "done");
      const result = await updateTaskAction(form);
      if (!result.ok) toast.error(result.detail);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={isDone ? t.task.markOpen : t.task.markDone}
      aria-pressed={isDone}
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
        isDone
          ? "border-grass bg-grass text-white"
          : "border-line bg-sheet hover:border-grass",
        pending && "opacity-50",
      )}
    >
      {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}

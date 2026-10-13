"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteTaskAction,
  updateTaskAction,
} from "@/app/(app)/tareas/actions";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  PRIORITY_KEYS,
  STATUS_KEYS,
  priorityLabel,
  statusLabel,
} from "@/lib/dates";
import type { Assignee, TaskRowData } from "@/lib/tasks";

export function TaskDetailForm({
  task,
  people,
  sedes,
  canDelete,
  backHref,
}: {
  task: TaskRowData;
  people: Assignee[];
  sedes: { id: string; name: string }[];
  canDelete: boolean;
  backHref: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const assigned = new Set(task.assignees.map((a) => a.id));
  const isDone = task.status === "done";
  const busy = pending || saving;

  function onSubmit(formData: FormData) {
    // Toast + navigate live outside startTransition so React does not
    // drop the popup as a low-priority update when the page changes.
    setSaving(true);
    void (async () => {
      const result = await updateTaskAction(formData);
      if (!result.ok) {
        setSaving(false);
        toast.error(result.detail);
        return;
      }
      toast.success(t.task.saved);
      router.push(backHref);
    })();
  }

  function setStatus(status: "open" | "done") {
    startTransition(async () => {
      const form = new FormData();
      form.set("id", task.id);
      form.set("status", status);
      const result = await updateTaskAction(form);
      if (result.ok) {
        toast.success(status === "done" ? t.task.markedDone : t.task.markedOpen);
      } else {
        toast.error(result.detail);
      }
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteTaskAction(task.id, backHref);
      if (result && !result.ok) {
        setConfirmingDelete(false);
        toast.error(result.detail);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-card border border-line bg-sheet p-4">
      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="id" value={task.id} />

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            {t.task.title}
          </span>
          <Input name="title" defaultValue={task.title} maxLength={200} required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            {t.task.notes}
          </span>
          <Textarea
            name="notes"
            defaultValue={task.notes ?? ""}
            maxLength={4000}
            placeholder={t.task.notesPlaceholder}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              {t.task.status}
            </span>
            <Select name="status" defaultValue={task.status}>
              {STATUS_KEYS.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value, t)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              {t.task.priority}
            </span>
            <Select name="priority" defaultValue={task.priority}>
              {PRIORITY_KEYS.map((value) => (
                <option key={value} value={value}>
                  {priorityLabel(value, t)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              {t.task.dueDate}
            </span>
            <Input type="date" name="due_date" defaultValue={task.due_date ?? ""} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              {t.task.sede}
            </span>
            <Select name="sede_id" defaultValue={task.sede?.id ?? ""}>
              <option value="">{t.task.noSede}</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">{t.task.assignedTo}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="assignee_ids"
                  value={p.id}
                  defaultChecked={assigned.has(p.id)}
                  className="h-4 w-4 accent-[color:var(--lime)]"
                />
                {p.full_name}
              </label>
            ))}
          </div>
          <input type="hidden" name="assignee_ids" value="" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? t.task.saving : t.task.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setStatus(isDone ? "open" : "done")}
          >
            {isDone ? t.task.markOpen : t.task.markDone}
          </Button>
        </div>
      </form>

      {canDelete ? (
        <div className="border-t border-line pt-4">
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t.task.deleteConfirm}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={onDelete}
                >
                  {t.task.deleteYes}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t.task.deleteCancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              {t.task.delete}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

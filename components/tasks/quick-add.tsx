"use client";

import { Plus } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createTaskAction } from "@/app/(app)/tareas/actions";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PRIORITY_KEYS, priorityLabel } from "@/lib/dates";
import type { Assignee, Space } from "@/lib/tasks";

export function QuickAdd({
  spaces,
  people,
  membersBySpace,
  sedes,
  defaultSpaceId,
}: {
  spaces: Space[];
  people?: Assignee[];
  membersBySpace?: Record<string, Assignee[]>;
  sedes: { id: string; name: string }[];
  defaultSpaceId: string;
}) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [pending, startTransition] = useTransition();
  const candidates = membersBySpace?.[spaceId] ?? people ?? [];

  function onSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;

    startTransition(async () => {
      const result = await createTaskAction(formData);
      if (result.ok) {
        formRef.current?.reset();
        setExpanded(false);
        toast.success(t.task.created);
      } else {
        toast.error(result.detail);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="rounded-card border border-line bg-sheet p-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Input
          name="title"
          placeholder={t.task.placeholder}
          maxLength={200}
          required
          className="border-0 shadow-none focus-visible:ring-0"
          onFocus={() => setExpanded(true)}
          onChange={(e) => {
            if (e.target.value.length > 0) setExpanded(true);
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending}
          aria-label={t.task.addAria}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <Field label={t.task.space}>
            <Select
              name="space_id"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t.task.dueDate}>
            <Input type="date" name="due_date" />
          </Field>

          <Field label={t.task.priority}>
            <Select name="priority" defaultValue="medium">
              {PRIORITY_KEYS.map((value) => (
                <option key={value} value={value}>
                  {priorityLabel(value, t)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t.task.sede}>
            <Select name="sede_id" defaultValue="">
              <option value="">{t.task.noSede}</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-muted">
              {t.task.assignTo}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {candidates.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="assignee_ids"
                    value={p.id}
                    className="h-4 w-4 accent-[color:var(--lime)]"
                  />
                  {p.full_name}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <input type="hidden" name="space_id" value={defaultSpaceId} />
      )}

      <button
        type="button"
        onClick={() =>
          setExpanded((v) => {
            if (v) setSpaceId(defaultSpaceId);
            return !v;
          })
        }
        className="mt-2 text-xs text-muted hover:text-pitch"
      >
        {expanded ? t.task.less : t.task.more}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

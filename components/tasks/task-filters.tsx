"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/provider";
import { Select } from "@/components/ui/input";
import { STATUS_KEYS, statusLabel } from "@/lib/dates";
import type { Assignee, Space } from "@/lib/tasks";

export function TaskFilters({
  spaces,
  people,
  sedes,
  showSpace = true,
}: {
  spaces: Space[];
  people: Assignee[];
  sedes: { id: string; name: string }[];
  showSpace?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showSpace ? (
        <Select
          aria-label={t.filters.space}
          value={params.get("space") ?? ""}
          onChange={(e) => set("space", e.target.value)}
          className="h-9 w-auto text-[13px]"
        >
          <option value="">{t.filters.allSpaces}</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        aria-label={t.filters.person}
        value={params.get("assignee") ?? ""}
        onChange={(e) => set("assignee", e.target.value)}
        className="h-9 w-auto text-[13px]"
      >
        <option value="">{t.filters.anyPerson}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t.filters.status}
        value={params.get("status") ?? "open"}
        onChange={(e) => set("status", e.target.value)}
        className="h-9 w-auto text-[13px]"
      >
        <option value="open">{t.filters.pending}</option>
        <option value="all">{t.filters.all}</option>
        {STATUS_KEYS.map((value) => (
          <option key={value} value={value}>
            {statusLabel(value, t)}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t.filters.sede}
        value={params.get("sede") ?? ""}
        onChange={(e) => set("sede", e.target.value)}
        className="h-9 w-auto text-[13px]"
      >
        <option value="">{t.filters.allSedes}</option>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

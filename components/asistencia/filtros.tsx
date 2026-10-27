"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/components/i18n/provider";
import { Select } from "@/components/ui/input";

// Mismo patron que components/tasks/task-filters.tsx: el estado vive en la URL,
// asi el server component vuelve a consultar y la vista es compartible.
export function AsistenciaFiltros({
  sedes,
  anios,
}: {
  sedes: string[];
  anios: number[];
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
      <Select
        aria-label={t.asistencia.sede}
        className="h-9 w-auto text-[13px]"
        value={params.get("sede") ?? ""}
        onChange={(e) => set("sede", e.target.value)}
      >
        <option value="">{t.asistencia.todasLasSedes}</option>
        {sedes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t.asistencia.anio}
        className="h-9 w-auto text-[13px]"
        value={params.get("anio") ?? ""}
        onChange={(e) => set("anio", e.target.value)}
      >
        <option value="">{t.asistencia.todosLosAnios}</option>
        {anios.map((a) => (
          <option key={a} value={String(a)}>
            {a}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t.asistencia.denominador}
        className="h-9 w-auto text-[13px]"
        value={params.get("just") ?? "si"}
        onChange={(e) => set("just", e.target.value === "si" ? "" : e.target.value)}
      >
        <option value="si">{t.asistencia.justIncluidas}</option>
        <option value="no">{t.asistencia.justExcluidas}</option>
      </Select>
    </div>
  );
}

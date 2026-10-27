import { AsistenciaFiltros } from "@/components/asistencia/filtros";
import { Tendencia } from "@/components/asistencia/tendencia";
import { fill } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n/server";
import { getSessionProfile } from "@/lib/session";
import {
  getUltimaCarga,
  listAgregados,
  listOpciones,
  porMes,
  seriesPorGrupo,
  totales,
} from "@/lib/asistencia";

export const metadata = { title: "Asistencia · FxP Tareas" };

const DIAS_PARA_ALERTA = 10;

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; anio?: string; just?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) return null;

  const t = await getMessages();
  const sp = await searchParams;

  const incluirJustificadas = sp.just !== "no";
  const filtro = {
    sede: sp.sede || undefined,
    anio: sp.anio ? Number(sp.anio) : undefined,
  };

  const [filas, opciones, carga] = await Promise.all([
    listAgregados(filtro),
    listOpciones(),
    getUltimaCarga(),
  ]);

  const tot = totales(filas, incluirJustificadas);
  const series = seriesPorGrupo(filas, incluirJustificadas);
  const meses = porMes(filas, incluirJustificadas);

  const diasDesde = carga
    ? Math.floor((Date.now() - new Date(carga.recibido_en).getTime()) / 86_400_000)
    : null;
  const vieja = diasDesde !== null && diasDesde > DIAS_PARA_ALERTA;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">{t.asistencia.title}</h1>
        <p className="mt-0.5 text-sm text-muted">
          {carga
            ? fill(t.asistencia.actualizado, {
                fecha: new Date(carga.recibido_en).toLocaleDateString("es-CR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })
            : t.asistencia.sinCargas}
        </p>
      </header>

      {vieja ? (
        <p className="rounded-card border border-overdue/40 bg-sheet px-4 py-3 text-sm text-overdue">
          {fill(t.asistencia.datoViejo, { dias: diasDesde })}
        </p>
      ) : null}

      <AsistenciaFiltros sedes={opciones.sedes} anios={opciones.anios} />

      {filas.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-sheet px-4 py-10 text-center text-sm text-muted">
          {t.asistencia.vacio}
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label={t.asistencia.tasa}
              value={tot.tasa === null ? "—" : `${(tot.tasa * 100).toFixed(1)}%`}
              hint={
                incluirJustificadas
                  ? t.asistencia.justIncluidas
                  : t.asistencia.justExcluidas
              }
            />
            <Kpi label={t.asistencia.presentes} value={tot.presente.toLocaleString("es-CR")} />
            <Kpi
              label={t.asistencia.justificadas}
              value={tot.justificada.toLocaleString("es-CR")}
            />
            <Kpi
              label={t.asistencia.injustificadas}
              value={tot.injustificada.toLocaleString("es-CR")}
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink">{t.asistencia.tendencia}</h2>
            <div className="mt-1">
              <Tendencia series={series} etiquetaVacia={t.asistencia.vacio} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink">{t.asistencia.porMes}</h2>
            <ul className="mt-1 rounded-card border border-line bg-sheet px-3">
              {meses.map((m) => (
                <li
                  key={m.mes_num}
                  className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span className="text-sm text-ink">{m.mes}</span>
                  <span className="flex items-center gap-3 text-[13px] text-muted">
                    <span>
                      {m.presente.toLocaleString("es-CR")} / {m.denominador.toLocaleString("es-CR")}
                    </span>
                    <span className="w-14 text-right font-semibold text-ink">
                      {m.tasa === null ? "—" : `${(m.tasa * 100).toFixed(1)}%`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-[12px] text-muted">{t.asistencia.notaDenominador}</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-sheet px-3 py-2.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

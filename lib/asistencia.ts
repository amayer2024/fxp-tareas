import { createClient } from "@/lib/supabase/server";

// Nota: corre `npm run types` despues de aplicar 00013_asistencia.sql, o
// TypeScript rechazara .from("asistencia_agregados") porque lib/db/types.ts
// todavia no conoce las tablas.

export type Agregado = {
  sede: string;
  anio: number;
  mes_num: number;
  mes: string;
  grupo_etario: string;
  semana: string;
  fechas: string | null;
  presente: number;
  ausente_justificada: number;
  ausente_injustificada: number;
  sin_registro: number;
  filas: number;
  filas_sesion_realizada: number;
  tasa_asistencia: number | null;
  generado: string;
};

export type Carga = {
  generado: string;
  filas_master: number;
  filas_agregadas: number;
  recibido_en: string;
};

export type Filtro = { sede?: string; anio?: number };

/** Todas las filas que el usuario puede ver, segun RLS. */
export async function listAgregados(filtro: Filtro = {}): Promise<Agregado[]> {
  const supabase = await createClient();

  let q = supabase
    .from("asistencia_agregados")
    .select(
      "sede, anio, mes_num, mes, grupo_etario, semana, fechas, presente," +
        " ausente_justificada, ausente_injustificada, sin_registro, filas," +
        " filas_sesion_realizada, tasa_asistencia, generado",
    )
    .order("sede")
    .order("mes_num")
    .order("grupo_etario");

  if (filtro.sede) q = q.eq("sede", filtro.sede);
  if (filtro.anio) q = q.eq("anio", filtro.anio);

  const { data } = await q;
  return (data ?? []) as unknown as Agregado[];
}

/** Ultima carga recibida. Sirve para avisar si el dato quedo viejo. */
export async function getUltimaCarga(): Promise<Carga | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asistencia_cargas")
    .select("generado, filas_master, filas_agregadas, recibido_en")
    .order("recibido_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data ?? null) as Carga | null;
}

/**
 * Sedes y anios presentes en los datos. Los sacamos de los propios agregados
 * en vez de la tabla `sedes`, porque el nombre viene normalizado desde Drive
 * ("Cobano", sin tilde) y puede no coincidir literalmente con el catalogo.
 */
export async function listOpciones(): Promise<{ sedes: string[]; anios: number[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asistencia_agregados")
    .select("sede, anio");

  const filas = (data ?? []) as { sede: string; anio: number }[];
  return {
    sedes: [...new Set(filas.map((f) => f.sede))].sort((a, b) => a.localeCompare(b)),
    anios: [...new Set(filas.map((f) => f.anio))].sort((a, b) => b - a),
  };
}

// ---------------------------------------------------------------- calculos

export type Totales = {
  presente: number;
  justificada: number;
  injustificada: number;
  sinRegistro: number;
  denominador: number;
  tasa: number | null;
};

/**
 * `incluirJustificadas` decide si una ausencia justificada pesa en el
 * denominador. Mueve la cifra principal unos doce puntos, asi que es una
 * decision explicita y no un default escondido.
 */
export function totales(filas: Agregado[], incluirJustificadas = true): Totales {
  const presente = sum(filas, (f) => f.presente);
  const justificada = sum(filas, (f) => f.ausente_justificada);
  const injustificada = sum(filas, (f) => f.ausente_injustificada);
  const sinRegistro = sum(filas, (f) => f.sin_registro);
  const denominador = presente + injustificada + (incluirJustificadas ? justificada : 0);

  return {
    presente,
    justificada,
    injustificada,
    sinRegistro,
    denominador,
    tasa: denominador > 0 ? presente / denominador : null,
  };
}

export type PuntoMes = { mes_num: number; mes: string; tasa: number | null; presente: number };

/** Serie por grupo etario a lo largo de los meses, para la tendencia. */
export function seriesPorGrupo(
  filas: Agregado[],
  incluirJustificadas = true,
): { grupo: string; puntos: PuntoMes[] }[] {
  const porGrupo = agrupar(filas, (f) => f.grupo_etario);

  return [...porGrupo.entries()]
    .map(([grupo, delGrupo]) => {
      const porMes = agrupar(delGrupo, (f) => String(f.mes_num));
      const puntos = [...porMes.entries()]
        .map(([mesNum, delMes]) => {
          const t = totales(delMes, incluirJustificadas);
          return {
            mes_num: Number(mesNum),
            mes: delMes[0].mes,
            tasa: t.tasa,
            presente: t.presente,
          };
        })
        .sort((a, b) => a.mes_num - b.mes_num);
      return { grupo, puntos };
    })
    .sort((a, b) => a.grupo.localeCompare(b.grupo));
}

export type FilaMes = { mes_num: number; mes: string } & Totales;

/** Una fila por mes, sumando todos los grupos. */
export function porMes(filas: Agregado[], incluirJustificadas = true): FilaMes[] {
  return [...agrupar(filas, (f) => String(f.mes_num)).entries()]
    .map(([mesNum, delMes]) => ({
      mes_num: Number(mesNum),
      mes: delMes[0].mes,
      ...totales(delMes, incluirJustificadas),
    }))
    .sort((a, b) => a.mes_num - b.mes_num);
}

function sum<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((acc, x) => acc + f(x), 0);
}

function agrupar<T>(xs: T[], clave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = clave(x);
    const actual = m.get(k);
    if (actual) actual.push(x);
    else m.set(k, [x]);
  }
  return m;
}

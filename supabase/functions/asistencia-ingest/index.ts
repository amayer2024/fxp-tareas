// Recibe los agregados de asistencia del Apps Script y los escribe en Postgres.
// Vive fuera de la app Next a proposito: usa el service role, y la regla del
// repo es que el proceso Next nunca lo toca.
//
// Deploy:  supabase functions deploy asistencia-ingest --no-verify-jwt
// Secrets: supabase secrets set ASISTENCIA_WEBHOOK_TOKEN=...
//
// --no-verify-jwt porque quien llama es Apps Script, no un usuario; la
// autenticacion es el token compartido que validamos abajo.

import { createClient } from "jsr:@supabase/supabase-js@2";

type Agregado = {
  sede: string;
  anio: number;
  mes_num: number;
  mes: string;
  grupo_etario: string;
  semana: string;
  fechas?: string | null;
  presente: number;
  ausente_justificada: number;
  ausente_injustificada: number;
  sin_registro: number;
  filas: number;
  filas_sesion_realizada: number;
  tasa_asistencia: number | null;
};

type Payload = {
  generado: string;
  filas_master: number;
  agregados: Agregado[];
};

const CLAVES: (keyof Agregado)[] = [
  "sede", "anio", "mes_num", "grupo_etario", "semana",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Comparacion de tiempo constante, para no filtrar el token por timing. */
function tokenValido(recibido: string | null): boolean {
  const esperado = Deno.env.get("ASISTENCIA_WEBHOOK_TOKEN");
  if (!esperado || !recibido || recibido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= esperado.charCodeAt(i) ^ recibido.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!tokenValido(req.headers.get("x-auth-token"))) {
    return json({ error: "no autorizado" }, 401);
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON invalido" }, 400);
  }

  if (!body?.generado || !Array.isArray(body.agregados) || body.agregados.length === 0) {
    return json({ error: "payload vacio o mal formado" }, 400);
  }

  // Si el Apps Script falla a medias y manda un fragmento, preferimos conservar
  // la carga anterior completa antes que sobrescribirla con datos parciales.
  if (body.agregados.length < 100) {
    return json({
      error: `solo ${body.agregados.length} filas; se esperaban cientos. No se escribio nada.`,
    }, 422);
  }

  for (const fila of body.agregados) {
    for (const k of CLAVES) {
      const v = fila[k];
      if (v === undefined || v === null || v === "") {
        return json({ error: `falta ${String(k)} en alguna fila` }, 400);
      }
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const generado = new Date(body.generado).toISOString();
  const filas = body.agregados.map((a) => ({
    ...a,
    fechas: a.fechas ?? null,
    generado,
    actualizado_en: new Date().toISOString(),
  }));

  // Upsert primero y borrado despues: la tabla nunca queda vacia, asi que el
  // dashboard no tiene una ventana en blanco mientras se refresca.
  const LOTE = 500;
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await supabase
      .from("asistencia_agregados")
      .upsert(filas.slice(i, i + LOTE), {
        onConflict: "sede,anio,mes_num,grupo_etario,semana",
      });
    if (error) return json({ error: `upsert fallo: ${error.message}` }, 500);
  }

  const { error: errBorrado } = await supabase
    .from("asistencia_agregados")
    .delete()
    .lt("generado", generado);
  if (errBorrado) return json({ error: `limpieza fallo: ${errBorrado.message}` }, 500);

  await supabase.from("asistencia_cargas").insert({
    generado,
    filas_master: body.filas_master ?? 0,
    filas_agregadas: filas.length,
  });

  return json({ ok: true, filas: filas.length, generado });
});

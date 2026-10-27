import type { PuntoMes } from "@/lib/asistencia";

// SVG a mano, sin libreria de graficos. El repo no tiene ninguna instalada y
// una linea por grupo etario no justifica sumar una dependencia con su propio
// riesgo de compatibilidad con React 19. Se renderiza en el servidor: cero JS.

const W = 720;
const H = 260;
const M = { top: 16, right: 12, bottom: 34, left: 38 };

// Paleta del propio tema, en orden de contraste descendente.
const COLORES = [
  "var(--pitch)",
  "var(--grass)",
  "var(--lime)",
  "var(--soon)",
  "var(--overdue)",
  "var(--muted)",
];

export type Serie = { grupo: string; puntos: PuntoMes[] };

export function Tendencia({
  series,
  etiquetaVacia,
}: {
  series: Serie[];
  etiquetaVacia: string;
}) {
  const meses = [
    ...new Set(series.flatMap((s) => s.puntos.map((p) => p.mes_num))),
  ].sort((a, b) => a - b);

  if (meses.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line bg-sheet px-4 py-10 text-center text-sm text-muted">
        {etiquetaVacia}
      </p>
    );
  }

  const nombreMes = new Map<number, string>();
  for (const s of series) for (const p of s.puntos) nombreMes.set(p.mes_num, p.mes);

  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (mes: number) => {
    if (meses.length === 1) return M.left + innerW / 2;
    return M.left + (meses.indexOf(mes) / (meses.length - 1)) * innerW;
  };
  const y = (tasa: number) => M.top + (1 - tasa) * innerH;

  return (
    <figure className="rounded-card border border-line bg-sheet p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--muted)"
            >
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {meses.map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - 12}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted)"
          >
            {(nombreMes.get(m) ?? String(m)).slice(0, 3)}
          </text>
        ))}

        {series.map((s, i) => {
          const color = COLORES[i % COLORES.length];
          const conDato = s.puntos.filter(
            (p): p is PuntoMes & { tasa: number } => p.tasa !== null,
          );
          // Cortamos la linea cuando falta un mes, en vez de interpolar sobre
          // un hueco: Cobano no tiene mayo ni junio y una linea continua ahi
          // inventaria datos que nadie registro.
          const tramos: (PuntoMes & { tasa: number })[][] = [];
          let actual: (PuntoMes & { tasa: number })[] = [];
          for (const m of meses) {
            const p = conDato.find((q) => q.mes_num === m);
            if (p) actual.push(p);
            else if (actual.length) {
              tramos.push(actual);
              actual = [];
            }
          }
          if (actual.length) tramos.push(actual);

          return (
            <g key={s.grupo}>
              {tramos.map((tramo, j) => (
                <polyline
                  key={j}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={tramo.map((p) => `${x(p.mes_num)},${y(p.tasa)}`).join(" ")}
                />
              ))}
              {conDato.map((p) => (
                <circle
                  key={p.mes_num}
                  cx={x(p.mes_num)}
                  cy={y(p.tasa)}
                  r={3}
                  fill={color}
                />
              ))}
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <span key={s.grupo} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLORES[i % COLORES.length] }}
            />
            {s.grupo}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

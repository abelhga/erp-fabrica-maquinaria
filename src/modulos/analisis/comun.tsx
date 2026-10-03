import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, BarChart3, Table2 } from "lucide-react";
import { fecha, hoyISO, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

// -----------------------------------------------------------------------------
// Periodo: vive en la URL (?p=12m) para que al cambiar de pestaña se quede el mismo
// y se pueda mandar la liga tal cual.
// -----------------------------------------------------------------------------
export type ClavePeriodo = "anio" | "12m" | "anterior" | "todo" | "rango";
export const PERIODOS: { valor: ClavePeriodo; texto: string }[] = [
  { valor: "anio", texto: "Este año" },
  { valor: "12m", texto: "Últimos 12 meses" },
  { valor: "anterior", texto: "Año anterior" },
  { valor: "todo", texto: "Desde 2018" },
  { valor: "rango", texto: "Rango" },
];

export interface Periodo { clave: ClavePeriodo; desde: string; hasta: string; etiqueta: string }

const masDias = (iso: string, d: number) => {
  const f = new Date(iso + "T12:00:00");
  f.setDate(f.getDate() + d);
  return f.toLocaleDateString("en-CA");
};

export function calcularPeriodo(clave: ClavePeriodo, desde?: string | null, hasta?: string | null): Periodo {
  const hoy = hoyISO();
  const anio = Number(hoy.slice(0, 4));
  switch (clave) {
    case "12m": {
      const d = masDias(`${anio - 1}${hoy.slice(4)}`, 1);
      return { clave, desde: d, hasta: hoy, etiqueta: "los últimos 12 meses" };
    }
    case "anterior":
      return { clave, desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31`, etiqueta: String(anio - 1) };
    case "todo":
      return { clave, desde: "2018-01-01", hasta: hoy, etiqueta: "2018 a la fecha" };
    case "rango": {
      const d = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : `${anio}-01-01`;
      const h = hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) && hasta >= d ? hasta : hoy;
      return { clave, desde: d, hasta: h, etiqueta: `${fecha(d)} a ${fecha(h)}` };
    }
    default:
      return { clave: "anio", desde: `${anio}-01-01`, hasta: hoy, etiqueta: `${anio} a la fecha` };
  }
}

export function usePeriodo() {
  const [params, setParams] = useSearchParams();
  const clave = (PERIODOS.some((p) => p.valor === params.get("p")) ? params.get("p") : "anio") as ClavePeriodo;
  const periodo = calcularPeriodo(clave, params.get("desde"), params.get("hasta"));
  const cambiar = (c: ClavePeriodo, d?: string, h?: string) => {
    const n = new URLSearchParams(params);
    n.set("p", c);
    if (c === "rango") { n.set("desde", d ?? periodo.desde); n.set("hasta", h ?? periodo.hasta); }
    else { n.delete("desde"); n.delete("hasta"); }
    setParams(n, { replace: true });
  };
  return { periodo, cambiar, params, setParams };
}

// -----------------------------------------------------------------------------
// Escalas de color. Los colores son tokens (index.css), nunca hex: así el modo oscuro
// usa su propia rampa validada y no una inversión automática.
// -----------------------------------------------------------------------------
export const SEQ = (i: number) => `var(--seq-${Math.min(7, Math.max(1, i))})`;
export const SEQ_TINTA = (i: number) => `var(--seq-tinta-${Math.min(7, Math.max(1, i))})`;
export const DIV = (i: number) => `var(--div-${Math.min(7, Math.max(1, i))})`;
export const VACIO = "var(--mapa-vacio)";

/** Redondea a 2 cifras significativas: un corte de $1,234,567 se lee "$1.2 M". */
function redondear(v: number) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}

export interface Escala {
  tipo: "secuencial" | "divergente";
  /** Límites superiores de cada clase, menos la última. */
  cortes: number[];
  /** Token de color de cada clase. */
  colores: string[];
  claseDe: (v: number) => number;
  explicacion: string;
}

/**
 * Cortes por cuantiles redondeados: cada tono junta un número parecido de regiones, así
 * Jalisco no deja a los demás estados en el mismo color pálido. Hasta 7 clases; con pocas
 * regiones, menos (nunca una clase vacía).
 */
export function escalaCuantiles(valores: number[], maxClases = 7): Escala {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b);
  const k = Math.max(1, Math.min(maxClases, Math.ceil(v.length / 2)));
  const cortes: number[] = [];
  for (let i = 1; i < k; i++) {
    const c = redondear(v[Math.floor((i * v.length) / k)] ?? 0);
    if (c > 0 && (cortes.length === 0 || c > cortes[cortes.length - 1]) && c < (v[v.length - 1] ?? 0)) cortes.push(c);
  }
  const n = cortes.length + 1;
  // Tonos repartidos a lo largo de la rampa de 7, del más claro al más oscuro.
  const colores = Array.from({ length: n }, (_, i) => SEQ(n === 1 ? 5 : 1 + Math.round((i * 6) / (n - 1))));
  return {
    tipo: "secuencial", cortes, colores,
    claseDe: (x) => { let i = 0; while (i < cortes.length && x > cortes[i]) i++; return i; },
    explicacion: "Cortes por cuantiles redondeados: cada tono junta una cantidad parecida de regiones (o de celdas).",
  };
}

/** Crecimiento: cortes fijos y simétricos, gris entre −5 % y +5 %. */
export const CORTES_CRECIMIENTO = [-0.5, -0.2, -0.05, 0.05, 0.2, 0.5];
export function escalaCrecimiento(): Escala {
  const cortes = CORTES_CRECIMIENTO;
  return {
    tipo: "divergente", cortes, colores: [1, 2, 3, 4, 5, 6, 7].map(DIV),
    claseDe: (x) => { let i = 0; while (i < cortes.length && x > cortes[i]) i++; return i; },
    explicacion: "Cortes fijos: gris es «casi igual» (±5 %); rojo cayó, azul creció.",
  };
}

// -----------------------------------------------------------------------------
// Piezas comunes
// -----------------------------------------------------------------------------

/** Cambio contra el periodo anterior, con flecha e insignia (nunca el color solo). */
export function Cambio({ v, nuevo, className }: { v: number | null | undefined; nuevo?: boolean; className?: string }) {
  if (nuevo) return <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold bg-info-suave text-info", className)}>nuevo</span>;
  if (v == null || !Number.isFinite(v)) return <span className={cn("text-xs text-tenue", className)}>—</span>;
  const sube = v >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold cifra",
      Math.abs(v) < 0.05 ? "bg-fondo text-tenue" : sube ? "bg-ok-suave text-ok" : "bg-peligro-suave text-peligro", className)}>
      {sube ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {/* Arriba de +200 % se lee mejor "×21" que "2,000 %". */}
      {v >= 2 ? `×${Math.round(1 + v)}` : porcentaje(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0)}
    </span>
  );
}

/** Cifra de la vista: etiqueta, valor grande y una línea de contexto. */
export function Cifra({ titulo, valor, detalle, extra }: { titulo: string; valor: ReactNode; detalle?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="tarjeta px-4 py-3 min-w-0">
      <p className="text-sm text-tenue truncate">{titulo}</p>
      <div className="flex items-end gap-2 mt-0.5">
        <span className="text-2xl font-semibold tracking-tight leading-tight truncate">{valor}</span>
        {extra}
      </div>
      {detalle && <p className="text-xs text-tenue mt-1">{detalle}</p>}
    </div>
  );
}

/**
 * Tarjeta de una gráfica con su gemela en tabla (para leer con lector de pantalla
 * y para copiar a Excel). La tabla es la misma información, no un resumen.
 */
export function TarjetaGrafica({ titulo, descripcion, acciones, tabla, children, className, pie }: {
  titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; tabla?: ReactNode; children: ReactNode; className?: string; pie?: ReactNode;
}) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <section className={cn("tarjeta flex flex-col min-w-0", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{titulo}</h3>
          {descripcion && <p className="text-sm text-tenue mt-0.5">{descripcion}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {acciones}
          {tabla && (
            <div className="inline-flex rounded-lg border border-borde p-0.5" role="group" aria-label="Ver como">
              <button type="button" onClick={() => setVerTabla(false)} aria-pressed={!verTabla} title="Gráfica"
                className={cn("p-1 rounded-md", !verTabla ? "bg-marca-suave text-marca-texto" : "text-tenue hover:text-texto")}>
                <BarChart3 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setVerTabla(true)} aria-pressed={verTabla} title="Tabla"
                className={cn("p-1 rounded-md", verTabla ? "bg-marca-suave text-marca-texto" : "text-tenue hover:text-texto")}>
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">{verTabla && tabla ? tabla : children}</div>
      {pie && <div className="px-5 pb-3 pt-1 text-xs text-tenue">{pie}</div>}
    </section>
  );
}

/** Leyenda de una escala de clases: muestras y cortes legibles. */
export function LeyendaEscala({ escala, formato, vacio = "Sin venta", className }: {
  escala: Escala; formato: (v: number) => string; vacio?: string | null; className?: string;
}) {
  const { cortes, colores } = escala;
  const etiqueta = (i: number) => {
    if (escala.tipo === "divergente") {
      const t = ["−50 % o más", "−20 a −50 %", "−5 a −20 %", "±5 %", "+5 a +20 %", "+20 a +50 %", "+50 % o más"];
      return t[i];
    }
    if (cortes.length === 0) return "Con venta";
    if (i === 0) return `hasta ${formato(cortes[0])}`;
    if (i === cortes.length) return `más de ${formato(cortes[i - 1])}`;
    return `${formato(cortes[i - 1])} – ${formato(cortes[i])}`;
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tenue", className)}>
      {colores.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border border-borde/60" style={{ background: c }} />
          <span className="cifra">{etiqueta(i)}</span>
        </span>
      ))}
      {vacio && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border border-borde" style={{ background: VACIO }} />{vacio}
        </span>
      )}
    </div>
  );
}

/** Barra horizontal para rankings: una sola serie, un solo color (la longitud ya dice cuánto). */
export function BarraRanking({ valor, max, className }: { valor: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  return (
    <div className={cn("h-2 rounded-full bg-fondo overflow-hidden", className)}>
      <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(pct, valor > 0 ? 1.5 : 0)}%`, background: "var(--serie-1)" }} />
    </div>
  );
}

export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Familias con color fijo (siempre el mismo, en cualquier periodo); el resto se junta en gris. */
export const FAMILIAS_CON_COLOR = ["dosificadoras", "bandas", "helicoidales", "tolvas_silos", "cribas", "banda_hule", "elevadores"] as const;
export const colorFamilia = (clave: string) => {
  const i = (FAMILIAS_CON_COLOR as readonly string[]).indexOf(clave);
  return i >= 0 ? `var(--serie-${i + 1})` : "var(--serie-resto)";
};

export const NOMBRE_SEGMENTO: Record<string, { nombre: string; texto: string }> = {
  campeones: { nombre: "Campeones", texto: "Compraron en el último año, 3 o más veces en 3 años y están entre los que más compran." },
  nuevos: { nombre: "Nuevos", texto: "Su primera compra fue en los últimos 12 meses." },
  leales: { nombre: "Leales", texto: "Compraron en el último año y 2 o más veces en 3 años." },
  ocasionales: { nombre: "Ocasionales", texto: "Compraron en el último año, una sola vez en 3 años." },
  en_riesgo: { nombre: "En riesgo", texto: "Su última compra fue hace 12 a 24 meses y compraban seguido o mucho." },
  dormidos: { nombre: "Dormidos", texto: "Su última compra fue hace 12 a 24 meses." },
  perdidos: { nombre: "Perdidos", texto: "Hace más de 2 años que no compran." },
};

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIE, TooltipGrafica, ejeProps, Leyenda } from "@/components/graficas/comunes";
import { fecha, numero, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { MENU } from "@/navegacion";

/** Lo que se puede comparar: cada gráfica usa la misma medida, con un solo eje. */
export type Metrica = "minutos" | "cambios" | "ia" | "costo" | "personas";
export const METRICAS: { valor: Metrica; texto: string }[] = [
  { valor: "minutos", texto: "Tiempo activo" }, { valor: "cambios", texto: "Cambios" }, { valor: "ia", texto: "Consultas a la IA" },
  { valor: "costo", texto: "Costo de la IA" }, { valor: "personas", texto: "Personas activas" },
];

export function tiempo(min: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  // Arriba de 10 horas los minutos ya no dicen nada (y no caben en un indicador).
  return h >= 10 ? `${numero(h)} h` : h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
export const usd = (v: number) => (!v ? "—" : v < 0.01 ? "< US$0.01" : `US$${v < 1 ? v.toFixed(2) : numero(Math.round(v * 100) / 100)}`);
export function formatoMetrica(m: Metrica, v: number) {
  return m === "minutos" ? tiempo(v) : m === "costo" ? usd(v) : numero(v);
}

export interface DiaUso { dia: string; n: number; personas: number; minutos: number; cambios: number; ia: number; costo_usd: number }
const deDia = (d: DiaUso, m: Metrica) => (m === "costo" ? d.costo_usd : m === "personas" ? d.personas : m === "ia" ? d.ia : m === "cambios" ? d.cambios : d.minutos);

/** Cómo va día por día contra el periodo anterior del mismo largo (alineado por día del periodo). */
export function Tendencia({ dias, anteriores, metrica, comparar }: { dias: DiaUso[]; anteriores: DiaUso[]; metrica: Metrica; comparar: boolean }) {
  const datos = dias.map((d, i) => ({ etiqueta: fecha(d.dia).slice(0, 6), actual: deDia(d, metrica), anterior: anteriores[i] ? deDia(anteriores[i], metrica) : 0 }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rejilla)" />
          <XAxis dataKey="etiqueta" {...ejeProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...ejeProps} allowDecimals={metrica === "costo"} tickFormatter={(v) => (metrica === "minutos" ? `${Math.round(v / 60)} h` : metrica === "costo" ? `$${v}` : String(v))} />
          <Tooltip content={<TooltipGrafica formato={(v) => formatoMetrica(metrica, v)} />} />
          <Line dataKey="actual" name="Este periodo" stroke={SERIE(1)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} type="linear" />
          {comparar && <Line dataKey="anterior" name="Periodo anterior" stroke="var(--eje)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} type="linear" />}
          {comparar && <Legend content={() => <div className="pt-2"><Leyenda series={[{ nombre: "Este periodo", color: SERIE(1) }, { nombre: "Periodo anterior", color: "var(--eje)" }]} /></div>} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface PersonaUso {
  id: string; nombre: string; minutos: number; cambios: number; consultas_ia: number; costo_ia_usd: number; dias_activos: number;
  ant: { minutos: number; cambios: number; consultas_ia: number; costo_ia_usd: number; dias_activos: number };
}
export const dePersona = (p: PersonaUso | PersonaUso["ant"], m: Metrica) =>
  m === "costo" ? p.costo_ia_usd : m === "ia" ? p.consultas_ia : m === "cambios" ? p.cambios : m === "personas" ? p.dias_activos : p.minutos;
export const etiquetaPorPersona = (m: Metrica) => (m === "personas" ? "Días con uso" : METRICAS.find((x) => x.valor === m)!.texto);

/** Cada persona contra sí misma en el periodo anterior: barra llena = ahora, barra gris = antes. */
export function Comparativo({ personas, metrica, comparar }: { personas: PersonaUso[]; metrica: Metrica; comparar: boolean }) {
  // Solo quien tuvo algo en alguno de los dos periodos: una barra en cero no compara nada.
  const datos = [...personas].filter((p) => dePersona(p, metrica) > 0 || (comparar && dePersona(p.ant, metrica) > 0))
    .sort((a, b) => dePersona(b, metrica) - dePersona(a, metrica)).slice(0, 14)
    .map((p) => ({ nombre: p.nombre.split(" ").slice(0, 3).join(" "), actual: dePersona(p, metrica), anterior: dePersona(p.ant, metrica) }));
  if (datos.length === 0) return <p className="text-sm text-tenue">Nadie tiene de esto en el periodo con este filtro.</p>;
  return (
    <div style={{ height: Math.max(160, datos.length * (comparar ? 30 : 24) + 40) }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barGap={2} barCategoryGap={comparar ? 6 : 8}>
          <CartesianGrid horizontal={false} stroke="var(--rejilla)" />
          <XAxis type="number" {...ejeProps} allowDecimals={metrica === "costo"} tickFormatter={(v) => (metrica === "minutos" ? `${Math.round(v / 60)} h` : metrica === "costo" ? `$${v}` : String(v))} />
          <YAxis type="category" dataKey="nombre" {...ejeProps} width={130} />
          <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => formatoMetrica(metrica, v)} />} />
          <Bar dataKey="actual" name="Este periodo" fill={SERIE(1)} radius={[0, 4, 4, 0]} />
          {comparar && <Bar dataKey="anterior" name="Periodo anterior" fill="var(--rejilla)" stroke="var(--eje)" strokeWidth={0.5} radius={[0, 4, 4, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface CeldaUso { u: string; dia: string; minutos: number; cambios: number; ia: number }

/**
 * Persona × día: qué tan intenso fue cada día (un solo tono, de claro a oscuro). Deja ver quién lo usa
 * diario, quién solo algunos días y quién lo dejó de usar.
 */
export function MapaCalor({ personas, celdas, dias, metrica, vivo }: {
  personas: { id: string; nombre: string }[]; celdas: CeldaUso[]; dias: string[]; metrica: Metrica;
  /** Quién hizo algo ahorita (por persona, cuántas veces): enciende su cuadro de hoy. */
  vivo?: Record<string, { k: number; tipo: "cambio" | "vista"; rapido?: boolean }>;
}) {
  const hoy = hoyISO();
  const [sobre, setSobre] = useState<{ nombre: string; dia: string; c: CeldaUso | undefined } | null>(null);
  const valor = (c: CeldaUso | undefined) => !c ? 0 : metrica === "minutos" ? c.minutos : metrica === "cambios" ? c.cambios
    : metrica === "ia" || metrica === "costo" ? c.ia : c.minutos + c.cambios + c.ia;
  const idx = useMemo(() => new Map(celdas.map((c) => [`${c.u}|${c.dia}`, c])), [celdas]);
  const max = Math.max(1, ...celdas.map(valor));
  const tono = (v: number) => (v <= 0 ? "hsl(var(--fondo))" : `color-mix(in oklab, var(--serie-1) ${Math.round(18 + 82 * Math.sqrt(v / max))}%, hsl(var(--superficie)))`);
  return (
    <div className="space-y-2">
      <p className="text-xs text-tenue h-4">{sobre ? <><b className="text-texto">{sobre.nombre}</b> · {fecha(sobre.dia)}: {sobre.c ? `${tiempo(sobre.c.minutos)} activo, ${sobre.c.cambios} cambios, ${sobre.c.ia} consultas a la IA` : "sin uso"}</> : "Pasa el mouse por un cuadro para ver el detalle del día."}</p>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }} onMouseLeave={() => setSobre(null)}>
          <thead>
            <tr><th />{dias.map((d, i) => <th key={d} className="text-[10px] font-normal text-tenue px-0 w-4">{i % 7 === 0 ? fecha(d).slice(0, 2) : ""}</th>)}</tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.id}>
                <td className="pr-2 text-xs whitespace-nowrap max-w-[150px] truncate">{p.nombre.split(" ").slice(0, 3).join(" ")}</td>
                {dias.map((d) => {
                  const c = idx.get(`${p.id}|${d}`);
                  // La llave cambia con cada aviso: React vuelve a montar la celda y la animación corre otra vez.
                  const v = d === hoy ? vivo?.[p.id] : undefined;
                  return <td key={v ? `${d}-${v.k}` : d} className={cn("h-4 w-4 rounded-[3px] p-0", sobre?.nombre === p.nombre && sobre.dia === d && "ring-2 ring-texto/40",
                      v && (v.rapido ? "uso-destello-rapido" : v.tipo === "cambio" ? "uso-destello" : "uso-destello-suave"))}
                    style={{ background: tono(valor(c)) }} onMouseEnter={() => setSobre({ nombre: p.nombre, dia: d, c })} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-tenue">
        <span>Menos</span>{[0, 0.15, 0.4, 0.7, 1].map((f) => <span key={f} className="h-3 w-3 rounded-[3px]" style={{ background: tono(f * max) }} />)}<span>Más</span>
      </div>
    </div>
  );
}

// La sección del menú de cada pantalla («/almacen/…» → Almacén). Lo que no está en el menú va a «Inicio y pendientes».
const SECCION = new Map<string, string>();
for (const s of MENU) for (const e of s.entradas) { const k = e.ruta.split("/")[1]; if (k && !SECCION.has(k)) SECCION.set(k, s.titulo); }
SECCION.set("piso", "Producción");
export const nombreSeccion = (s: string) => SECCION.get(s) ?? "Inicio y pendientes";

/** En qué partes del ERP se le va el tiempo a cada persona (de 100 %), con las secciones siempre del mismo color. */
export function MezclaSecciones({ personas, filas }: { personas: { id: string; nombre: string }[]; filas: { u: string; seccion: string; minutos: number; vistas: number }[] }) {
  // Las secciones en orden fijo por tiempo total; de la octava en adelante, «Otras».
  const total = new Map<string, number>();
  for (const f of filas) { const s = nombreSeccion(f.seccion); total.set(s, (total.get(s) ?? 0) + f.minutos + f.vistas); }
  const orden = [...total.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const fijas = orden.slice(0, 7), hayOtras = orden.length > 7;
  const series = [...fijas, ...(hayOtras ? ["Otras"] : [])];
  const datos = personas.map((p) => {
    const fila: Record<string, number | string> = { nombre: p.nombre.split(" ").slice(0, 3).join(" ") };
    let suma = 0;
    for (const f of filas.filter((x) => x.u === p.id)) {
      const s = nombreSeccion(f.seccion), k = fijas.includes(s) ? s : "Otras", v = f.minutos || f.vistas * 0.5;
      fila[k] = ((fila[k] as number) ?? 0) + v; suma += v;
    }
    for (const s of series) fila[s] = suma ? Math.round(((fila[s] as number) ?? 0) / suma * 1000) / 10 : 0;
    return { ...fila, suma };
  }).filter((d) => d.suma > 0);
  if (datos.length === 0) return <p className="text-sm text-tenue">Todavía no hay pantallas registradas en este periodo.</p>;
  return (
    <div className="space-y-2">
      <Leyenda series={series.map((s, i) => ({ nombre: s, color: s === "Otras" ? "var(--eje)" : SERIE(i + 1) }))} />
      <div style={{ height: datos.length * 26 + 30 }}>
        <ResponsiveContainer>
          <BarChart data={datos} layout="vertical" stackOffset="expand" margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" {...ejeProps} tickFormatter={(v) => `${Math.round(v * 100)} %`} />
            <YAxis type="category" dataKey="nombre" {...ejeProps} width={130} />
            <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => `${v} %`} />} />
            {series.map((s, i) => <Bar key={s} dataKey={s} name={s} stackId="a" fill={s === "Otras" ? "var(--eje)" : SERIE(i + 1)} stroke="hsl(var(--superficie))" strokeWidth={2} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const MODO_IA: Record<string, string> = {
  chat: "Preguntas al asistente", resumen: "Resumen diario de cada área", semana: "«Tu semana»", redactar: "Mensajes a clientes",
  mensaje_seguimiento: "Mensajes de seguimiento", mensaje_lead: "Mensajes a leads", respuesta_ml: "Respuestas de Mercado Libre",
  pulir_descripcion: "Descripciones del catálogo", leer_documento: "Leer documentos de importación", leer_correos_embarque: "Leer correos de embarques",
  sugerir_mejoras: "Ideas de mejora", nocturna: "Revisión nocturna", bien_asi: "Revisar «Está bien así»", ayuda_corregir: "«Ayúdame a corregirlo»",
};

/** En qué se va el dinero de la IA: una barra por uso, de mayor a menor. */
export function CostoPorUso({ usos }: { usos: { modo: string; consultas: number; costo_usd: number }[] }) {
  const datos = usos.filter((u) => u.costo_usd > 0).map((u) => ({ nombre: MODO_IA[u.modo] ?? u.modo, costo: u.costo_usd, consultas: u.consultas }));
  if (datos.length === 0) return <p className="text-sm text-tenue">Sin uso de la IA en este periodo.</p>;
  return (
    <div style={{ height: datos.length * 26 + 30 }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--rejilla)" />
          <XAxis type="number" {...ejeProps} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="nombre" {...ejeProps} width={200} />
          <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => usd(v)} />} />
          <Bar dataKey="costo" name="Costo" fill={SERIE(2)} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

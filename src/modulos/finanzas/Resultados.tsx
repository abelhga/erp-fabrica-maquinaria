import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { AlertTriangle, Factory, Landmark, PiggyBank, Tags, TrendingUp, Waypoints } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Filtro } from "@/components/datos/TablaDatos";
import { Leyenda, SERIE } from "@/components/graficas/comunes";
import { TarjetaGrafica } from "@/modulos/analisis/comun";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useRpc } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hoyISO, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Cuánto deja lo que se vende: ventas → costo de fabricación / gastos de operación / utilidad.
 * Toda la cuenta (y qué es estimado) la hace la base en resultados_periodo; aquí solo se dibuja
 * y se dice de dónde sale cada número.
 */

interface Monto { categoria: string; importe: number }
interface Datos {
  periodo: { desde: string; hasta: string };
  ventas: { linea: string; importe: number }[];
  ventas_total: number;
  material: { exacto: number; estimado: number; cobertura: number | null };
  proporcion: Record<string, { r: number; fuente: "ventas" | "catalogo"; partidas: number }>;
  mano_obra: { estimado: number; real: number };
  sueldos_oficina: { estimado: number; real: number };
  semanas_cerradas: number;
  comisiones: number; comisiones_completas: boolean;
  fabricacion: Monto[]; operacion: Monto[];
  material_comprado: number; caja_chica: number; mercado_libre: number; envios: number;
  sin_clasificar: string[];
  desde_compras: string | null; desde_caja: string | null; desde_ventas: string | null;
  sin_sueldo: number;
  totales: {
    material: number; mano_obra: number; gastos_fabricacion: number; costo_fabricacion: number;
    sueldos_oficina: number; compras_operacion: number; gastos_operacion: number; utilidad: number;
  };
}
interface Categoria { categoria: string; tipo: TipoCategoria; clasificada: boolean; compras: number; importe: number }
type TipoCategoria = "material" | "fabricacion" | "operacion";

// --- Periodo -----------------------------------------------------------------
type ClavePeriodo = "mes" | "anterior" | "anio" | "12m" | "rango";
const PERIODOS: { valor: ClavePeriodo; texto: string }[] = [
  { valor: "anterior", texto: "Mes pasado" }, { valor: "mes", texto: "Este mes" }, { valor: "anio", texto: "Este año" },
  { valor: "12m", texto: "12 meses" }, { valor: "rango", texto: "Rango" },
];
const iso = (d: Date) => d.toLocaleDateString("en-CA");
function calcular(clave: ClavePeriodo, d?: string | null, h?: string | null) {
  const hoy = hoyISO();
  const [a, m] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
  switch (clave) {
    case "mes": return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "anio": return { desde: `${a}-01-01`, hasta: hoy };
    case "12m": return { desde: iso(new Date(a - 1, m - 1, Number(hoy.slice(8, 10)) + 1)), hasta: hoy };
    case "rango": {
      const desde = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : `${hoy.slice(0, 7)}-01`;
      return { desde, hasta: h && /^\d{4}-\d{2}-\d{2}$/.test(h) && h >= desde ? h : hoy };
    }
    // Por omisión el mes que ya cerró: el que trae sus compras y su caja completas.
    default: return { desde: iso(new Date(a, m - 2, 1)), hasta: iso(new Date(a, m - 1, 0)) };
  }
}

// --- Flujo del diagrama ---------------------------------------------------------
type Grupo = "ventas" | "fabricacion" | "operacion" | "utilidad" | "perdida";
const COLOR: Record<Grupo, string> = {
  ventas: SERIE(1), fabricacion: SERIE(2), operacion: SERIE(7), utilidad: SERIE(3), perdida: "hsl(var(--peligro))",
};
const LINEA: Record<string, string> = { maquinaria: "Maquinaria", refacciones: "Refacciones", otros: "Otros" };
interface NodoFlujo { name: string; grupo: Grupo; estimado: boolean }
interface Flujo { nodes: NodoFlujo[]; links: { source: number; target: number; value: number }[] }

function armarFlujo(d: Datos): Flujo {
  const t = d.totales;
  const nodes: NodoFlujo[] = [];
  const links: Flujo["links"] = [];
  const nodo = (name: string, grupo: Grupo, estimado = false) => nodes.push({ name, grupo, estimado }) - 1;
  const liga = (source: number, target: number, value: number) => { if (value > 0.5) links.push({ source, target, value }); };

  const ventas = nodo("Ventas", "ventas");
  for (const v of d.ventas) if (v.importe > 0) liga(nodo(LINEA[v.linea] ?? v.linea, "ventas"), ventas, v.importe);
  const estMaterial = d.material.estimado > 0;
  const estSueldos = (k: "mano_obra" | "sueldos_oficina") => d[k].estimado > 0;
  const fab = nodo("Costo de fabricación", "fabricacion", estMaterial || estSueldos("mano_obra"));
  const op = nodo("Gastos de operación", "operacion", estSueldos("sueldos_oficina"));
  // Las ventas pagan primero la fabricación y luego la operación; si no alcanzan, lo que falta
  // entra como pérdida.
  const aFab = Math.min(d.ventas_total, t.costo_fabricacion);
  const aOp = Math.min(d.ventas_total - aFab, t.gastos_operacion);
  liga(ventas, fab, aFab);
  liga(ventas, op, aOp);
  if (t.utilidad > 0) liga(ventas, nodo("Utilidad", "utilidad", estMaterial || estSueldos("mano_obra") || estSueldos("sueldos_oficina")), t.utilidad);
  if (t.utilidad < 0) {
    const perdida = nodo("Pérdida", "perdida");
    liga(perdida, fab, t.costo_fabricacion - aFab);
    liga(perdida, op, t.gastos_operacion - aOp);
  }
  const hijo = (padre: number, name: string, value: number, estimado = false) => {
    if (value > 0.5) liga(padre, nodo(name, nodes[padre].grupo, estimado), value);
  };
  hijo(fab, "Material", t.material, estMaterial);
  hijo(fab, "Mano de obra del taller", t.mano_obra, estSueldos("mano_obra"));
  hijo(fab, "Gastos de fabricación", t.gastos_fabricacion);
  hijo(op, "Sueldos de oficina", t.sueldos_oficina, estSueldos("sueldos_oficina"));
  hijo(op, "Comisiones", d.comisiones);
  hijo(op, "Compras de operación", t.compras_operacion);
  hijo(op, "Caja chica", d.caja_chica);
  hijo(op, "Mercado Libre", d.mercado_libre);
  hijo(op, "Envíos", d.envios);
  // Recharts no dibuja nodos sin franjas: los que quedaron sin liga se quitan y se renumera.
  const usados = [...new Set(links.flatMap((l) => [l.source, l.target]))].sort((a, b) => a - b);
  const nuevo = new Map(usados.map((v, i) => [v, i]));
  return { nodes: usados.map((i) => nodes[i]), links: links.map((l) => ({ ...l, source: nuevo.get(l.source)!, target: nuevo.get(l.target)! })) };
}

export default function Resultados() {
  const [params, setParams] = useSearchParams();
  const clave = (PERIODOS.some((p) => p.valor === params.get("p")) ? params.get("p") : "anterior") as ClavePeriodo;
  const { desde, hasta } = calcular(clave, params.get("desde"), params.get("hasta"));
  const [categorias, setCategorias] = useState(false);
  const r = useRpc<Datos>("resultados_periodo", { p_desde: desde, p_hasta: hasta }, { clave: ["resultados_periodo", desde, hasta] });
  const cambiar = (v: ClavePeriodo, d = desde, h = hasta) => {
    const n = new URLSearchParams();
    if (v !== "anterior") n.set("p", v);
    if (v === "rango") { n.set("desde", d); n.set("hasta", h); }
    setParams(n, { replace: true });
  };
  return (
    <Pagina titulo="Resultados" ancho="max-w-[1500px]" descripcion={`Del ${fecha(desde)} al ${fecha(hasta)} · cuánto deja lo que se vende`}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Filtro opciones={PERIODOS} valor={clave} alCambiar={(v) => cambiar(v)} />
          {clave === "rango" && (
            <span className="inline-flex items-center gap-1 text-xs text-tenue">
              <input type="date" className="campo h-8 w-[150px]" value={desde} aria-label="Desde" onChange={(e) => e.target.value && cambiar("rango", e.target.value, hasta)} />
              a
              <input type="date" className="campo h-8 w-[150px]" value={hasta} aria-label="Hasta" onChange={(e) => e.target.value && cambiar("rango", desde, e.target.value)} />
            </span>
          )}
          <Boton variante="secundario" tamano="sm" onClick={() => setCategorias(true)}><Tags className="h-4 w-4" />Categorías de compra</Boton>
        </div>
      }>
      {r.error ? <ErrorCarga error={r.error} /> : !r.data ? <Cargando filas={8} />
        : <Contenido d={r.data} desde={desde} abrirCategorias={() => setCategorias(true)} />}
      <Lateral abierto={categorias} alCambiar={setCategorias} titulo="Categorías de compra"
        subtitulo={`Las que tienen compras del ${fecha(desde)} al ${fecha(hasta)}`}>
        {categorias && <EditorCategorias desde={desde} hasta={hasta} />}
      </Lateral>
    </Pagina>
  );
}

function Contenido({ d, desde, abrirCategorias }: { d: Datos; desde: string; abrirCategorias: () => void }) {
  const t = d.totales;
  const flujo = useMemo(() => armarFlujo(d), [d]);
  const pct = (v: number) => (d.ventas_total ? porcentaje(v / d.ventas_total, 0) : "—");
  const estimado = d.material.estimado > 0 || d.mano_obra.estimado > 0 || d.sueldos_oficina.estimado > 0;
  // En los indicadores, compacto: con centavos no cabía y se cortaba. La tabla trae el importe completo.
  const ap = (v: number, est: boolean) => `${est ? "≈ " : ""}${dineroCompacto(v)}`;

  const avisos: { texto: string; accion?: React.ReactNode }[] = [];
  if (d.desde_compras && desde < d.desde_compras)
    avisos.push({ texto: `El libro de compras con categoría empieza el ${fecha(d.desde_compras)}: antes de esa fecha faltan los gastos de compras.` });
  if (d.desde_caja && desde < d.desde_caja) avisos.push({ texto: `La caja chica empieza el ${fecha(d.desde_caja)}: antes no hay salidas de caja.` });
  if (d.material.cobertura != null && d.material.cobertura < 0.5)
    avisos.push({ texto: `Solo ${porcentaje(d.material.cobertura, d.material.cobertura < 0.01 ? 2 : 0)} de lo vendido tiene costeo: el material del resto es estimado.` });
  if (d.mano_obra.estimado + d.sueldos_oficina.estimado > 0)
    avisos.push({ texto: d.semanas_cerradas
      ? `${numero(d.semanas_cerradas)} ${d.semanas_cerradas === 1 ? "semana" : "semanas"} de nómina cerrada con lo pagado; los demás días, con el sueldo semanal de cada persona.`
      : "Ninguna semana de nómina de este periodo se ha cerrado en el ERP: los sueldos salen del sueldo semanal de cada persona." });
  if (d.sin_sueldo > 0) avisos.push({ texto: `${numero(d.sin_sueldo)} ${d.sin_sueldo === 1 ? "persona activa no tiene" : "personas activas no tienen"} sueldo registrado en Personal y no ${d.sin_sueldo === 1 ? "cuenta" : "cuentan"}.` });
  if (d.sin_clasificar.length)
    avisos.push({ texto: `${numero(d.sin_clasificar.length)} ${d.sin_clasificar.length === 1 ? "categoría de compra nueva cuenta" : "categorías de compra nuevas cuentan"} como gasto de operación hasta que alguien las clasifique.`,
      accion: <button type="button" className="underline font-medium" onClick={abrirCategorias}>Clasificar</button> });
  if (!d.comisiones_completas) avisos.push({ texto: "Tu rol no ve las comisiones de todos los vendedores: aquí solo están las tuyas." });

  if (!d.ventas_total) {
    return <Tarjeta><Vacio icono={Waypoints} titulo="No hay ventas en este periodo" texto="Elige otro periodo arriba: el diagrama sale de los pedidos con fecha en el periodo." /></Tarjeta>;
  }
  return (
    <div className="space-y-4">
      {avisos.length > 0 && (
        <div className="rounded-lg border border-aviso/40 bg-aviso-suave px-4 py-3 text-sm space-y-1">
          {avisos.map((a) => (
            <p key={a.texto} className="flex gap-2"><AlertTriangle className="h-4 w-4 text-aviso shrink-0 mt-0.5" /><span>{a.texto} {a.accion}</span></p>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Ventas" valor={dineroCompacto(d.ventas_total)} icono={TrendingUp} explica={GLOSARIO.ventasResultados}
          detalle={d.ventas.map((v) => `${LINEA[v.linea] ?? v.linea} ${pct(v.importe)}`).join(" · ")} />
        <Kpi titulo="Costo de fabricación" valor={ap(t.costo_fabricacion, d.material.estimado + d.mano_obra.estimado > 0)} icono={Factory}
          tono="aviso" explica={GLOSARIO.costoFabricacion} detalle={`${pct(t.costo_fabricacion)} de las ventas`} />
        <Kpi titulo="Gastos de operación" valor={ap(t.gastos_operacion, d.sueldos_oficina.estimado > 0)} icono={Landmark}
          tono="info" explica={GLOSARIO.gastosOperacion} detalle={`${pct(t.gastos_operacion)} de las ventas`} />
        <Kpi titulo={t.utilidad < 0 ? "Pérdida" : "Utilidad"} valor={ap(t.utilidad, estimado)} icono={PiggyBank}
          tono={t.utilidad < 0 ? "peligro" : "ok"} explica={GLOSARIO.utilidadPeriodo} detalle={`Margen ${pct(t.utilidad)} · antes de impuestos`} />
      </div>

      <TarjetaGrafica titulo="De dónde viene y a dónde se va el dinero" explica={GLOSARIO.estimadoResultados}
        descripcion="El grueso de cada franja es el dinero. ≈ = estimado. Pasa el mouse por una franja para ver cuánto es."
        tabla={<TablaFlujo flujo={flujo} ventas={d.ventas_total} />}
        pie="Solo cuenta lo que pasa por el ERP: compras con categoría, caja chica, nómina, comisiones, Mercado Libre y Envíos. Lo que se paga por fuera (renta, impuestos o cuotas del IMSS que no se capturan como compra) no está, así que la utilidad de verdad es menor.">
        <div className="px-5"><Leyenda series={[
          { nombre: "Ventas", color: COLOR.ventas }, { nombre: "Costo de fabricación", color: COLOR.fabricacion },
          { nombre: "Gastos de operación", color: COLOR.operacion },
          t.utilidad < 0 ? { nombre: "Pérdida", color: COLOR.perdida } : { nombre: "Utilidad", color: COLOR.utilidad },
        ]} /></div>
        <div className="overflow-x-auto">
          <div className="min-w-[820px] h-[520px] px-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey data={flujo} nodePadding={26} nodeWidth={12} iterations={64} sort={false}
                margin={{ top: 16, bottom: 16, left: 200, right: 270 }}
                node={<NodoSankey ventas={d.ventas_total} />} link={<LigaSankey />}>
                <Tooltip content={<TooltipFlujo ventas={d.ventas_total} />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </div>
      </TarjetaGrafica>

      <Tarjeta>
        <EncabezadoTarjeta titulo="De dónde sale cada número" descripcion="Exacto: sale tal cual de lo capturado. Estimado: se calcula con una regla, aquí dice cuál." />
        <OrigenNumeros d={d} />
      </Tarjeta>
    </div>
  );
}

// --- Piezas del diagrama -------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any -- recharts pasa a node/link props sin tipo */
function NodoSankey(props: any) {
  const { x, y, width, height, payload, ventas } = props;
  const n = payload as NodoFlujo & { depth: number; value: number; targetNodes?: number[] };
  const izquierda = n.depth === 0;
  // Las columnas de en medio tienen otra columna enfrente: en un renglón la etiqueta se encimaba
  // con la de la derecha, así que van en dos.
  const enMedio = !izquierda && (n.targetNodes?.length ?? 0) > 0;
  const tx = izquierda ? x - 8 : x + width + 8;
  const monto = `${n.estimado ? "≈ " : ""}${dineroCompacto(n.value)} · ${porcentaje(n.value / ventas, 0)}`;
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} rx={2} fill={COLOR[n.grupo]} />
      <text x={tx} y={y + height / 2} textAnchor={izquierda ? "end" : "start"} dominantBaseline="middle" fontSize={12}
        fill="hsl(var(--texto))" stroke="hsl(var(--superficie))" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
        {enMedio ? (
          <>
            <tspan x={tx} dy="-0.6em" fontWeight={600}>{n.name}</tspan>
            <tspan x={tx} dy="1.25em" fill="hsl(var(--tenue))">{monto}</tspan>
          </>
        ) : (
          <>
            <tspan fontWeight={600}>{n.name}</tspan>
            <tspan dx={6} fill="hsl(var(--tenue))">{monto}</tspan>
          </>
        )}
      </text>
    </g>
  );
}

function LigaSankey(props: any) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
  const grupo: Grupo = payload.source.grupo === "perdida" ? "perdida" : payload.target.grupo === "ventas" ? "ventas" : payload.target.grupo;
  return (
    <path className="liga-sankey" fill="none" stroke={COLOR[grupo]} strokeWidth={Math.max(1, linkWidth)}
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`} />
  );
}

function TooltipFlujo({ active, payload, ventas }: { active?: boolean; payload?: any[]; ventas: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload?.payload ?? payload[0].payload;
  const esLiga = p?.source && p?.target;
  const nombre = esLiga ? `${p.source.name} → ${p.target.name}` : p?.name;
  const valor = Number(payload[0].value ?? p?.value ?? 0);
  const estimado = esLiga ? p.target.estimado || p.source.estimado : p?.estimado;
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[180px]">
      <p className="font-medium mb-1">{nombre}</p>
      <p className="flex justify-between gap-4"><span className="text-tenue">{estimado ? "Estimado" : "Importe"}</span><span className="cifra font-medium">{dinero(valor)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-tenue">De las ventas</span><span className="cifra">{porcentaje(valor / ventas, 1)}</span></p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function TablaFlujo({ flujo, ventas }: { flujo: Flujo; ventas: number }) {
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="tabla">
        <thead><tr><th>De</th><th>A</th><th className="!text-right">Importe</th><th className="!text-right">De las ventas</th></tr></thead>
        <tbody>
          {flujo.links.map((l) => {
            const a = flujo.nodes[l.target];
            return (
              <tr key={`${l.source}-${l.target}`}>
                <td>{flujo.nodes[l.source].name}</td><td className="font-medium">{a.name}</td>
                <td className="text-right cifra">{a.estimado ? "≈ " : ""}{dinero(l.value)}</td>
                <td className="text-right cifra">{porcentaje(l.value / ventas, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- De dónde sale cada número ---------------------------------------------------
type Precision = "exacto" | "estimado" | "parcial";
const PRECISION: Record<Precision, { tono: "ok" | "aviso" | "neutro"; texto: string }> = {
  exacto: { tono: "ok", texto: "Exacto" }, estimado: { tono: "aviso", texto: "Estimado" }, parcial: { tono: "neutro", texto: "Parcial" },
};

function OrigenNumeros({ d }: { d: Datos }) {
  const t = d.totales;
  const pct = (v: number) => (d.ventas_total ? porcentaje(v / d.ventas_total, 1) : "—");
  const top = (xs: Monto[]) => xs.slice(0, 4).map((x) => `${x.categoria} ${dineroCompacto(x.importe)}`).join(" · ") + (xs.length > 4 ? ` y ${xs.length - 4} más` : "");
  const pesos = Object.entries(d.proporcion).filter(([l]) => d.ventas.some((v) => v.linea === l))
    .map(([l, p]) => `${LINEA[l] ?? l} ${porcentaje(p.r, 0)} (${p.fuente === "ventas" ? `de ${numero(p.partidas)} partidas vendidas` : "del catálogo"})`).join(", ");
  const sueldos = (k: "mano_obra" | "sueldos_oficina", quien: string) => {
    const x = d[k];
    const partes = [];
    if (x.real > 0) partes.push(`${dinero(x.real)} de semanas de nómina cerradas`);
    if (x.estimado > 0) partes.push(`${dinero(x.estimado)} con el sueldo semanal ÷ 7 por cada día de alta`);
    return { texto: `${quien}: ${partes.join("; ") || "sin sueldos en el periodo"}.`, precision: (x.estimado > 0 ? "estimado" : "exacto") as Precision };
  };
  // Compras y caja empezaron después que las ventas: un periodo que arranca antes sale incompleto.
  const compras: Precision = d.desde_compras && d.periodo.desde < d.desde_compras ? "parcial" : "exacto";
  const caja: Precision = d.desde_caja && d.periodo.desde < d.desde_caja ? "parcial" : "exacto";
  const mo = sueldos("mano_obra", "La gente del departamento de Producción");
  const so = sueldos("sueldos_oficina", "Todos los demás departamentos");
  const mat: Precision = d.material.estimado > 0 ? "estimado" : "exacto";
  const com: Precision = d.comisiones_completas ? "exacto" : "parcial";
  // Un total es tan exacto como su parte menos exacta.
  const peor = (...ps: Precision[]): Precision => ps.includes("estimado") ? "estimado" : ps.includes("parcial") ? "parcial" : "exacto";
  const fab = peor(mat, mo.precision, compras);
  const op = peor(so.precision, com, compras, caja);
  const filas: { concepto: string; importe: number; texto: string; precision: Precision; explica?: string; total?: boolean; aparte?: boolean }[] = [
    { concepto: "Ventas", importe: d.ventas_total, precision: "exacto", explica: GLOSARIO.ventasResultados, total: true,
      texto: "Partidas de los pedidos con fecha en el periodo, sin IVA y sin cancelados; los de dólares, con su tipo de cambio." },
    { concepto: "Material", importe: t.material, precision: mat, explica: GLOSARIO.materialVendido,
      texto: `${porcentaje(d.material.cobertura ?? 0, (d.material.cobertura ?? 0) < 0.01 ? 2 : 0)} de lo vendido tiene costeo: ${dinero(d.material.exacto)} con su costo de material de hoy.`
        + (d.material.estimado > 0 ? ` El resto, ${dinero(d.material.estimado)}, con el peso del material en el precio: ${pesos || "50 % (no hay con qué compararlo)"}.` : "") },
    { concepto: "Mano de obra del taller", importe: t.mano_obra, precision: mo.precision, explica: GLOSARIO.manoObraTaller, texto: mo.texto },
    { concepto: "Gastos de fabricación", importe: t.gastos_fabricacion, precision: compras, explica: GLOSARIO.gastosFabricacion,
      texto: d.fabricacion.length ? `Compras de taller: ${top(d.fabricacion)}.` : "Ninguna compra de categoría de taller en el periodo." },
    { concepto: "Costo de fabricación", importe: t.costo_fabricacion, precision: fab,
      texto: "Material + mano de obra del taller + gastos de fabricación.", total: true },
    { concepto: "Sueldos de oficina", importe: t.sueldos_oficina, precision: so.precision, texto: so.texto },
    { concepto: "Comisiones", importe: d.comisiones, precision: com,
      texto: "Lo que da la regla de comisiones de cada vendedor en cada mes que toca el periodo (un mes empezado cuenta completo)." },
    { concepto: "Compras de operación", importe: t.compras_operacion, precision: compras,
      texto: d.operacion.length ? `Sin IVA si tienen factura: ${top(d.operacion)}.` : "Ninguna compra de operación en el periodo." },
    { concepto: "Caja chica", importe: d.caja_chica, precision: caja, texto: "Salidas de efectivo de la caja chica." },
    { concepto: "Mercado Libre", importe: d.mercado_libre, precision: "exacto",
      texto: "Comisión, envío y otros cargos de los pagos aprobados. Las retenciones no: son impuestos a cuenta." },
    { concepto: "Envíos", importe: d.envios, precision: "exacto", texto: "Lo que costaron las guías de Envíos, por la fecha en que salió el paquete." },
    { concepto: "Gastos de operación", importe: t.gastos_operacion, precision: op,
      explica: GLOSARIO.gastosOperacion, texto: "Sueldos de oficina + comisiones + compras de operación + caja chica + Mercado Libre + envíos.", total: true },
    { concepto: t.utilidad < 0 ? "Pérdida" : "Utilidad", importe: t.utilidad, precision: peor(fab, op),
      explica: GLOSARIO.utilidadPeriodo, texto: "Ventas − costo de fabricación − gastos de operación, antes de impuestos.", total: true },
    { concepto: "Material comprado (no se suma)", importe: d.material_comprado, precision: compras, aparte: true, explica: GLOSARIO.tipoCategoriaCompra,
      texto: "Compras de categorías de material. No es gasto: ese material ya está en lo vendido. Sirve para comparar con el material de arriba." },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="tabla">
        <thead><tr><th>Concepto</th><th className="!text-right">Importe</th><th className="!text-right">De las ventas</th><th>Cómo sale</th><th>Precisión</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.concepto} className={cn(f.total && "bg-fondo/60", f.aparte && "text-tenue")}>
              <td className={cn("whitespace-nowrap", f.total ? "font-semibold" : "pl-6")}>
                <span data-explain={f.explica} data-explain-title={f.explica ? f.concepto : undefined}>{f.concepto}</span>
              </td>
              <td className={cn("text-right cifra whitespace-nowrap", f.total && "font-semibold", f.importe < 0 && "text-peligro")}>{dinero(f.importe)}</td>
              <td className="text-right cifra">{f.aparte ? "—" : pct(f.importe)}</td>
              <td className="text-xs text-tenue min-w-[320px]">{f.texto}</td>
              <td><span data-explain={f.precision === "estimado" ? GLOSARIO.estimadoResultados : f.precision === "parcial" ? GLOSARIO.parcialResultados : undefined}><Insignia tono={PRECISION[f.precision].tono}>{PRECISION[f.precision].texto}</Insignia></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Categorías de compra --------------------------------------------------------
const TIPOS: { valor: TipoCategoria; texto: string }[] = [
  { valor: "material", texto: "Material (ya va en lo vendido)" },
  { valor: "fabricacion", texto: "Gasto de fabricación" },
  { valor: "operacion", texto: "Gasto de operación" },
];

function EditorCategorias({ desde, hasta }: { desde: string; hasta: string }) {
  const { puede } = useSesion();
  const editable = puede("finanzas", 2) || puede("analisis", 3);
  const c = useRpc<Categoria[]>("categorias_compra_periodo", { p_desde: desde, p_hasta: hasta }, { clave: ["categorias_compra_periodo", desde, hasta] });
  const fijar = useAccion((a: { categoria: string; tipo: TipoCategoria }) => q(supabase.rpc("fijar_categoria_compra", { p_categoria: a.categoria, p_tipo: a.tipo })),
    { invalidar: [["categorias_compra_periodo"], ["resultados_periodo"]], exito: "Listo: los resultados ya cuentan esa categoría así" });
  if (c.error) return <ErrorCarga error={c.error} />;
  if (!c.data) return <Cargando filas={6} />;
  if (!c.data.length) return <Vacio icono={Tags} titulo="Sin compras con categoría en este periodo" texto="Elige otro periodo en la pantalla: aquí salen las categorías del libro de compras que tienen compras en él." />;
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-tenue" data-explain={GLOSARIO.tipoCategoriaCompra} data-explain-title="Cómo cuenta cada categoría">
        Material no se suma como gasto: ya va en el material de lo vendido. Lo de taller que no se queda en el equipo es gasto de fabricación; lo demás, de operación.
        {!editable && " Solo finanzas lo cambia."}
      </p>
      <table className="tabla">
        <thead><tr><th>Categoría</th><th className="!text-right">Compras</th><th className="!text-right">Importe</th><th>Cuenta como</th></tr></thead>
        <tbody>
          {c.data.map((x) => (
            <tr key={x.categoria}>
              <td>{capital(x.categoria)}{!x.clasificada && <> <Insignia tono="aviso">Nueva</Insignia></>}</td>
              <td className="text-right cifra">{numero(x.compras)}</td>
              <td className="text-right cifra whitespace-nowrap">{dinero(x.importe)}</td>
              <td>
                {editable
                  ? <select className="campo h-8 text-xs" value={x.tipo} aria-label={`Cómo cuenta ${x.categoria}`} disabled={fijar.isPending}
                      onChange={(e) => fijar.mutate({ categoria: x.categoria, tipo: e.target.value as TipoCategoria })}>
                      {TIPOS.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                    </select>
                  : <span className="text-xs">{TIPOS.find((o) => o.valor === x.tipo)?.texto}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-tenue">El importe es el del libro de compras, con IVA si la compra lo trae; en los resultados las facturadas cuentan sin IVA.</p>
    </div>
  );
}

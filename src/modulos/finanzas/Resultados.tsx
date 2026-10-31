import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Factory, Landmark, PiggyBank, Tags, TrendingUp, Waypoints } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Lateral } from "@/components/ui/dialogo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Filtro } from "@/components/datos/TablaDatos";
import { Leyenda, SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { DiagramaSankey, TablaSankey, armarSankey, type DatosSankey, type NodoSankey } from "@/components/graficas/Sankey";
import { TarjetaGrafica } from "@/modulos/analisis/comun";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useRpc } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hoyISO, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Cuánto deja lo que se vende: ventas → costo de fabricación / gastos de operación / impuestos e
 * intereses / utilidad, desde 2018. Antes del arranque del ERP los números salen de las hojas.
 * Toda la cuenta (y qué es estimado) la hace la base en resultados_periodo; aquí solo se dibuja
 * y se dice de dónde sale cada número.
 */

interface Monto { categoria: string; importe: number }
interface Sueldos { estimado: number; real: number; hoja: number }
interface Datos {
  periodo: { desde: string; hasta: string };
  arranque: string; usa_hoja: boolean;
  ventas: { linea: string; importe: number }[];
  ventas_total: number; ventas_hoja: number; ventas_ml?: number;
  material: { exacto: number; estimado: number; cobertura: number | null; comprado_hoja: number };
  proporcion: Record<string, { r: number; fuente: "ventas" | "catalogo"; partidas: number }>;
  proporcion_taller: number;
  mano_obra: Sueldos; sueldos_oficina: Sueldos; nomina_hoja: number;
  semanas_cerradas: number;
  comisiones: number; comisiones_hoja: number; comisiones_pagadas?: number; comisiones_completas: boolean;
  fabricacion: Monto[]; operacion: Monto[]; impuestos: Monto[]; fuera: Monto[];
  material_comprado: number; caja_chica: number; mercado_libre: number; envios: number;
  /** Compras del ERP: las ligadas a su orden cuentan por partida; las demás, por la categoría de la factura. */
  compras_erp?: { con_orden: number; sin_orden: number; sin_articulo: number };
  sin_clasificar: string[]; sin_categoria: number;
  desde_compras: string | null; desde_caja: string | null; desde_ventas: string | null;
  sin_sueldo: number;
  totales: {
    material: number; mano_obra: number; gastos_fabricacion: number; costo_fabricacion: number;
    sueldos_oficina: number; compras_operacion: number; gastos_operacion: number;
    utilidad_operacion: number; impuestos_financieros: number; utilidad: number; fuera: number;
  };
}
interface Anio { anio: number; ventas: number; costo_fabricacion: number; gastos_operacion: number; impuestos_financieros: number; utilidad: number; fuera: number; parcial: boolean }
interface Categoria { categoria: string; tipo: TipoCategoria; clasificada: boolean; compras: number; importe: number }
type TipoCategoria = "material" | "fabricacion" | "operacion" | "nomina" | "impuestos" | "financiero" | "fuera";

// --- Periodo -----------------------------------------------------------------
type ClavePeriodo = "mes" | "anterior" | "anio" | "pasado" | "12m" | "rango";
const PERIODOS: { valor: ClavePeriodo; texto: string }[] = [
  { valor: "anterior", texto: "Mes pasado" }, { valor: "mes", texto: "Este mes" }, { valor: "anio", texto: "Este año" },
  { valor: "pasado", texto: "Año pasado" }, { valor: "12m", texto: "12 meses" }, { valor: "rango", texto: "Rango" },
];
const iso = (d: Date) => d.toLocaleDateString("en-CA");
function calcular(clave: ClavePeriodo, d?: string | null, h?: string | null) {
  const hoy = hoyISO();
  const [a, m] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
  switch (clave) {
    case "mes": return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "anio": return { desde: `${a}-01-01`, hasta: hoy };
    case "pasado": return { desde: `${a - 1}-01-01`, hasta: `${a - 1}-12-31` };
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
type Grupo = "ventas" | "fabricacion" | "operacion" | "impuestos" | "utilidad" | "perdida";
const COLOR: Record<Grupo, string> = {
  ventas: SERIE(1), fabricacion: SERIE(2), operacion: SERIE(7), impuestos: SERIE(5), utilidad: SERIE(3), perdida: "hsl(var(--peligro))",
};
const LINEA: Record<string, string> = { maquinaria: "Maquinaria", refacciones: "Refacciones", otros: "Otros" };

function armarFlujo(d: Datos): DatosSankey {
  const t = d.totales;
  const nodes: NodoSankey[] = [];
  const grupos: Grupo[] = [];
  const links: DatosSankey["links"] = [];
  const nodo = (name: string, grupo: Grupo, estimado = false) => {
    grupos.push(grupo);
    // La pérdida pinta de rojo lo que tapa.
    return nodes.push({ name, color: COLOR[grupo], marca: estimado ? "≈ " : undefined, colorSalida: grupo === "perdida" ? COLOR.perdida : undefined }) - 1;
  };
  const liga = (source: number, target: number, value: number) => links.push({ source, target, value });

  const ventas = nodo("Ventas", "ventas");
  for (const v of d.ventas) if (v.importe > 0) liga(nodo(LINEA[v.linea] ?? v.linea, "ventas"), ventas, v.importe);
  const estMaterial = d.material.estimado > 0;
  // La nómina de la hoja se reparte taller/oficina con la proporción de hoy: también es estimada.
  const estSueldos = (k: "mano_obra" | "sueldos_oficina") => d[k].estimado > 0 || d[k].hoja > 0;
  const fab = nodo("Costo de fabricación", "fabricacion", estMaterial || estSueldos("mano_obra"));
  const op = nodo("Gastos de operación", "operacion", estSueldos("sueldos_oficina"));
  const imp = nodo("Impuestos e intereses", "impuestos");
  // Las ventas pagan primero la fabricación, luego la operación y luego impuestos e intereses; si
  // no alcanzan, lo que falta entra como pérdida.
  const aFab = Math.min(d.ventas_total, t.costo_fabricacion);
  const aOp = Math.min(d.ventas_total - aFab, t.gastos_operacion);
  const aImp = Math.min(d.ventas_total - aFab - aOp, t.impuestos_financieros);
  liga(ventas, fab, aFab);
  liga(ventas, op, aOp);
  liga(ventas, imp, aImp);
  if (t.utilidad > 0) liga(ventas, nodo("Utilidad", "utilidad", estMaterial || estSueldos("mano_obra") || estSueldos("sueldos_oficina")), t.utilidad);
  if (t.utilidad < 0) {
    const perdida = nodo("Pérdida", "perdida");
    liga(perdida, fab, t.costo_fabricacion - aFab);
    liga(perdida, op, t.gastos_operacion - aOp);
    liga(perdida, imp, t.impuestos_financieros - aImp);
  }
  const hijo = (padre: number, name: string, value: number, estimado = false) => {
    if (value > 0.5) liga(padre, nodo(name, grupos[padre], estimado), value);
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
  for (const x of d.impuestos) hijo(imp, x.categoria, x.importe);
  return armarSankey(nodes, links);
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
  const estimado = d.material.estimado > 0 || d.mano_obra.estimado + d.mano_obra.hoja > 0 || d.sueldos_oficina.estimado + d.sueldos_oficina.hoja > 0;
  // En los indicadores, compacto: con centavos no cabía y se cortaba. La tabla trae el importe completo.
  const ap = (v: number, est: boolean) => `${est ? "≈ " : ""}${dineroCompacto(v)}`;

  const avisos: { texto: string; accion?: React.ReactNode }[] = [];
  if (d.usa_hoja)
    avisos.push({ texto: `Antes del ${fecha(d.arranque)} los números salen de las hojas: ventas y compras como se registraron ahí. Las compras cuentan por la categoría de su proveedor y la nómina pagada se reparte entre taller y oficina con la proporción de hoy (${porcentaje(d.proporcion_taller, 0)} taller).` });
  if (d.sin_categoria > 0)
    avisos.push({ texto: `${dinero(d.sin_categoria)} de compras son de proveedores sin categoría: cuentan como gasto de operación.` });
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
          tono={t.utilidad < 0 ? "peligro" : "ok"} explica={GLOSARIO.utilidadPeriodo}
          detalle={`Margen ${pct(t.utilidad)} · ${t.impuestos_financieros > 0 ? `después de ${dineroCompacto(t.impuestos_financieros)} de impuestos e intereses` : "antes de impuestos"}`} />
      </div>

      <TarjetaGrafica titulo="De dónde viene y a dónde se va el dinero" explica={GLOSARIO.estimadoResultados}
        descripcion="El grueso de cada franja es el dinero. ≈ = estimado. Pasa el mouse por una franja para ver cuánto es."
        tabla={<TablaSankey datos={flujo} total={d.ventas_total} formato={dinero} />}
        pie={`Solo cuenta lo registrado: en el ERP, compras con categoría, caja chica, nómina, comisiones, Mercado Libre y Envíos; antes del arranque, los libros de ventas y compras de las hojas. Lo que se pagó por fuera no está.${t.fuera > 0 ? ` Además salieron ${dinero(t.fuera)} que no son gasto (retiros, préstamos, activos): no se restan.` : ""}`}>
        <div className="px-5"><Leyenda series={[
          { nombre: "Ventas", color: COLOR.ventas }, { nombre: "Costo de fabricación", color: COLOR.fabricacion },
          { nombre: "Gastos de operación", color: COLOR.operacion },
          ...(t.impuestos_financieros > 0 ? [{ nombre: "Impuestos e intereses", color: COLOR.impuestos }] : []),
          t.utilidad < 0 ? { nombre: "Pérdida", color: COLOR.perdida } : { nombre: "Utilidad", color: COLOR.utilidad },
        ]} /></div>
        <DiagramaSankey datos={flujo} total={d.ventas_total} formato={dineroCompacto} formatoLargo={dinero} />
      </TarjetaGrafica>

      <AnioPorAnio />

      <Tarjeta>
        <EncabezadoTarjeta titulo="De dónde sale cada número" descripcion="Exacto: sale tal cual de lo capturado. Estimado: se calcula con una regla, aquí dice cuál." />
        <OrigenNumeros d={d} />
      </Tarjeta>
    </div>
  );
}

// --- Año por año ---------------------------------------------------------------
/** Cada año desde 2018 con la misma cuenta que el diagrama: ventas contra utilidad. */
function AnioPorAnio() {
  const r = useRpc<Anio[]>("resultados_por_anio", { p_desde: 2018 }, { clave: ["resultados_periodo", "por_anio"] });
  const filas = r.data ?? [];
  const datos = filas.map((x) => ({ anio: x.parcial ? `${x.anio}*` : String(x.anio), Ventas: Number(x.ventas), Utilidad: Number(x.utilidad) }));
  const tabla = (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="tabla">
        <thead><tr><th>Año</th><th className="!text-right">Ventas</th><th className="!text-right">Costo de fabricación</th><th className="!text-right">Gastos de operación</th>
          <th className="!text-right">Impuestos e intereses</th><th className="!text-right">Utilidad</th><th className="!text-right">Margen</th><th className="!text-right">No es gasto</th></tr></thead>
        <tbody>
          {filas.map((x) => (
            <tr key={x.anio}>
              <td className="font-medium whitespace-nowrap">{x.anio}{x.parcial && <span className="text-tenue font-normal"> a la fecha</span>}</td>
              <td className="text-right cifra">{dinero(x.ventas)}</td>
              <td className="text-right cifra">{dinero(x.costo_fabricacion)}</td>
              <td className="text-right cifra">{dinero(x.gastos_operacion)}</td>
              <td className="text-right cifra">{dinero(x.impuestos_financieros)}</td>
              <td className={cn("text-right cifra font-medium", x.utilidad < 0 && "text-peligro")}>{dinero(x.utilidad)}</td>
              <td className="text-right cifra">{x.ventas ? porcentaje(x.utilidad / x.ventas, 0) : "—"}</td>
              <td className="text-right cifra text-tenue">{dinero(x.fuera)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <TarjetaGrafica titulo="Año por año" explica={GLOSARIO.anioPorAnio}
      descripcion="Ventas y utilidad de cada año desde 2018, con la misma cuenta del diagrama. * = el año en curso, a la fecha."
      tabla={tabla}>
      {r.error ? <ErrorCarga error={r.error} /> : !r.data ? <Cargando filas={4} /> : (
        <>
          <div className="px-5"><Leyenda series={[{ nombre: "Ventas", color: SERIE(1) }, { nombre: "Utilidad", color: SERIE(3) }]} /></div>
          <div className="h-[280px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} margin={{ top: 12, right: 12, left: 4, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--rejilla)" />
                <XAxis dataKey="anio" {...ejeProps} />
                <YAxis {...ejeProps} width={64} tickFormatter={(v: number) => dineroCompacto(v)} />
                <Tooltip cursor={{ fill: "hsl(var(--fondo))" }} content={<TooltipGrafica formato={(v) => dinero(v)} />} />
                <Bar dataKey="Ventas" fill={SERIE(1)} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Utilidad" fill={SERIE(3)} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </TarjetaGrafica>
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
  const sueldos = (k: "mano_obra" | "sueldos_oficina", quien: string, parte: number) => {
    const x = d[k];
    const partes = [];
    if (x.hoja > 0) partes.push(`${dinero(x.hoja)} de la nómina pagada en la hoja antes del arranque (${porcentaje(parte, 0)} de ${dinero(d.nomina_hoja)}, por la proporción de los sueldos de hoy)`);
    if (x.real > 0) partes.push(`${dinero(x.real)} de semanas de nómina cerradas`);
    if (x.estimado > 0) partes.push(`${dinero(x.estimado)} con el sueldo semanal ÷ 7 por cada día de alta`);
    return { texto: `${quien}: ${partes.join("; ") || "sin sueldos en el periodo"}.`, precision: (x.estimado > 0 || x.hoja > 0 ? "estimado" : "exacto") as Precision };
  };
  // Compras y caja empezaron después que las ventas: un periodo que arranca antes sale incompleto.
  const compras: Precision = d.desde_compras && d.periodo.desde < d.desde_compras ? "parcial" : "exacto";
  const caja: Precision = d.desde_caja && d.periodo.desde < d.desde_caja ? "parcial" : "exacto";
  const mo = sueldos("mano_obra", "La gente del departamento de Producción", d.proporcion_taller);
  const so = sueldos("sueldos_oficina", "Todos los demás departamentos", 1 - d.proporcion_taller);
  const ventasMl = d.ventas_ml ?? 0;
  const ventasErp = d.ventas_total - d.ventas_hoja - ventasMl;
  const mat: Precision = d.material.estimado > 0 ? "estimado" : "exacto";
  const com: Precision = d.comisiones_completas ? "exacto" : "parcial";
  // Un total es tan exacto como su parte menos exacta.
  const peor = (...ps: Precision[]): Precision => ps.includes("estimado") ? "estimado" : ps.includes("parcial") ? "parcial" : "exacto";
  const fab = peor(mat, mo.precision, compras);
  // Las facturas del ERP ligadas a su orden de compra cuentan por partida, no por la categoría que se tecleó.
  const ce = d.compras_erp;
  const porPartida = ce && ce.con_orden > 0
    ? ` De las facturas del ERP, ${dinero(ce.con_orden)} están ligadas a su orden de compra y cuentan por partida (los consumibles del taller aquí, el material en lo vendido${ce.sin_articulo > 0 ? `, y ${dinero(ce.sin_articulo)} de partidas sin artículo con la categoría de la factura` : ""})${ce.sin_orden > 0 ? `; ${dinero(ce.sin_orden)} sin orden, con la categoría de la factura` : ""}.`
    : "";
  const op = peor(so.precision, com, compras, caja);
  const filas: { concepto: string; importe: number; texto: string; precision: Precision; explica?: string; total?: boolean; aparte?: boolean }[] = [
    { concepto: "Ventas", importe: d.ventas_total, precision: "exacto", explica: GLOSARIO.ventasResultados, total: true,
      texto: [d.ventas_hoja > 0 && `${dinero(d.ventas_hoja)} del libro de ventas de la hoja antes del ${fecha(d.arranque)} (sin IVA si tuvo factura; la línea sale de la familia del producto).`,
        ventasMl > 0 && `${dinero(ventasMl)} de ventas de Mercado Libre sin pedido en el ERP: lo que pagó el comprador según Mercado Pago, menos reembolsos y sin IVA (la hoja solo anotaba las facturadas).`,
        ventasErp > 0 && `${dinero(ventasErp)} de las partidas de los pedidos del ERP, sin IVA y sin cancelados; los de dólares, con su tipo de cambio.`].filter(Boolean).join(" ") },
    { concepto: "Material", importe: t.material, precision: mat, explica: GLOSARIO.materialVendido,
      texto: [d.material.comprado_hoja > 0 && `Antes del arranque no hay costeo de lo vendido: ${dinero(d.material.comprado_hoja)} es lo que se compró de material según el libro de la hoja.`,
        ventasErp > 0 && `${porcentaje(d.material.cobertura ?? 0, (d.material.cobertura ?? 0) < 0.01 ? 2 : 0)} de lo vendido en el ERP tiene costeo: ${dinero(d.material.exacto)} con su costo de material de hoy.`
          + (d.material.estimado > 0 ? ` El resto, ${dinero(d.material.estimado)}, con el peso del material en el precio: ${pesos || "50 % (no hay con qué compararlo)"}.` : "")].filter(Boolean).join(" ") || "Sin material en el periodo." },
    { concepto: "Mano de obra del taller", importe: t.mano_obra, precision: mo.precision, explica: GLOSARIO.manoObraTaller, texto: mo.texto },
    { concepto: "Gastos de fabricación", importe: t.gastos_fabricacion, precision: compras, explica: GLOSARIO.gastosFabricacion,
      texto: (d.fabricacion.length ? `Compras de taller: ${top(d.fabricacion)}.` : "Ninguna compra de categoría de taller en el periodo.") + porPartida },
    { concepto: "Costo de fabricación", importe: t.costo_fabricacion, precision: fab,
      texto: "Material + mano de obra del taller + gastos de fabricación.", total: true },
    { concepto: "Sueldos de oficina", importe: t.sueldos_oficina, precision: so.precision, texto: so.texto },
    { concepto: "Comisiones", importe: d.comisiones, precision: com,
      texto: [(d.comisiones_pagadas ?? 0) > 0 && `${dinero(d.comisiones_pagadas ?? 0)} pagadas a los vendedores antes del arranque, cada una en el mes de las ventas que la generaron.`,
        d.comisiones_hoja > 0 && `${dinero(d.comisiones_hoja)} pagadas según el libro de la hoja.`,
        d.comisiones - d.comisiones_hoja - (d.comisiones_pagadas ?? 0) > 0 && "Desde el mes del arranque, lo que da la regla de comisiones de cada vendedor en cada mes que toca el periodo (un mes empezado cuenta completo)."].filter(Boolean).join(" ") || "Sin comisiones en el periodo." },
    { concepto: "Compras de operación", importe: t.compras_operacion, precision: compras,
      texto: (d.operacion.length ? `Sin IVA si tienen factura: ${top(d.operacion)}.` : "Ninguna compra de operación en el periodo.")
        + (d.sin_categoria > 0 ? ` Incluye ${dinero(d.sin_categoria)} de proveedores sin categoría.` : "") },
    { concepto: "Caja chica", importe: d.caja_chica, precision: caja, texto: "Salidas de efectivo de la caja chica." },
    { concepto: "Mercado Libre", importe: d.mercado_libre, precision: "exacto",
      texto: "Comisión, envío y otros cargos de los pagos aprobados. Las retenciones no: son impuestos a cuenta." },
    { concepto: "Envíos", importe: d.envios, precision: "exacto", texto: "Lo que costaron las guías de Envíos, por la fecha en que salió el paquete." },
    { concepto: "Gastos de operación", importe: t.gastos_operacion, precision: op,
      explica: GLOSARIO.gastosOperacion, texto: "Sueldos de oficina + comisiones + compras de operación + caja chica + Mercado Libre + envíos.", total: true },
    { concepto: "Utilidad de operación", importe: t.utilidad_operacion, precision: peor(fab, op),
      texto: "Ventas − costo de fabricación − gastos de operación.", total: true },
    { concepto: "Impuestos e intereses", importe: t.impuestos_financieros, precision: compras, explica: GLOSARIO.impuestosFinancieros,
      texto: d.impuestos.length ? `Del libro de compras: ${top(d.impuestos)}.` : "Ninguno registrado en el periodo." },
    { concepto: t.utilidad < 0 ? "Pérdida" : "Utilidad", importe: t.utilidad, precision: peor(fab, op),
      explica: GLOSARIO.utilidadPeriodo, texto: "Utilidad de operación − impuestos e intereses registrados.", total: true },
    ...(t.fuera > 0 ? [{ concepto: "No es gasto (no se resta)", importe: t.fuera, precision: compras, aparte: true, explica: GLOSARIO.fueraDeResultados,
      texto: `Salió del dinero pero no es gasto: ${top(d.fuera)}.` }] : []),
    ...(d.material_comprado > 0 ? [{ concepto: "Material comprado en el ERP (no se suma)", importe: d.material_comprado, precision: compras, aparte: true, explica: GLOSARIO.tipoCategoriaCompra,
      texto: "Compras de categorías de material desde el arranque. No es gasto: ese material ya está en lo vendido. Sirve para comparar con el material de arriba." }] : []),
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
  { valor: "nomina", texto: "Nómina (sueldos)" },
  { valor: "impuestos", texto: "Impuestos y PTU" },
  { valor: "financiero", texto: "Intereses y financieros" },
  { valor: "fuera", texto: "No es gasto (retiros, activos, préstamos)" },
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
        Nómina e impuestos tienen su lugar, y lo que no es gasto (retiros de socios, préstamos, compra de activos) no se resta.
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

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleCheck, CircleX, FileText, Hourglass, Send, Waypoints, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Filtro, TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Leyenda, SERIE } from "@/components/graficas/comunes";
import { DiagramaSankey, TablaSankey, armarSankey, type DatosSankey, type NodoSankey } from "@/components/graficas/Sankey";
import { TarjetaGrafica } from "@/modulos/analisis/comun";
import { useRpc } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hoyISO, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * ¿Qué pasó con lo cotizado? De lo que cotiza cada vendedor: cuánto se ganó, cuánto se perdió
 * (y por qué) y cuánto sigue abierto (y qué le falta). La clasificación la hace la base
 * (lo_cotizado); aquí se dibuja y se puede bajar a las cotizaciones de cada bloque.
 */

type Grupo = "sin_enviar" | "ganada" | "perdida" | "abierta" | "otra";
interface Total { monto: number; cotizaciones: number }
interface Cotizacion {
  id: string; folio: string; version: number; versiones: number; fecha: string; cliente: string; vendedor: string;
  monto: number; estado: string; grupo: Grupo; subgrupo: string; motivo: string | null; que_paso: string | null; seguimiento: string | null;
}
interface Datos {
  hoy: string;
  vendedores: { id: string | null; nombre: string; cotizaciones: number; monto: number }[];
  totales: Record<"cotizado" | "enviada" | Grupo, Total>;
  tasa_cierre: { monto: number | null; cotizaciones: number | null };
  nodos: { grupo: Grupo; subgrupo: string; monto: number; cotizaciones: number }[];
  cotizaciones: Cotizacion[];
}

const COLOR: Record<"cotizado" | Grupo, string> = {
  cotizado: SERIE(1), ganada: SERIE(3), perdida: SERIE(8), abierta: SERIE(4), sin_enviar: "var(--serie-resto)", otra: "var(--serie-resto)",
};
const NOMBRE: Record<Grupo, string> = {
  ganada: "Ganado", perdida: "Perdido", abierta: "Abierto", sin_enviar: "Sin enviar", otra: "Se cerró con otra cotización",
};
const TONO: Record<Grupo, Tono> = { ganada: "ok", perdida: "peligro", abierta: "aviso", sin_enviar: "neutro", otra: "neutro" };
// Lo abierto, de lo que va mejor a lo que más urge: así se lee de arriba abajo en el diagrama.
const ORDEN_ABIERTA = ["Negociando", "Esperando respuesta", "No contesta", "Vigencia vencida", "Seguimiento atrasado"];

type ClavePeriodo = "mes" | "anterior" | "90" | "anio";
const PERIODOS: { valor: ClavePeriodo; texto: string }[] = [
  { valor: "90", texto: "90 días" }, { valor: "mes", texto: "Este mes" }, { valor: "anterior", texto: "Mes pasado" }, { valor: "anio", texto: "Este año" },
];
const iso = (d: Date) => d.toLocaleDateString("en-CA");
function calcular(clave: ClavePeriodo) {
  const hoy = hoyISO();
  const [a, m, dia] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), Number(hoy.slice(8, 10))];
  switch (clave) {
    case "mes": return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "anterior": return { desde: iso(new Date(a, m - 2, 1)), hasta: iso(new Date(a, m - 1, 0)) };
    case "anio": return { desde: `${a}-01-01`, hasta: hoy };
    default: return { desde: iso(new Date(a, m - 1, dia - 89)), hasta: hoy };
  }
}
type Medida = "monto" | "cotizaciones";
const MEDIDAS: { valor: Medida; texto: string }[] = [{ valor: "monto", texto: "En dinero" }, { valor: "cotizaciones", texto: "En cotizaciones" }];

export default function LoCotizado() {
  const [params, setParams] = useSearchParams();
  const clave = (PERIODOS.some((p) => p.valor === params.get("p")) ? params.get("p") : "90") as ClavePeriodo;
  const medida = (params.get("medida") === "cotizaciones" ? "cotizaciones" : "monto") as Medida;
  const vendedor = params.get("vendedor");
  const { desde, hasta } = calcular(clave);
  const r = useRpc<Datos>("lo_cotizado", { p_desde: desde, p_hasta: hasta, p_vendedor: vendedor },
    { clave: ["lo_cotizado", desde, hasta, vendedor] });
  // Todo vive en la URL: el bloque elegido y el vendedor se comparten con la liga.
  const poner = (cambios: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) { if (v == null) n.delete(k); else n.set(k, v); }
    setParams(n, { replace: true });
  };
  const vendedores = r.data?.vendedores ?? [];
  return (
    <Pagina titulo="Lo cotizado" ancho="max-w-[1500px]" descripcion={`Del ${fecha(desde)} al ${fecha(hasta)} · qué pasó con cada cotización`}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Filtro opciones={PERIODOS} valor={clave} alCambiar={(v) => poner({ p: v === "90" ? null : v, bloque: null })} />
          <Filtro opciones={MEDIDAS} valor={medida} alCambiar={(v) => poner({ medida: v === "monto" ? null : v })} />
          {(vendedores.length > 1 || vendedor) && (
            <select className="campo h-8 text-xs w-auto" aria-label="Vendedor" value={vendedor ?? ""}
              onChange={(e) => poner({ vendedor: e.target.value || null, bloque: null })}>
              <option value="">Todo el equipo</option>
              {vendedores.filter((v) => v.id).map((v) => <option key={v.id} value={v.id!}>{v.nombre} · {numero(v.cotizaciones)}</option>)}
            </select>
          )}
        </div>
      }>
      {r.error ? <ErrorCarga error={r.error} /> : !r.data ? <Cargando filas={8} />
        : <Contenido d={r.data} medida={medida} bloque={params.get("bloque")} elegir={(b) => poner({ bloque: b })} />}
    </Pagina>
  );
}

function Contenido({ d, medida, bloque, elegir }: { d: Datos; medida: Medida; bloque: string | null; elegir: (b: string | null) => void }) {
  const navegar = useNavigate();
  const t = d.totales;
  const cuanto = (x: Total) => (medida === "monto" ? x.monto : x.cotizaciones);
  const total = cuanto(t.cotizado);
  const formato = medida === "monto" ? dineroCompacto : numero;
  const formatoLargo = medida === "monto" ? dinero : (v: number) => `${numero(v)} ${v === 1 ? "cotización" : "cotizaciones"}`;
  const flujo = useMemo(() => armarFlujo(d, medida), [d, medida]);
  const atrasadas = d.nodos.find((n) => n.subgrupo === "Seguimiento atrasado");
  const motivo = d.nodos.filter((n) => n.grupo === "perdida").sort((a, b) => b.monto - a.monto)[0];

  const filas = useMemo(() => {
    if (!bloque) return d.cotizaciones;
    const [g, sub] = bloque.split(":") as [string, string | undefined];
    if (g === "enviada") return d.cotizaciones.filter((c) => c.grupo !== "sin_enviar");
    return d.cotizaciones.filter((c) => c.grupo === g && (!sub || c.subgrupo === sub));
  }, [d, bloque]);
  const nombreBloque = bloque ? (bloque.includes(":") ? bloque.split(":")[1] : bloque === "enviada" ? "Enviado" : NOMBRE[bloque as Grupo]) : null;
  const variosVendedores = new Set(d.cotizaciones.map((c) => c.vendedor)).size > 1;

  const columnas: Columna<Cotizacion>[] = [
    { clave: "folio", titulo: "Folio", valor: (c) => c.folio,
      celda: (c) => <span className="font-medium whitespace-nowrap">{c.folio}{c.versiones > 1 && <span className="text-tenue font-normal"> · v{c.version}</span>}</span> },
    { clave: "cliente", titulo: "Cliente", clase: "max-w-[260px] truncate" },
    { clave: "vendedor", titulo: "Vendedor", oculta: !variosVendedores },
    { clave: "fecha", titulo: "Fecha", valor: (c) => c.fecha, celda: (c) => <span className="whitespace-nowrap">{fecha(c.fecha)}</span>, sinBusqueda: true },
    { clave: "monto", titulo: "Monto sin IVA", alinear: "der", valor: (c) => c.monto, celda: (c) => <span className="cifra">{dinero(c.monto)}</span>, sinBusqueda: true },
    { clave: "subgrupo", titulo: "Cómo va", explica: GLOSARIO.abiertoCotizado,
      celda: (c) => <Insignia tono={TONO[c.grupo]}>{c.grupo === "perdida" ? `Perdida: ${c.subgrupo}` : c.subgrupo}</Insignia> },
    { clave: "que_paso", titulo: "Qué pasó", valor: (c) => c.que_paso ?? c.motivo ?? "",
      celda: (c) => <span className="text-xs text-tenue line-clamp-2 max-w-[320px]">{c.que_paso ?? c.motivo ?? "—"}</span> },
    { clave: "seguimiento", titulo: "Seguimiento", valor: (c) => c.seguimiento ?? "", sinBusqueda: true, explica: GLOSARIO.seguimientoCotizacion,
      celda: (c) => c.seguimiento
        ? <span className={cn("whitespace-nowrap", c.grupo === "abierta" && c.seguimiento < d.hoy && "text-peligro font-medium")}>{fecha(c.seguimiento)}</span>
        : <span className="text-tenue">—</span> },
  ];

  if (!t.cotizado.cotizaciones) {
    return <Tarjeta><Vacio icono={FileText} titulo="No hay cotizaciones en este periodo" texto="Elige un periodo más largo arriba. Aquí cuenta cada cotización por la fecha de su primera versión." /></Tarjeta>;
  }
  const leyenda = (["ganada", "perdida", "abierta", "sin_enviar"] as Grupo[]).filter((g) => cuanto(t[g]) > 0)
    .map((g) => ({ nombre: NOMBRE[g], color: COLOR[g] }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Cotizado" valor={dineroCompacto(t.cotizado.monto)} icono={Send} explica={GLOSARIO.loCotizado} alClic={() => elegir(null)}
          detalle={`${numero(t.cotizado.cotizaciones)} cotizaciones · ${numero(t.sin_enviar.cotizaciones)} sin enviar`} />
        <Kpi titulo="Ganado" valor={dineroCompacto(t.ganada.monto)} icono={CircleCheck} tono="ok" explica={GLOSARIO.tasaCierreCotizado}
          alClic={() => elegir("ganada")}
          detalle={d.tasa_cierre.monto != null ? `${porcentaje(d.tasa_cierre.monto, 0)} de lo ya decidido · ${numero(t.ganada.cotizaciones)} cotizaciones` : "Todavía no se decide ninguna"} />
        <Kpi titulo="Perdido" valor={dineroCompacto(t.perdida.monto)} icono={CircleX} tono="peligro" explica={GLOSARIO.perdidoCotizado}
          alClic={() => elegir("perdida")}
          detalle={motivo ? `Más por «${motivo.subgrupo}»: ${dineroCompacto(motivo.monto)}` : "Ninguna perdida"} />
        <Kpi titulo="Abierto" valor={dineroCompacto(t.abierta.monto)} icono={Hourglass} tono="aviso" explica={GLOSARIO.abiertoCotizado}
          alClic={() => elegir(atrasadas ? "abierta:Seguimiento atrasado" : "abierta")}
          detalle={atrasadas ? `${numero(atrasadas.cotizaciones)} con el seguimiento atrasado (${dineroCompacto(atrasadas.monto)})` : `${numero(t.abierta.cotizaciones)} cotizaciones, seguimiento al día`} />
      </div>

      <TarjetaGrafica titulo="¿Qué pasó con lo cotizado?" explica={GLOSARIO.loCotizado}
        descripcion={`El grueso de cada franja es ${medida === "monto" ? "el dinero, sin IVA" : "el número de cotizaciones"}. Toca un bloque para ver sus cotizaciones abajo.`}
        tabla={<TablaSankey datos={flujo} total={total} formato={formatoLargo} encabezado={medida === "monto" ? "Monto" : "Cotizaciones"} />}>
        <div className="px-5"><Leyenda series={leyenda} /></div>
        <DiagramaSankey datos={flujo} total={total} formato={formato} formatoLargo={formatoLargo} margen={{ izq: 150, der: 300 }}
          alClicNodo={(n) => elegir(n.clave === "cotizado" ? null : n.clave ?? null)} />
      </TarjetaGrafica>

      <Tarjeta>
        <EncabezadoTarjeta titulo={nombreBloque ? `Cotizaciones: ${nombreBloque}` : "Las cotizaciones"}
          descripcion="Cada una con su última versión. Clic en un renglón para abrirla."
          acciones={nombreBloque && (
            <button type="button" onClick={() => elegir(null)} className="inline-flex items-center gap-1 text-xs text-tenue hover:text-texto">
              <X className="h-3.5 w-3.5" />Ver todas
            </button>
          )} />
        <TablaDatos filas={filas} columnas={columnas} claveFila={(c) => c.id} exportarComo="lo-cotizado" compacta
          placeholder="Buscar folio, cliente o lo que pasó…" alClicFila={(c) => navegar(`/ventas/cotizaciones/${c.id}`)}
          filtros={<Filtro opciones={[{ valor: "", texto: "Todas" }, ...(["ganada", "perdida", "abierta", "sin_enviar"] as Grupo[])
              .filter((g) => t[g].cotizaciones > 0).map((g) => ({ valor: g, texto: NOMBRE[g], cuenta: t[g].cotizaciones }))]}
            valor={bloque?.split(":")[0] === "enviada" ? "" : bloque?.split(":")[0] ?? ""} alCambiar={(v) => elegir(v || null)} />}
          vacio={{ icono: Waypoints, titulo: "Ninguna cotización en este bloque", texto: "Toca otro bloque del diagrama o «Ver todas»." }} />
      </Tarjeta>
    </div>
  );
}

function armarFlujo(d: Datos, medida: Medida): DatosSankey {
  const valor = (x: { monto: number; cotizaciones: number }) => (medida === "monto" ? x.monto : x.cotizaciones);
  const nodes: NodoSankey[] = [];
  const links: DatosSankey["links"] = [];
  const nodo = (name: string, color: string, clave: string) => nodes.push({ name, color, clave }) - 1;
  const t = d.totales;
  const cotizado = nodo("Cotizado", COLOR.cotizado, "cotizado");
  const enviada = nodo("Enviado", COLOR.cotizado, "enviada");
  links.push({ source: cotizado, target: enviada, value: valor(t.enviada) });
  const padres: Partial<Record<Grupo, number>> = {};
  for (const g of ["ganada", "perdida", "abierta", "otra", "sin_enviar"] as Grupo[]) {
    padres[g] = nodo(NOMBRE[g], COLOR[g], g);
    links.push({ source: g === "sin_enviar" ? cotizado : enviada, target: padres[g]!, value: valor(t[g]) });
  }
  // Lo ganado no se abre más (todo es «se volvió pedido»); lo demás, por motivo o por lo que le falta.
  // En el mismo orden que sus padres, para que las franjas no se crucen.
  const orden: Grupo[] = ["perdida", "abierta", "sin_enviar"];
  const hijos = d.nodos.filter((n) => orden.includes(n.grupo))
    .sort((a, b) => orden.indexOf(a.grupo) - orden.indexOf(b.grupo)
      || (a.grupo === "abierta" ? ORDEN_ABIERTA.indexOf(a.subgrupo) - ORDEN_ABIERTA.indexOf(b.subgrupo) : b.monto - a.monto));
  for (const n of hijos) {
    links.push({ source: padres[n.grupo]!, target: nodo(n.subgrupo, COLOR[n.grupo], `${n.grupo}:${n.subgrupo}`), value: valor(n) });
  }
  return armarSankey(nodes, links);
}

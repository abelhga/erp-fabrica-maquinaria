// Salud del inventario (foto de hoy): en qué está el dinero o los artículos, qué artículos merecen
// control fino (ABC-XYZ) y cuánto alcanza lo disponible contra la meta. Lo calcula la base
// (almacen_salud); un clic en cualquier pedazo trae sus artículos (almacen_salud_lista).
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, ArrowDownToLine, CircleCheck, Layers, PackageX, Snail, X } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { SERIE, TooltipGrafica, ejeProps } from "@/components/graficas/comunes";
import { useRpc } from "@/lib/consultas";
import { dinero, dineroCompacto, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

type Clase = "negativo" | "quiebre" | "bajo_reorden" | "sano" | "exceso" | "esporadico" | "sin_movimiento";
interface Salud {
  con_costos: boolean; abc_por: "valor" | "rotacion";
  totales: { articulos: number; con_existencia: number; con_demanda: number; con_consumo: number; valor_stock: number | null };
  salud: { clase: Clase; articulos: number; valor: number | null }[];
  matriz: { abc: "A" | "B" | "C"; xyz: "X" | "Y" | "Z"; articulos: number; valor_12: number | null; disponible_valor: number | null }[];
  cobertura: { rango: Rango; importado: boolean; articulos: number }[];
  meses: { mes: string; articulos: number; valor: number | null }[];
}
type Rango = "sin" | "menos_mitad" | "debajo" | "meta" | "arriba" | "muy_arriba";
interface FilaLista {
  articulo_id: string; clave: string; nombre: string; unidad: string; categoria: string; es_importado: boolean; en_planta: number; disponible: number;
  demanda_mensual: number; punto_reorden: number; meta_meses: number; cobertura_meses: number | null; consumo_12: number; meses_12: number;
  cv: number | null; valor_12: number | null; valor_stock: number | null; salud: Clase | null; abc: string | null; xyz: string | null;
}

// Lo que falta en tonos de estado; lo que sobra en la rampa secuencial (más oscuro = más dinero dormido).
const CLASES: { clase: Clase; nombre: string; color: string; icono: typeof AlertOctagon; explica: string }[] = [
  { clase: "negativo", nombre: "Negativo", color: "hsl(var(--peligro))", icono: AlertOctagon, explica: GLOSARIO.saludNegativo },
  { clase: "quiebre", nombre: "Quiebre", color: "hsl(var(--peligro))", icono: PackageX, explica: GLOSARIO.saludQuiebre },
  { clase: "bajo_reorden", nombre: "Bajo el punto de reorden", color: "hsl(var(--aviso))", icono: ArrowDownToLine, explica: GLOSARIO.saludBajoReorden },
  { clase: "sano", nombre: "Sano", color: "hsl(var(--ok))", icono: CircleCheck, explica: GLOSARIO.saludSano },
  { clase: "exceso", nombre: "Exceso", color: "var(--seq-3)", icono: Layers, explica: GLOSARIO.saludExceso },
  { clase: "esporadico", nombre: "Esporádico", color: "var(--seq-5)", icono: Snail, explica: GLOSARIO.saludEsporadico },
  { clase: "sin_movimiento", nombre: "Sin movimiento en 12 meses", color: "var(--seq-7)", icono: PackageX, explica: GLOSARIO.saludSinMovimiento },
];
const XYZ = { X: "Estable", Y: "Variable", Z: "Errático" } as const;
const POLITICA: Record<string, string> = {
  AX: "Lo más valioso y predecible: punto de reorden fino, revisar seguido, poco colchón.",
  AY: "Valioso con altibajos: punto de reorden con colchón y revisar cada mes.",
  AZ: "Valioso y errático: no conviene tenerlo por si acaso; comprarlo contra pedido u orden de producción.",
  BX: "Reorden automático con revisión mensual.",
  BY: "Reorden automático con un poco más de colchón.",
  BZ: "Contra pedido cuando se pueda; si se tiene, poco y vigilado.",
  CX: "Barato y predecible: comprar por lote grande y olvidarse.",
  CY: "Lote grande, revisión de vez en cuando.",
  CZ: "Candidato a no tenerlo en almacén: pedir solo cuando haga falta.",
};
// Divergente: debajo de la meta en naranja (más fuerte entre más lejos), en la meta neutro, arriba en azul.
const RANGOS: { rango: Rango; nombre: string; color: string }[] = [
  { rango: "sin", nombre: "Nada disponible", color: "color-mix(in oklab, var(--serie-2) 100%, hsl(var(--superficie)))" },
  { rango: "menos_mitad", nombre: "Menos de la mitad", color: "color-mix(in oklab, var(--serie-2) 65%, hsl(var(--superficie)))" },
  { rango: "debajo", nombre: "Debajo de la meta", color: "color-mix(in oklab, var(--serie-2) 35%, hsl(var(--superficie)))" },
  { rango: "meta", nombre: "En la meta (1 a 2×)", color: "var(--serie-resto)" },
  { rango: "arriba", nombre: "2 a 4× la meta", color: "color-mix(in oklab, var(--serie-1) 45%, hsl(var(--superficie)))" },
  { rango: "muy_arriba", nombre: "Más de 4× la meta", color: "color-mix(in oklab, var(--serie-1) 100%, hsl(var(--superficie)))" },
];
const mesCorto = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { month: "short", year: "2-digit" }).replace(".", "");

type Seleccion = { grupo: "salud" | "matriz"; valor: string; titulo: string } | null;

export function SaludInventario() {
  const s = useRpc<Salud>("almacen_salud", {}, { clave: ["almacen_salud"] });
  const [sel, setSel] = useState<Seleccion>(null);
  if (s.error) return <ErrorCarga error={s.error} />;
  if (s.isLoading || !s.data) return <Cargando filas={6} />;
  const d = s.data;
  return (
    <div className="space-y-4">
      <MapaSalud d={d} alElegir={setSel} sel={sel} />
      <div className="grid gap-4 xl:grid-cols-5">
        <Tarjeta className="xl:col-span-3">
          <EncabezadoTarjeta titulo="Matriz ABC-XYZ" explica={GLOSARIO.matrizAbcXyz}
            descripcion={d.abc_por === "valor"
              ? "Filas: cuánto valor se consumió en 12 meses (A = el 80 %). Columnas: qué tan parejo sale mes con mes. Clic en una celda para ver sus artículos."
              : "Filas: qué tan seguido sale (A = 6 meses o más de 12). Columnas: qué tan parejo sale mes con mes. Clic en una celda para ver sus artículos."} />
          <MatrizAbcXyz d={d} alElegir={setSel} sel={sel} />
        </Tarjeta>
        <Tarjeta className="xl:col-span-2">
          <EncabezadoTarjeta titulo="Cobertura contra la meta" explica={GLOSARIO.coberturaContraMeta}
            descripcion={`Lo disponible ÷ lo que sale al mes, contra la meta de cada artículo (1 mes nacional, 6 importado). ${numero(d.totales.con_demanda)} artículos con demanda.`} />
          <Cobertura d={d} />
        </Tarjeta>
      </div>
      {sel && <ListaSeleccion sel={sel} conCostos={d.con_costos} alCerrar={() => setSel(null)} />}
      <Tarjeta>
        <EncabezadoTarjeta titulo={d.con_costos ? "Valor que salió por mes" : "Artículos con salida por mes"} explica={GLOSARIO.consumoMensualAlmacen}
          descripcion="Los últimos 12 meses cerrados, de la hoja y del ERP. La línea punteada es el promedio." />
        <ConsumoMeses d={d} />
      </Tarjeta>
    </div>
  );
}

function MapaSalud({ d, alElegir, sel }: { d: Salud; alElegir: (s: Seleccion) => void; sel: Seleccion }) {
  const [por, setPor] = useState<"valor" | "articulos">(d.con_costos ? "valor" : "articulos");
  const filas = CLASES.map((c) => ({ ...c, ...(d.salud.find((x) => x.clase === c.clase) ?? { articulos: 0, valor: 0 }) }))
    .filter((c) => c.articulos > 0);
  const med = (c: { articulos: number; valor: number | null }) => (por === "valor" ? c.valor ?? 0 : c.articulos);
  const total = filas.reduce((a, c) => a + med(c), 0) || 1;
  const dormido = filas.filter((c) => ["exceso", "esporadico", "sin_movimiento"].includes(c.clase));
  const falta = filas.filter((c) => ["quiebre", "bajo_reorden", "negativo"].includes(c.clase));
  const pctDormido = dormido.reduce((a, c) => a + med(c), 0) / total;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Salud del inventario hoy" explica={GLOSARIO.saludInventario}
        descripcion={`${numero(d.totales.con_existencia)} artículos con existencia${d.totales.valor_stock != null ? ` · ${dineroCompacto(d.totales.valor_stock)}` : ""} · según cuánto alcanza contra lo que sale`}
        acciones={d.con_costos ? (
          <div className="flex rounded-lg border border-borde p-0.5 text-xs" data-explain={GLOSARIO.saludPorValorArticulos} data-explain-title="Por valor o por artículos">
            {(["valor", "articulos"] as const).map((x) => (
              <button key={x} type="button" onClick={() => setPor(x)} className={cn("rounded-md px-2.5 py-1", por === x ? "bg-marca-suave text-marca-texto" : "text-tenue")}>
                {x === "valor" ? "Por valor" : "Por artículos"}</button>
            ))}
          </div>) : undefined} />
      <div className="px-5 pb-5 space-y-4">
        <p className="text-sm">
          <b className="cifra">{porcentaje(pctDormido, 0)}</b> {por === "valor" ? "del valor en existencia" : "de los artículos con existencia"} no tiene demanda regular
          {por === "valor" && d.con_costos && <> (<b className="cifra">{dineroCompacto(dormido.reduce((a, c) => a + (c.valor ?? 0), 0))}</b>)</>}.
          {" "}{falta.length > 0 && <>Del otro lado, <b className="cifra">{numero(falta.reduce((a, c) => a + c.articulos, 0))}</b> artículos con demanda están en quiebre o debajo del punto de reorden.</>}
        </p>
        {/* Barra segmentada al 100 %: cada pedazo es una clase; clic para ver sus artículos. */}
        <div className="flex h-9 w-full overflow-hidden rounded-md" role="img" aria-label="Reparto del inventario por salud">
          {filas.map((c) => {
            const pct = med(c) / total;
            if (pct <= 0) return null;
            return (
              <button key={c.clase} type="button" title={`${c.nombre}: ${porcentaje(pct, 1)}`} data-explain={c.explica} data-explain-title={c.nombre}
                onClick={() => alElegir({ grupo: "salud", valor: c.clase, titulo: c.nombre })}
                className={cn("h-full border-r-2 border-superficie last:border-r-0 transition-opacity hover:opacity-80",
                  sel && !(sel.grupo === "salud" && sel.valor === c.clase) && "opacity-40")}
                style={{ width: `${pct * 100}%`, background: c.color, minWidth: 3 }} />
            );
          })}
        </div>
        <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {filas.map((c) => {
            const Icono = c.icono;
            return (
              <li key={c.clase}>
                <button type="button" onClick={() => alElegir({ grupo: "salud", valor: c.clase, titulo: c.nombre })} data-explain={c.explica} data-explain-title={c.nombre}
                  className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left hover:bg-fondo">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: c.color }} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1"><Icono className="h-3.5 w-3.5 text-tenue" />{c.nombre}</span>
                    <span className="block text-xs text-tenue cifra">
                      {numero(c.articulos)} art. · {porcentaje(med(c) / total, 0)}{d.con_costos && c.valor != null ? ` · ${dineroCompacto(c.valor)}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Tarjeta>
  );
}

function MatrizAbcXyz({ d, alElegir, sel }: { d: Salud; alElegir: (s: Seleccion) => void; sel: Seleccion }) {
  const celda = (a: string, x: string) => d.matriz.find((m) => m.abc === a && m.xyz === x);
  const medida = (m?: Salud["matriz"][number]) => (d.con_costos ? m?.valor_12 ?? 0 : m?.articulos ?? 0);
  const total = d.matriz.reduce((s, m) => s + medida(m), 0) || 1;
  const max = Math.max(...d.matriz.map(medida), 1);
  const [foco, setFoco] = useState<string | null>(null);
  const actual = foco ?? (sel?.grupo === "matriz" ? sel.valor : null);
  return (
    <div className="px-5 pb-5 space-y-3">
      <table className="w-full border-separate border-spacing-1 text-sm">
        <thead>
          <tr><th />{(["X", "Y", "Z"] as const).map((x) => <th key={x} className="text-xs font-medium text-tenue">{x} · {XYZ[x]}</th>)}</tr>
        </thead>
        <tbody>
          {(["A", "B", "C"] as const).map((a) => (
            <tr key={a}>
              <th className="w-8 text-left text-xs font-medium text-tenue">{a}</th>
              {(["X", "Y", "Z"] as const).map((x) => {
                const m = celda(a, x);
                const k = medida(m) / max;
                // Secuencial de un tono: más intenso = más peso. La tinta cambia con el fondo para que se lea.
                const paso = m ? Math.max(1, Math.ceil(k * 7)) : 0;
                return (
                  <td key={x} className="p-0">
                    <button type="button" disabled={!m} onMouseEnter={() => setFoco(a + x)} onMouseLeave={() => setFoco(null)}
                      onFocus={() => setFoco(a + x)} onBlur={() => setFoco(null)}
                      onClick={() => alElegir({ grupo: "matriz", valor: a + x, titulo: `${a}${x}: ${a === "A" ? "valiosos" : a === "B" ? "intermedios" : "menores"} y ${XYZ[x].toLowerCase()}s` })}
                      className={cn("flex h-20 w-full flex-col items-center justify-center rounded-md transition-shadow",
                        m ? "cursor-pointer hover:ring-2 hover:ring-marca" : "bg-fondo text-tenue", actual === a + x && "ring-2 ring-marca")}
                      style={m ? { background: `var(--seq-${paso})`, color: `var(--seq-tinta-${paso})` } : undefined}>
                      <span className="text-lg font-semibold cifra">{m ? numero(m.articulos) : "—"}</span>
                      {m && <span className="text-xs cifra opacity-90">{porcentaje(medida(m) / total, 0)} {d.con_costos ? "del valor" : "de los art."}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="min-h-[2.5rem] rounded-lg bg-fondo px-3 py-2 text-sm">
        {actual ? <><b>{actual}:</b> {POLITICA[actual]}</> : <span className="text-tenue">Pasa el mouse por una celda para ver qué conviene hacer con esos artículos.</span>}
      </p>
    </div>
  );
}

function Cobertura({ d }: { d: Salud }) {
  const grupos = [{ importado: false, titulo: "Nacional · meta 1 mes" }, { importado: true, titulo: "Importado · meta 6 meses" }];
  return (
    <div className="px-5 pb-5 space-y-4">
      {grupos.map((g) => {
        const datos = RANGOS.map((r) => ({ ...r, articulos: d.cobertura.find((c) => c.importado === g.importado && c.rango === r.rango)?.articulos ?? 0 }));
        const total = datos.reduce((a, x) => a + x.articulos, 0);
        return (
          <div key={g.titulo}>
            <p className="text-xs font-medium text-tenue mb-1">{g.titulo} · {numero(total)} artículos</p>
            <div style={{ height: datos.length * 22 + 8 }}>
              <ResponsiveContainer>
                <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={3}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" {...ejeProps} width={150} fontSize={11} />
                  <Tooltip cursor={{ fill: "var(--rejilla)", opacity: 0.4 }} content={<TooltipGrafica formato={(v) => `${numero(v)} artículos`} />} />
                  <Bar dataKey="articulos" name="Artículos" radius={[0, 4, 4, 0]} isAnimationActive={false}
                    label={{ position: "right", fontSize: 11, fill: "var(--eje)", formatter: (v: number) => (v ? numero(v) : "") }}>
                    {datos.map((x) => <Cell key={x.rango} fill={x.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConsumoMeses({ d }: { d: Salud }) {
  const datos = d.meses.map((m) => ({ mes: mesCorto(m.mes), valor: d.con_costos ? m.valor ?? 0 : m.articulos }));
  const prom = datos.reduce((a, x) => a + x.valor, 0) / (datos.length || 1);
  const fmt = (v: number) => (d.con_costos ? dinero(v) : `${numero(v)} artículos`);
  return (
    <div className="h-56 px-2 pb-3">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rejilla)" />
          <XAxis dataKey="mes" {...ejeProps} />
          <YAxis {...ejeProps} width={d.con_costos ? 56 : 40} tickFormatter={(v) => (d.con_costos ? dineroCompacto(v) : numero(v))} />
          <Tooltip content={<TooltipGrafica formato={fmt} />} />
          <ReferenceLine y={prom} stroke="var(--eje)" strokeDasharray="4 4" label={{ value: "promedio", position: "insideTopRight", fontSize: 11, fill: "var(--eje)" }} />
          <Line dataKey="valor" name={d.con_costos ? "Valor que salió" : "Artículos con salida"} stroke={SERIE(1)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
            type="linear" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ListaSeleccion({ sel, conCostos, alCerrar }: { sel: NonNullable<Seleccion>; conCostos: boolean; alCerrar: () => void }) {
  const l = useRpc<FilaLista[]>("almacen_salud_lista", { p_grupo: sel.grupo, p_valor: sel.valor }, { clave: ["almacen_salud_lista", sel.grupo, sel.valor] });
  const cols: Columna<FilaLista>[] = [
    { clave: "nombre", titulo: "Artículo", clase: "min-w-[220px]", valor: (x) => `${x.nombre} ${x.clave} ${x.categoria}`,
      celda: (x) => <div><p>{x.nombre}</p><p className="text-xs text-tenue">{x.clave} · {x.categoria}{x.es_importado ? " · importado" : ""}</p></div> },
    { clave: "disponible", titulo: "Disponible", alinear: "der", sinBusqueda: true, valor: (x) => x.disponible, explica: GLOSARIO.disponibleReabasto,
      celda: (x) => <span className="cifra whitespace-nowrap">{numero(x.disponible)} <span className="text-xs text-tenue">{x.unidad}</span></span> },
    { clave: "demanda_mensual", titulo: "Sale al mes", alinear: "der", sinBusqueda: true, valor: (x) => x.demanda_mensual, explica: GLOSARIO.demandaMensual,
      celda: (x) => x.demanda_mensual > 0 ? <span className="cifra">{numero(x.demanda_mensual)}</span> : <span className="text-tenue">—</span> },
    { clave: "cobertura_meses", titulo: "Alcanza", alinear: "der", sinBusqueda: true, valor: (x) => x.cobertura_meses ?? -1, explica: GLOSARIO.alcanzaMesesSalud,
      celda: (x) => x.cobertura_meses == null ? <span className="text-tenue">—</span> : <span className="cifra">{numero(x.cobertura_meses)} meses</span> },
    { clave: "meses_12", titulo: "Meses con salida", alinear: "der", sinBusqueda: true, valor: (x) => x.meses_12, celda: (x) => <span className="cifra">{x.meses_12} de 12</span> },
    { clave: "cv", titulo: "Variación", alinear: "der", sinBusqueda: true, valor: (x) => x.cv ?? -1, explica: GLOSARIO.matrizAbcXyz,
      celda: (x) => x.cv == null ? <span className="text-tenue">—</span> : <span className="cifra">{numero(x.cv)}{x.abc && x.xyz ? <span className="text-xs text-tenue"> · {x.abc}{x.xyz}</span> : null}</span> },
    ...(conCostos ? [
      { clave: "valor_stock", titulo: "Valor en existencia", alinear: "der" as const, sinBusqueda: true, valor: (x: FilaLista) => x.valor_stock ?? 0,
        celda: (x: FilaLista) => <span className="cifra">{x.valor_stock ? dinero(x.valor_stock) : "—"}</span> },
      { clave: "valor_12", titulo: "Salió en 12 meses", alinear: "der" as const, sinBusqueda: true, valor: (x: FilaLista) => x.valor_12 ?? 0,
        celda: (x: FilaLista) => <span className="cifra">{x.valor_12 ? dinero(x.valor_12) : "—"}</span> },
    ] : []),
  ];
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo={sel.titulo} descripcion="Hasta 300 artículos, los de más valor en existencia primero"
        acciones={<Boton tamano="sm" variante="fantasma" onClick={alCerrar}><X className="h-4 w-4" />Cerrar</Boton>} />
      <div className="px-3 pb-3">
        {l.error ? <ErrorCarga error={l.error} /> : l.isLoading || !l.data ? <Cargando filas={5} /> : (
          <TablaDatos filas={l.data} columnas={cols} claveFila={(x) => x.articulo_id} exportarComo={`inventario-${sel.valor}`} compacta placeholder="Buscar artículo…" />
        )}
      </div>
    </Tarjeta>
  );
}

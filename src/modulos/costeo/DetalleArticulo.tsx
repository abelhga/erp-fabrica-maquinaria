import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, PackageSearch } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { PlanosArticulo } from "@/components/planos/PlanosArticulo";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, hace, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { NOMBRE_TIPO, esCostoViejo, esFabricado, pct, useArticulo, useParametros, type ArticuloCatalogo } from "./componentes/comun";
import { ListaMateriales } from "./componentes/ListaMateriales";
import { HorasEtapa, Parametros } from "./componentes/ParametrosHoras";
import { CostoPrecio, useDesglose } from "./componentes/CostoPrecio";
import { Historial } from "./componentes/Historial";
import { DondeSeUsa } from "./componentes/DondeSeUsa";
import { DialogoDuplicar } from "./componentes/Duplicar";
import { FichaComponente } from "./componentes/FichaComponente";
import { EmpaqueArticulo } from "@/modulos/almacen/envios/EmpaqueArticulo";

function Cifra({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: "ok" | "aviso" | "peligro" }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-tenue">{etiqueta}</p>
      <p className={cn("text-xl font-semibold cifra leading-tight mt-0.5 truncate", tono === "aviso" && "text-aviso", tono === "peligro" && "text-peligro", tono === "ok" && "text-ok")}>{valor}</p>
      {detalle && <p className="text-xs text-tenue mt-0.5">{detalle}</p>}
    </div>
  );
}

/** La copia recién hecha contra su original: lo primero que se quiere saber después de duplicar. */
function ComparacionCopia({ origen, copia }: { origen: string; copia: ArticuloCatalogo }) {
  const { puede } = useSesion();
  const o = useArticulo(origen).data;
  if (!o) return null;
  const dif = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || !b ? null : a / b - 1);
  const dc = dif(copia.costo_total, o.costo_total), dp = dif(copia.precio, o.precio);
  const flecha = (d: number | null) => (d == null ? "" : d > 0 ? "▲" : d < 0 ? "▼" : "=");
  return (
    <div className="rounded-xl border border-marca/30 bg-marca-suave px-4 py-3 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
      <span>Copia de <Link to={`/costeo/equipos/${o.id}`} className="font-medium hover:underline cifra">{o.clave}</Link> {o.nombre}</span>
      {puede("costos") && <span>Costo <b className="cifra">{dinero(o.costo_total)}</b> <ArrowRight className="inline h-3.5 w-3.5" /> <b className="cifra">{dinero(copia.costo_total)}</b>
        {dc != null && <span className="ml-1 text-tenue cifra">{flecha(dc)} {dinero(Math.abs((copia.costo_total ?? 0) - (o.costo_total ?? 0)))} ({porcentaje(Math.abs(dc))})</span>}</span>}
      <span>Precio de lista <b className="cifra">{dinero(o.precio)}</b> <ArrowRight className="inline h-3.5 w-3.5" /> <b className="cifra">{dinero(copia.precio)}</b>
        {dp != null && <span className="ml-1 text-tenue cifra">{flecha(dp)} {dinero(Math.abs((copia.precio ?? 0) - (o.precio ?? 0)))} ({porcentaje(Math.abs(dp))})</span>}</span>
    </div>
  );
}

function Encabezado({ a }: { a: ArticuloCatalogo }) {
  const { puede } = useSesion();
  const costos = puede("costos");
  const d = useDesglose(a.id);
  const fab = esFabricado(a.tipo);
  const x = d.data;
  const neto = x?.pct_neto ?? null;
  return (
    <Tarjeta className="p-5 grid gap-5 md:grid-cols-[minmax(220px,auto)_1fr] items-center">
      <div className="flex items-center gap-4">
        {a.imagen_url && <img src={a.imagen_url} alt="" className="hidden sm:block h-16 w-16 rounded-lg object-cover border border-borde bg-fondo shrink-0"
          onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        <div>
          <p className="text-xs text-tenue">Precio de lista sin IVA</p>
          <p className="text-3xl sm:text-4xl font-semibold cifra tracking-tight leading-tight">{a.precio == null ? <span className="text-tenue text-2xl">sin precio</span> : dinero(a.precio)}</p>
          <p className="text-xs text-tenue mt-0.5">{a.precio != null ? <>Con IVA {dinero(a.precio * 1.16)} · calculado {hace(a.precio_calculado_en)}</> : "Sale solo en cuanto tenga costo."}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:border-l md:pl-6 border-borde">
        {costos ? (
          <>
            <Cifra etiqueta="Costo" valor={dinero(a.costo_total)}
              detalle={fab ? <>material {dinero(a.costo_material)} · mano de obra {dinero(a.costo_mano_obra)}</>
                : a.moneda_costo && a.moneda_costo !== "MXN" ? `${a.moneda_costo} ${numero(a.costo_capturado)}` : a.costo_actualizado_en ? `al ${fecha(a.costo_actualizado_en)}` : undefined} />
            <Cifra etiqueta="Utilidad neta" valor={neto == null ? "—" : pct(neto)}
              tono={neto == null ? undefined : x && neto < x.utilidad - 0.005 ? "aviso" : undefined}
              detalle={x ? <>política {x.politica.nombre}: {pct(x.utilidad)}{x.politica.compensar_isr ? " después de ISR" : ""}</> : undefined} />
            <Cifra etiqueta="Precio ÷ costo" valor={x?.factor ? `${(Math.round(x.factor * 100) / 100).toLocaleString("es-MX")}×` : "—"} detalle="antes del redondeo" />
            {fab ? <Cifra etiqueta="Horas hombre" valor={numero(a.horas)} detalle="con las de sus subensambles" />
              : <Cifra etiqueta="Existencia en planta" valor={`${numero(a.existencia ?? 0)}`} detalle={a.unidad} />}
          </>
        ) : (
          <>
            {fab ? <Cifra etiqueta="Líneas de material" valor={numero(a.lineas_bom)} /> : <Cifra etiqueta="Existencia en planta" valor={numero(a.existencia ?? 0)} detalle={a.unidad} />}
            {!fab && <Cifra etiqueta="Tiempo de entrega" valor={a.tiempo_entrega_dias != null ? `${a.tiempo_entrega_dias} días` : "—"} />}
            {a.usado_en > 0 && <Cifra etiqueta="Se usa en" valor={numero(a.usado_en)} detalle={a.usado_en === 1 ? "lista de materiales" : "listas de materiales"} />}
          </>
        )}
      </div>
    </Tarjeta>
  );
}

export default function DetalleArticulo() {
  const { id } = useParams();
  const { puede } = useSesion();
  const { state } = useLocation() as { state: { origen?: string } | null };
  const [params, setParams] = useSearchParams();
  const [duplicando, setDuplicando] = useState(false);
  const art = useArticulo(id);
  const pars = useParametros(id);
  const a = art.data;

  if (art.isLoading) return <Pagina titulo=""><Cargando filas={8} /></Pagina>;
  if (art.error) return <Pagina titulo="Artículo"><ErrorCarga error={art.error} /></Pagina>;
  if (!a) {
    return (
      <Pagina titulo="Artículo no encontrado">
        <div className="tarjeta"><Vacio icono={PackageSearch} titulo="No existe o ya no está activo"
          texto="Búscalo por clave o nombre con Ctrl K." accion={<Link to="/costeo/equipos" className="text-marca-texto">Ir a equipos</Link>} /></div>
      </Pagina>
    );
  }

  const fab = esFabricado(a.tipo);
  const costos = puede("costos");
  const parametros = pars.data ?? [];
  const pestanas = fab ? [
    { valor: "lista", texto: "Lista de materiales", cuenta: a.lineas_bom },
    { valor: "parametros", texto: "Parámetros", cuenta: parametros.length || undefined },
    { valor: "horas", texto: "Horas por etapa" },
    ...(costos ? [{ valor: "costo", texto: "Costo y precio" }, { valor: "historial", texto: "Historial" }] : []),
    ...(a.tipo === "subensamble" || a.usado_en > 0 ? [{ valor: "usos", texto: "Dónde se usa", cuenta: a.usado_en }] : []),
    { valor: "planos", texto: "Planos" },
  ] : [];
  const pestana = pestanas.some((p) => p.valor === params.get("pestana")) ? params.get("pestana")! : "lista";
  const volver = fab ? { ruta: a.tipo === "subensamble" ? "/costeo/equipos?vista=subensambles" : "/costeo/equipos", texto: "Equipos y subensambles" }
    : { ruta: "/costeo/componentes", texto: "Componentes" };

  return (
    <Pagina
      titulo={a.nombre}
      descripcion={
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <Link to={volver.ruta} className="inline-flex items-center gap-1 hover:text-texto"><ArrowLeft className="h-3.5 w-3.5" /> {volver.texto}</Link>
          <span className="text-borde">|</span>
          <span className="cifra font-medium text-texto">{a.clave}</span>
          <Insignia tono={fab ? "marca" : "neutro"}>{NOMBRE_TIPO[a.tipo]}</Insignia>
          {a.categoria && <Insignia>{a.categoria}</Insignia>}
          {a.medida_especial && <Insignia tono="info">medida especial</Insignia>}
          {a.es_importado && <Insignia tono="info">importado</Insignia>}
          {!a.se_vende && <Insignia>no se vende suelto</Insignia>}
          {costos && fab && (a.sin_costo ?? 0) > 0 && <Insignia tono="peligro" punto>{a.sin_costo} {a.sin_costo === 1 ? "pieza" : "piezas"} sin costo</Insignia>}
          {costos && a.costo_mas_viejo && esCostoViejo(a.costo_mas_viejo) && fab && <Insignia tono="aviso" punto>costo más viejo: {fecha(a.costo_mas_viejo)}</Insignia>}
        </span>
      }
      acciones={fab && puede("costeo", 2) && (
        <Boton variante="secundario" onClick={() => setDuplicando(true)}><Copy className="h-4 w-4" /> Duplicar con otros parámetros</Boton>
      )}
    >
      {state?.origen && state.origen !== a.id && <ComparacionCopia origen={state.origen} copia={a} />}
      <Encabezado a={a} />

      {fab ? (
        <Pestanas value={pestana} onValueChange={(v) => setParams(v === "lista" ? {} : { pestana: v }, { replace: true, state })}>
          <ListaPestanas opciones={pestanas} />
          <ContenidoPestana value="lista" className="pt-4"><ListaMateriales articulo={a} parametros={parametros} /></ContenidoPestana>
          <ContenidoPestana value="parametros" className="pt-4"><Parametros articulo={a} parametros={parametros} /></ContenidoPestana>
          <ContenidoPestana value="horas" className="pt-4"><HorasEtapa articulo={a} parametros={parametros} /></ContenidoPestana>
          {costos && <ContenidoPestana value="costo" className="pt-4"><CostoPrecio articulo={a} /></ContenidoPestana>}
          {costos && <ContenidoPestana value="historial" className="pt-4"><Historial id={a.id} /></ContenidoPestana>}
          <ContenidoPestana value="usos" className="pt-4"><DondeSeUsa id={a.id} unidad={a.unidad} /></ContenidoPestana>
          <ContenidoPestana value="planos" className="pt-4"><PlanosArticulo articuloId={a.id} /></ContenidoPestana>
        </Pestanas>
      ) : (
        <>
          <FichaComponente articulo={a} />
          <EmpaqueArticulo articuloId={a.id} />
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Planos</h2>
            <PlanosArticulo articuloId={a.id} />
          </section>
        </>
      )}

      {fab && <DialogoDuplicar abierto={duplicando} alCambiar={setDuplicando} articulo={a} parametros={parametros} />}
    </Pagina>
  );
}

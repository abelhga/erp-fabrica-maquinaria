import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardList, Layers, Lightbulb, Plus, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Seleccion } from "@/components/ui/campo";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { dinero, fecha, hace, numero } from "@/lib/formato";
import { diasDesde, rutaArticulo, useCatalogo, type ArticuloCatalogo, type TipoArticulo } from "./componentes/comun";
import { cn } from "@/lib/utilidades";
import { NuevoArticulo } from "./componentes/NuevoArticulo";

const FABRICADOS: TipoArticulo[] = ["equipo", "subensamble"];

/** Piezas sin costo dentro: cuentan como $0 y bajan el precio sin avisar. */
function SinCosto({ a }: { a: ArticuloCatalogo }) {
  if (!a.lineas_bom) return <Insignia tono="neutro">sin lista</Insignia>;
  if ((a.sin_costo ?? 0) > 0) return <Insignia tono="peligro" punto>{a.sin_costo} sin costo</Insignia>;
  return <span className="text-tenue">—</span>;
}

/** Un costo de hace más de un año dentro de un equipo ya no es el de hoy. */
const DIAS_VIEJO_EQUIPO = 365;
function CostoMasViejo({ f }: { f: string | null | undefined }) {
  if (!f) return <span className="text-tenue">—</span>;
  const viejo = (diasDesde(f) ?? 0) > DIAS_VIEJO_EQUIPO;
  return <span className={cn("whitespace-nowrap", viejo ? "text-aviso" : "text-tenue")} title={`El costo más antiguo de sus piezas es de ${hace(f)}`}>
    {viejo && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1.5 align-middle" />}{fecha(f).slice(3)}</span>;
}

type FiltroEq = "todos" | "alertas" | "sin_lista";

function TablaFabricados({ filas, cargando, error, tipo }: {
  filas: ArticuloCatalogo[] | undefined; cargando: boolean; error: unknown; tipo: "equipo" | "subensamble";
}) {
  const { puede } = useSesion();
  const ir = useNavigate();
  const costos = puede("costos");
  const [filtro, setFiltro] = useState<FiltroEq>("todos");
  const [categoria, setCategoria] = useState("");

  const categorias = useMemo(() => [...new Set((filas ?? []).map((a) => a.categoria).filter(Boolean) as string[])].sort(), [filas]);
  const conAlerta = (a: ArticuloCatalogo) => (a.sin_costo ?? 0) > 0;
  const visibles = useMemo(() => (filas ?? []).filter((a) =>
    (!categoria || a.categoria === categoria) &&
    (filtro === "todos" || (filtro === "alertas" ? conAlerta(a) : !a.lineas_bom))), [filas, filtro, categoria]);

  const columnas: Columna<ArticuloCatalogo>[] = [
    { clave: "clave", titulo: "Clave", clase: "whitespace-nowrap font-medium cifra" },
    { clave: "nombre", titulo: "Nombre", valor: (a) => `${a.nombre} ${a.categoria ?? ""}`,
      celda: (a) => (
        <div className="min-w-[220px] max-w-[330px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate" title={a.nombre}>{a.nombre}</span>
            {a.medida_especial && <Insignia tono="info" className="shrink-0">medida especial</Insignia>}
          </div>
          {tipo === "equipo" && <span className="block text-xs text-tenue truncate">{a.categoria ?? "Sin tipo de equipo"}</span>}
        </div>
      ) },
    { clave: "lineas_bom", titulo: "Líneas", alinear: "der", sinBusqueda: true, valor: (a) => a.lineas_bom },
    { clave: "usado_en", titulo: "Usado en", alinear: "der", sinBusqueda: true, valor: (a) => a.usado_en, oculta: tipo === "equipo", clase: "whitespace-nowrap",
      celda: (a) => a.usado_en ? <span>{a.usado_en} {a.usado_en === 1 ? "lista" : "listas"}</span> : <span className="text-tenue">en ninguna</span> },
    { clave: "horas", titulo: "Horas", alinear: "der", sinBusqueda: true, oculta: !costos, valor: (a) => a.horas ?? null, celda: (a) => numero(a.horas) },
    { clave: "costo_total", titulo: "Costo", alinear: "der", sinBusqueda: true, oculta: !costos, valor: (a) => a.costo_total ?? null, celda: (a) => dinero(a.costo_total) },
    { clave: "precio", titulo: "Precio de lista", alinear: "der", sinBusqueda: true, valor: (a) => a.precio,
      celda: (a) => a.precio == null ? <span className="text-tenue">sin precio</span> : <span className="font-medium">{dinero(a.precio)}</span> },
    { clave: "sin_costo", titulo: "Sin costo", oculta: !costos, sinBusqueda: true, valor: (a) => a.sin_costo ?? 0, celda: (a) => <SinCosto a={a} /> },
    { clave: "costo_mas_viejo", titulo: "Más viejo", oculta: !costos, sinBusqueda: true, valor: (a) => a.costo_mas_viejo ?? null,
      celda: (a) => <CostoMasViejo f={a.costo_mas_viejo} /> },
  ];

  return (
    <TablaDatos
      filas={visibles} columnas={columnas} cargando={cargando} error={error} claveFila={(a) => a.id}
      alClicFila={(a) => ir(rutaArticulo(a))} exportarComo={tipo === "equipo" ? "equipos" : "subensambles"}
      placeholder={tipo === "equipo" ? 'Buscar: "banda 18", E-315, dosificadora…' : "Buscar subensamble…"}
      filtros={
        <>
          {tipo === "equipo" && categorias.length > 1 && (
            <Seleccion value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-auto h-8 text-xs">
              <option value="">Todos los tipos</option>
              {categorias.map((c) => <option key={c}>{c}</option>)}
            </Seleccion>
          )}
          <Filtro<FiltroEq> valor={filtro} alCambiar={setFiltro} opciones={[
            { valor: "todos", texto: "Todos" },
            ...(costos ? [{ valor: "alertas" as const, texto: "Con piezas sin costo", cuenta: (filas ?? []).filter(conAlerta).length }] : []),
            { valor: "sin_lista", texto: "Sin lista de materiales", cuenta: (filas ?? []).filter((a) => !a.lineas_bom).length },
          ]} />
        </>
      }
      vacio={tipo === "subensamble"
        ? { icono: Layers, titulo: filtro === "todos" ? "Todavía no hay subensambles" : "Nada con este filtro",
            texto: "Abre un equipo, elige las líneas que siempre van juntas (cabezal motriz, tambor de cola…) y usa «Convertir en subensamble». Así se capturan una vez y se comparten." }
        : { icono: Layers, titulo: filtro === "todos" ? "Todavía no hay equipos" : "Nada con este filtro",
            texto: filtro === "todos" ? "Da de alta un equipo o importa Nuevo Costeo desde Sistema → Importar." : "Prueba con otro filtro." }}
    />
  );
}

interface Solicitud {
  id: string; descripcion: string; estado: "pendiente" | "aplicada" | "descartada"; solicitado_en: string; resuelto_en: string | null;
  articulo: { id: string; clave: string; nombre: string; tipo: TipoArticulo } | null;
  orden: { id: string; folio: string } | null;
  solicitante: { nombre: string } | null;
  resolvio: { nombre: string } | null;
}

function Solicitudes({ filas, cargando, error }: { filas: Solicitud[] | undefined; cargando: boolean; error: unknown }) {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [vista, setVista] = useState<"pendiente" | "resueltas">("pendiente");
  const resolver = useAccion(
    (a: { id: string; estado: "aplicada" | "descartada" }) => q(supabase.rpc("resolver_solicitud_cambio", { p_id: a.id, p_estado: a.estado })),
    { exito: "Solicitud resuelta. Producción la verá como atendida.", invalidar: [["costeo", "solicitudes"]] },
  );
  const visibles = (filas ?? []).filter((s) => (vista === "pendiente" ? s.estado === "pendiente" : s.estado !== "pendiente"));
  const editar = puede("costeo", 2);

  const columnas: Columna<Solicitud>[] = [
    { clave: "solicitado_en", titulo: "Cuándo", clase: "whitespace-nowrap text-tenue", valor: (s) => s.solicitado_en, celda: (s) => hace(s.solicitado_en) },
    { clave: "articulo", titulo: "Equipo o subensamble", clase: "min-w-[200px] max-w-[280px]", valor: (s) => `${s.articulo?.clave} ${s.articulo?.nombre}`,
      celda: (s) => s.articulo && (
        <Link to={rutaArticulo(s.articulo) + "?pestana=lista"} onClick={(e) => e.stopPropagation()} className="hover:underline">
          <span className="font-medium cifra">{s.articulo.clave}</span> <span className="text-tenue">{s.articulo.nombre}</span>
        </Link>
      ) },
    { clave: "descripcion", titulo: "Qué hay que corregir", clase: "min-w-[280px] max-w-[420px] whitespace-normal" },
    { clave: "orden", titulo: "Orden", clase: "whitespace-nowrap", valor: (s) => s.orden?.folio, celda: (s) => s.orden
      ? <Link to={`/produccion/ordenes/${s.orden.id}`} onClick={(e) => e.stopPropagation()} className="text-marca-texto hover:underline cifra">{s.orden.folio}</Link>
      : <span className="text-tenue">—</span> },
    { clave: "solicitante", titulo: "Pidió", clase: "whitespace-nowrap text-tenue", valor: (s) => s.solicitante?.nombre },
    vista === "pendiente"
      ? { clave: "acciones", titulo: "", sinBusqueda: true, oculta: !editar, clase: "whitespace-nowrap text-right",
          celda: (s) => (
            <div className="flex justify-end gap-1">
              <Boton tamano="sm" variante="secundario" onClick={(e) => { e.stopPropagation(); if (s.articulo) ir(rutaArticulo(s.articulo) + "?pestana=lista"); }}>Abrir lista</Boton>
              <Boton tamano="sm" variante="exito" title="Ya lo corregí en la lista de materiales" cargando={resolver.isPending && resolver.variables?.id === s.id}
                onClick={(e) => { e.stopPropagation(); resolver.mutate({ id: s.id, estado: "aplicada" }); }}><Check className="h-3.5 w-3.5" /> Aplicada</Boton>
              <Boton tamano="sm" variante="fantasma" title="Descartar: no procede" aria-label="Descartar"
                onClick={(e) => { e.stopPropagation(); resolver.mutate({ id: s.id, estado: "descartada" }); }}><X className="h-3.5 w-3.5" /></Boton>
            </div>
          ) }
      : { clave: "estado", titulo: "Resultado", clase: "whitespace-nowrap", valor: (s) => s.estado,
          celda: (s) => (
            <span className="inline-flex items-center gap-2">
              <Insignia tono={s.estado === "aplicada" ? "ok" : "neutro"}>{s.estado}</Insignia>
              <span className="text-xs text-tenue">{s.resolvio?.nombre} · {fecha(s.resuelto_en)}</span>
            </span>
          ) },
  ];

  return (
    <TablaDatos
      filas={visibles} columnas={columnas} cargando={cargando} error={error} claveFila={(s) => s.id}
      placeholder="Buscar en las solicitudes…" exportarComo="solicitudes-cambio"
      filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
        { valor: "pendiente", texto: "Pendientes", cuenta: (filas ?? []).filter((s) => s.estado === "pendiente").length },
        { valor: "resueltas", texto: "Resueltas" },
      ]} />}
      vacio={{ icono: ClipboardList, titulo: vista === "pendiente" ? "Sin correcciones pendientes" : "Todavía no hay solicitudes resueltas",
        texto: "Cuando en piso algo no cuadra con la lista de materiales («los rodillos son de 14\"»), producción lo manda desde la orden y aparece aquí." }}
    />
  );
}

/**
 * Sugerencias de subensamble que detecta la importación (grupos de piezas que se
 * repiten igual en varios equipos). La lista vive en Sistema → Importar; aquí
 * solo se avisa cuántas hay. Si la tabla aún no existe en esta base, no se muestra nada.
 */
function AvisoSugerencias() {
  const { puede } = useSesion();
  const sug = useQuery({
    queryKey: ["costeo", "sugerencias-pendientes"],
    enabled: puede("costeo", 2),
    retry: false,
    queryFn: async () => {
      const { count, error } = await supabase.from("sugerencias_subensamble").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
      return error ? null : count;
    },
  });
  if (!sug.data) return null;
  return (
    <div className="mb-3 rounded-xl border border-info/25 bg-info-suave px-4 py-3 text-sm flex flex-wrap items-center gap-3">
      <Lightbulb className="h-4 w-4 text-info shrink-0" />
      <span className="flex-1 min-w-[260px]">
        <b>{sug.data} {sug.data === 1 ? "grupo de piezas se repite" : "grupos de piezas se repiten"} igual en varios equipos</b> y podrían ser subensambles
        (los encontró la importación de Nuevo Costeo).
      </span>
      {puede("admin", 3)
        ? <Link to="/sistema/importar" className="text-marca-texto font-medium hover:underline">Revisar sugerencias</Link>
        : <span className="text-tenue">La lista está en Sistema → Importar; pídele a sistemas que te la abra.</span>}
    </div>
  );
}

export default function Equipos() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const [nuevo, setNuevo] = useState<"equipo" | "subensamble" | null>(null);
  const vista = params.get("vista") ?? "equipos";
  const cat = useCatalogo(FABRICADOS);
  // Las correcciones de piso son asunto de ingeniería y producción; un vendedor no las necesita.
  const verSolicitudes = puede("costeo", 2) || puede("produccion", 2);
  const solicitudes = useQuery({
    queryKey: ["costeo", "solicitudes"],
    enabled: verSolicitudes,
    queryFn: () => q<Solicitud[]>(supabase.from("solicitudes_cambio_bom").select(
      "id, descripcion, estado, solicitado_en, resuelto_en, articulo:articulos(id, clave, nombre, tipo), orden:ordenes_produccion(id, folio), " +
      "solicitante:perfiles!solicitudes_cambio_bom_solicitado_por_fkey(nombre), resolvio:perfiles!solicitudes_cambio_bom_resuelto_por_fkey(nombre)")
      .order("solicitado_en", { ascending: false }).limit(500) as unknown as PromiseLike<{ data: Solicitud[] | null; error: { message: string } | null }>),
  });
  useTiempoReal("solicitudes_cambio_bom", [["costeo", "solicitudes"]]);

  const equipos = cat.data?.filter((a) => a.tipo === "equipo");
  const subensambles = cat.data?.filter((a) => a.tipo === "subensamble");
  const pendientes = solicitudes.data?.filter((s) => s.estado === "pendiente").length;

  return (
    <Pagina
      titulo="Equipos y subensambles"
      descripcion="Listas de materiales, horas y precio de cada equipo. Los subensambles se capturan una vez y se comparten."
      acciones={puede("costeo", 2) && (
        <>
          <Boton variante="secundario" onClick={() => setNuevo("subensamble")}><Plus className="h-4 w-4" /> Nuevo subensamble</Boton>
          <Boton onClick={() => setNuevo("equipo")}><Plus className="h-4 w-4" /> Nuevo equipo</Boton>
        </>
      )}
    >
      <Pestanas value={vista} onValueChange={(v) => setParams(v === "equipos" ? {} : { vista: v }, { replace: true })}>
        <ListaPestanas opciones={[
          { valor: "equipos", texto: "Equipos", cuenta: equipos?.length },
          { valor: "subensambles", texto: "Subensambles", cuenta: subensambles?.length },
          ...(verSolicitudes ? [{ valor: "solicitudes", texto: "Solicitudes de cambio", cuenta: pendientes || undefined }] : []),
        ]} />
        <ContenidoPestana value="equipos" className="pt-4">
          <TablaFabricados filas={equipos} cargando={cat.isLoading} error={cat.error} tipo="equipo" />
        </ContenidoPestana>
        <ContenidoPestana value="subensambles" className="pt-4">
          <AvisoSugerencias />
          <TablaFabricados filas={subensambles} cargando={cat.isLoading} error={cat.error} tipo="subensamble" />
        </ContenidoPestana>
        <ContenidoPestana value="solicitudes" className="pt-4">
          <Solicitudes filas={solicitudes.data} cargando={solicitudes.isLoading} error={solicitudes.error} />
        </ContenidoPestana>
      </Pestanas>
      {nuevo && <NuevoArticulo abierto alCambiar={(v) => !v && setNuevo(null)} tipo={nuevo} />}
    </Pagina>
  );
}

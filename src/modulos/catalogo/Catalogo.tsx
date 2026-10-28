import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ImageOff, Link2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { BotonSubirFoto } from "@/components/datos/SubirFoto";
import { dinero, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { traerTodas } from "@/modulos/costeo/componentes/comun";
import { GLOSARIO } from "@/tutorial/glosario";
import { FichasTecnicas } from "@/modulos/ventas/componentes/Fichas";

/**
 * Lo que recepción necesita para contestar el teléfono: qué vendemos, cómo es, cuánto
 * cuesta en lista y si hay. Sin listas de materiales, horas, planos ni proveedores: eso es
 * de ingeniería, y antes recepción lo veía solo porque el precio vivía en esas pantallas.
 */
interface Articulo {
  id: string; clave: string; tipo: "equipo" | "componente"; nombre: string; descripcion: string | null; unidad: string;
  categoria: string | null; imagen_url: string | null; precio: number | null; existencia: number | null;
}

type FiltroCat = "todos" | "equipo" | "componente" | "con_existencia" | "sin_foto";

function Foto({ url, grande }: { url: string | null; grande?: boolean }) {
  const [rota, setRota] = useState(false);
  const clase = grande ? "w-full max-h-72 rounded-xl" : "h-10 w-10 rounded-md";
  if (!url || rota) {
    return (
      <span className={cn("flex items-center justify-center border border-borde bg-fondo text-tenue", grande ? "h-40 w-full rounded-xl" : clase)}>
        <ImageOff className={grande ? "h-8 w-8" : "h-4 w-4"} />
      </span>
    );
  }
  return <img src={url} alt="" loading="lazy" onError={() => setRota(true)} className={cn("object-contain border border-borde bg-fondo", clase)} />;
}

/** Marketing (catálogo 2) pone la foto: la sube o pega la liga de Drive; nada más de la ficha. */
function CambiarFoto({ a, alCambiar }: { a: Articulo; alCambiar: (url: string | null) => void }) {
  const [liga, setLiga] = useState("");
  const poner = useAccion((url: string | null) => q<string | null>(supabase.rpc("poner_imagen_articulo", { p_articulo: a.id, p_url: url })), {
    exito: (u) => u ? "Foto guardada: ya sale en el catálogo y en las cotizaciones nuevas" : "Foto quitada",
    invalidar: [["catalogo_venta"]], alTerminar: (u) => { alCambiar(u); setLiga(""); },
  });
  return (
    <div className="flex flex-wrap items-center gap-2" data-explain={GLOSARIO.fotoCatalogo} data-explain-title="Foto del catálogo">
      <BotonSubirFoto carpeta={`articulos/${a.id}`} texto={a.imagen_url ? "Cambiar foto" : "Subir foto"} alSubir={(url) => poner.mutate(url)} />
      <form className="flex flex-1 min-w-[200px] items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (liga.trim()) poner.mutate(liga.trim()); }}>
        <Link2 className="h-4 w-4 text-tenue shrink-0" />
        <input className="campo h-9 flex-1 text-sm" value={liga} onChange={(e) => setLiga(e.target.value)} placeholder="o pega la liga (Drive o https://…) y Enter" />
      </form>
      {a.imagen_url && <button type="button" className="text-sm text-peligro hover:underline" onClick={() => poner.mutate(null)}>Quitar</button>}
    </div>
  );
}

export default function Catalogo() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const filtro = (params.get("filtro") as FiltroCat) ?? "todos";
  // ?articulo=… viene del buscador de arriba: abre su ficha.
  const articuloId = params.get("articulo");
  const [abierto, setAbierto] = useState<Articulo | null>(null);

  const cat = useQuery({
    queryKey: ["catalogo_venta"],
    queryFn: () => traerTodas<Articulo>((d, h) =>
      supabase.from("v_catalogo").select("id, clave, tipo, nombre, descripcion, unidad, categoria, imagen_url, precio, existencia")
        .in("tipo", ["equipo", "componente"]).eq("activo", true).eq("se_vende", true)
        .order("clave").range(d, h) as unknown as PromiseLike<{ data: Articulo[] | null; error: { message: string } | null }>),
    staleTime: 60_000,
  });
  const enLista = cat.data?.find((a) => a.id === articuloId);
  const suelto = useQuery({
    queryKey: ["catalogo_venta", "uno", articuloId],
    enabled: !!articuloId && !!cat.data && !enLista,
    queryFn: () => q<Articulo | null>(supabase.from("v_catalogo").select("id, clave, tipo, nombre, descripcion, unidad, categoria, imagen_url, precio, existencia")
      .eq("id", articuloId!).maybeSingle() as unknown as PromiseLike<{ data: Articulo | null; error: { message: string } | null }>),
  });
  useEffect(() => {
    const a = enLista ?? suelto.data;
    if (articuloId && a) setAbierto(a);
  }, [articuloId, enLista, suelto.data]);
  const cerrar = () => {
    setAbierto(null);
    if (articuloId) setParams((p) => { const n = new URLSearchParams(p); n.delete("articulo"); return n; }, { replace: true });
  };

  const filas = useMemo(() => {
    const f = cat.data ?? [];
    if (filtro === "equipo" || filtro === "componente") return f.filter((a) => a.tipo === filtro);
    if (filtro === "con_existencia") return f.filter((a) => (a.existencia ?? 0) > 0);
    if (filtro === "sin_foto") return f.filter((a) => !a.imagen_url);
    return f;
  }, [cat.data, filtro]);

  const cuenta = (p: (a: Articulo) => boolean) => cat.data?.filter(p).length;
  const opciones: { valor: FiltroCat; texto: string; cuenta?: number; explica?: string }[] = [
    { valor: "todos", texto: "Todo", cuenta: cat.data?.length },
    { valor: "equipo", texto: "Equipos", cuenta: cuenta((a) => a.tipo === "equipo") },
    { valor: "componente", texto: "Componentes", cuenta: cuenta((a) => a.tipo === "componente") },
    { valor: "con_existencia", texto: "Con existencia", cuenta: cuenta((a) => (a.existencia ?? 0) > 0), explica: GLOSARIO.enPlanta },
    { valor: "sin_foto", texto: "Sin foto", cuenta: cuenta((a) => !a.imagen_url) },
  ];

  const columnas: Columna<Articulo>[] = [
    { clave: "imagen_url", titulo: "", sinBusqueda: true, valor: () => null, celda: (a) => <Foto key={a.imagen_url ?? a.id} url={a.imagen_url} /> },
    { clave: "clave", titulo: "Clave", clase: "whitespace-nowrap font-medium cifra" },
    {
      clave: "nombre", titulo: "Nombre",
      celda: (a) => (
        <div className="min-w-[240px]">
          {a.nombre}
          {a.tipo === "equipo" && <Insignia className="ml-2 align-middle">Equipo</Insignia>}
          {a.descripcion && <p className="text-xs text-tenue line-clamp-1">{a.descripcion}</p>}
        </div>
      ),
      valor: (a) => `${a.nombre} ${a.descripcion ?? ""}`,
    },
    { clave: "categoria", titulo: "Categoría", clase: "text-tenue", celda: (a) => <span className="block max-w-[140px] truncate">{a.categoria ?? "—"}</span> },
    {
      clave: "existencia", titulo: "Existencia", alinear: "der", sinBusqueda: true, valor: (a) => a.existencia ?? 0, clase: "whitespace-nowrap",
      explica: GLOSARIO.enPlanta,
      celda: (a) => <span className={cn("cifra", !a.existencia && "text-tenue")}>{numero(a.existencia ?? 0)} <span className="text-xs text-tenue">{a.unidad}</span></span>,
    },
    {
      clave: "precio", titulo: "Precio de lista", alinear: "der", sinBusqueda: true, valor: (a) => a.precio, explica: GLOSARIO.precioListaCatalogo,
      celda: (a) => a.precio != null ? <span className="cifra">{dinero(a.precio)}</span> : <span className="text-tenue">Pregunta a ventas</span>,
    },
  ];

  return (
    <Pagina titulo="Catálogo" descripcion="Lo que vendemos, con su foto, precio de lista y lo que hay en planta.">
      <TablaDatos
        filas={filas} columnas={columnas} cargando={cat.isLoading} error={cat.error} claveFila={(a) => a.id}
        alClicFila={setAbierto} exportarComo="catalogo"
        placeholder="Buscar por clave, nombre o descripción…"
        filtros={<Filtro opciones={opciones} valor={filtro} alCambiar={(v) => setParams(v === "todos" ? {} : { filtro: v }, { replace: true })} />}
        vacio={filtro === "todos"
          ? { icono: BookOpen, titulo: "Todavía no hay nada a la venta", texto: "Ingeniería marca qué artículos se venden; cuando lo haga, aparecen aquí con su precio." }
          : { icono: BookOpen, titulo: "Nada con este filtro", texto: "Prueba con otro filtro o quítalo." }}
      />
      <Lateral abierto={!!abierto} alCambiar={(v) => !v && cerrar()} titulo={abierto?.nombre} subtitulo={abierto?.clave} ancho="max-w-lg">
        {abierto && (
          <div className="space-y-5">
            <Foto key={abierto.imagen_url ?? abierto.id} url={abierto.imagen_url} grande />
            {puede("catalogo", 2) && <CambiarFoto a={abierto} alCambiar={(url) => setAbierto({ ...abierto, imagen_url: url })} />}
            <dl className="grid grid-cols-2 gap-4">
              <div data-explain={GLOSARIO.precioListaCatalogo} data-explain-title="Precio de lista">
                <dt className="text-xs text-tenue">Precio de lista</dt>
                <dd className="text-xl font-semibold cifra">{abierto.precio != null ? dinero(abierto.precio) : "Pregunta a ventas"}</dd>
              </div>
              <div data-explain={GLOSARIO.enPlanta} data-explain-title="Existencia">
                <dt className="text-xs text-tenue">Existencia en planta</dt>
                <dd className="text-xl font-semibold cifra">{numero(abierto.existencia ?? 0)} <span className="text-sm font-normal text-tenue">{abierto.unidad}</span></dd>
              </div>
              <div><dt className="text-xs text-tenue">Tipo</dt><dd>{abierto.tipo === "equipo" ? "Equipo" : "Componente"}</dd></div>
              <div><dt className="text-xs text-tenue">Categoría</dt><dd>{abierto.categoria ?? "—"}</dd></div>
            </dl>
            <div>
              <p className="text-xs text-tenue">Descripción</p>
              <p className="whitespace-pre-line">{abierto.descripcion ?? "Sin descripción. Si el cliente pide detalles, pásaselo a un vendedor."}</p>
            </div>
            {/* Lo que se le puede mandar al cliente: ficha técnica y fotos vigentes (no los planos de fabricación). */}
            <div data-explain={GLOSARIO.fichaTecnica} data-explain-title="Fichas técnicas y fotos">
              <FichasTecnicas articuloId={abierto.id} tipo={abierto.tipo} />
            </div>
          </div>
        )}
      </Lateral>
    </Pagina>
  );
}

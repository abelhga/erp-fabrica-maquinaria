import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ImageOff } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { dinero, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { traerTodas } from "@/modulos/costeo/componentes/comun";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Lo que recepción necesita para contestar el teléfono: qué vendemos, cómo es, cuánto
 * cuesta en lista y si hay. Sin listas de materiales, horas, planos ni proveedores: eso es
 * de ingeniería, y antes recepción lo veía solo porque el precio vivía en esas pantallas.
 */
interface Articulo {
  id: string; clave: string; tipo: "equipo" | "componente"; nombre: string; descripcion: string | null; unidad: string;
  categoria: string | null; imagen_url: string | null; precio: number | null; existencia: number | null;
}

type FiltroCat = "todos" | "equipo" | "componente" | "con_existencia";

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

export default function Catalogo() {
  const [params, setParams] = useSearchParams();
  const filtro = (params.get("filtro") as FiltroCat) ?? "todos";
  const [abierto, setAbierto] = useState<Articulo | null>(null);

  const cat = useQuery({
    queryKey: ["catalogo_venta"],
    queryFn: () => traerTodas<Articulo>((d, h) =>
      supabase.from("v_catalogo").select("id, clave, tipo, nombre, descripcion, unidad, categoria, imagen_url, precio, existencia")
        .in("tipo", ["equipo", "componente"]).eq("activo", true).eq("se_vende", true)
        .order("clave").range(d, h) as unknown as PromiseLike<{ data: Articulo[] | null; error: { message: string } | null }>),
    staleTime: 60_000,
  });

  const filas = useMemo(() => {
    const f = cat.data ?? [];
    if (filtro === "equipo" || filtro === "componente") return f.filter((a) => a.tipo === filtro);
    if (filtro === "con_existencia") return f.filter((a) => (a.existencia ?? 0) > 0);
    return f;
  }, [cat.data, filtro]);

  const cuenta = (p: (a: Articulo) => boolean) => cat.data?.filter(p).length;
  const opciones: { valor: FiltroCat; texto: string; cuenta?: number; explica?: string }[] = [
    { valor: "todos", texto: "Todo", cuenta: cat.data?.length },
    { valor: "equipo", texto: "Equipos", cuenta: cuenta((a) => a.tipo === "equipo") },
    { valor: "componente", texto: "Componentes", cuenta: cuenta((a) => a.tipo === "componente") },
    { valor: "con_existencia", texto: "Con existencia", cuenta: cuenta((a) => (a.existencia ?? 0) > 0), explica: GLOSARIO.enPlanta },
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
    <Pagina titulo="Catálogo" descripcion="Lo que vendemos, con su foto, precio de lista y lo que hay en planta. Para dar precios por teléfono.">
      <TablaDatos
        filas={filas} columnas={columnas} cargando={cat.isLoading} error={cat.error} claveFila={(a) => a.id}
        alClicFila={setAbierto} exportarComo="catalogo"
        placeholder="Buscar por clave, nombre o descripción…"
        filtros={<Filtro opciones={opciones} valor={filtro} alCambiar={(v) => setParams(v === "todos" ? {} : { filtro: v }, { replace: true })} />}
        vacio={filtro === "todos"
          ? { icono: BookOpen, titulo: "Todavía no hay nada a la venta", texto: "Ingeniería marca qué artículos se venden; cuando lo haga, aparecen aquí con su precio." }
          : { icono: BookOpen, titulo: "Nada con este filtro", texto: "Prueba con otro filtro o quítalo." }}
      />
      <Lateral abierto={!!abierto} alCambiar={(v) => !v && setAbierto(null)} titulo={abierto?.nombre} subtitulo={abierto?.clave} ancho="max-w-lg">
        {abierto && (
          <div className="space-y-5">
            <Foto key={abierto.imagen_url ?? abierto.id} url={abierto.imagen_url} grande />
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
          </div>
        )}
      </Lateral>
    </Pagina>
  );
}

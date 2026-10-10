import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Boxes, Plus } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { COMPRADOS, NOMBRE_TIPO, esCostoViejo, useCatalogo, type ArticuloCatalogo } from "./componentes/comun";
import { NuevoArticulo } from "./componentes/NuevoArticulo";

type FiltroComp = "todos" | "sin_costo" | "viejo" | "importados" | "con_existencia";

/** Costo en su moneda; si no es pesos, con la equivalencia que usa el costeo debajo. */
function CeldaCosto({ a }: { a: ArticuloCatalogo }) {
  if (!a.costo_capturado) return <Insignia tono="peligro">sin costo</Insignia>;
  if (a.moneda_costo && a.moneda_costo !== "MXN") {
    return (
      <span className="inline-flex flex-col items-end leading-tight">
        <span>{a.moneda_costo} {Number(a.costo_capturado).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        <span className="text-xs text-tenue">{dinero(a.costo_total)}</span>
      </span>
    );
  }
  return <>{dinero(a.costo_capturado)}</>;
}

export default function Componentes() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [nuevo, setNuevo] = useState(false);
  const costos = puede("costos");
  const cat = useCatalogo(COMPRADOS);
  const filtro = (params.get("filtro") as FiltroComp) ?? "todos";

  const cuentas = useMemo(() => {
    const f = cat.data ?? [];
    return {
      sin_costo: f.filter((a) => !a.costo_capturado).length,
      viejo: f.filter((a) => a.costo_capturado && esCostoViejo(a.costo_actualizado_en)).length,
      importados: f.filter((a) => a.es_importado).length,
      con_existencia: f.filter((a) => (a.existencia ?? 0) > 0).length,
    };
  }, [cat.data]);

  const filas = useMemo(() => {
    const f = cat.data ?? [];
    switch (filtro) {
      case "sin_costo": return costos ? f.filter((a) => !a.costo_capturado) : f;
      case "viejo": return costos ? f.filter((a) => a.costo_capturado && esCostoViejo(a.costo_actualizado_en)) : f;
      case "importados": return f.filter((a) => a.es_importado);
      case "con_existencia": return f.filter((a) => (a.existencia ?? 0) > 0);
      default: return f;
    }
  }, [cat.data, filtro, costos]);

  const opciones: { valor: FiltroComp; texto: string; cuenta?: number }[] = [
    { valor: "todos", texto: "Todos", cuenta: cat.data?.length },
    ...(costos ? [
      { valor: "sin_costo" as const, texto: "Sin costo", cuenta: cuentas.sin_costo },
      { valor: "viejo" as const, texto: "Costo de +6 meses", cuenta: cuentas.viejo },
    ] : []),
    { valor: "importados", texto: "Importados", cuenta: cuentas.importados },
    { valor: "con_existencia", texto: "Con existencia", cuenta: cuentas.con_existencia },
  ];

  const columnas: Columna<ArticuloCatalogo>[] = [
    { clave: "clave", titulo: "Clave", clase: "whitespace-nowrap font-medium cifra" },
    {
      clave: "nombre", titulo: "Nombre",
      celda: (a) => (
        // El nombre va completo (lo que distingue a dos bandas suele estar al final) y las
        // etiquetas fluyen detrás del texto en vez de quitarle ancho a su columna.
        <div className="min-w-[260px]">
          {a.nombre}
          {a.tipo !== "componente" && <Insignia className="ml-2 align-middle">{NOMBRE_TIPO[a.tipo]}</Insignia>}
          {a.es_importado && <Insignia tono="info" className="ml-2 align-middle">importado</Insignia>}
        </div>
      ),
    },
    { clave: "categoria", titulo: "Categoría", clase: "text-tenue", celda: (a) => <span className="block max-w-[110px] truncate" title={a.categoria ?? undefined}>{a.categoria ?? "—"}</span> },
    {
      clave: "existencia", titulo: "Existencia", alinear: "der", sinBusqueda: true, valor: (a) => a.existencia ?? 0, clase: "whitespace-nowrap",
      celda: (a) => <span className={cn(!a.existencia && "text-tenue")}>{numero(a.existencia ?? 0)} <span className="text-xs text-tenue">{a.unidad}</span></span>,
    },
    { clave: "precio", titulo: "Precio de lista", alinear: "der", sinBusqueda: true, valor: (a) => a.precio, celda: (a) => dinero(a.precio) },
    {
      clave: "costo", titulo: "Costo", alinear: "der", sinBusqueda: true, oculta: !costos, clase: "whitespace-nowrap",
      valor: (a) => a.costo_total ?? null, celda: (a) => <CeldaCosto a={a} />,
    },
    {
      clave: "costo_actualizado_en", titulo: "Fecha costo", sinBusqueda: true, oculta: !costos, clase: "whitespace-nowrap",
      valor: (a) => a.costo_actualizado_en ?? null,
      celda: (a) => !a.costo_actualizado_en ? <span className="text-tenue">—</span>
        : esCostoViejo(a.costo_actualizado_en)
          ? <span className="text-aviso inline-flex items-center gap-1.5" title={`Actualizado ${hace(a.costo_actualizado_en)}: conviene confirmarlo`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />{fecha(a.costo_actualizado_en)}</span>
          : fecha(a.costo_actualizado_en),
    },
    { clave: "proveedor", titulo: "Proveedor", oculta: !costos, clase: "text-tenue", celda: (a) => <span className="block max-w-[110px] truncate" title={a.proveedor ?? undefined}>{a.proveedor ?? "—"}</span> },
  ];

  return (
    <Pagina
      titulo="Componentes"
      descripcion="Lo que se compra: componentes, materia prima y servicios, con su precio de lista y lo que hay en planta."
      acciones={puede("costeo", 2) && <Boton onClick={() => setNuevo(true)}><Plus className="h-4 w-4" /> Nuevo componente</Boton>}
    >
      <TablaDatos
        filas={filas} columnas={columnas} cargando={cat.isLoading} error={cat.error} claveFila={(a) => a.id}
        alClicFila={(a) => ir(`/costeo/componentes/${a.id}`)} exportarComo="componentes"
        placeholder="Buscar por clave, nombre, categoría o proveedor…"
        filtros={<Filtro opciones={opciones} valor={filtro} alCambiar={(v) => setParams(v === "todos" ? {} : { filtro: v }, { replace: true })} />}
        claseFila={(a) => (costos && !a.costo_capturado ? "bg-peligro-suave/40" : undefined)}
        vacio={filtro === "todos"
          ? { icono: Boxes, titulo: "Todavía no hay componentes", texto: "Da de alta el primero o importa la lista de compras desde Sistema → Importar.",
              accion: puede("costeo", 2) ? <Boton onClick={() => setNuevo(true)}><Plus className="h-4 w-4" /> Nuevo componente</Boton> : undefined }
          : { icono: Boxes, titulo: "Nada con este filtro", texto: filtro === "sin_costo" ? "Todos los componentes tienen costo capturado." : "Prueba con otro filtro o quítalo." }}
      />
      <NuevoArticulo abierto={nuevo} alCambiar={setNuevo} tipo="componente" />
    </Pagina>
  );
}

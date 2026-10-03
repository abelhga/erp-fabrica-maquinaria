import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { cn } from "@/lib/utilidades";
import { PERIODOS, usePeriodo, type ClavePeriodo } from "./comun";

const MapaVentas = lazy(() => import("./MapaVentas"));
const Tendencias = lazy(() => import("./Tendencias"));
const ClientesAnalisis = lazy(() => import("./ClientesAnalisis"));
const ProductoRegion = lazy(() => import("./ProductoRegion"));
const Planeacion = lazy(() => import("./Planeacion"));
const Ubicaciones = lazy(() => import("./Ubicaciones"));

// Una sola ruta /analisis/* con sus pestañas: el periodo elegido (en la URL) se queda al
// cambiar de vista, y cada vista tiene su liga para mandarla o regresar a ella.
const PESTANAS = [
  { ruta: "/analisis", texto: "Mapa de ventas", periodo: true, fin: true },
  { ruta: "/analisis/tendencias", texto: "Tendencias", periodo: false },
  { ruta: "/analisis/clientes", texto: "Clientes", periodo: true },
  { ruta: "/analisis/producto", texto: "Producto × región", periodo: true },
  { ruta: "/analisis/planeacion", texto: "Planeación", periodo: false },
  { ruta: "/analisis/ubicaciones", texto: "Ubicaciones por revisar", periodo: false },
];

const DESCRIPCION: Record<string, string> = {
  "/analisis": "Dónde se vende y dónde se dejó de vender, por estado y municipio.",
  "/analisis/tendencias": "La venta mes a mes desde 2018: estacionalidad, crecimiento y mezcla de producto.",
  "/analisis/clientes": "Cuánto depende la venta de pocos clientes, quién regresa y a quién se está perdiendo.",
  "/analisis/producto": "Qué familia de producto se vende en cada región.",
  "/analisis/planeacion": "La meta del año repartida con la estacionalidad real, contra lo vendido.",
  "/analisis/ubicaciones": "Ciudades escritas a mano que no se reconocieron: corregirlas una vez afina el mapa para siempre.",
};

export default function Analisis() {
  const { pathname } = useLocation();
  const { periodo, cambiar, params } = usePeriodo();
  const actual = PESTANAS.find((p) => p.ruta === pathname.replace(/\/$/, "")) ?? PESTANAS[0];
  const busqueda = params.toString() ? `?${params.toString()}` : "";

  return (
    <Pagina titulo="Análisis de ventas" descripcion={DESCRIPCION[actual.ruta]} ancho="max-w-[1500px]">
      <nav className="flex gap-1 border-b border-borde overflow-x-auto -mt-1" aria-label="Vistas del análisis">
        {PESTANAS.map((p) => (
          <NavLink key={p.ruta} to={p.ruta + busqueda} end={p.fin}
            className={({ isActive }) => cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
              isActive ? "text-marca-texto border-marca" : "text-tenue border-transparent hover:text-texto")}>
            {p.texto}
          </NavLink>
        ))}
      </nav>

      {actual.periodo && <FiltroPeriodo clave={periodo.clave} desde={periodo.desde} hasta={periodo.hasta} cambiar={cambiar} />}

      <Suspense fallback={<div className="py-24 flex justify-center text-tenue"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <Routes>
          <Route index element={<MapaVentas />} />
          <Route path="tendencias" element={<Tendencias />} />
          <Route path="clientes" element={<ClientesAnalisis />} />
          <Route path="producto" element={<ProductoRegion />} />
          <Route path="planeacion" element={<Planeacion />} />
          <Route path="ubicaciones" element={<Ubicaciones />} />
          <Route path="*" element={<MapaVentas />} />
        </Routes>
      </Suspense>
    </Pagina>
  );
}

/** Un solo renglón de filtros arriba de todo lo que filtran: el periodo primero. */
function FiltroPeriodo({ clave, desde, hasta, cambiar }: {
  clave: ClavePeriodo; desde: string; hasta: string; cambiar: (c: ClavePeriodo, d?: string, h?: string) => void;
}) {
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  useEffect(() => { setD(desde); setH(hasta); }, [desde, hasta]);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo">
      <span className="text-sm text-tenue mr-1">Periodo</span>
      {PERIODOS.map((p) => (
        <button key={p.valor} type="button" onClick={() => cambiar(p.valor)} aria-pressed={clave === p.valor}
          className={cn("h-8 rounded-full px-3 text-xs font-medium border transition",
            clave === p.valor ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:text-texto hover:bg-superficie")}>
          {p.texto}
        </button>
      ))}
      {clave === "rango" && (
        <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); cambiar("rango", d, h); }}>
          <input type="date" className="campo h-8 w-[150px]" value={d} min="2018-01-01" onChange={(e) => setD(e.target.value)}
            onBlur={() => d && d <= h && cambiar("rango", d, h)} aria-label="Desde" />
          <span className="text-tenue text-sm">a</span>
          <input type="date" className="campo h-8 w-[150px]" value={h} onChange={(e) => setH(e.target.value)}
            onBlur={() => h && d <= h && cambiar("rango", d, h)} aria-label="Hasta" />
        </form>
      )}
    </div>
  );
}

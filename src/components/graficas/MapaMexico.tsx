import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utilidades";

// Los mapas ya vienen proyectados (cónica de Lambert del INEGI) a un lienzo de 1000 de ancho:
// aquí solo se dibujan <path d>. Ver scripts/construir-mapas.mjs.
interface GeoEstado { cve: string; nombre: string; d: string; c: [number, number]; caja: [number, number, number, number] }
interface GeoPais { ancho: number; alto: number; fuente: string; estados: GeoEstado[] }
interface GeoMunicipio { cve: string; nombre: string; d: string; c: [number, number] }
interface GeoEntidad { cve: string; nombre: string; caja: [number, number, number, number]; municipios: GeoMunicipio[] }

const base = import.meta.env.BASE_URL ?? "/";
async function bajar<T>(ruta: string): Promise<T> {
  const r = await fetch(`${base}geo/${ruta}`);
  if (!r.ok) throw new Error("No se pudo cargar el mapa.");
  return r.json() as Promise<T>;
}

/** El mapa nacional (94 KB) se baja una vez; el de cada estado, al entrar a él. */
export function useGeoPais() {
  return useQuery({ queryKey: ["geo", "pais"], queryFn: () => bajar<GeoPais>("estados.json"), staleTime: Infinity, gcTime: Infinity });
}
function useGeoEntidad(cve: string | null | undefined) {
  return useQuery({ queryKey: ["geo", cve], enabled: !!cve, queryFn: () => bajar<GeoEntidad>(`municipios/${cve}.json`), staleTime: Infinity, gcTime: Infinity });
}

export const FUENTE_MAPAS = "Mapas: INEGI, Marco Geoestadístico 2023";

interface Region { cve: string; nombre: string; d: string; c: [number, number] }

/**
 * México por estados, o un estado por municipios (`estado="14"`).
 * El color de cada región lo decide quien llama (`color(cve)` → token CSS) con su escala;
 * el mapa solo dibuja, muestra el tooltip y avisa del clic. Cada región se puede enfocar
 * con Tab y abrir con Enter, igual que con el ratón.
 */
export function MapaMexico({ estado, color, tooltip, alClic, etiqueta, seleccion, className, compacto }: {
  estado?: string | null;
  color: (cve: string) => string;
  tooltip?: (cve: string, nombre: string) => ReactNode;
  alClic?: (cve: string, nombre: string) => void;
  /** Texto para lectores de pantalla de cada región ("Jalisco: $64.8 M"). */
  etiqueta?: (cve: string, nombre: string) => string;
  seleccion?: string | null;
  className?: string;
  /** Sin interacción ni tooltip: para la tarjeta chica del inicio. */
  compacto?: boolean;
}) {
  const pais = useGeoPais();
  const entidad = useGeoEntidad(estado);
  const caja = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [activa, setActiva] = useState<{ cve: string; nombre: string; x: number; y: number } | null>(null);
  // Al entrar a un estado (o salir) el tooltip de la región anterior ya no aplica.
  useEffect(() => setActiva(null), [estado]);

  const { regiones, contexto, viewBox } = useMemo(() => {
    if (!pais.data) return { regiones: [] as Region[], contexto: [] as GeoEstado[], viewBox: "0 0 1000 640" };
    if (!estado) return { regiones: pais.data.estados as Region[], contexto: [], viewBox: `0 0 ${pais.data.ancho} ${pais.data.alto}` };
    if (!entidad.data) return { regiones: [], contexto: [], viewBox: "0 0 1000 640" };
    const [x1, y1, x2, y2] = entidad.data.caja;
    const m = Math.max(x2 - x1, y2 - y1) * 0.04;
    return {
      regiones: entidad.data.municipios as Region[],
      // Los estados vecinos, en gris, para que el estado no flote en el vacío.
      contexto: pais.data.estados.filter((e) => e.cve !== estado),
      viewBox: `${x1 - m} ${y1 - m} ${x2 - x1 + 2 * m} ${y2 - y1 + 2 * m}`,
    };
  }, [pais.data, entidad.data, estado]);

  const cargando = pais.isLoading || (!!estado && entidad.isLoading);
  const error = pais.error || entidad.error;

  /** Coordenadas de pantalla del centro de una región, para el tooltip cuando llega con el teclado. */
  function centroEnPantalla(c: [number, number]) {
    const s = svg.current, k = caja.current;
    if (!s || !k) return { x: 0, y: 0 };
    const p = s.createSVGPoint();
    p.x = c[0]; p.y = c[1];
    const m = s.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const t = p.matrixTransform(m), r = k.getBoundingClientRect();
    return { x: t.x - r.left, y: t.y - r.top };
  }
  function mover(e: PointerEvent, r: Region) {
    const k = caja.current?.getBoundingClientRect();
    if (!k) return;
    setActiva({ cve: r.cve, nombre: r.nombre, x: e.clientX - k.left, y: e.clientY - k.top });
  }
  function tecla(e: KeyboardEvent, r: Region) {
    if ((e.key === "Enter" || e.key === " ") && alClic) { e.preventDefault(); alClic(r.cve, r.nombre); }
    if (e.key === "Escape") setActiva(null);
  }

  const ancho = caja.current?.clientWidth ?? 0;
  const resaltada = regiones.find((r) => r.cve === (activa?.cve ?? seleccion));

  return (
    <div ref={caja} className={cn("relative w-full", className)} onPointerLeave={() => setActiva(null)}>
      {error ? (
        <p className="p-6 text-sm text-peligro">{error instanceof Error ? error.message : "No se pudo cargar el mapa."}</p>
      ) : (
        <svg ref={svg} viewBox={viewBox} className={cn("w-full h-auto block transition-opacity", !compacto && "max-h-[640px]", cargando && "opacity-40")}
          role={compacto ? "img" : "group"} aria-label={estado ? `Mapa de municipios de ${entidad.data?.nombre ?? ""}` : "Mapa de México por estado"}>
          {contexto.map((e) => (
            <path key={e.cve} d={e.d} fill="hsl(var(--superficie))" stroke="hsl(var(--borde))" strokeWidth={1} vectorEffect="non-scaling-stroke" aria-hidden />
          ))}
          {regiones.map((r) => (
            <path key={r.cve} d={r.d} fill={color(r.cve)}
              // La separación entre regiones es el color de la tarjeta, no un borde dibujado.
              stroke="hsl(var(--superficie))" strokeWidth={estado ? 0.6 : 1} vectorEffect="non-scaling-stroke"
              className={cn(!compacto && "cursor-pointer outline-none")}
              tabIndex={compacto ? undefined : 0}
              role={compacto ? undefined : "button"}
              aria-label={compacto ? undefined : etiqueta?.(r.cve, r.nombre) ?? r.nombre}
              onPointerMove={compacto ? undefined : (e) => mover(e, r)}
              onFocus={compacto ? undefined : () => { const p = centroEnPantalla(r.c); setActiva({ cve: r.cve, nombre: r.nombre, ...p }); }}
              onBlur={compacto ? undefined : () => setActiva(null)}
              onClick={compacto || !alClic ? undefined : () => alClic(r.cve, r.nombre)}
              onKeyDown={compacto ? undefined : (e) => tecla(e, r)} />
          ))}
          {/* La región bajo el puntero (o elegida) se marca con un contorno de tinta encima. */}
          {resaltada && !compacto && (
            <path d={resaltada.d} fill="none" stroke="hsl(var(--texto))" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          )}
        </svg>
      )}
      {cargando && <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-tenue" />}
      {activa && tooltip && !compacto && (
        <div className="absolute z-20 pointer-events-none tarjeta shadow-lg px-3 py-2 text-xs min-w-[180px] max-w-[260px]"
          style={{
            left: Math.min(Math.max(activa.x + 14, 4), Math.max(4, ancho - 264)),
            // Cerca del borde de abajo se abre hacia arriba para no salirse de la tarjeta.
            top: activa.y > (caja.current?.clientHeight ?? 0) - 170 ? Math.max(4, activa.y - 160) : activa.y + 14,
          }}>
          {tooltip(activa.cve, activa.nombre)}
        </div>
      )}
    </div>
  );
}

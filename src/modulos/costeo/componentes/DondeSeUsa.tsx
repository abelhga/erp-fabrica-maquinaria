import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GitFork } from "lucide-react";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero } from "@/lib/formato";
import { cant, enTrozos, NOMBRE_TIPO, rutaArticulo, type TipoArticulo } from "./comun";

interface Uso {
  id: string; clave: string; nombre: string; tipo: TipoArticulo; categoria: string | null; precio: number | null;
  costo_total?: number | null; nivel: number; cantidad: number | null;
}

/**
 * "¿Dónde se usa?": todos los fabricados que lo contienen, en cualquier nivel.
 * Es lo que hay que revisar antes de cambiar una pieza de un subensamble:
 * cada equipo de esta lista cambia de costo y de precio.
 */
export function DondeSeUsa({ id, unidad }: { id: string; unidad: string }) {
  const { puede } = useSesion();
  const ir = useNavigate();
  const costos = puede("costos");
  const usos = useQuery({
    queryKey: ["costeo", "usos", id, costos],
    queryFn: async () => {
      const niveles = await q<{ articulo_id: string; nivel: number }[]>(supabase.rpc("donde_se_usa", { p_articulo: id }));
      if (!niveles.length) return [];
      const ids = niveles.map((n) => n.articulo_id);
      const cols = `id, clave, nombre, tipo, categoria, precio${costos ? ", costo_total" : ""}`;
      const [arts, directas] = await Promise.all([
        enTrozos<Omit<Uso, "nivel" | "cantidad">>(ids, (t) => supabase.from("v_catalogo").select(cols).in("id", t) as never),
        q<{ padre_id: string; cantidad_efectiva: number }[]>(supabase.from("v_bom").select("padre_id, cantidad_efectiva").eq("hijo_id", id)),
      ]);
      const nivel = new Map(niveles.map((n) => [n.articulo_id, n.nivel]));
      const cant1 = new Map<string, number>();
      for (const d of directas) cant1.set(d.padre_id, (cant1.get(d.padre_id) ?? 0) + Number(d.cantidad_efectiva));
      return arts.map((a) => ({ ...a, nivel: nivel.get(a.id) ?? 1, cantidad: cant1.get(a.id) ?? null }))
        .sort((a, b) => a.nivel - b.nivel || a.clave.localeCompare(b.clave, "es", { numeric: true }));
    },
  });

  const columnas: Columna<Uso>[] = [
    { clave: "clave", titulo: "Clave", clase: "whitespace-nowrap font-medium cifra w-28" },
    { clave: "nombre", titulo: "Nombre", clase: "min-w-[260px]" },
    { clave: "tipo", titulo: "Tipo", clase: "whitespace-nowrap", valor: (u) => NOMBRE_TIPO[u.tipo],
      celda: (u) => <Insignia tono={u.tipo === "subensamble" ? "marca" : "neutro"}>{NOMBRE_TIPO[u.tipo]}</Insignia> },
    { clave: "nivel", titulo: "Cómo lo lleva", clase: "whitespace-nowrap text-tenue", valor: (u) => u.nivel,
      celda: (u) => (u.nivel === 1 ? <span className="text-texto">directo · {cant(u.cantidad)} {unidad}</span> : `dentro de un subensamble (nivel ${u.nivel})`) },
    { clave: "costo_total", titulo: "Costo", alinear: "der", sinBusqueda: true, oculta: !costos, valor: (u) => u.costo_total ?? null, celda: (u) => dinero(u.costo_total) },
    { clave: "precio", titulo: "Precio de lista", alinear: "der", sinBusqueda: true, valor: (u) => u.precio, celda: (u) => dinero(u.precio) },
  ];

  return (
    <TablaDatos filas={usos.data} columnas={columnas} cargando={usos.isLoading} error={usos.error} claveFila={(u) => u.id}
      alClicFila={(u) => ir(rutaArticulo(u))} exportarComo="donde-se-usa" placeholder="Buscar equipo…"
      vacio={{ icono: GitFork, titulo: "No se usa en ninguna lista", texto: "Ningún equipo ni subensamble lo lleva. Se puede cambiar sin afectar a nadie." }} />
  );
}

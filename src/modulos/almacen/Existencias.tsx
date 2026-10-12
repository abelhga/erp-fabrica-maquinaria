import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Boxes, PackageOpen, Store, Truck, Warehouse } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Kpi } from "@/components/ui/kpi";
import { Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { useTiempoReal } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { nombreCorto, todasLasFilas, useAlmacenes } from "./componentes/comun";
import { DetalleExistencia } from "./componentes/DetalleExistencia";

export interface FilaExistencia {
  articulo_id: string; clave: string; nombre: string; unidad: string; tipo: string; es_importado: boolean;
  en_planta: number; en_mercadolibre: number; reservado: number; en_transito: number; por_almacen: Record<string, number> | null;
  // El tránsito de importación por tramo y la llegada a planta según la etapa real del embarque.
  en_produccion?: number; en_mar?: number; en_puerto?: number; llegada_estimada?: string | null;
}

type Vista = "con" | "todos" | "apartados" | "transito" | "negativos";

export default function Existencias() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [vista, setVista] = useState<Vista>("con");
  const almacenFiltro = params.get("almacen") ?? "";
  const seleccion = params.get("articulo");
  const verCostos = puede("costos", 1);
  // El tránsito sale de las órdenes de compra; quien no las ve recibiría ceros que parecen reales.
  const verTransito = puede("compras", 1) || puede("finanzas", 1);

  const almacenes = useAlmacenes();
  const datos = useQuery({
    queryKey: ["v_existencias"],
    queryFn: () => todasLasFilas<FilaExistencia>((d, h) => supabase.from("v_existencias")
      .select("articulo_id, clave, nombre, unidad, tipo, es_importado, en_planta, en_mercadolibre, reservado, en_transito, por_almacen, en_produccion, en_mar, en_puerto, llegada_estimada")
      .order("nombre").order("articulo_id").range(d, h)),
  });
  const costos = useQuery({
    queryKey: ["costos_calculados", "existencias"],
    enabled: verCostos,
    queryFn: () => todasLasFilas<{ articulo_id: string; costo_total: number }>((d, h) =>
      supabase.from("costos_calculados").select("articulo_id, costo_total").order("articulo_id").range(d, h)),
  });
  useTiempoReal("existencias", [["v_existencias"]]);

  const costoDe = useMemo(() => new Map((costos.data ?? []).map((c) => [c.articulo_id, Number(c.costo_total)])), [costos.data]);
  const filas = useMemo(() => (datos.data ?? []).map((f) => ({
    ...f, en_planta: Number(f.en_planta), en_mercadolibre: Number(f.en_mercadolibre), reservado: Number(f.reservado),
    en_transito: Number(f.en_transito), disponible: Number(f.en_planta) - Number(f.reservado),
    valor: verCostos ? (Number(f.en_planta) + Number(f.en_mercadolibre)) * (costoDe.get(f.articulo_id) ?? 0) : null,
  })), [datos.data, costoDe, verCostos]);

  const delAlmacen = (f: FilaExistencia, nombre: string) => Number(f.por_almacen?.[nombre] ?? 0);
  const visibles = filas.filter((f) => {
    if (almacenFiltro && delAlmacen(f, almacenFiltro) === 0) return false;
    switch (vista) {
      case "con": return f.en_planta !== 0 || f.en_mercadolibre !== 0;
      case "apartados": return f.reservado > 0;
      case "transito": return f.en_transito > 0;
      case "negativos": return Object.values(f.por_almacen ?? {}).some((v) => Number(v) < 0);
      default: return true;
    }
  });

  const total = (fn: (f: (typeof filas)[number]) => number) => filas.reduce((s, f) => s + fn(f), 0);
  const conExistencia = filas.filter((f) => f.en_planta > 0).length;

  const columnas: Columna<(typeof filas)[number]>[] = [
    { clave: "clave", titulo: "Clave", clase: "whitespace-nowrap text-tenue text-xs" },
    {
      clave: "nombre", titulo: "Artículo", clase: "min-w-[280px]",
      celda: (f) => (
        <div className="min-w-0">
          <p>{f.nombre}</p>
          <p className="text-xs text-tenue">{f.unidad}{f.es_importado && <> · <span className="text-info">importado</span></>}</p>
        </div>
      ),
    },
    { clave: "en_planta", titulo: "En planta", alinear: "der", sinBusqueda: true, clase: "px-2", celda: (f) => numero(f.en_planta) },
    {
      clave: "reservado", titulo: "Apartado", alinear: "der", sinBusqueda: true, clase: "px-2",
      celda: (f) => f.reservado > 0 ? <span className="text-aviso">{numero(f.reservado)}</span> : <span className="text-tenue/50">·</span>,
    },
    {
      clave: "en_transito", titulo: "Tránsito", alinear: "der", sinBusqueda: true, oculta: !verTransito, clase: "px-2",
      celda: (f) => f.en_transito > 0 ? <CeldaTransito f={f} /> : <span className="text-tenue/50">·</span>,
    },
    {
      clave: "disponible", titulo: "Disponible", alinear: "der", sinBusqueda: true, clase: "px-2 border-r border-borde bg-marca-suave/30",
      celda: (f) => <span className={cn("font-semibold", f.disponible < 0 ? "text-peligro" : f.disponible === 0 ? "text-tenue" : "")}>{numero(f.disponible)}</span>,
    },
    ...(almacenes.data ?? []).map<Columna<(typeof filas)[number]>>((a) => ({
      clave: `al-${a.id}`, titulo: nombreCorto(a.nombre), alinear: "der", sinBusqueda: true,
      clase: cn("px-2 text-tenue", almacenFiltro === a.nombre && "bg-marca-suave/50 text-texto", !a.disponible_para_planta && "border-l border-borde"),
      valor: (f) => delAlmacen(f, a.nombre),
      celda: (f) => {
        const v = delAlmacen(f, a.nombre);
        return v === 0 ? <span className="text-tenue/50">·</span> : <span className={cn(v < 0 && "text-peligro font-medium")}>{numero(v)}</span>;
      },
    })),
    { clave: "valor", titulo: "Valor", alinear: "der", sinBusqueda: true, oculta: !verCostos, celda: (f) => f.valor ? dinero(f.valor) : "—" },
  ];

  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("articulo", id); else p.delete("articulo");
    setParams(p, { replace: true });
  };

  return (
    <Pagina
      titulo="Existencias"
      descripcion="Lo que hay en cada almacén, lo apartado para órdenes y ventas, y lo que viene en camino."
      ancho="max-w-[1500px]"
      acciones={puede("inventario", 2) && (
        <button onClick={() => ir("/almacen/movimientos")} className="inline-flex items-center gap-2 h-9 rounded-lg border border-borde bg-superficie px-4 text-sm font-medium hover:bg-fondo">
          <ArrowLeftRight className="h-4 w-4" /> Registrar entrada o salida
        </button>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Artículos con existencia" valor={numero(conExistencia)} icono={Boxes} tono="marca"
          detalle={`de ${numero(filas.length)} que controla el almacén`} />
        {verCostos ? (
          <Kpi titulo="Valor en planta y ML" valor={dineroCompacto(total((f) => f.valor ?? 0))} icono={Warehouse} tono="neutro"
            detalle="A costo vigente (sin IVA)" />
        ) : (
          <Kpi titulo="Piezas en planta" valor={numero(total((f) => Math.max(f.en_planta, 0)))} icono={Warehouse} tono="neutro"
            detalle="Suma de todas las unidades" />
        )}
        <Kpi titulo="Apartado" valor={numero(filas.filter((f) => f.reservado > 0).length)} icono={PackageOpen} tono="aviso"
          detalle="artículos con material reservado" alClic={() => setVista("apartados")} />
        <Kpi titulo="En Mercado Libre Full" valor={numero(filas.filter((f) => f.en_mercadolibre > 0).length)} icono={Store} tono="info"
          detalle={`${numero(total((f) => f.en_mercadolibre))} piezas que no cuentan para planta`} />
      </div>

      <TablaDatos
        filas={visibles}
        columnas={columnas}
        cargando={datos.isLoading || almacenes.isLoading}
        error={datos.error}
        claveFila={(f) => f.articulo_id}
        alClicFila={(f) => abrir(f.articulo_id)}
        placeholder="Buscar por clave o nombre…"
        exportarComo="existencias"
        compacta
        claseFila={(f) => (f.articulo_id === seleccion ? "bg-marca-suave/60" : undefined)}
        filtros={
          <>
            <Filtro<Vista>
              valor={vista} alCambiar={setVista}
              opciones={[
                { valor: "con", texto: "Con existencia" },
                { valor: "apartados", texto: "Apartados" },
                ...(verTransito ? [{ valor: "transito" as Vista, texto: "En tránsito" }] : []),
                { valor: "negativos", texto: "Negativos" },
                { valor: "todos", texto: "Todos" },
              ]}
            />
            <Seleccion className="w-auto h-8 text-xs" value={almacenFiltro} aria-label="Almacén"
              onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) p.set("almacen", e.target.value); else p.delete("almacen"); setParams(p, { replace: true }); }}>
              <option value="">Todos los almacenes</option>
              {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
            </Seleccion>
          </>
        }
        vacio={{
          icono: Truck, titulo: vista === "con" ? "No hay existencias con este filtro" : "Nada que mostrar",
          texto: almacenFiltro ? `Prueba con "Todos los almacenes" o con otro filtro.` : "Cambia el filtro o busca por otra palabra.",
        }}
        pie={
          <p className="text-xs text-tenue">
            <b>Disponible</b> = en planta − apartado. Lo que está en <Insignia className="mx-1">ML Full</Insignia> existe pero no se puede usar en planta.
            {verTransito && " En tránsito: órdenes de compra enviadas que no han llegado."}
          </p>
        }
      />

      <DetalleExistencia
        articuloId={seleccion}
        fila={filas.find((f) => f.articulo_id === seleccion) ?? null}
        alCerrar={() => abrir(null)}
      />
    </Pagina>
  );
}

/** Cuánto del tránsito sigue con el proveedor, en el mar o en puerto, y cuándo llega a planta. */
function CeldaTransito({ f }: { f: FilaExistencia }) {
  const tramos = [
    [Number(f.en_produccion ?? 0), "con el proveedor"], [Number(f.en_mar ?? 0), "en el mar"], [Number(f.en_puerto ?? 0), "en puerto"],
  ].filter(([n]) => Number(n) > 0).map(([n, t]) => `${numero(Number(n))} ${t}`);
  return (
    <span className="text-info" title={tramos.length ? tramos.join(" · ") : undefined}>
      {numero(f.en_transito)}
      {f.llegada_estimada && <span className="block text-[11px] text-tenue whitespace-nowrap">llega {fecha(f.llegada_estimada)}</span>}
    </span>
  );
}

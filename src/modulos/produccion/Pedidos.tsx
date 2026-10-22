import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPlus, PackageCheck, Printer, ShoppingCart } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Lateral } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, numero } from "@/lib/formato";
import { ESTADO_PEDIDO, CANAL, type EstadoPedido, type Canal } from "@/modulos/ventas/comun";
import { BotonEntregar, RecuadroEntrega, abrirHojaSalida, useHojaSalida } from "@/modulos/ventas/componentes/EntregaPedido";
import { BarraAvance, InsigniaCompromiso } from "./componentes/piezas";
import { ESTADO_OP, abreviarEquipo } from "./componentes/util";
import { CLAVE } from "./componentes/datos";
import { GanttCompacto } from "./Gantt";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * Los pedidos vistos desde la planta: qué se vendió, para cuándo y cómo va cada equipo,
 * sin un solo monto (v_pedidos_produccion sale de pedidos_basicos()). Antes la gerencia
 * solo veía el pedido desde cada orden y no sabía qué faltaba por ordenar.
 */
interface OrdenDePartida { id: string; folio: string; estado: keyof typeof ESTADO_OP; serie: string | null; avance: number }
interface Partida {
  linea_id: string; articulo_id: string | null; clave: string; titulo: string; cantidad: number; unidad: string;
  fabrica: boolean; tiene_lista: boolean; ordenes: OrdenDePartida[];
}
interface PedidoPlanta {
  id: string; folio: string; cliente: string | null; vendedor: string | null; canal: Canal;
  estado: EstadoPedido; fecha: string; fecha_compromiso: string | null; dias_restantes: number | null; entregado_en: string | null;
  partidas: Partida[]; equipos: number; sin_orden: number; ordenes: number; ordenes_terminadas: number; avance: number | null;
  /** Órdenes del pedido que no cuelgan de una partida (las que vinieron de la hoja de Luis). */
  ordenes_sueltas: (OrdenDePartida & { equipo: string; clave: string })[];
}
interface OrdenStock { id: string; folio: string; articulo_id: string; estado: keyof typeof ESTADO_OP; numero_serie: string | null }

type FiltroPed = "activos" | "por_ordenar" | "listos" | "entregados" | "todos";
const ACTIVOS: EstadoPedido[] = ["confirmado", "en_produccion", "listo"];
const CLAVE_PED = ["v_pedidos_produccion"];

export default function PedidosPlanta() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const filtro = (params.get("filtro") as FiltroPed) ?? "activos";
  const pedidoId = params.get("pedido");

  const lista = useQuery({
    queryKey: CLAVE_PED,
    queryFn: () => q<PedidoPlanta[]>(supabase.from("v_pedidos_produccion").select("*").order("fecha", { ascending: false }).limit(2000)),
  });
  // Equipos fabricados (o en proceso) sin pedido: se pueden asignar a quien los compró.
  const stock = useQuery({
    queryKey: [...CLAVE, "stock_libre"],
    queryFn: () => q<OrdenStock[]>(supabase.from("ordenes_produccion").select("id, folio, articulo_id, estado, numero_serie")
      .is("pedido_id", null).not("estado", "in", "(entregada,cancelada)").order("folio")),
  });

  const hace60 = useMemo(() => new Date(Date.now() - 60 * 86_400_000).toISOString(), []);
  const filas = useMemo(() => {
    const f = lista.data ?? [];
    switch (filtro) {
      case "activos": return f.filter((p) => ACTIVOS.includes(p.estado));
      case "por_ordenar": return f.filter((p) => ACTIVOS.includes(p.estado) && p.sin_orden > 0);
      case "listos": return f.filter((p) => p.estado === "listo");
      case "entregados": return f.filter((p) => p.estado === "entregado" && (p.entregado_en ?? p.fecha) >= hace60.slice(0, 10));
      default: return f;
    }
  }, [lista.data, filtro, hace60]);

  const cuenta = (pred: (p: PedidoPlanta) => boolean) => lista.data?.filter(pred).length;
  const opciones: { valor: FiltroPed; texto: string; cuenta?: number; explica?: string }[] = [
    { valor: "activos", texto: "Activos", cuenta: cuenta((p) => ACTIVOS.includes(p.estado)) },
    { valor: "por_ordenar", texto: "Sin orden", cuenta: cuenta((p) => ACTIVOS.includes(p.estado) && p.sin_orden > 0), explica: GLOSARIO.sinOrden },
    { valor: "listos", texto: "Listos para entregar", cuenta: cuenta((p) => p.estado === "listo") },
    { valor: "entregados", texto: "Entregados (60 días)" },
    { valor: "todos", texto: "Todos" },
  ];

  const abierto = useMemo(() => lista.data?.find((p) => p.id === pedidoId) ?? null, [lista.data, pedidoId]);
  const abrir = (id: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (id) n.set("pedido", id); else n.delete("pedido"); return n; });

  const columnas: Columna<PedidoPlanta>[] = [
    {
      clave: "folio", titulo: "Pedido",
      celda: (p) => (
        <div className="whitespace-nowrap">
          <p className="font-medium cifra">{p.folio}</p>
          {p.canal !== "directo" && <p className="text-[11px] text-tenue">{CANAL[p.canal]}</p>}
        </div>
      ),
    },
    { clave: "cliente", titulo: "Cliente", celda: (p) => <span className="block max-w-[220px] truncate">{p.cliente ?? "—"}</span> },
    { clave: "vendedor", titulo: "Vendedor", clase: "text-tenue", celda: (p) => <span className="block max-w-[140px] truncate">{p.vendedor ?? "—"}</span> },
    {
      clave: "equipos", titulo: "Lleva", valor: (p) => [...p.partidas.map((x) => x.titulo), ...p.ordenes_sueltas.map((o) => o.equipo)].join(" "),
      celda: (p) => {
        const equipos = [...p.partidas.filter((x) => x.fabrica).map((x) => `${numero(x.cantidad)} × ${x.titulo}`), ...p.ordenes_sueltas.map((o) => abreviarEquipo(o.equipo))];
        const otras = p.partidas.filter((x) => !x.fabrica);
        return (
          <div className="min-w-[220px] max-w-[320px]">
            <p className="truncate" title={equipos.join(" · ")}>{equipos.join(" · ") || <span className="text-tenue">Solo componentes</span>}</p>
            {otras.length > 0 && <p className="text-xs text-tenue truncate">+ {otras.map((x) => x.titulo).join(" · ")}</p>}
          </div>
        );
      },
    },
    {
      clave: "fecha_compromiso", titulo: "Compromiso", sinBusqueda: true, valor: (p) => p.fecha_compromiso ?? "",
      celda: (p) => p.fecha_compromiso ? <InsigniaCompromiso dias={p.dias_restantes} fechaCompromiso={p.fecha_compromiso} cerrada={!ACTIVOS.includes(p.estado)} corta /> : <span className="text-tenue">—</span>,
    },
    {
      clave: "ordenes", titulo: "Órdenes", sinBusqueda: true, valor: (p) => p.avance ?? -1, explica: GLOSARIO.avanceOrden,
      celda: (p) => (
        <div className="min-w-[120px]">
          {p.ordenes > 0 ? (
            <>
              <p className="text-xs cifra">{p.ordenes_terminadas} de {p.ordenes} terminadas · {p.avance ?? 0}%</p>
              <BarraAvance valor={p.avance ?? 0} />
            </>
          ) : p.equipos === 0 ? <span className="text-xs text-tenue">No se fabrica</span> : null}
          {p.sin_orden > 0 && ACTIVOS.includes(p.estado) && <Insignia tono="aviso" className="mt-1">{p.sin_orden} sin orden</Insignia>}
        </div>
      ),
    },
    { clave: "estado", titulo: "Estado", valor: (p) => ESTADO_PEDIDO[p.estado].texto, celda: (p) => <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Insignia> },
  ];

  return (
    <Pagina titulo="Pedidos" descripcion="Lo que se vendió y cómo va cada equipo en el taller: cliente, compromiso, equipos y sus órdenes. Sin montos.">
      <TablaDatos
        filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(p) => p.id}
        alClicFila={(p) => abrir(p.id)} exportarComo="pedidos-planta" placeholder="Buscar pedido, cliente, vendedor o equipo…"
        filtros={<Filtro opciones={opciones} valor={filtro} alCambiar={(v) => setParams(v === "activos" ? {} : { filtro: v }, { replace: true })} />}
        vacio={{ icono: ShoppingCart, titulo: filtro === "por_ordenar" ? "Todos los equipos vendidos tienen orden" : "No hay pedidos con este filtro",
          texto: filtro === "por_ordenar" ? "Cuando ventas confirme un pedido con equipos, aparece aquí hasta que se creen sus órdenes." : "Prueba con otro filtro." }}
      />
      <Lateral abierto={!!abierto} alCambiar={(v) => !v && abrir(null)} ancho="max-w-2xl"
        titulo={abierto ? `${abierto.folio} · ${abierto.cliente ?? ""}` : ""}
        subtitulo={abierto && <>{ESTADO_PEDIDO[abierto.estado].texto} · {abierto.vendedor ?? "sin vendedor"} · pedido el {fecha(abierto.fecha)}</>}>
        {abierto && <DetallePedido p={abierto} stock={stock.data ?? []} gerencia={puede("produccion", 3)} />}
      </Lateral>
    </Pagina>
  );
}

function DetallePedido({ p, stock, gerencia }: { p: PedidoPlanta; stock: OrdenStock[]; gerencia: boolean }) {
  const crear = useAccion(() => q<number>(supabase.rpc("ordenes_desde_pedido", { p_pedido: p.id })), {
    exito: (n) => n ? `${n} orden(es) creadas para ${p.folio}` : "No había equipos con lista de materiales por ordenar",
    invalidar: [CLAVE_PED, CLAVE],
  });
  const asignar = useAccion((a: { op: string; linea: string }) => q(supabase.rpc("asignar_orden_stock", { p_op: a.op, p_linea: a.linea })), {
    exito: "Equipo de stock asignado al pedido", invalidar: [CLAVE_PED, CLAVE],
  });
  const activo = ACTIVOS.includes(p.estado);
  // Almacén entrega desde aquí: quién puede lo dice la base.
  const hoja = useHojaSalida(p.id);
  const navegar = useNavigate();
  const ordenes = [...p.partidas.flatMap((x) => x.ordenes), ...p.ordenes_sueltas];
  const enTaller = ordenes.filter((o) => o.estado !== "entregada" && o.estado !== "cancelada");
  return (
    <div className="space-y-4">
      {p.estado !== "cancelado" && !hoja.data?.salidas.some((s) => !s.anulada_en) && (
        <div className="flex flex-wrap items-center gap-2">
          <Boton variante="secundario" tamano="sm" onClick={() => abrirHojaSalida(p.id)} data-explain={GLOSARIO.hojaSalida} data-explain-title="Hoja de salida">
            <Printer className="h-3.5 w-3.5" />Hoja de salida
          </Boton>
          {activo && hoja.data?.puede_entregar && (
            <BotonEntregar pedido={p.id} invalidar={[CLAVE_PED, CLAVE]} antes={() => {
              const pendientes = p.ordenes - p.ordenes_terminadas;
              return pendientes <= 0 || confirm(`Hay ${pendientes} orden(es) de producción sin terminar. ¿Entregar de todos modos?`);
            }} />
          )}
        </div>
      )}
      {hoja.data && <RecuadroEntrega hoja={hoja.data} invalidar={[CLAVE_PED, CLAVE]} />}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-tenue">Compromiso</span>
        {p.fecha_compromiso ? <InsigniaCompromiso dias={p.dias_restantes} fechaCompromiso={p.fecha_compromiso} cerrada={!activo} /> : <span>sin fecha</span>}
        {gerencia && activo && p.sin_orden > 0 && (
          <Boton tamano="sm" className="ml-auto" onClick={() => crear.mutate(undefined)} cargando={crear.isPending}>
            <ClipboardPlus className="h-3.5 w-3.5" /> Crear las órdenes que faltan
          </Boton>
        )}
      </div>
      {p.partidas.length === 0 && p.ordenes_sueltas.length === 0 && <p className="text-sm text-tenue">El pedido no tiene partidas capturadas.</p>}
      <ul className="space-y-2">
        {p.partidas.map((x) => {
          const faltan = x.fabrica ? Math.max(Math.ceil(Number(x.cantidad)) - x.ordenes.length, 0) : 0;
          const deStock = faltan > 0 ? stock.filter((s) => s.articulo_id === x.articulo_id) : [];
          return (
            <li key={x.linea_id} className="rounded-lg border border-borde p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{numero(x.cantidad)} {x.unidad} · {x.titulo}</p>
                  <p className="text-xs text-tenue cifra">{x.clave}</p>
                </div>
                {!x.fabrica ? <Insignia>Componente</Insignia>
                  : faltan > 0 ? <span data-explain={GLOSARIO.sinOrden} data-explain-title="Sin orden"><Insignia tono="aviso">{faltan} sin orden</Insignia></span>
                  : <Insignia tono="ok">Con orden</Insignia>}
              </div>
              {x.ordenes.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {x.ordenes.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 text-sm">
                      <Link to={`/produccion/ordenes/${o.id}`} className="font-medium cifra text-marca-texto hover:underline whitespace-nowrap">{o.folio}</Link>
                      {o.serie && <span className="text-xs text-tenue cifra">{o.serie}</span>}
                      <Insignia tono={ESTADO_OP[o.estado]?.tono}>{ESTADO_OP[o.estado]?.texto ?? o.estado}</Insignia>
                      <div className="flex-1 min-w-[80px]"><BarraAvance valor={o.avance} /></div>
                      <span className="text-xs cifra w-9 text-right">{o.avance}%</span>
                    </li>
                  ))}
                </ul>
              )}
              {x.fabrica && faltan > 0 && !x.tiene_lista && (
                <p className="mt-2 text-xs text-aviso">Este equipo no tiene lista de materiales: ingeniería la captura antes de crear su orden.</p>
              )}
              {gerencia && activo && deStock.length > 0 && (
                <div className="mt-2 rounded-md bg-fondo px-3 py-2 text-sm" data-explain={GLOSARIO.asignarStock} data-explain-title="De stock">
                  <p className="text-xs text-tenue mb-1.5"><PackageCheck className="inline h-3.5 w-3.5 mr-1" />Hay {deStock.length} de este equipo para stock:</p>
                  <div className="flex flex-wrap gap-2">
                    {deStock.map((s) => (
                      <Boton key={s.id} tamano="sm" variante="secundario" cargando={asignar.isPending}
                             onClick={() => asignar.mutate({ op: s.id, linea: x.linea_id })}>
                        Usar {s.folio}{s.numero_serie ? ` · ${s.numero_serie}` : ""} ({ESTADO_OP[s.estado]?.texto ?? s.estado})
                      </Boton>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {p.ordenes_sueltas.length > 0 && (
        <div className="rounded-lg border border-borde p-3" data-explain={GLOSARIO.ordenesSueltas} data-explain-title="Equipos en el taller">
          <p className="font-medium mb-2">Equipos en el taller <span className="text-tenue font-normal text-sm">· {p.ordenes_sueltas.length} orden(es)</span></p>
          <ul className="space-y-2">
            {p.ordenes_sueltas.map((o) => (
              <li key={o.id} className="text-sm">
                <p className="truncate" title={o.equipo}>{abreviarEquipo(o.equipo)} <span className="text-xs text-tenue cifra">{o.clave}</span></p>
                <div className="flex items-center gap-3">
                  <Link to={`/produccion/ordenes/${o.id}`} className="font-medium cifra text-marca-texto hover:underline whitespace-nowrap">{o.folio}</Link>
                  {o.serie && <span className="text-xs text-tenue cifra">{o.serie}</span>}
                  <Insignia tono={ESTADO_OP[o.estado]?.tono}>{ESTADO_OP[o.estado]?.texto ?? o.estado}</Insignia>
                  <div className="flex-1 min-w-[80px]"><BarraAvance valor={o.avance} /></div>
                  <span className="text-xs cifra w-9 text-right">{o.avance}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {enTaller.length > 0 && (
        <div data-explain={GLOSARIO.planTaller} data-explain-title="Plan del taller">
          <p className="font-medium mb-2">Plan del taller</p>
          <GanttCompacto ordenes={enTaller.map((o) => o.id)} alAbrir={(op) => navegar(`/produccion/ordenes/${op}`)} />
        </div>
      )}
    </div>
  );
}

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardList, FilePlus2, Flame, Minus, PackagePlus } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { fecha } from "@/lib/formato";
import { CLAVE, useProduccionEnVivo, useTablero, type OrdenTablero } from "./componentes/datos";
import { BarraAvance, ChipEtapa, InsigniaCompromiso } from "./componentes/piezas";
import { DialogoDesdePedido, DialogoOrdenStock } from "./componentes/DialogosCrear";
import { ESTADO_OP, abreviarEquipo, textoDias } from "./componentes/util";

type FiltroOrdenes = "abiertas" | "planeada" | "liberada" | "en_proceso" | "terminada" | "atrasadas" | "faltantes";

const PASA: Record<FiltroOrdenes, (o: OrdenTablero) => boolean> = {
  abiertas: (o) => o.estado !== "terminada",
  planeada: (o) => o.estado === "planeada",
  liberada: (o) => o.estado === "liberada",
  en_proceso: (o) => o.estado === "en_proceso",
  terminada: (o) => o.estado === "terminada",
  atrasadas: (o) => o.atrasada,
  faltantes: (o) => o.materiales_faltantes > 0,
};

function Paso({ hecho, texto, titulo }: { hecho: boolean; texto: string; titulo: string }) {
  return (
    <span className={hecho ? "inline-flex items-center gap-0.5 text-ok" : "inline-flex items-center gap-0.5 text-tenue/70"} title={`${titulo}: ${hecho ? "hecho" : "pendiente"}`}>
      {hecho ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}{texto}
    </span>
  );
}

export default function Ordenes() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  useProduccionEnVivo();
  const tablero = useTablero();
  const filtro = (params.get("filtro") as FiltroOrdenes) in PASA ? (params.get("filtro") as FiltroOrdenes) : "abiertas";
  const nueva = params.get("nueva");
  const crea = puede("produccion", 2);
  const porProducir = useQuery({
    queryKey: [...CLAVE, "por_producir", "cuenta"],
    enabled: crea,
    queryFn: async () => {
      const { data, error } = await supabase.from("v_pedidos_por_producir").select("unidades");
      if (error) throw new Error(error.message);
      return (data ?? []).filter((p: { unidades: number }) => p.unidades > 0).length;
    },
  });

  const cambiar = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const filas = (tablero.data ?? []).filter(PASA[filtro]);
  const cuenta = (f: FiltroOrdenes) => (tablero.data ?? []).filter(PASA[f]).length;

  const columnas = useMemo<Columna<OrdenTablero>[]>(() => [
    {
      clave: "folio", titulo: "Orden", valor: (o) => `${o.folio} ${o.numero_serie ?? ""}`,
      celda: (o) => (
        <div className="whitespace-nowrap">
          <p className="font-medium cifra flex items-center gap-1">{o.folio}{o.prioridad === 1 && <Flame className="h-3.5 w-3.5 text-peligro" aria-label="Urgente" />}</p>
          <p className="text-xs text-tenue cifra">{o.numero_serie ?? "sin serie"}</p>
          <Insignia tono={ESTADO_OP[o.estado].tono} className="mt-1">{ESTADO_OP[o.estado].texto}</Insignia>
        </div>
      ),
    },
    {
      clave: "equipo", titulo: "Equipo", valor: (o) => o.equipo,
      celda: (o) => (
        <div className="max-w-[210px]">
          <p className="truncate" title={o.equipo}>{abreviarEquipo(o.equipo)}{o.cantidad > 1 && ` × ${o.cantidad}`}</p>
          <p className="text-xs text-tenue">{o.clave}</p>
        </div>
      ),
    },
    {
      clave: "cliente", titulo: "Cliente", valor: (o) => (o.para_stock ? "Para stock" : o.cliente),
      celda: (o) => (
        <div className="max-w-[150px]">
          <p className="truncate">{o.para_stock ? <span className="text-tenue">Para stock</span> : o.cliente ?? "—"}</p>
          {o.pedido_folio && <p className="text-xs text-tenue">{o.pedido_folio}</p>}
        </div>
      ),
    },
    { clave: "estado", titulo: "Estado", oculta: true, valor: (o) => ESTADO_OP[o.estado].texto },
    {
      clave: "fecha_compromiso", titulo: "Compromiso", valor: (o) => o.fecha_compromiso, sinBusqueda: true,
      celda: (o) => (
        <div className="whitespace-nowrap">
          <p className="cifra">{fecha(o.fecha_compromiso)}</p>
          {o.estado !== "terminada" && <InsigniaCompromiso dias={o.dias_restantes} fechaCompromiso={o.fecha_compromiso} corta />}
        </div>
      ),
    },
    {
      clave: "avance", titulo: "Avance y etapa", valor: (o) => Number(o.avance), sinBusqueda: true,
      celda: (o) => (
        <div className="w-40 space-y-1">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">{o.etapas_activas.length ? o.etapas_activas.map((e) => <ChipEtapa key={e.id} nombre={e.estado === "pausada" ? `${e.nombre} (pausada)` : e.nombre} color={e.color} estado={e.estado} />)
            : o.siguiente_etapa && o.estado !== "terminada" ? <ChipEtapa nombre={`Sigue: ${o.siguiente_etapa}`} color={o.siguiente_etapa_color} className="text-tenue" /> : null}</div>
          <div className="flex items-center gap-2"><BarraAvance valor={o.avance} /><span className="text-xs cifra w-9 text-right">{o.avance}%</span></div>
        </div>
      ),
    },
    { clave: "etapa", titulo: "Etapa", oculta: true, valor: (o) => o.etapa_actual ?? o.siguiente_etapa },
    {
      clave: "material", titulo: "Material y validación", valor: (o) => o.materiales_faltantes, sinBusqueda: true,
      celda: (o) => (
        <div className="space-y-1 min-w-[140px]">
          {o.estado === "terminada" ? null : o.materiales_faltantes > 0 ? (
            <div>
              <Insignia tono={o.faltantes_sin_pedir > 0 ? "peligro" : "aviso"}>{o.materiales_faltantes} con faltante</Insignia>
              <p className="text-xs text-tenue mt-0.5">{o.faltantes_sin_pedir > 0 ? `${o.faltantes_sin_pedir} sin pedir a compras` : "Todo pedido a compras"}</p>
            </div>
          ) : o.material_apartado ? <Insignia tono="ok">Material completo</Insignia> : <span className="text-xs text-tenue">Sin apartar</span>}
          <div className="flex gap-2 text-xs">
            <Paso hecho={o.revisada_ingenieria} texto="Ing." titulo="Ingeniería revisó" />
            <Paso hecho={o.material_apartado} texto="Apartado" titulo="Material apartado" />
            <Paso hecho={o.revisada_almacen} texto="Alm." titulo="Almacén revisó" />
          </div>
        </div>
      ),
    },
    { clave: "validacion", titulo: "Validación", oculta: true, valor: (o) => [o.revisada_ingenieria && "Ingeniería", o.material_apartado && "Apartado", o.revisada_almacen && "Almacén"].filter(Boolean).join(", ") },
    { clave: "dias", titulo: "Días", oculta: true, valor: (o) => textoDias(o.dias_restantes) },
    { clave: "compromiso_texto", titulo: "Fecha compromiso", oculta: true, valor: (o) => fecha(o.fecha_compromiso) },
  ], []);

  return (
    <Pagina
      titulo="Órdenes y material"
      descripcion="Cada orden con su lista de materiales congelada, lo apartado, lo que falta y en qué etapa va."
      ancho="max-w-[1500px]"
      acciones={crea && <>
        <Boton variante="secundario" onClick={() => cambiar("nueva", "stock")}><PackagePlus className="h-4 w-4" />Orden para stock</Boton>
        <Boton onClick={() => cambiar("nueva", "pedido")}>
          <FilePlus2 className="h-4 w-4" />Crear órdenes desde pedido
          {!!porProducir.data && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs cifra">{porProducir.data}</span>}
        </Boton>
      </>}
    >
      <TablaDatos
        filas={filas}
        columnas={columnas}
        cargando={tablero.isLoading}
        error={tablero.error}
        claveFila={(o) => o.id}
        alClicFila={(o) => ir(`/produccion/ordenes/${o.id}`)}
        claseFila={(o) => (o.atrasada ? "bg-peligro-suave/40" : undefined)}
        placeholder="Folio, serie, equipo, cliente o pedido…"
        exportarComo="ordenes-produccion"
        filtros={
          <Filtro<FiltroOrdenes>
            valor={filtro}
            alCambiar={(v) => cambiar("filtro", v === "abiertas" ? null : v)}
            opciones={[
              { valor: "abiertas", texto: "Abiertas", cuenta: cuenta("abiertas") },
              { valor: "planeada", texto: "Planeadas", cuenta: cuenta("planeada") },
              { valor: "liberada", texto: "Liberadas", cuenta: cuenta("liberada") },
              { valor: "en_proceso", texto: "En proceso", cuenta: cuenta("en_proceso") },
              { valor: "terminada", texto: "Terminadas", cuenta: cuenta("terminada") },
              { valor: "atrasadas", texto: "Atrasadas", cuenta: cuenta("atrasadas") },
              { valor: "faltantes", texto: "Con faltantes", cuenta: cuenta("faltantes") },
            ]}
          />
        }
        vacio={{
          icono: ClipboardList,
          titulo: filtro === "abiertas" ? "No hay órdenes abiertas" : "Ninguna orden con este filtro",
          texto: crea ? "Crea las órdenes de un pedido confirmado o una orden para stock." : "Cuando producción cree órdenes, aparecerán aquí.",
          accion: crea && filtro === "abiertas" ? <Boton onClick={() => cambiar("nueva", "pedido")}>Crear órdenes desde pedido</Boton> : undefined,
        }}
      />
      {crea && <>
        <DialogoDesdePedido abierto={nueva === "pedido"} alCambiar={(v) => cambiar("nueva", v ? "pedido" : null)} />
        <DialogoOrdenStock abierto={nueva === "stock"} alCambiar={(v) => cambiar("nueva", v ? "stock" : null)} />
      </>}
    </Pagina>
  );
}

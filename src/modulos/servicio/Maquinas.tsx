import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, CalendarCheck, CheckCircle2, Hand, Plus, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas, ContenidoPestana, ListaPestanas } from "@/components/ui/pestanas";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, hace, numero } from "@/lib/formato";
import { CLAVE, ESTADO_MAQUINA, ESTADO_MTO, TIPO_MAQUINA, horas, useMaquinas, useServicioEnVivo, type Maquina, type OrdenMto, type Plan } from "./datos";
import { EnlaceBoton, InsigniaMaquina, InsigniaMto, usePermisosServicio } from "./componentes/piezas";
import { LateralMantenimiento } from "./componentes/LateralMantenimiento";
import { DialogoMaquina } from "./componentes/DialogoMaquina";

type Vista = "todas" | "problemas" | "herramienta" | "prestadas";

const SITUACION = {
  vencido: { texto: "Vencido", tono: "peligro" },
  por_vencer: { texto: "Por vencer", tono: "aviso" },
  al_dia: { texto: "Al día", tono: "ok" },
} as const;

/**
 * Catálogo de máquinas y herramienta propias, las órdenes de mantenimiento abiertas
 * y los planes preventivos. Antes: una foto en un canal que se abandonó dos veces.
 */
export default function Maquinas() {
  useServicioEnVivo(["maquinas", "ordenes_mantenimiento", "resguardos", "servicio_materiales"]);
  const ir = useNavigate();
  const p = usePermisosServicio();
  const [params, setParams] = useSearchParams();
  const pestana = params.get("pestana") ?? "maquinas";
  const [vista, setVista] = useState<Vista>("todas");
  const [orden, setOrden] = useState<string | null>(params.get("orden"));
  const [nueva, setNueva] = useState(false);
  const maquinas = useMaquinas();
  const ordenes = useQuery({
    queryKey: [...CLAVE, "ordenes_mto", "abiertas"],
    queryFn: () => q<OrdenMto[]>(supabase.from("v_ordenes_mantenimiento").select("*").eq("abierta", true).order("reportado_en", { ascending: false })),
  });
  const planes = useQuery({
    queryKey: [...CLAVE, "planes"],
    queryFn: () => q<Plan[]>(supabase.from("v_planes_preventivos").select("*").eq("activo", true).order("proxima_fecha", { nullsFirst: false })),
  });

  const lista = maquinas.data ?? [];
  const activas = lista.filter((m) => m.estado !== "baja");
  const paradas = activas.filter((m) => m.estado === "fuera_de_servicio" || m.estado === "en_mantenimiento");
  const conFalla = activas.filter((m) => m.estado === "con_falla");
  const vencidos = (planes.data ?? []).filter((x) => x.situacion === "vencido");
  const prestadas = activas.filter((m) => m.resguardo_id);
  const filtradas = activas.filter((m) =>
    vista === "problemas" ? m.estado !== "operando" || m.preventivo_situacion === "vencido"
      : vista === "herramienta" ? m.tipo === "herramienta" || m.prestable
      : vista === "prestadas" ? !!m.resguardo_id : true);

  const cambiarPestana = (v: string) => setParams((x) => { x.set("pestana", v); return x; }, { replace: true });

  const colMaquinas: Columna<Maquina>[] = [
    { clave: "numero", titulo: "Número", celda: (m) => <span className="cifra font-medium whitespace-nowrap">{m.numero}</span> },
    { clave: "nombre", titulo: "Máquina", celda: (m) => (
      <div className="min-w-[160px]"><p className="leading-tight">{m.nombre}{m.critica && <span className="ml-1.5 text-[11px] text-tenue">· crítica</span>}</p>
        <p className="text-xs text-tenue">{TIPO_MAQUINA[m.tipo]} · {m.categoria}{m.marca ? ` · ${m.marca}` : ""}</p></div>
    ) },
    { clave: "etapa", titulo: "Área", celda: (m) => m.etapa ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full" style={{ background: m.etapa_color ?? undefined }} />{m.etapa}</span> : <span className="text-tenue">{m.ubicacion ?? "—"}</span> },
    { clave: "estado", titulo: "Estado", valor: (m) => ESTADO_MAQUINA[m.estado].texto, celda: (m) => (
      <div><InsigniaMaquina estado={m.estado} />
        {m.orden_falla && m.orden_tipo === "correctivo" && <p className="text-[11px] text-tenue mt-0.5 max-w-[240px] truncate" title={m.orden_falla}>{m.orden_falla} · {hace(m.orden_desde)}</p>}</div>
    ) },
    { clave: "preventivo_fecha", titulo: "Preventivo", valor: (m) => m.preventivo_fecha ?? (m.preventivo_horas != null ? `h${m.preventivo_horas}` : null), celda: (m) => m.preventivo ? (
      <div className="whitespace-nowrap"><Insignia tono={SITUACION[m.preventivo_situacion ?? "al_dia"].tono}>{SITUACION[m.preventivo_situacion ?? "al_dia"].texto}</Insignia>
        <p className="text-[11px] text-tenue mt-0.5">{m.preventivo_fecha ? fecha(m.preventivo_fecha) : `a las ${horas(m.preventivo_horas)}`}</p></div>
    ) : <span className="text-tenue">—</span> },
    { clave: "fallas_12m", titulo: "Último año", alinear: "der", celda: (m) => m.fallas_12m || m.horas_paro_12m ? (
      <span className="whitespace-nowrap">{m.fallas_12m} {m.fallas_12m === 1 ? "falla" : "fallas"}
        <span className="block text-[11px] text-tenue">{m.horas_paro_12m ? `${horas(m.horas_paro_12m)} parada` : "sin paro"}</span></span>
    ) : <span className="text-tenue">Sin fallas</span> },
    { clave: "prestada_a", titulo: "La tiene", celda: (m) => m.prestada_a ? <span className="text-sm whitespace-nowrap">{m.prestada_a}<span className="block text-[11px] text-tenue">{hace(m.prestada_desde)}</span></span> : <span className="text-tenue">—</span> },
  ];

  const colOrdenes: Columna<OrdenMto>[] = [
    { clave: "folio", titulo: "Folio", celda: (o) => <span className="cifra font-medium whitespace-nowrap">{o.folio}</span> },
    { clave: "maquina", titulo: "Máquina", valor: (o) => `${o.numero} ${o.maquina}`, celda: (o) => <span className="whitespace-nowrap">{o.numero} · {o.maquina}</span> },
    { clave: "tipo", titulo: "Tipo", celda: (o) => <Insignia tono={o.tipo === "preventivo" ? "info" : "neutro"}>{o.tipo === "preventivo" ? "Preventivo" : "Falla"}</Insignia> },
    { clave: "falla", titulo: "Qué tiene", celda: (o) => <span className="text-sm line-clamp-2 max-w-[340px]">{o.diagnostico ?? o.falla}</span> },
    { clave: "reportado_en", titulo: "Desde", celda: (o) => <span className="whitespace-nowrap text-sm">{hace(o.reportado_en)}<span className="block text-[11px] text-tenue">{o.reportado_por_nombre}</span></span> },
    { clave: "estado", titulo: "Estado", valor: (o) => ESTADO_MTO[o.estado].texto, celda: (o) => (
      <div className="flex flex-wrap gap-1"><InsigniaMto estado={o.estado} />{o.detiene && <Insignia tono="peligro">Parada</Insignia>}{o.vencida && <Insignia tono="peligro">Vencido</Insignia>}</div>
    ) },
    { clave: "refacciones_pendientes", titulo: "Refacciones", alinear: "der", celda: (o) => o.refacciones ? `${o.refacciones - o.refacciones_pendientes}/${o.refacciones}` : "—" },
  ];

  const colPlanes: Columna<Plan>[] = [
    { clave: "maquina", titulo: "Máquina", valor: (x) => `${x.numero} ${x.maquina}`, celda: (x) => <span className="whitespace-nowrap">{x.numero} · {x.maquina}</span> },
    { clave: "nombre", titulo: "Plan", celda: (x) => <div className="min-w-[180px]"><p>{x.nombre}</p>{x.tareas && <p className="text-xs text-tenue line-clamp-1">{x.tareas}</p>}</div> },
    { clave: "cada", titulo: "Cada", valor: (x) => x.cada_dias ?? x.cada_horas, celda: (x) => <span className="whitespace-nowrap">{[x.cada_dias && `${x.cada_dias} días`, x.cada_horas && horas(x.cada_horas)].filter(Boolean).join(" o ")}</span> },
    { clave: "ultima_fecha", titulo: "Último", celda: (x) => <span className="whitespace-nowrap">{fecha(x.ultima_fecha)}</span> },
    { clave: "proxima_fecha", titulo: "Toca", valor: (x) => x.proxima_fecha ?? x.proximas_horas, celda: (x) => (
      <span className="whitespace-nowrap">{x.proxima_fecha ? fecha(x.proxima_fecha) : `a las ${horas(x.proximas_horas)}`}
        {x.cada_horas != null && <span className="block text-[11px] text-tenue">lleva {horas(x.horas_actuales)}</span>}</span>
    ) },
    { clave: "situacion", titulo: "Situación", valor: (x) => SITUACION[x.situacion].texto, celda: (x) => (
      <div><Insignia tono={SITUACION[x.situacion].tono}>{SITUACION[x.situacion].texto}</Insignia>
        {x.orden_folio && <p className="text-[11px] text-tenue mt-0.5 whitespace-nowrap">{x.orden_folio}</p>}</div>
    ) },
  ];

  return (
    <Pagina
      titulo="Máquinas y herramienta"
      descripcion="Lo que tiene el taller, en qué estado está, cuánto ha fallado y qué preventivo le toca."
      ancho="max-w-[1500px]"
      acciones={<>
        {p.pedir && <EnlaceBoton a="/servicio/reportar?volver=/servicio/maquinas" variante="peligro"><AlertTriangle className="h-4 w-4" />Reportar falla</EnlaceBoton>}
        <EnlaceBoton a="/servicio/resguardos"><Hand className="h-4 w-4" />Resguardos</EnlaceBoton>
        {p.gerencia && <Boton onClick={() => setNueva(true)}><Plus className="h-4 w-4" />Nueva máquina</Boton>}
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Paradas" valor={numero(paradas.length)} icono={AlertOctagon} tono={paradas.length ? "peligro" : "ok"}
             detalle={paradas.length ? paradas.map((m) => m.numero).join(", ") : "Todo operando"} alClic={() => { cambiarPestana("maquinas"); setVista("problemas"); }} />
        <Kpi titulo="Con falla reportada" valor={numero(conFalla.length)} icono={Wrench} tono={conFalla.length ? "aviso" : "ok"}
             detalle="Todavía trabajan, pero alguien vio algo" alClic={() => cambiarPestana("ordenes")} />
        <Kpi titulo="Preventivos vencidos" valor={numero(vencidos.length)} icono={CalendarCheck} tono={vencidos.length ? "aviso" : "ok"}
             detalle={`${(planes.data ?? []).length} planes activos`} alClic={() => cambiarPestana("preventivos")} />
        <Kpi titulo="Herramienta prestada" valor={numero(prestadas.length)} icono={Hand} tono="marca"
             detalle="Quién la tiene y desde cuándo" alClic={() => ir("/servicio/resguardos")} />
      </div>

      <Pestanas value={pestana} onValueChange={cambiarPestana}>
        <ListaPestanas opciones={[
          { valor: "maquinas", texto: "Máquinas", cuenta: activas.length },
          { valor: "ordenes", texto: "Órdenes abiertas", cuenta: (ordenes.data ?? []).length },
          { valor: "preventivos", texto: "Preventivos", cuenta: (planes.data ?? []).length },
        ]} />
        <ContenidoPestana value="maquinas" className="pt-3">
          <TablaDatos filas={filtradas} columnas={colMaquinas} cargando={maquinas.isLoading} error={maquinas.error}
            claveFila={(m) => m.id} alClicFila={(m) => ir(`/servicio/maquinas/${m.id}`)} exportarComo="maquinas"
            placeholder="Número, nombre, marca…"
            filtros={<Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
              { valor: "todas", texto: "Todas", cuenta: activas.length },
              { valor: "problemas", texto: "Con algo pendiente", cuenta: activas.filter((m) => m.estado !== "operando" || m.preventivo_situacion === "vencido").length },
              { valor: "herramienta", texto: "Herramienta", cuenta: activas.filter((m) => m.tipo === "herramienta" || m.prestable).length },
              { valor: "prestadas", texto: "Prestadas", cuenta: prestadas.length },
            ]} />}
            vacio={{ icono: Wrench, titulo: vista === "todas" ? "Todavía no hay máquinas en el catálogo" : "Nada aquí",
                     texto: p.gerencia ? "Da de alta las soldadoras, el compresor, el torno… con el número que tienen pintado." : undefined,
                     accion: p.gerencia && vista === "todas" ? <Boton onClick={() => setNueva(true)}><Plus className="h-4 w-4" />Nueva máquina</Boton> : undefined }} />
        </ContenidoPestana>
        <ContenidoPestana value="ordenes" className="pt-3">
          <TablaDatos filas={ordenes.data} columnas={colOrdenes} cargando={ordenes.isLoading} error={ordenes.error}
            claveFila={(o) => o.id} alClicFila={(o) => setOrden(o.id)} exportarComo="ordenes-mantenimiento"
            vacio={{ icono: CheckCircle2, titulo: "No hay órdenes de mantenimiento abiertas", texto: "Cuando el taller reporte una falla o venza un preventivo, aparece aquí." }} />
        </ContenidoPestana>
        <ContenidoPestana value="preventivos" className="pt-3">
          <TablaDatos filas={planes.data} columnas={colPlanes} cargando={planes.isLoading} error={planes.error}
            claveFila={(x) => x.id} alClicFila={(x) => (x.orden_id ? setOrden(x.orden_id) : ir(`/servicio/maquinas/${x.maquina_id}`))} exportarComo="preventivos"
            vacio={{ icono: CalendarCheck, titulo: "Sin planes preventivos", texto: "Abre la ficha de una máquina y agrégale su plan: por fecha (cada 90 días) o por horas de uso (cada 250 h). La orden sale sola cuando vence." }} />
        </ContenidoPestana>
      </Pestanas>

      <LateralMantenimiento id={orden} alCerrar={() => setOrden(null)} />
      {nueva && <DialogoMaquina alCerrar={() => setNueva(false)} alGuardar={(id) => ir(`/servicio/maquinas/${id}`)} />}
    </Pagina>
  );
}

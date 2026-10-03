import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlarmClock, CheckCircle2, Hand, Inbox, MessageSquareQuote, Siren, Timer } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Lateral } from "@/components/ui/dialogo";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { useAncho } from "@/modulos/ventas/comun";
import {
  CLAVE, ESTADO_SOL, abierta, cuando, horas, plazo, useResumenSolicitudes, useSolicitudes, useSolicitudesEnVivo,
  type ResumenSolicitudes, type Solicitud,
} from "./solicitudes/datos";
import { InsigniasSolicitud, PuntoSemaforo, QueSePide } from "./solicitudes/Componentes";
import { PanelContestar } from "./solicitudes/PanelContestar";

type Vista = "pendientes" | "vencidas" | "contestadas" | "todas";
const ORDEN_SEMAFORO = { vencida: 0, por_vencer: 1, a_tiempo: 2 } as const;

/**
 * La cola de precios que pide ventas. Antes era "@compras me ayudas a cotizar esta
 * polea?" en el chat, sin saber qué seguía abierto ni qué venció. Aquí va ordenada
 * por vencimiento con semáforo; "Tomar" en un clic le dice al vendedor quién la
 * tiene, y "Contestar" mete el costo al catálogo y le devuelve el precio de lista.
 */
export default function Solicitudes() {
  const { perfil, puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const vista = (params.get("filtro") as Vista) || "pendientes";
  const abiertaId = params.get("id");
  const ancho = useAncho(900);
  useSolicitudesEnVivo();
  const lista = useSolicitudes();
  const resumen = useResumenSolicitudes();

  const todas = useMemo(() => lista.data ?? [], [lista.data]);
  const pasa = (s: Solicitud, v: Vista) =>
    v === "pendientes" ? abierta(s) : v === "vencidas" ? s.semaforo === "vencida"
      : v === "contestadas" ? s.estado === "contestada" || s.estado === "no_se_consigue" : true;
  // Lo pendiente por vencimiento (lo vencido arriba); lo demás, lo más reciente primero.
  const visibles = useMemo(() => todas.filter((s) => pasa(s, vista)).sort((a, b) => {
    if (abierta(a) && abierta(b)) {
      return ORDEN_SEMAFORO[a.semaforo ?? "a_tiempo"] - ORDEN_SEMAFORO[b.semaforo ?? "a_tiempo"]
        || Number(b.urgente) - Number(a.urgente) || a.vence_en.localeCompare(b.vence_en);
    }
    if (abierta(a) !== abierta(b)) return abierta(a) ? -1 : 1;
    return (b.contestada_en ?? b.creado_en).localeCompare(a.contestada_en ?? a.creado_en);
  }), [todas, vista]);
  const seleccion = todas.find((s) => s.id === abiertaId) ?? null;

  const cambiar = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const tomar = useAccion(
    (s: Solicitud) => q(supabase.rpc("tomar_solicitud_precio", { p_solicitud: s.id })),
    { exito: "Tomada: el vendedor ya ve que la tienes", invalidar: [[...CLAVE]] },
  );
  const puedeContestar = puede("compras", 2) && puede("costos", 2);

  const acciones = (s: Solicitud) => !abierta(s) ? (
    <Boton tamano="sm" variante="fantasma" onClick={(e) => { e.stopPropagation(); cambiar("id", s.id); }}>Ver</Boton>
  ) : (
    <span className="inline-flex gap-1.5">
      {s.estado === "abierta" && (
        <Boton tamano="sm" variante="secundario" cargando={tomar.isPending && tomar.variables?.id === s.id}
          onClick={(e) => { e.stopPropagation(); tomar.mutate(s); }}><Hand className="h-3.5 w-3.5" />Tomar</Boton>
      )}
      {puedeContestar && <Boton tamano="sm" onClick={(e) => { e.stopPropagation(); cambiar("id", s.id); }}>Contestar</Boton>}
    </span>
  );

  const columnas: Columna<Solicitud>[] = [
    { clave: "semaforo", titulo: "", clase: "w-6 pr-0", sinBusqueda: true, valor: (s) => ORDEN_SEMAFORO[s.semaforo ?? "a_tiempo"], celda: (s) => <PuntoSemaforo s={s} /> },
    {
      clave: "vence_en", titulo: "Vence", clase: "whitespace-nowrap", valor: (s) => s.vence_en,
      celda: (s) => abierta(s) ? (
        <div>
          <p className={cn("font-medium", s.semaforo === "vencida" && "text-peligro", s.semaforo === "por_vencer" && "text-aviso")}>{cuando(s.vence_en)}</p>
          <p className="text-xs text-tenue">{s.semaforo === "vencida" ? `hace ${horas(s.horas_vencida)} hábiles` : `quedan ${horas(s.horas_restantes)}`}</p>
        </div>
      ) : <span className="text-xs text-tenue">{s.contestada_en ? `${horas(s.horas_respuesta)} háb.` : cuando(s.cancelada_en)}</span>,
    },
    {
      clave: "folio", titulo: "Folio", clase: "whitespace-nowrap",
      celda: (s) => <div><p className="font-medium cifra">{s.folio}</p>{s.urgente && abierta(s) && <Insignia tono="peligro"><Siren className="h-3 w-3" />Urgente</Insignia>}</div>,
    },
    { clave: "que", titulo: "Qué piden", clase: "min-w-[240px] max-w-[380px]", valor: (s) => `${s.articulo ?? ""} ${s.descripcion ?? ""} ${s.marca ?? ""} ${s.modelo ?? ""}`, celda: (s) => <QueSePide s={s} chico /> },
    {
      clave: "solicitante", titulo: "Pidió", clase: "max-w-[220px]", valor: (s) => `${s.solicitante} ${s.cliente ?? ""} ${s.cotizacion_folio ?? ""}`,
      celda: (s) => <div className="min-w-0"><p className="truncate">{s.solicitante}</p><p className="text-xs text-tenue truncate">{[s.cliente, s.cotizacion_folio].filter(Boolean).join(" · ") || "Sin cliente"}</p></div>,
    },
    {
      clave: "estado", titulo: "Estado", valor: (s) => ESTADO_SOL[s.estado].texto,
      celda: (s) => <div className="space-y-0.5"><Insignia tono={ESTADO_SOL[s.estado].tono}>{ESTADO_SOL[s.estado].texto}</Insignia>
        {s.estado === "tomada" && <p className={cn("text-xs", s.tomada_por === perfil?.id ? "text-marca-texto font-medium" : "text-tenue")}>{s.tomada_por === perfil?.id ? "La tienes tú" : s.tomada_por_nombre}</p>}
        {s.estado === "contestada" && s.precio_lista_actual != null && <p className="text-xs text-tenue cifra">lista {dinero(s.precio_lista_actual)}</p>}</div>,
    },
    { clave: "acciones", titulo: "", sinBusqueda: true, alinear: "der", celda: acciones },
  ];

  return (
    <Pagina
      titulo="Solicitudes de precio"
      descripcion="Lo que ventas necesita cotizar, por vencimiento. Tómala para que el vendedor sepa que ya la tienes; al contestar, el costo entra al catálogo con su historial y el precio de lista se recalcula solo."
      ancho="max-w-[1400px]"
    >
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Por contestar" valor={numero(resumen.data?.abiertas ?? 0)} icono={Inbox} tono="info"
          detalle={resumen.data ? `${resumen.data.sin_tomar} sin tomar` : undefined} alClic={() => cambiar("filtro", null)} />
        <Kpi titulo="Por vencer" valor={numero(resumen.data?.por_vencer ?? 0)} icono={AlarmClock} tono={resumen.data?.por_vencer ? "aviso" : "neutro"}
          detalle="en menos de una hora hábil" alClic={() => cambiar("filtro", null)} />
        <Kpi titulo="Vencidas" valor={numero(resumen.data?.vencidas ?? 0)} icono={Siren} tono={resumen.data?.vencidas ? "peligro" : "ok"}
          detalle="el vendedor sigue esperando" alClic={() => cambiar("filtro", "vencidas")} />
        <Kpi titulo="Contestadas hoy" valor={numero(resumen.data?.contestadas_hoy ?? 0)} icono={CheckCircle2} tono="ok"
          detalle="con precio o “no se consigue”" alClic={() => cambiar("filtro", "contestadas")} />
      </div>

      {/* En el celular la cola va primero: el indicador queda abajo. */}
      {ancho && resumen.data && <Indicador r={resumen.data} />}

      {ancho ? (
        <TablaDatos
          filas={visibles}
          columnas={columnas}
          cargando={lista.isLoading}
          error={lista.error}
          claveFila={(s) => s.id}
          alClicFila={(s) => cambiar("id", s.id)}
          exportarComo="solicitudes-precio"
          placeholder="Folio, artículo, vendedor, cliente…"
          claseFila={(s) => (s.semaforo === "vencida" ? "bg-peligro-suave/30" : undefined)}
          filtros={<FiltroVista vista={vista} todas={todas} pasa={pasa} alCambiar={(v) => cambiar("filtro", v === "pendientes" ? null : v)} />}
          vacio={{
            icono: MessageSquareQuote,
            titulo: vista === "pendientes" ? "No hay precios pendientes" : vista === "vencidas" ? "Ninguna vencida" : "Nada con este filtro",
            texto: vista === "pendientes" ? "Cuando un vendedor pida un precio desde su cotización aparece aquí y te llega un aviso." : "Cambia el filtro para ver otras.",
          }}
        />
      ) : (
        <div className="space-y-3">
          <FiltroVista vista={vista} todas={todas} pasa={pasa} alCambiar={(v) => cambiar("filtro", v === "pendientes" ? null : v)} />
          {lista.isLoading ? <Cargando /> : visibles.length === 0 ? (
            <div className="tarjeta"><Vacio icono={MessageSquareQuote} titulo="No hay precios pendientes" texto="Cuando un vendedor pida un precio desde su cotización aparece aquí y te llega un aviso." /></div>
          ) : visibles.map((s) => (
            // div y no button: adentro van los botones de Tomar y Contestar.
            <div key={s.id} role="button" tabIndex={0} onClick={() => cambiar("id", s.id)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) cambiar("id", s.id); }}
              className={cn("tarjeta w-full text-left p-3 space-y-2 cursor-pointer", s.semaforo === "vencida" && "border-peligro/40")}>
              <div className="flex items-start gap-2">
                <span className="pt-1.5"><PuntoSemaforo s={s} /></span>
                <div className="flex-1 min-w-0"><QueSePide s={s} chico /></div>
                <span className="text-xs cifra text-tenue">{s.folio}</span>
              </div>
              <p className="text-xs text-tenue">{s.solicitante}{s.cliente ? ` · ${s.cliente}` : ""}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <InsigniasSolicitud s={s} />
                <span className={cn("text-xs", s.semaforo === "vencida" ? "text-peligro font-medium" : "text-tenue")}>{plazo(s) ?? (s.contestada_en ? `contestada ${cuando(s.contestada_en)}` : "")}</span>
              </div>
              {abierta(s) && <div className="flex justify-end">{acciones(s)}</div>}
            </div>
          ))}
        </div>
      )}

      {!ancho && resumen.data && <Indicador r={resumen.data} />}

      <Lateral abierto={!!abiertaId} alCambiar={(v) => !v && cambiar("id", null)} ancho="max-w-xl"
        titulo={seleccion ? <span className="cifra">{seleccion.folio}</span> : "Solicitud"}
        subtitulo={seleccion ? (abierta(seleccion) ? plazo(seleccion) : ESTADO_SOL[seleccion.estado].texto) : undefined}
        acciones={seleccion?.estado === "abierta" ? (
          <Boton tamano="sm" variante="secundario" cargando={tomar.isPending} onClick={() => tomar.mutate(seleccion)}><Hand className="h-3.5 w-3.5" />Tomar</Boton>
        ) : null}>
        {seleccion ? <PanelContestar key={seleccion.id + seleccion.estado} s={seleccion} alCerrar={() => cambiar("id", null)} />
          : lista.isLoading ? <Cargando /> : <Vacio icono={MessageSquareQuote} titulo="No encontramos esa solicitud" texto="Puede que la hayan cancelado. Ciérrala y elige otra de la lista." />}
      </Lateral>
    </Pagina>
  );
}

function FiltroVista({ vista, todas, pasa, alCambiar }: {
  vista: Vista; todas: Solicitud[]; pasa: (s: Solicitud, v: Vista) => boolean; alCambiar: (v: Vista) => void;
}) {
  return (
    <Filtro<Vista> valor={vista} alCambiar={alCambiar} opciones={[
      { valor: "pendientes", texto: "Por contestar", cuenta: todas.filter((s) => pasa(s, "pendientes")).length },
      { valor: "vencidas", texto: "Vencidas", cuenta: todas.filter((s) => pasa(s, "vencidas")).length },
      { valor: "contestadas", texto: "Contestadas" },
      { valor: "todas", texto: "Todas" },
    ]} />
  );
}

/**
 * El indicador honesto: mediana de horas hábiles hasta el precio este mes y % de
 * más de un día hábil, contra lo que medía el chat. Las abiertas que ya pasaron de
 * un día cuentan (si no, el indicador mejora con solo no contestar).
 */
function Indicador({ r }: { r: ResumenSolicitudes }) {
  const m = r.mes, b = r.linea_base;
  if (!m.resueltas && !m.abiertas_mas_de_un_dia) {
    return <p className="text-sm text-tenue flex items-center gap-2"><Timer className="h-4 w-4" />Este mes todavía no hay precios contestados. En el chat la mediana era de {b.mediana_horas} h hábiles y el {porcentaje(b.pct_mas_de_un_dia, 0)} pasaba de un día.</p>;
  }
  const mejorMediana = m.mediana_horas != null && Number(m.mediana_horas) <= b.mediana_horas;
  const mejorPct = (m.pct_mas_de_un_dia ?? 0) <= b.pct_mas_de_un_dia;
  return (
    <div className="tarjeta p-4 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-marca-suave text-marca flex items-center justify-center"><Timer className="h-5 w-5" /></div>
        <div>
          <p className="font-semibold leading-tight">Tiempo de respuesta este mes</p>
          <p className="text-xs text-tenue">{m.resueltas} contestada(s){m.mediana_acuse != null ? ` · acuse en ${horas(m.mediana_acuse)}` : ""}</p>
        </div>
      </div>
      <Comparacion titulo="Mediana hasta el precio" valor={horas(m.mediana_horas)} antes={`${b.mediana_horas} h`} mejor={mejorMediana}
        nota={`horas hábiles · ${b.mediana_horas_2026} h en 2026`} />
      <Comparacion titulo="Tardaron más de un día hábil" valor={porcentaje(m.pct_mas_de_un_dia ?? 0, 0)} antes={porcentaje(b.pct_mas_de_un_dia, 0)} mejor={mejorPct}
        nota={m.abiertas_mas_de_un_dia ? `incluye ${m.abiertas_mas_de_un_dia} abierta(s) que ya pasaron de un día` : `${porcentaje(b.pct_mas_de_un_dia_2026, 0)} en 2026`} />
    </div>
  );
}

function Comparacion({ titulo, valor, antes, mejor, nota }: { titulo: string; valor: string; antes: string; mejor: boolean; nota: string }) {
  return (
    <div className="rounded-lg bg-fondo px-3 py-2">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="flex items-baseline gap-2">
        <span className={cn("text-xl font-semibold cifra", mejor ? "text-ok" : "text-aviso")}>{valor}</span>
        <span className="text-xs text-tenue">antes, en el chat: <b className="cifra">{antes}</b></span>
      </p>
      <p className="text-[11px] text-tenue">{nota}</p>
    </div>
  );
}

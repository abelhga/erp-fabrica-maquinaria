import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, CheckCircle2, Pause, Play, Search, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, hace } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";
import { CLAVE, CRITICIDAD, horas, useServicioEnVivo, type OrdenMto } from "./datos";
import { EnlaceBoton, usePermisosServicio } from "./componentes/piezas";
import { LateralMantenimiento } from "./componentes/LateralMantenimiento";
import { GLOSARIO } from "@/tutorial/glosario";

// Las razones que más se repiten, a un toque; «Pausar» sin razón también vale.
const MOTIVOS = ["Esperando refacción", "Me voy a otra", "Fin del día"];

const ORDEN_CRITICIDAD = { muy_alta: 0, alta: 1, media: 2, baja: 3, muy_baja: 4 } as const;
const critica = (o: OrdenMto) => (o.criticidad ? ORDEN_CRITICIDAD[o.criticidad] : 5);

/** Cuánto lleva el tramo abierto, al minuto: «1 h 20 min». */
function Cronometro({ desde }: { desde: string }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const min = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000));
  return <span className="cifra">{min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`}</span>;
}

/**
 * Terminal de mantenimiento: play en la máquina que se va a trabajar y pausa al dejarla. Arriba lo
 * que trae en play y lo último que pausó, para regresar rápido; abajo lo que espera. Las horas de
 * la orden salen de los tramos (la base las suma al cerrar).
 */
export default function TerminalMantenimiento() {
  useServicioEnVivo(["ordenes_mantenimiento", "mantenimiento_tramos", "orden_checklist"]);
  const p = usePermisosServicio(true);
  const { perfil } = useSesion();
  const [buscar, setBuscar] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pausando, setPausando] = useState<string | null>(null);

  const ordenes = useQuery({
    queryKey: [...CLAVE, "terminal_mto"],
    queryFn: () => q<OrdenMto[]>(supabase.from("v_ordenes_mantenimiento").select("*").eq("abierta", true)),
  });
  // El inicio del tramo abierto (para el cronómetro): la vista solo trae la suma de horas.
  const miTramo = useQuery({
    queryKey: [...CLAVE, "terminal_mto", "mi_tramo", perfil?.id],
    enabled: !!perfil,
    queryFn: () => q<{ orden_id: string; inicio: string } | null>(supabase.from("mantenimiento_tramos").select("orden_id, inicio")
      .eq("usuario_id", perfil!.id).is("fin", null).maybeSingle()),
  });

  const play = useAccion((o: OrdenMto) => q(supabase.rpc("mto_play", { p_orden: o.id })), {
    invalidar: [CLAVE], exito: "En play",
  });
  const pausa = useAccion((a: { id: string; motivo?: string }) => q(supabase.rpc("mto_pausa", { p_orden: a.id, p_motivo: a.motivo ?? null })), {
    invalidar: [CLAVE], exito: "En pausa", alTerminar: () => setPausando(null),
  });

  const grupos = useMemo(() => {
    const lista = (ordenes.data ?? []).filter((o) => coincide(`${o.folio} ${o.numero} ${o.maquina} ${o.categoria} ${o.etapa ?? ""}`, buscar));
    const enPlay = lista.filter((o) => o.yo_en_play);
    // En pausa: empezadas que yo no traigo en play. Primero lo que yo pausé, lo más reciente arriba.
    const pausadas = lista.filter((o) => !o.yo_en_play && o.estado === "en_proceso")
      .sort((a, b) => (b.mi_ultima_pausa ?? "").localeCompare(a.mi_ultima_pausa ?? "") || (b.ultima_pausa ?? b.inicio_en ?? "").localeCompare(a.ultima_pausa ?? a.inicio_en ?? ""));
    const preventivos = lista.filter((o) => o.estado === "pendiente" && o.tipo === "preventivo")
      .sort((a, b) => Number(b.vencida) - Number(a.vencida) || (a.vence ?? "9").localeCompare(b.vence ?? "9") || critica(a) - critica(b));
    const fallas = lista.filter((o) => o.estado === "pendiente" && o.tipo === "correctivo")
      .sort((a, b) => Number(b.detiene) - Number(a.detiene) || critica(a) - critica(b) || a.reportado_en.localeCompare(b.reportado_en));
    return { enPlay, pausadas, preventivos, fallas, total: lista.length };
  }, [ordenes.data, buscar]);

  // Funciones y no componentes: definidas aquí adentro, un componente se volvería a montar en cada
  // recarga en vivo y se perdería lo que se está tocando.
  const tarjeta = (o: OrdenMto) => {
    const otros = (o.en_play ?? []).filter((n) => n !== perfil?.nombre);
    return (
      <li key={o.id} className={cn("rounded-xl border bg-superficie p-3 sm:p-4", o.yo_en_play ? "border-ok ring-2 ring-ok/30" : "border-borde")}>
        <div className="flex items-start gap-3">
          <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setAbierta(o.id)}>
            <p className="font-semibold leading-tight"><span className="cifra">{o.numero}</span> · {o.maquina}</p>
            <p className="text-sm text-tenue line-clamp-2">{o.diagnostico ?? o.falla}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <Insignia tono={o.tipo === "preventivo" ? "info" : "neutro"}>{o.tipo === "preventivo" ? "Preventivo" : "Falla"}</Insignia>
              {o.detiene && <Insignia tono="peligro">Parada</Insignia>}
              {o.vencida && <Insignia tono="peligro">Vencido {o.vence ? fecha(o.vence) : ""}</Insignia>}
              {!o.vencida && o.vence && o.estado === "pendiente" && <span className="text-tenue">Toca {fecha(o.vence)}</span>}
              {o.criticidad && <span data-explain={GLOSARIO.criticidadMaquina}><Insignia tono={CRITICIDAD[o.criticidad].tono}>Criticidad {CRITICIDAD[o.criticidad].texto.toLowerCase()}</Insignia></span>}
              {o.puntos > 0 && <span className="text-tenue cifra">Checklist {o.puntos_revisados}/{o.puntos}</span>}
              {!!o.horas_tramos && <span className="text-tenue" data-explain={GLOSARIO.tramoMantenimiento}>Llevan {horas(o.horas_tramos)}</span>}
              {o.etapa && <span className="text-tenue">{o.etapa}</span>}
            </div>
            {o.yo_en_play && miTramo.data?.orden_id === o.id && (
              <p className="mt-1.5 text-sm text-ok font-medium">Trabajando desde hace <Cronometro desde={miTramo.data.inicio} /></p>
            )}
            {!o.yo_en_play && o.ultima_pausa && (
              <p className="mt-1.5 text-xs text-tenue">Pausada {hace(o.ultima_pausa)}{o.ultima_pausa_motivo ? ` · ${o.ultima_pausa_motivo}` : ""}</p>
            )}
            {otros.length > 0 && <p className="mt-1 text-xs text-marca-texto">En play: {otros.join(", ")}</p>}
          </button>
          {p.personal && (o.yo_en_play ? (
            <Boton tamano="lg" variante="secundario" className="shrink-0 h-14 w-28" onClick={() => setPausando(pausando === o.id ? null : o.id)} aria-label={`Pausar ${o.numero}`}>
              <Pause className="h-5 w-5" />Pausa
            </Boton>
          ) : (
            <Boton tamano="lg" variante="exito" className="shrink-0 h-14 w-28" cargando={play.isPending && play.variables?.id === o.id}
                   onClick={() => play.mutate(o)} aria-label={`Play ${o.numero}`}>
              <Play className="h-5 w-5" />Play
            </Boton>
          ))}
        </div>
        {pausando === o.id && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-borde pt-3">
            {MOTIVOS.map((m) => <Boton key={m} variante="secundario" onClick={() => pausa.mutate({ id: o.id, motivo: m })} disabled={pausa.isPending}>{m}</Boton>)}
            <Boton variante="fantasma" onClick={() => pausa.mutate({ id: o.id })} disabled={pausa.isPending}>Solo pausar</Boton>
          </div>
        )}
      </li>
    );
  };

  const grupo = (titulo: string, Icono: typeof Play, filas: OrdenMto[], explica?: string) =>
    filas.length === 0 ? null : (
      <section key={titulo} className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold" data-explain={explica} data-explain-title={explica ? titulo : undefined}>
          <Icono className="h-4 w-4 text-tenue" />{titulo}<span className="text-tenue font-normal cifra">{filas.length}</span>
        </h2>
        <ul className="space-y-2">{filas.map(tarjeta)}</ul>
      </section>
    );

  return (
    <Pagina titulo="Terminal de mantenimiento" ancho="max-w-3xl"
      descripcion="Dale play a la máquina que vas a trabajar y pausa cuando la dejes. Al cerrar la orden, las horas salen solas."
      acciones={<>
        {p.pedir && <EnlaceBoton a="/servicio/reportar?volver=/servicio/terminal" variante="peligro"><AlertTriangle className="h-4 w-4" />Reportar falla</EnlaceBoton>}
        <EnlaceBoton a="/servicio/maquinas"><Wrench className="h-4 w-4" />Máquinas</EnlaceBoton>
      </>}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tenue" />
        <Entrada className="pl-9 h-11" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Número o nombre de la máquina" aria-label="Buscar máquina" />
      </div>
      {!p.personal && <p className="text-sm text-tenue">Puedes ver lo que está en trabajo; dar play es del personal de mantenimiento.</p>}
      {ordenes.isLoading ? <Cargando filas={4} /> : ordenes.error ? <ErrorCarga error={ordenes.error} /> : grupos.total === 0 ? (
        <Vacio icono={CheckCircle2} titulo={buscar ? "Ninguna orden abierta de esa máquina" : "No hay mantenimiento pendiente"}
               texto={buscar ? "Revisa el número o reporta la falla para abrirle una orden." : "Cuando el taller reporte una falla o toque un preventivo, aparece aquí para darle play."} />
      ) : (
        <div className="space-y-6">
          {grupo("Trabajando ahora", Play, grupos.enPlay, GLOSARIO.tramoMantenimiento)}
          {grupo("En pausa", Pause, grupos.pausadas)}
          {grupo("Preventivos por hacer", CalendarCheck, grupos.preventivos, GLOSARIO.situacionPreventivo)}
          {grupo("Fallas reportadas", AlertTriangle, grupos.fallas)}
        </div>
      )}
      <LateralMantenimiento id={abierta} alCerrar={() => setAbierta(null)} />
    </Pagina>
  );
}

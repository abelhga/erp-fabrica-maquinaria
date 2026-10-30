import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarPlus, Check, Info, Scale, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hace, numero } from "@/lib/formato";
import {
  AvisoCargos, Avatar, ESTADOS, TABLA_LFT, TIPOS, antiguedad, useSimularVacaciones, useVacaciones, type Incidencia, type TipoIncidencia, type Vacaciones,
} from "./componentes/comun";
import { NuevaIncidencia } from "./componentes/NuevaIncidencia";
import { CalendarioAusencias } from "./componentes/CalendarioAusencias";
import { GLOSARIO } from "@/tutorial/glosario";

type IncidenciaCompleta = Incidencia & { empleado: { nombre: string; numero: string | null; puesto: string | null } | null };

const rango = (i: { inicio: string; fin: string }) => (i.inicio === i.fin ? fecha(i.inicio) : `${fecha(i.inicio)} – ${fecha(i.fin)}`);
function cantidad(i: Incidencia) {
  if (i.tipo === "horas_extra") return `${numero(i.horas)} h extra`;
  if (i.tipo === "retardo") return i.horas ? `${numero(Number(i.horas) * 60)} min` : "—";
  return `${numero(i.dias)} ${Number(i.dias) === 1 ? "día" : "días"}${i.tipo === "incapacidad" ? " naturales" : ""}`;
}

export default function Incidencias() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") ?? "pendientes";
  const [nueva, setNueva] = useState<{ abierto: boolean; dia?: string }>({ abierto: false });
  const puedeRegistrar = puede("rrhh", 2) || puede("produccion", 3);

  const todas = useQuery({
    queryKey: ["incidencias", "todas"],
    queryFn: () => q<IncidenciaCompleta[]>(supabase.from("incidencias").select("*, empleado:empleados(nombre, numero, puesto)")
      .gte("fin", new Date(Date.now() - 400 * 86_400_000).toLocaleDateString("en-CA")).order("inicio", { ascending: false })),
  });
  const vacaciones = useVacaciones();
  const pendientes = (todas.data ?? []).filter((i) => i.estado === "solicitada").sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <Pagina
      titulo="Vacaciones e incidencias"
      descripcion="Solicitudes por aprobar, quién falta cada día y cuántas vacaciones le quedan a cada quien."
      acciones={puedeRegistrar && <Boton onClick={() => setNueva({ abierto: true })}><CalendarPlus className="h-4 w-4" /> Registrar</Boton>}
    >
      <Pestanas value={vista} onValueChange={(v) => setParams(v === "pendientes" ? {} : { vista: v }, { replace: true })}>
        <ListaPestanas opciones={[
          { valor: "pendientes", texto: "Por aprobar", cuenta: pendientes.length, explica: GLOSARIO.solicitudesPorAprobar },
          { valor: "calendario", texto: "Calendario", explica: GLOSARIO.calendarioAusencias },
          { valor: "saldos", texto: "Saldos de vacaciones", explica: GLOSARIO.saldoVacaciones },
          { valor: "historial", texto: "Historial" },
        ]} />
        <ContenidoPestana value="pendientes" className="pt-4">
          {todas.error ? <ErrorCarga error={todas.error} /> : todas.isLoading ? <Cargando /> : (
            <Pendientes pendientes={pendientes} todas={todas.data ?? []} vacaciones={vacaciones.data ?? []} />
          )}
        </ContenidoPestana>
        <ContenidoPestana value="calendario" className="pt-4">
          <CalendarioAusencias alElegirDia={puedeRegistrar ? (dia) => setNueva({ abierto: true, dia }) : undefined} />
        </ContenidoPestana>
        <ContenidoPestana value="saldos" className="pt-4 space-y-4">
          <Saldos vacaciones={vacaciones.data} cargando={vacaciones.isLoading} />
        </ContenidoPestana>
        <ContenidoPestana value="historial" className="pt-4">
          <Historial filas={todas.data} cargando={todas.isLoading} />
        </ContenidoPestana>
      </Pestanas>
      <NuevaIncidencia abierto={nueva.abierto} alCambiar={(v) => setNueva({ abierto: v })} inicioSugerido={nueva.dia} />
    </Pagina>
  );
}

function Pendientes({ pendientes, todas, vacaciones }: { pendientes: IncidenciaCompleta[]; todas: IncidenciaCompleta[]; vacaciones: Vacaciones[] }) {
  const { puede } = useSesion();
  const [rechazo, setRechazo] = useState<IncidenciaCompleta | null>(null);
  const saldo = useMemo(() => new Map(vacaciones.map((v) => [v.empleado_id, v])), [vacaciones]);
  const aprobar = useAccion((i: IncidenciaCompleta) => q(supabase.from("incidencias").update({ estado: "aprobada" }).eq("id", i.id)),
    { exito: "Aprobada", invalidar: [["incidencias"], ["v_vacaciones"]] });

  if (pendientes.length === 0) {
    return <div className="tarjeta"><Vacio icono={CalendarCheck} titulo="Nada por aprobar" texto="Cuando alguien pida vacaciones o un permiso desde su usuario, o su gerente lo registre, aparecerá aquí." /></div>;
  }
  return (
    <div className="space-y-3">
      {pendientes.map((i) => {
        const v = saldo.get(i.empleado_id);
        // Quién más falta en esas fechas: lo primero que pregunta el gerente antes de aprobar.
        const coinciden = [...new Set(todas.filter((o) => o.id !== i.id && o.empleado_id !== i.empleado_id && o.estado === "aprobada"
          && TIPOS[o.tipo].ausencia && o.inicio <= i.fin && o.fin >= i.inicio).map((o) => o.empleado?.nombre.split(" ")[0]))];
        return (
          <div key={i.id} className="tarjeta p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar nombre={i.empleado?.nombre ?? "?"} />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{i.empleado?.nombre} <span className="text-tenue font-normal text-sm">· {i.empleado?.puesto}</span></p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Insignia tono={TIPOS[i.tipo].tono}>{TIPOS[i.tipo].texto}</Insignia>
                  <span className="cifra">{rango(i)}</span>
                  <span className="text-tenue">· {cantidad(i)}</span>
                </div>
                {i.motivo && <p className="text-sm text-tenue">“{i.motivo}”</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
                  <span>Pedida {hace(i.creado_en)}</span>
                  {i.tipo === "vacaciones" && v && <CargoSolicitud incidencia={i} saldo={v.saldo} />}
                  {coinciden.length > 0 && <span>Esos días también faltan: {coinciden.join(", ")}</span>}
                </div>
              </div>
            </div>
            {puede("rrhh", 2) ? (
              <div className="flex gap-2 sm:shrink-0">
                <Boton variante="secundario" tamano="sm" onClick={() => setRechazo(i)}><X className="h-4 w-4" /> Rechazar</Boton>
                <Boton variante="exito" tamano="sm" cargando={aprobar.isPending && aprobar.variables?.id === i.id} onClick={() => aprobar.mutate(i)}>
                  <Check className="h-4 w-4" /> Aprobar
                </Boton>
              </div>
            ) : <Insignia tono="aviso">Espera a Recursos Humanos</Insignia>}
          </div>
        );
      })}
      <DialogoRechazo incidencia={rechazo} alCerrar={() => setRechazo(null)} />
    </div>
  );
}

/** Con qué días se cubriría la solicitud si se aprueba: de qué periodo y cuántos serían adelanto. */
function CargoSolicitud({ incidencia: i, saldo }: { incidencia: IncidenciaCompleta; saldo: number }) {
  const sim = useSimularVacaciones(i.empleado_id, i.inicio, Number(i.dias));
  return (
    <span>
      <span data-explain={GLOSARIO.saldoVacaciones} data-explain-title="Saldo">Saldo hoy {numero(saldo)} días</span>
      {sim.data && <> · <AvisoCargos cargos={sim.data} className="font-medium" /></>}
    </span>
  );
}

function DialogoRechazo({ incidencia: i, alCerrar }: { incidencia: IncidenciaCompleta | null; alCerrar: () => void }) {
  const [nota, setNota] = useState("");
  const rechazar = useAccion(() => q(supabase.from("incidencias").update({
    estado: "rechazada", motivo: [i!.motivo, nota.trim() && `Rechazo: ${nota.trim()}`].filter(Boolean).join(" · ") || null,
  }).eq("id", i!.id)), { exito: "Rechazada", invalidar: [["incidencias"], ["v_vacaciones"]], alTerminar: () => { setNota(""); alCerrar(); } });
  return (
    <Dialogo abierto={!!i} alCambiar={(v) => !v && alCerrar()} titulo="Rechazar solicitud"
      descripcion={i && `${i.empleado?.nombre} · ${TIPOS[i.tipo].texto} · ${rango(i)}`}
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton variante="peligro" cargando={rechazar.isPending} onClick={() => rechazar.mutate(undefined)}>Rechazar</Boton>
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); rechazar.mutate(undefined); }}>
        <Campo etiqueta="¿Por qué? (lo verá en su historial)">
          <Entrada autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Coincide con una entrega, falta cubrir el puesto…" />
        </Campo>
      </form>
    </Dialogo>
  );
}

function Saldos({ vacaciones, cargando }: { vacaciones: Vacaciones[] | undefined; cargando: boolean }) {
  const columnas: Columna<Vacaciones>[] = [
    { clave: "nombre", titulo: "Empleado", celda: (v) => <span className="flex items-center gap-2 whitespace-nowrap"><Avatar nombre={v.nombre} tamano="sm" />{v.nombre}</span> },
    { clave: "anios", titulo: "Antigüedad", valor: (v) => v.anios, sinBusqueda: true, celda: (v) => <span className="whitespace-nowrap" title={`Ingresó el ${fecha(v.fecha_ingreso)}`}>{antiguedad(v.fecha_ingreso)}</span> },
    { clave: "dias_periodo", titulo: "Le tocan", explica: GLOSARIO.diasPorLey, alinear: "der", sinBusqueda: true },
    { clave: "tomados", titulo: "Tomados", explica: GLOSARIO.diasTomados, alinear: "der", sinBusqueda: true, valor: (v) => Number(v.tomados), celda: (v) => numero(v.tomados) },
    { clave: "solicitados", titulo: "Por aprobar", explica: GLOSARIO.diasPorAprobar, alinear: "der", sinBusqueda: true, valor: (v) => Number(v.solicitados), celda: (v) => (Number(v.solicitados) ? numero(v.solicitados) : <span className="text-tenue">—</span>) },
    {
      clave: "disponible", titulo: "Vigentes", explica: GLOSARIO.periodoVacaciones, alinear: "der", sinBusqueda: true, valor: (v) => Number(v.disponible),
      celda: (v) => (Number(v.disponible) ? numero(v.disponible) : <span className="text-tenue">—</span>),
    },
    {
      clave: "adelantados", titulo: "Adelantados", explica: GLOSARIO.adelantoVacaciones, alinear: "der", sinBusqueda: true, valor: (v) => Number(v.adelantados),
      celda: (v) => (Number(v.adelantados) ? <span className="text-aviso">{numero(v.adelantados)}</span> : <span className="text-tenue">—</span>),
    },
    {
      clave: "saldo", titulo: "Saldo", explica: GLOSARIO.saldoVacaciones, alinear: "der", sinBusqueda: true, valor: (v) => Number(v.saldo),
      celda: (v) => <b className={v.saldo < 0 ? "text-peligro" : v.saldo > 0 ? "text-ok" : ""}>{numero(v.saldo)}</b>,
    },
    {
      clave: "proximo_aniversario", titulo: "Próximo aniversario", explica: GLOSARIO.proximoAniversario, valor: (v) => v.proximo_aniversario, sinBusqueda: true,
      celda: (v) => <span className="whitespace-nowrap">{fecha(v.proximo_aniversario)} <span className="text-tenue">→ {v.dias_proximo_periodo} días</span></span>,
    },
    {
      clave: "vence_primero", titulo: "Vencen primero", explica: GLOSARIO.venceVacaciones, valor: (v) => v.vence_primero ?? "9999", sinBusqueda: true,
      celda: (v) => {
        if (!v.vence_primero) return <span className="text-tenue">—</span>;
        const dias = Math.round((new Date(v.vence_primero + "T12:00:00").getTime() - Date.now()) / 86_400_000);
        const texto = `${numero(v.dias_vence_primero ?? 0)} el ${fecha(v.vence_primero)}`;
        return dias <= 60 ? <Insignia tono={dias <= 30 ? "peligro" : "aviso"}>{texto}</Insignia> : <span className="whitespace-nowrap">{texto}</span>;
      },
    },
  ];
  return (
    <div className="space-y-4">
      <Tarjeta>
        <EncabezadoTarjeta titulo="Cómo se calculan" descripcion="Ley Federal del Trabajo, reforma 2023 (vacaciones dignas)" />
        <div className="px-5 pb-5 grid gap-4 lg:grid-cols-2 text-sm">
          <div>
            <p className="text-xs text-tenue mb-2">Años cumplidos → días de vacaciones</p>
            <div className="flex flex-wrap gap-1.5">
              {TABLA_LFT.map((t) => (
                <span key={t.anios} className="inline-flex items-baseline gap-1 rounded-lg border border-borde bg-fondo px-2 py-1">
                  <span className="text-tenue text-xs">{t.anios} {t.anios === "1" ? "año" : "años"}</span><b className="cifra">{t.dias}</b>
                </span>
              ))}
            </div>
          </div>
          <ul className="space-y-1.5 text-tenue">
            <li className="flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" />12 días al cumplir el primer año, 2 más por año hasta 20 a los 5 años; después, 2 más cada 5 años. Antes del primer año no hay (art. 76).</li>
            <li className="flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" />Cada aniversario abre un periodo con los días de la ley. Cada vacación aprobada se carga al periodo más viejo que siga vigente, en días hábiles (semana laboral de Configuración, sin feriados de ley).</li>
            <li className="flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" />Si ya no le queda nada vigente, o no ha cumplido el primer año, lo que tome es adelanto del periodo siguiente: se le descuenta cuando llega, no se perdona al cumplir año.</li>
            <li className="flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" />Se disfrutan dentro de los 6 meses siguientes al aniversario (art. 81), con prima vacacional de al menos 25 %. Lo que no se toma vence 18 meses después del aniversario (art. 516).</li>
          </ul>
        </div>
      </Tarjeta>
      <TablaDatos filas={vacaciones} columnas={columnas} cargando={cargando} claveFila={(v) => v.empleado_id} exportarComo="saldos-vacaciones"
        placeholder="Buscar empleado…" vacio={{ icono: Scale, titulo: "Sin personal activo", texto: "Da de alta al personal en Personal para ver sus saldos." }} />
    </div>
  );
}

function Historial({ filas, cargando }: { filas: IncidenciaCompleta[] | undefined; cargando: boolean }) {
  const [tipo, setTipo] = useState<"" | TipoIncidencia>("");
  const [estado, setEstado] = useState("");
  const visibles = (filas ?? []).filter((i) => (!tipo || i.tipo === tipo) && (!estado || i.estado === estado));
  const columnas: Columna<IncidenciaCompleta>[] = [
    { clave: "empleado", titulo: "Empleado", valor: (i) => i.empleado?.nombre },
    { clave: "tipo", titulo: "Tipo", explica: GLOSARIO.tipoIncidencia, valor: (i) => TIPOS[i.tipo].texto, celda: (i) => <Insignia tono={TIPOS[i.tipo].tono}>{TIPOS[i.tipo].texto}</Insignia> },
    { clave: "inicio", titulo: "Fechas", valor: (i) => i.inicio, celda: (i) => <span className="whitespace-nowrap cifra">{rango(i)}</span> },
    { clave: "dias", titulo: "Cantidad", alinear: "der", sinBusqueda: true, valor: (i) => Number(i.dias), celda: (i) => <span className="whitespace-nowrap">{cantidad(i)}</span> },
    { clave: "estado", titulo: "Estado", explica: GLOSARIO.estadoIncidencia, valor: (i) => ESTADOS[i.estado].texto, celda: (i) => <Insignia tono={ESTADOS[i.estado].tono}>{ESTADOS[i.estado].texto}</Insignia> },
    { clave: "motivo", titulo: "Motivo", clase: "max-w-[320px] truncate", valor: (i) => i.motivo },
    { clave: "creado_en", titulo: "Registrada", sinBusqueda: true, valor: (i) => i.creado_en, celda: (i) => <span className="text-tenue whitespace-nowrap">{fechaYHora(i.creado_en)}</span> },
  ];
  return (
    <TablaDatos filas={visibles} columnas={columnas} cargando={cargando} claveFila={(i) => i.id} exportarComo="incidencias"
      placeholder="Buscar por empleado o motivo…"
      filtros={
        <div className="flex flex-wrap gap-2">
          <Seleccion className="h-8 w-auto text-xs" value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia | "")} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPOS) as TipoIncidencia[]).map((t) => <option key={t} value={t}>{TIPOS[t].texto}</option>)}
          </Seleccion>
          <Seleccion className="h-8 w-auto text-xs" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </Seleccion>
        </div>
      }
      vacio={{ icono: CalendarPlus, titulo: "Sin registros", texto: "Registra vacaciones, permisos, faltas o incapacidades con el botón Registrar." }} />
  );
}

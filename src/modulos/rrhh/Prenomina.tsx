import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Banknote, CalendarX, ChevronLeft, ChevronRight, Clock, Download, HandCoins, Lock, Plus, Receipt, Trash2, Wallet,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { nombreMes, puntos } from "./componentes/objetivos";

interface Semana { inicio: string; fin: string; pago: string; estado: "abierta" | "cerrada"; cerrada_en: string | null; cerrada_por: string | null; personas: number; neto: number | null }
interface Concepto { clave: string; concepto: string; tipo: "percepcion" | "deduccion"; importe: number; nota: string | null; referencia: string | null; id?: string }
interface Renglon {
  semana: string; empleado_id: string; numero: string | null; nombre: string; puesto: string | null;
  sueldo_semanal: number | null; sueldo_origen: string | null; salario_dia: number | null;
  dias_fuera: number; faltas: number; permisos_sin_goce: number; permisos_con_goce: number; incapacidad: number; vacaciones: number;
  retardo_horas: number; descuento_dias: number; dias_pagados: number; importe_dias: number;
  horas_extra: number; horas_dobles: number; horas_triples: number; importe_dobles: number; importe_triples: number; prima_vacacional: number;
  percepciones: number; deducciones: number; prestamos: number;
  bono_pct: number | null; bono_monto: number | null; bono_aviso: string | null; bono_detalle: { mes: string; pct: number; base: number | null; monto: number | null }[] | null;
  total_percepciones: number; total_deducciones: number; neto: number; conceptos: Concepto[]; avisos: string[];
}
interface Prestamo {
  id: string; empleado_id: string; nombre: string; monto: number; descuento_semanal: number; primera_semana: string; motivo: string;
  autorizado_por: string | null; autorizado_en: string; estado: "activo" | "cancelado"; cancelado_motivo: string | null; abonado: number; saldo: number; semanas_restantes: number;
}
interface Sueldo { empleado_id: string; numero: string | null; nombre: string; puesto: string | null; activo: boolean; sueldo_semanal: number | null; desde: string | null; origen: string | null; historial: { sueldo: number; desde: string; motivo: string; por: string | null; en: string }[] }

const n = (x: number | string | null | undefined) => Number(x ?? 0);
const rango = (s: { inicio: string; pago: string }) => `${fecha(s.inicio)} al ${fecha(s.pago)}`;

export default function Prenomina() {
  const { puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") ?? "semana";
  const semanas = useQuery({ queryKey: ["nomina", "semanas"], queryFn: () => q<Semana[]>(supabase.rpc("semanas_nomina", { p_cuantas: 16 })) });
  const lista = semanas.data ?? [];
  // Por omisión, la que ya terminó y falta cerrar (el trabajo de RRHH el viernes); si no hay, la actual.
  const hoy = hoyISO();
  const elegida = params.get("semana") ?? lista.find((s) => s.estado === "abierta" && s.fin < hoy)?.inicio ?? lista[0]?.inicio ?? null;
  const semana = lista.find((s) => s.inicio === elegida) ?? null;
  const idx = lista.findIndex((s) => s.inicio === elegida);
  const ir = (inicio: string) => { const p = new URLSearchParams(params); p.set("semana", inicio); setParams(p, { replace: true }); };

  return (
    <Pagina
      titulo="Prenómina"
      descripcion="Semana de viernes a jueves (se paga el viernes), calculada de las incidencias aprobadas. ISR, IMSS y timbrado los hace el contador."
      acciones={semana && (
        <div className="flex items-center rounded-lg border border-borde bg-superficie">
          <button className="p-2 text-tenue hover:text-texto disabled:opacity-30" disabled={idx >= lista.length - 1} onClick={() => ir(lista[idx + 1].inicio)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></button>
          <Seleccion className="h-8 border-0 bg-transparent text-sm font-medium w-auto" value={elegida ?? ""} onChange={(e) => ir(e.target.value)} aria-label="Semana">
            {lista.map((s) => <option key={s.inicio} value={s.inicio}>Del {rango(s)}{s.estado === "cerrada" ? " · cerrada" : ""}</option>)}
          </Seleccion>
          <button className="p-2 text-tenue hover:text-texto disabled:opacity-30" disabled={idx <= 0} onClick={() => ir(lista[idx - 1].inicio)} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    >
      <Pestanas value={vista} onValueChange={(v) => { const p = new URLSearchParams(params); if (v === "semana") p.delete("vista"); else p.set("vista", v); setParams(p, { replace: true }); }}>
        <ListaPestanas opciones={[{ valor: "semana", texto: "Semana" }, { valor: "prestamos", texto: "Préstamos" }, { valor: "sueldos", texto: "Sueldos" }]} />
        <ContenidoPestana value="semana" className="pt-4">
          {semanas.error ? <ErrorCarga error={semanas.error} /> : !semana ? <Cargando /> : <VistaSemana semana={semana} />}
        </ContenidoPestana>
        <ContenidoPestana value="prestamos" className="pt-4"><Prestamos semanas={lista} puedeCapturar={puede("nomina", 3)} /></ContenidoPestana>
        <ContenidoPestana value="sueldos" className="pt-4"><Sueldos puedeCapturar={puede("nomina", 3)} /></ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

function VistaSemana({ semana }: { semana: Semana }) {
  const { puede } = useSesion();
  const filas = useQuery({ queryKey: ["nomina", "prenomina", semana.inicio], queryFn: () => q<Renglon[]>(supabase.rpc("prenomina", { p_semana: semana.inicio })) });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "concepto" | "cerrar">(null);
  const datos = filas.data ?? [];
  const cerrada = semana.estado === "cerrada";
  const terminada = semana.fin < hoyISO();
  const total = datos.reduce((s, r) => s + n(r.neto), 0);
  const dobles = datos.reduce((s, r) => s + n(r.horas_dobles), 0);
  const triples = datos.reduce((s, r) => s + n(r.horas_triples), 0);
  const conTriples = datos.filter((r) => n(r.horas_triples) > 0).length;
  const ausencias = datos.reduce((s, r) => s + n(r.faltas) + n(r.permisos_sin_goce) + n(r.incapacidad), 0);
  const variables = datos.reduce((s, r) => s + n(r.percepciones), 0);
  const sinBase = datos.filter((r) => r.bono_aviso).length;
  const sinSueldo = datos.filter((r) => r.sueldo_semanal == null).length;
  const renglon = datos.find((r) => r.empleado_id === abierto) ?? null;

  const columnas: Columna<Renglon>[] = [
    {
      clave: "nombre", titulo: "Persona",
      celda: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium">{r.nombre}</p>
          <p className="text-xs text-tenue">{[r.numero, r.puesto].filter(Boolean).join(" · ")}</p>
          <p className="text-xs">{r.sueldo_semanal == null ? <span className="text-peligro">sin sueldo registrado</span> : <span className="text-tenue cifra">{dinero(r.sueldo_semanal)} a la semana</span>}</p>
        </div>
      ),
    },
    {
      clave: "dias_pagados", titulo: "Días", alinear: "der", sinBusqueda: true, valor: (r) => n(r.dias_pagados),
      celda: (r) => {
        const motivos = [n(r.faltas) && `${numero(r.faltas)} falta`, n(r.permisos_sin_goce) && `${numero(r.permisos_sin_goce)} sin goce`,
          n(r.incapacidad) && `${numero(r.incapacidad)} incapacidad`, n(r.dias_fuera) && `${numero(r.dias_fuera)} fuera`, n(r.retardo_horas) && `${numero(r.retardo_horas)} h retardo`].filter(Boolean);
        return <span title={motivos.join(", ")} className={n(r.dias_pagados) < 7 ? "text-aviso font-medium" : ""}>{numero(r.dias_pagados)}{motivos.length > 0 && <span className="block text-[11px] text-tenue font-normal">{motivos.join(", ")}</span>}</span>;
      },
    },
    { clave: "importe_dias", titulo: "Sueldo", alinear: "der", sinBusqueda: true, valor: (r) => n(r.importe_dias), celda: (r) => dinero(r.importe_dias) },
    {
      clave: "horas_extra", titulo: "Horas extra", alinear: "der", sinBusqueda: true, valor: (r) => n(r.importe_dobles) + n(r.importe_triples),
      celda: (r) => n(r.horas_extra) === 0 ? <span className="text-tenue">—</span> : (
        <span>{dinero(n(r.importe_dobles) + n(r.importe_triples))}
          <span className={cn("block text-[11px]", n(r.horas_triples) > 0 ? "text-aviso" : "text-tenue")}>{numero(r.horas_dobles)} dobles{n(r.horas_triples) > 0 && ` + ${numero(r.horas_triples)} ${n(r.horas_triples) === 1 ? "triple" : "triples"}`}</span></span>
      ),
    },
    // Prima, otros pagos y bono solo aparecen si alguien los tiene esa semana: la tabla cabe y "A pagar" siempre se ve.
    { clave: "prima_vacacional", titulo: "Prima vac.", alinear: "der", sinBusqueda: true, oculta: !datos.some((r) => n(r.prima_vacacional)), valor: (r) => n(r.prima_vacacional), celda: (r) => n(r.prima_vacacional) ? dinero(r.prima_vacacional) : <span className="text-tenue">—</span> },
    { clave: "percepciones", titulo: "Otros pagos", alinear: "der", sinBusqueda: true, oculta: !datos.some((r) => n(r.percepciones)), valor: (r) => n(r.percepciones), celda: (r) => n(r.percepciones) ? dinero(r.percepciones) : <span className="text-tenue">—</span> },
    {
      clave: "bono", titulo: "Bono", alinear: "der", sinBusqueda: true, oculta: !datos.some((r) => r.bono_pct != null), valor: (r) => r.bono_monto ?? r.bono_pct,
      celda: (r) => r.bono_pct == null ? <span className="text-tenue">—</span> : (
        <span>{r.bono_monto != null ? dinero(r.bono_monto) : puntos(r.bono_pct)}
          {r.bono_aviso && <span className="block text-[11px] text-aviso whitespace-nowrap">falta la base</span>}</span>
      ),
    },
    { clave: "deducciones", titulo: "Descuentos", alinear: "der", sinBusqueda: true, valor: (r) => n(r.total_deducciones), celda: (r) => n(r.total_deducciones) ? <span className="text-peligro">−{dinero(r.total_deducciones)}</span> : <span className="text-tenue">—</span> },
    { clave: "neto", titulo: "A pagar", alinear: "der", sinBusqueda: true, valor: (r) => n(r.neto), celda: (r) => <b>{dinero(r.neto)}</b> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {cerrada
          ? <Insignia tono="ok"><Lock className="h-3 w-3" /> Cerrada {semana.cerrada_por && `por ${semana.cerrada_por}`} el {fechaYHora(semana.cerrada_en)}</Insignia>
          : terminada ? <Insignia tono="aviso">Lista para cerrar: terminó el jueves {fecha(semana.fin)}</Insignia>
          : <Insignia tono="info">En curso: termina el jueves {fecha(semana.fin)}, se paga el {fecha(semana.pago)}</Insignia>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Boton variante="secundario" disabled={!datos.length} onClick={() => exportarCsv(semana, datos)}><Download className="h-4 w-4" /> Exportar CSV</Boton>
          {!cerrada && puede("nomina", 2) && <Boton variante="secundario" onClick={() => setDialogo("concepto")}><Plus className="h-4 w-4" /> Agregar concepto</Boton>}
          {!cerrada && puede("nomina", 3) && (
            <Boton disabled={!terminada} title={!terminada ? "Se cierra cuando termina la semana" : undefined} onClick={() => setDialogo("cerrar")}><Lock className="h-4 w-4" /> Cerrar semana</Boton>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Total a pagar" valor={dinero(total)} icono={Wallet} detalle={`${datos.length} personas · antes de lo fiscal`} />
        <Kpi titulo="Horas extra" valor={`${numero(dobles + triples)} h`} icono={Clock} tono={conTriples ? "aviso" : "marca"}
          detalle={conTriples ? `${numero(triples)} triples en ${conTriples} persona${conTriples > 1 ? "s" : ""} (más de 9 a la semana)` : `${numero(dobles)} dobles`} />
        <Kpi titulo="Días sin goce" valor={numero(ausencias)} icono={CalendarX} tono={ausencias ? "aviso" : "neutro"} detalle="Faltas, permisos sin goce e incapacidad" />
        <Kpi titulo="Otros pagos" valor={dinero(variables)} icono={HandCoins} tono="info" detalle="Servicios fuera, apoyos, gratificaciones" />
      </div>

      {(sinBase > 0 || sinSueldo > 0) && (
        <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            {sinBase > 0 && <p><b>Falta definir la base del bono.</b> {sinBase} {sinBase === 1 ? "persona tiene" : "personas tienen"} objetivos aprobados: se enseña el % y no se paga nada hasta que dirección diga cuánto vale el bono por puesto o por persona.</p>}
            {sinSueldo > 0 && <p><b>{sinSueldo} sin sueldo registrado.</b> Captúralo en la pestaña Sueldos.</p>}
          </div>
        </div>
      )}

      <TablaDatos filas={filas.data} columnas={columnas} cargando={filas.isLoading} error={filas.error} claveFila={(r) => r.empleado_id}
        alClicFila={(r) => setAbierto(r.empleado_id)} placeholder="Buscar persona o puesto…" compacta
        pie={datos.length > 0 && <div className="flex justify-end gap-6 text-sm cifra"><span className="text-tenue">Percepciones {dinero(datos.reduce((s, r) => s + n(r.total_percepciones), 0))}</span><span className="text-tenue">Descuentos −{dinero(datos.reduce((s, r) => s + n(r.total_deducciones), 0))}</span><b>A pagar {dinero(total)}</b></div>}
        vacio={{ icono: Receipt, titulo: "Sin personal en esta semana", texto: "La prenómina sale del personal activo y sus incidencias aprobadas. Da de alta al personal en Personal." }} />

      <Lateral abierto={!!renglon} alCambiar={(v) => !v && setAbierto(null)} titulo={renglon?.nombre ?? ""} subtitulo={renglon && `Semana del ${rango(semana)}`}>
        {renglon && <DetalleRenglon r={renglon} editable={!cerrada && puede("nomina", 2)} />}
      </Lateral>
      {dialogo === "concepto" && <DialogoConcepto semana={semana.inicio} personas={datos} alCerrar={() => setDialogo(null)} />}
      {dialogo === "cerrar" && <DialogoCerrar semana={semana} total={total} personas={datos.length} alCerrar={() => setDialogo(null)} />}
    </div>
  );
}

function DetalleRenglon({ r, editable }: { r: Renglon; editable: boolean }) {
  const quitar = useAccion((id: string) => q(supabase.from("nomina_movimientos").delete().eq("id", id)), { exito: "Concepto quitado", invalidar: [["nomina"]] });
  const linea = (texto: string, importe: number, detalle?: string, signo = 1) => (
    <div className="flex items-start justify-between gap-3 py-2">
      <div><p>{texto}</p>{detalle && <p className="text-xs text-tenue">{detalle}</p>}</div>
      <span className={cn("cifra whitespace-nowrap", signo < 0 && "text-peligro")}>{signo < 0 ? "−" : ""}{dinero(importe)}</span>
    </div>
  );
  const motivos = [
    n(r.faltas) && `${numero(r.faltas)} falta(s)`, n(r.permisos_sin_goce) && `${numero(r.permisos_sin_goce)} día(s) de permiso sin goce`,
    n(r.incapacidad) && `${numero(r.incapacidad)} día(s) de incapacidad (los paga el IMSS)`, n(r.retardo_horas) && `${numero(r.retardo_horas)} h de retardo`,
    n(r.dias_fuera) && `${numero(r.dias_fuera)} día(s) antes del ingreso o después de la baja`, n(r.vacaciones) && `${numero(r.vacaciones)} día(s) de vacaciones (pagados)`,
    n(r.permisos_con_goce) && `${numero(r.permisos_con_goce)} día(s) de permiso con goce (pagados)`,
  ].filter(Boolean).join(" · ");
  return (
    <div className="space-y-5 text-sm">
      {r.avisos.length > 0 && (
        <ul className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-aviso space-y-1">{r.avisos.map((a) => <li key={a} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{a}</li>)}</ul>
      )}
      <div className="divide-y divide-borde">
        {linea(`Sueldo: ${numero(r.dias_pagados)} de 7 días`, n(r.importe_dias),
          r.sueldo_semanal != null ? `${dinero(r.sueldo_semanal)} a la semana · ${dinero(r.salario_dia)} por día${r.sueldo_origen === "ficha" ? " (de la ficha)" : ""}${motivos ? ` · ${motivos}` : ""}` : "Sin sueldo registrado")}
        {n(r.horas_dobles) > 0 && linea(`${numero(r.horas_dobles)} horas extra dobles`, n(r.importe_dobles), "Hasta 9 a la semana, al doble de la hora (LFT art. 67)")}
        {n(r.horas_triples) > 0 && linea(`${numero(r.horas_triples)} horas extra triples`, n(r.importe_triples), "De la hora 10 en adelante, al triple (LFT art. 68)")}
        {n(r.prima_vacacional) > 0 && linea("Prima vacacional", n(r.prima_vacacional), `${numero(r.vacaciones)} día(s) de vacaciones`)}
        {r.conceptos.filter((c) => c.tipo === "percepcion").map((c, i) => (
          <div key={c.id ?? i} className="flex items-start gap-2">
            <div className="flex-1">{linea(c.concepto, n(c.importe), [c.nota, c.referencia].filter(Boolean).join(" · "))}</div>
            {editable && c.id && <button className="mt-2 text-tenue hover:text-peligro" onClick={() => quitar.mutate(c.id!)} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        {r.bono_pct != null && (
          <div className="flex items-start justify-between gap-3 py-2">
            <div>
              <p>Bono de objetivos</p>
              <p className="text-xs text-tenue">{(r.bono_detalle ?? []).map((b) => `${nombreMes(b.mes)}: ${puntos(b.pct)}`).join(" · ")}</p>
              {r.bono_aviso && <p className="text-xs text-aviso">{r.bono_aviso}: no se paga hasta que dirección la defina.</p>}
            </div>
            <span className="cifra whitespace-nowrap">{r.bono_monto != null ? dinero(r.bono_monto) : <span className="text-tenue">{puntos(r.bono_pct)}</span>}</span>
          </div>
        )}
        {r.conceptos.filter((c) => c.tipo === "deduccion").map((c, i) => (
          <div key={c.id ?? `d${i}`} className="flex items-start gap-2">
            <div className="flex-1">{linea(c.concepto, n(c.importe), [c.nota, c.referencia && c.clave !== "prestamo" ? c.referencia : null].filter(Boolean).join(" · "), -1)}</div>
            {editable && c.id && <button className="mt-2 text-tenue hover:text-peligro" onClick={() => quitar.mutate(c.id!)} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        <div className="flex items-center justify-between py-3 text-base"><b>A pagar</b><b className="cifra">{dinero(r.neto)}</b></div>
      </div>
      <p className="text-xs text-tenue">Lo fiscal (ISR, IMSS, subsidio y timbrado) lo calcula el contador a partir del CSV de la semana.</p>
    </div>
  );
}

function DialogoConcepto({ semana, personas, alCerrar }: { semana: string; personas: Renglon[]; alCerrar: () => void }) {
  const conceptos = useQuery({ queryKey: ["nomina", "conceptos"], queryFn: () => q<{ clave: string; nombre: string; tipo: string; descripcion: string | null }[]>(supabase.from("nomina_conceptos").select("*").eq("activo", true).order("tipo", { ascending: false }).order("nombre")) });
  const [f, setF] = useState({ empleado_id: "", concepto: "servicio_fuera", importe: "", nota: "", referencia: "" });
  const c = conceptos.data?.find((x) => x.clave === f.concepto);
  const guardar = useAccion(() => q(supabase.from("nomina_movimientos").insert({
    semana, empleado_id: f.empleado_id, concepto: f.concepto, importe: Number(f.importe), nota: f.nota.trim() || null, referencia: f.referencia.trim() || null,
  })), { exito: "Concepto agregado", invalidar: [["nomina"]], alTerminar: alCerrar });
  const valido = f.empleado_id && f.concepto && Number(f.importe) > 0;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Agregar concepto" descripcion="En lugar de una nota en la celda: queda con su concepto, motivo y quién lo registró."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}>Agregar</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <Campo etiqueta="Persona">
          <Seleccion autoFocus value={f.empleado_id} onChange={(e) => setF({ ...f, empleado_id: e.target.value })}>
            <option value="">Elige…</option>{personas.map((p) => <option key={p.empleado_id} value={p.empleado_id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Concepto" ayuda={c?.descripcion ?? undefined}>
          <Seleccion value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })}>
            <optgroup label="Pagos">{(conceptos.data ?? []).filter((x) => x.tipo === "percepcion").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</optgroup>
            <optgroup label="Descuentos">{(conceptos.data ?? []).filter((x) => x.tipo === "deduccion").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</optgroup>
          </Seleccion>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Importe"><Entrada type="number" min={0.01} step="0.01" value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} /></Campo>
          <Campo etiqueta="Pedido o lugar (opcional)"><Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} /></Campo>
        </div>
        <Campo etiqueta="Nota"><Entrada value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Puesta en marcha en Lagos de Moreno…" /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoCerrar({ semana, total, personas, alCerrar }: { semana: Semana; total: number; personas: number; alCerrar: () => void }) {
  const cerrar = useAccion(() => q<number>(supabase.rpc("cerrar_semana_nomina", { p_semana: semana.inicio })),
    { exito: (n) => `Semana cerrada: ${n} renglones congelados`, invalidar: [["nomina"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Cerrar la semana" descripcion={`Del ${rango(semana)}`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={cerrar.isPending} onClick={() => cerrar.mutate(undefined)}><Lock className="h-4 w-4" /> Cerrar</Boton></>}>
      <div className="space-y-2 text-sm">
        <p>Se congelan {personas} renglones por <b className="cifra">{dinero(total)}</b>, se descuentan los préstamos y se marcan como pagados los bonos que ya tienen base.</p>
        <p className="text-tenue">Después ya no se modifica: un error se corrige en la semana abierta con otro concepto.</p>
      </div>
    </Dialogo>
  );
}

function exportarCsv(s: Semana, filas: Renglon[]) {
  const enc = ["Número", "Nombre", "Puesto", "Semana (viernes)", "Hasta (jueves)", "Pago", "Sueldo semanal", "Salario diario", "Días pagados",
    "Faltas", "Permisos sin goce", "Incapacidad", "Vacaciones", "Retardo (h)", "Importe sueldo", "Horas extra", "Dobles", "Triples",
    "Importe dobles", "Importe triples", "Prima vacacional", "Otros pagos", "Bono objetivos %", "Bono objetivos $", "Descuentos", "Préstamos",
    "Total percepciones", "Total descuentos", "A pagar", "Conceptos", "Avisos"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cuerpo = filas.map((r) => [r.numero, r.nombre, r.puesto, s.inicio, s.fin, s.pago, r.sueldo_semanal, r.salario_dia, r.dias_pagados,
    r.faltas, r.permisos_sin_goce, r.incapacidad, r.vacaciones, r.retardo_horas, r.importe_dias, r.horas_extra, r.horas_dobles, r.horas_triples,
    r.importe_dobles, r.importe_triples, r.prima_vacacional, r.percepciones, r.bono_pct, r.bono_monto, r.deducciones, r.prestamos,
    r.total_percepciones, r.total_deducciones, r.neto,
    r.conceptos.map((c) => `${c.tipo === "deduccion" ? "-" : "+"}${c.concepto} ${c.importe}${c.nota ? ` (${c.nota})` : ""}`).join("; "),
    r.avisos.join("; ")].map(esc).join(","));
  const blob = new Blob(["﻿" + enc.map(esc).join(",") + "\n" + cuerpo.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prenomina-${s.inicio}${s.estado === "cerrada" ? "" : "-borrador"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------------------
// Préstamos con saldo
// ---------------------------------------------------------------------------
function Prestamos({ semanas, puedeCapturar }: { semanas: Semana[]; puedeCapturar: boolean }) {
  const prestamos = useQuery({ queryKey: ["nomina", "prestamos"], queryFn: () => q<Prestamo[]>(supabase.rpc("prestamos_nomina")) });
  const [nuevo, setNuevo] = useState(false);
  const [cancelar, setCancelar] = useState<Prestamo | null>(null);
  const activos = (prestamos.data ?? []).filter((p) => p.estado === "activo" && n(p.saldo) > 0);
  const columnas: Columna<Prestamo>[] = [
    { clave: "nombre", titulo: "Persona", celda: (p) => <div><p className="font-medium">{p.nombre}</p><p className="text-xs text-tenue">{p.motivo}</p></div>, valor: (p) => `${p.nombre} ${p.motivo}` },
    { clave: "monto", titulo: "Prestado", alinear: "der", sinBusqueda: true, valor: (p) => n(p.monto), celda: (p) => dinero(p.monto) },
    { clave: "descuento_semanal", titulo: "Por semana", alinear: "der", sinBusqueda: true, valor: (p) => n(p.descuento_semanal), celda: (p) => dinero(p.descuento_semanal) },
    { clave: "abonado", titulo: "Descontado", alinear: "der", sinBusqueda: true, valor: (p) => n(p.abonado), celda: (p) => dinero(p.abonado) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (p) => n(p.saldo), celda: (p) => <b className={n(p.saldo) > 0 ? "" : "text-ok"}>{dinero(p.saldo)}</b> },
    {
      clave: "estado", titulo: "Estado", valor: (p) => p.estado,
      celda: (p) => p.estado === "cancelado" ? <Insignia tono="neutro">Cancelado</Insignia> : n(p.saldo) <= 0 ? <Insignia tono="ok">Liquidado</Insignia>
        : <Insignia tono="info">{p.semanas_restantes} semana{p.semanas_restantes === 1 ? "" : "s"} más</Insignia>,
    },
    { clave: "autorizado_por", titulo: "Autorizó", valor: (p) => p.autorizado_por, celda: (p) => <span className="text-xs">{p.autorizado_por ?? "—"}<span className="block text-tenue">{fecha(p.autorizado_en)}</span></span> },
    { clave: "acciones", titulo: "", sinBusqueda: true, celda: (p) => puedeCapturar && p.estado === "activo" && n(p.saldo) > 0 && <Boton variante="fantasma" tamano="sm" onClick={(e) => { e.stopPropagation(); setCancelar(p); }}>Cancelar</Boton> },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Préstamos activos" valor={numero(activos.length)} icono={Banknote} detalle={`Saldo por cobrar ${dinero(activos.reduce((s, p) => s + n(p.saldo), 0))}`} />
      </div>
      <TablaDatos filas={prestamos.data} columnas={columnas} cargando={prestamos.isLoading} error={prestamos.error} claveFila={(p) => p.id}
        exportarComo="prestamos-nomina" placeholder="Buscar persona o motivo…"
        filtros={puedeCapturar && <Boton tamano="sm" onClick={() => setNuevo(true)}><Plus className="h-4 w-4" /> Nuevo préstamo</Boton>}
        vacio={{ icono: Banknote, titulo: "Sin préstamos", texto: "Registra el préstamo con su descuento semanal: la prenómina lo descuenta sola y lleva el saldo." }} />
      {nuevo && <DialogoPrestamo semanas={semanas.filter((s) => s.estado === "abierta")} alCerrar={() => setNuevo(false)} />}
      {cancelar && <DialogoCancelarPrestamo p={cancelar} alCerrar={() => setCancelar(null)} />}
    </div>
  );
}

function usePersonasNomina() {
  return useQuery({ queryKey: ["nomina", "sueldos"], queryFn: () => q<Sueldo[]>(supabase.rpc("sueldos_nomina")) });
}

function DialogoPrestamo({ semanas, alCerrar }: { semanas: Semana[]; alCerrar: () => void }) {
  const personas = usePersonasNomina();
  const { perfil } = useSesion();
  const [f, setF] = useState({ empleado_id: "", monto: "", descuento: "", semana: [...semanas].sort((a, b) => a.inicio.localeCompare(b.inicio)).find((s) => s.fin >= hoyISO())?.inicio ?? semanas[0]?.inicio ?? "", motivo: "" });
  const guardar = useAccion(() => q(supabase.from("nomina_prestamos").insert({
    empleado_id: f.empleado_id, monto: Number(f.monto), descuento_semanal: Number(f.descuento), primera_semana: f.semana, motivo: f.motivo.trim(),
  })), { exito: "Préstamo registrado", invalidar: [["nomina"]], alTerminar: alCerrar });
  const valido = f.empleado_id && Number(f.monto) > 0 && Number(f.descuento) > 0 && f.semana && f.motivo.trim().length >= 3;
  const semanasN = Number(f.monto) > 0 && Number(f.descuento) > 0 ? Math.ceil(Number(f.monto) / Number(f.descuento)) : null;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Nuevo préstamo" descripcion={`Queda autorizado por ${perfil?.nombre ?? "ti"}. Nadie se autoriza un préstamo a sí mismo.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}>Registrar</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <Campo etiqueta="Persona">
          <Seleccion autoFocus value={f.empleado_id} onChange={(e) => setF({ ...f, empleado_id: e.target.value })}>
            <option value="">Elige…</option>{(personas.data ?? []).map((p) => <option key={p.empleado_id} value={p.empleado_id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Monto"><Entrada type="number" min={1} step="0.01" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></Campo>
          <Campo etiqueta="Descuento por semana" ayuda={semanasN ? `${semanasN} semanas` : undefined}><Entrada type="number" min={1} step="0.01" value={f.descuento} onChange={(e) => setF({ ...f, descuento: e.target.value })} /></Campo>
        </div>
        <Campo etiqueta="Se empieza a descontar en la semana">
          <Seleccion value={f.semana} onChange={(e) => setF({ ...f, semana: e.target.value })}>
            {semanas.map((s) => <option key={s.inicio} value={s.inicio}>Del {rango(s)}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Motivo"><Entrada value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Préstamo de caja chica para…" /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoCancelarPrestamo({ p, alCerrar }: { p: Prestamo; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const guardar = useAccion(() => q(supabase.from("nomina_prestamos").update({ estado: "cancelado", cancelado_motivo: motivo.trim() }).eq("id", p.id)),
    { exito: "Préstamo cancelado", invalidar: [["nomina"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Cancelar préstamo" descripcion={`${p.nombre} · saldo ${dinero(p.saldo)}. Lo ya descontado queda en el historial.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Volver</Boton><Boton variante="peligro" cargando={guardar.isPending} disabled={motivo.trim().length < 3} onClick={() => guardar.mutate(undefined)}>Cancelar préstamo</Boton></>}>
      <Campo etiqueta="Motivo"><Entrada autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Lo pagó en efectivo, se condonó…" /></Campo>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Sueldos con historial
// ---------------------------------------------------------------------------
function Sueldos({ puedeCapturar }: { puedeCapturar: boolean }) {
  const sueldos = usePersonasNomina();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<string | null>(null);
  const datos = sueldos.data ?? [];
  const elegido = datos.find((s) => s.empleado_id === abierto) ?? null;
  const total = useMemo(() => datos.reduce((s, x) => s + n(x.sueldo_semanal), 0), [datos]);
  const columnas: Columna<Sueldo>[] = [
    { clave: "nombre", titulo: "Persona", celda: (s) => <div><p className="font-medium">{s.nombre}</p><p className="text-xs text-tenue">{[s.numero, s.puesto].filter(Boolean).join(" · ")}</p></div>, valor: (s) => `${s.nombre} ${s.puesto ?? ""}` },
    { clave: "sueldo_semanal", titulo: "Sueldo semanal", alinear: "der", sinBusqueda: true, valor: (s) => s.sueldo_semanal, celda: (s) => s.sueldo_semanal == null ? <span className="text-xs text-peligro">sin sueldo</span> : <b>{dinero(s.sueldo_semanal)}</b> },
    { clave: "dia", titulo: "Por día", alinear: "der", sinBusqueda: true, valor: (s) => n(s.sueldo_semanal) / 7, celda: (s) => s.sueldo_semanal == null ? "—" : dinero(n(s.sueldo_semanal) / 7) },
    { clave: "desde", titulo: "Desde", valor: (s) => s.desde, celda: (s) => s.origen === "ficha" ? <Insignia tono="aviso">De la ficha</Insignia> : fecha(s.desde) },
    { clave: "cambios", titulo: "Cambios", alinear: "der", sinBusqueda: true, valor: (s) => s.historial.length, celda: (s) => <span className="text-tenue">{s.historial.length}</span> },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-tenue max-w-3xl">Sueldo base semanal de cada persona. Un aumento es un renglón nuevo con su fecha y motivo; el anterior no se reescribe (en la hoja vivía dentro de la fórmula). Total semanal: <b className="text-texto cifra">{dinero(total)}</b>.</p>
      <TablaDatos filas={sueldos.data} columnas={columnas} cargando={sueldos.isLoading} error={sueldos.error} claveFila={(s) => s.empleado_id}
        alClicFila={(s) => setAbierto(s.empleado_id)} exportarComo="sueldos" placeholder="Buscar persona o puesto…"
        filtros={puedeCapturar && <Boton tamano="sm" onClick={() => setNuevo("")}><Plus className="h-4 w-4" /> Registrar sueldo</Boton>}
        vacio={{ icono: Wallet, titulo: "Sin personal activo", texto: "Da de alta al personal en Personal; aquí se registra su sueldo semanal." }} />
      <Lateral abierto={!!elegido} alCambiar={(v) => !v && setAbierto(null)} titulo={elegido?.nombre ?? ""} subtitulo="Historial de sueldo"
        acciones={puedeCapturar && elegido && <Boton tamano="sm" onClick={() => setNuevo(elegido.empleado_id)}><Plus className="h-4 w-4" /> Cambio</Boton>}>
        {elegido && (
          <ol className="space-y-3">
            {elegido.historial.length === 0 && <p className="text-sm text-tenue">Sin historial: se usa el salario diario de la ficha × 7.</p>}
            {elegido.historial.map((h, i) => (
              <li key={h.desde} className="tarjeta p-3 text-sm">
                <div className="flex justify-between"><b className="cifra">{dinero(h.sueldo)}</b><span className="text-tenue">desde {fecha(h.desde)}</span></div>
                <p className="text-tenue text-xs mt-1">{h.motivo}{h.por && ` · ${h.por}`} · {fechaYHora(h.en)}</p>
                {i < elegido.historial.length - 1 && n(elegido.historial[i + 1].sueldo) > 0 && (
                  <p className="text-xs mt-1 text-ok">+{numero(Math.round((n(h.sueldo) / n(elegido.historial[i + 1].sueldo) - 1) * 1000) / 10)} % contra el anterior</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Lateral>
      {nuevo != null && <DialogoSueldo personas={datos} empleadoId={nuevo} alCerrar={() => setNuevo(null)} />}
    </div>
  );
}

function DialogoSueldo({ personas, empleadoId, alCerrar }: { personas: Sueldo[]; empleadoId: string; alCerrar: () => void }) {
  const [f, setF] = useState({ empleado_id: empleadoId, sueldo: "", desde: hoyISO(), motivo: "Aumento anual" });
  const actual = personas.find((p) => p.empleado_id === f.empleado_id);
  const guardar = useAccion(() => q(supabase.from("nomina_sueldos").insert({ empleado_id: f.empleado_id, sueldo_semanal: Number(f.sueldo), desde: f.desde, motivo: f.motivo.trim() })),
    { exito: "Sueldo registrado", invalidar: [["nomina"]], alTerminar: alCerrar });
  const valido = f.empleado_id && Number(f.sueldo) > 0 && f.desde && f.motivo.trim().length >= 3;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Registrar sueldo" descripcion="Sueldo base semanal (7 días). Vale desde la fecha que pongas; las semanas ya cerradas no cambian."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}>Registrar</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <Campo etiqueta="Persona">
          <Seleccion autoFocus={!empleadoId} value={f.empleado_id} onChange={(e) => setF({ ...f, empleado_id: e.target.value })}>
            <option value="">Elige…</option>{personas.map((p) => <option key={p.empleado_id} value={p.empleado_id}>{p.nombre}</option>)}
          </Seleccion>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Sueldo semanal" ayuda={actual?.sueldo_semanal != null ? `Hoy: ${dinero(actual.sueldo_semanal)}` : undefined}>
            <Entrada autoFocus={!!empleadoId} type="number" min={1} step="0.01" value={f.sueldo} onChange={(e) => setF({ ...f, sueldo: e.target.value })} />
          </Campo>
          <Campo etiqueta="Desde"><Entrada type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Campo>
        </div>
        <Campo etiqueta="Motivo"><Entrada value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></Campo>
      </form>
    </Dialogo>
  );
}

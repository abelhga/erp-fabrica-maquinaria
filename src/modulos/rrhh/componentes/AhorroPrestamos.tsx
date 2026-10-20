import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, PiggyBank, Plus, Printer, Settings2, Wallet } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO, numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import { SelectorCuenta } from "@/modulos/finanzas/componentes/cuentas";

const n = (x: number | string | null | undefined) => Number(x ?? 0);
const sumarDias = (f: string, d: number) => { const x = new Date(f + "T12:00:00"); x.setDate(x.getDate() + d); return x.toLocaleDateString("en-CA"); };
/** Abre el papel para imprimir en otra pestaña: la lista se queda donde estaba. */
export const abrirDocumento = (tipo: "pagare" | "abono" | "retiro", id: string) => window.open(`/rrhh/documento/${tipo}/${id}`, "_blank");

export interface Reglas { dias_anticipacion: number; aportacion_empresa_pct: number; interes_moratorio_pct: number }
export function useReglas() {
  return useQuery({ queryKey: ["nomina", "reglas"], queryFn: () => q<Reglas>(supabase.rpc("reglas_ahorro_prestamos")) });
}

/** Las reglas de ahorro y préstamos (las tres juntas: se guardan en el mismo lugar). */
export function DialogoReglas({ alCerrar }: { alCerrar: () => void }) {
  const reglas = useReglas();
  const [f, setF] = useState<{ dias: string; empresa: string; interes: string } | null>(null);
  useEffect(() => {
    if (reglas.data && !f) setF({ dias: String(reglas.data.dias_anticipacion), empresa: String(n(reglas.data.aportacion_empresa_pct)), interes: String(n(reglas.data.interes_moratorio_pct)) });
  }, [reglas.data, f]);
  const guardar = useAccion(() => q(supabase.rpc("fijar_reglas_ahorro_prestamos", {
    p_dias_anticipacion: Number(f!.dias), p_aportacion_empresa_pct: Number(f!.empresa), p_interes_moratorio_pct: Number(f!.interes),
  })), { exito: "Reglas guardadas", invalidar: [["nomina"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Reglas de ahorro y préstamos"
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!f} onClick={() => guardar.mutate(undefined)}>Guardar</Boton></>}>
      {!f ? <Cargando filas={3} /> : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
          <Campo etiqueta="Días de anticipación para retirar ahorro" ayuda="Entre el día que lo pide y el día que se le entrega. 0 = el mismo día.">
            <Entrada type="number" min={0} max={120} className="cifra w-28 block" value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} />
          </Campo>
          <Campo etiqueta="La empresa pone (% de lo que ahorra cada quien)" ayuda="0 = solo ahorra la persona. Se suma al cerrar cada semana.">
            <Entrada type="number" min={0} max={100} step="0.01" className="cifra w-28 block" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} />
          </Campo>
          <Campo etiqueta="Interés moratorio de préstamos (% mensual)" ayuda="0 = sin interés. Solo cambia lo que dice el pagaré: la prenómina no cobra intereses.">
            <Entrada type="number" min={0} max={10} step="0.01" className="cifra w-28 block" value={f.interes} onChange={(e) => setF({ ...f, interes: e.target.value })} />
          </Campo>
        </form>
      )}
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Caja de ahorro
// ---------------------------------------------------------------------------
interface FilaAhorro {
  empleado_id: string; nombre: string; numero: string | null; activo: boolean; ahorro_semanal: number; desde: string | null;
  aportado: number; empresa: number; saldo_inicial: number; retirado: number; saldo: number; ultimo_retiro: string | null;
}
interface MovAhorro { id: string; tipo: "aportacion" | "aportacion_empresa" | "saldo_inicial" | "retiro"; importe: number; fecha: string; semana: string | null; solicitado_el: string | null; folio: string | null; nota: string | null; registrado_por: string | null }
const TIPO_MOV: Record<MovAhorro["tipo"], string> = { aportacion: "Nómina", aportacion_empresa: "Pone la empresa", saldo_inicial: "Saldo inicial", retiro: "Retiro" };

export function Ahorro({ semanas, puedeCapturar }: { semanas: { inicio: string; pago: string; estado: string }[]; puedeCapturar: boolean }) {
  const filas = useQuery({ queryKey: ["nomina", "ahorro"], queryFn: () => q<FilaAhorro[]>(supabase.rpc("ahorro_nomina")) });
  const reglas = useReglas();
  const [dialogo, setDialogo] = useState<null | { tipo: "aportacion" | "retiro" | "inicial" | "historial"; f: FilaAhorro } | { tipo: "reglas" }>(null);
  const datos = filas.data ?? [];
  const ahorran = datos.filter((f) => n(f.ahorro_semanal) > 0);
  const columnas: Columna<FilaAhorro>[] = [
    { clave: "nombre", titulo: "Persona", valor: (f) => f.nombre, celda: (f) => <div><p className="font-medium">{f.nombre}</p><p className="text-xs text-tenue">{[f.numero, !f.activo && "baja"].filter(Boolean).join(" · ")}</p></div> },
    {
      clave: "ahorro_semanal", titulo: "Ahorra por semana", explica: GLOSARIO.ahorroSemanal, alinear: "der", sinBusqueda: true, valor: (f) => n(f.ahorro_semanal),
      celda: (f) => n(f.ahorro_semanal) > 0 ? <span>{dinero(f.ahorro_semanal)}{f.desde && <span className="block text-[11px] text-tenue">desde {fecha(f.desde)}</span>}</span> : <span className="text-tenue">—</span>,
    },
    { clave: "aportado", titulo: "Ahorrado", alinear: "der", sinBusqueda: true, valor: (f) => n(f.aportado) + n(f.empresa) + n(f.saldo_inicial), celda: (f) => dinero(n(f.aportado) + n(f.empresa) + n(f.saldo_inicial)) },
    { clave: "retirado", titulo: "Retirado", alinear: "der", sinBusqueda: true, valor: (f) => n(f.retirado), celda: (f) => n(f.retirado) ? dinero(f.retirado) : <span className="text-tenue">—</span> },
    { clave: "saldo", titulo: "Saldo", explica: GLOSARIO.saldoAhorro, alinear: "der", sinBusqueda: true, valor: (f) => n(f.saldo), celda: (f) => <b>{dinero(f.saldo)}</b> },
    {
      clave: "acciones", titulo: "", sinBusqueda: true,
      celda: (f) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {puedeCapturar && f.activo && <Boton variante="fantasma" tamano="sm" onClick={() => setDialogo({ tipo: "aportacion", f })}>Ahorro</Boton>}
          {puedeCapturar && n(f.saldo) > 0 && <Boton variante="secundario" tamano="sm" onClick={() => setDialogo({ tipo: "retiro", f })}>Retiro</Boton>}
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Saldo de la caja" valor={dinero(datos.reduce((s, f) => s + n(f.saldo), 0))} icono={PiggyBank} explica={GLOSARIO.saldoAhorro} detalle="Lo que se le debe devolver al personal" />
        <Kpi titulo="Ahorran" valor={numero(ahorran.length)} icono={Wallet} tono="info" detalle={`${dinero(ahorran.reduce((s, f) => s + n(f.ahorro_semanal), 0))} por semana`} />
        <div className="tarjeta p-4 text-sm col-span-2 flex items-start gap-3" data-explain={GLOSARIO.retiroAhorro} data-explain-title="Reglas">
          <div className="flex-1">
            <p className="font-medium">Reglas</p>
            {reglas.data && <p className="text-tenue text-xs mt-0.5">
              Retiros con {reglas.data.dias_anticipacion} día{reglas.data.dias_anticipacion === 1 ? "" : "s"} de anticipación · la empresa
              {n(reglas.data.aportacion_empresa_pct) > 0 ? ` pone el ${n(reglas.data.aportacion_empresa_pct)} %` : " no pone nada"} · préstamos
              {n(reglas.data.interes_moratorio_pct) > 0 ? ` con ${n(reglas.data.interes_moratorio_pct)} % mensual de interés moratorio` : " sin interés"}
            </p>}
          </div>
          {puedeCapturar && <Boton variante="fantasma" tamano="sm" onClick={() => setDialogo({ tipo: "reglas" })}><Settings2 className="h-4 w-4" /> Cambiar</Boton>}
        </div>
      </div>
      <TablaDatos filas={filas.data} columnas={columnas} cargando={filas.isLoading} error={filas.error} claveFila={(f) => f.empleado_id}
        alClicFila={(f) => setDialogo({ tipo: "historial", f })} exportarComo="caja-de-ahorro" placeholder="Buscar persona…"
        vacio={{ icono: PiggyBank, titulo: "Nadie ahorra todavía", texto: "Con «Ahorro» en el renglón de cada persona capturas cuánto decidió ahorrar por semana; se descuenta solo en la prenómina." }} />
      {dialogo?.tipo === "reglas" && <DialogoReglas alCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "aportacion" && <DialogoAportacion f={dialogo.f} semanas={semanas.filter((s) => s.estado === "abierta")} alCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "retiro" && <DialogoRetiro f={dialogo.f} dias={reglas.data?.dias_anticipacion ?? 0} alCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "inicial" && <DialogoSaldoInicial f={dialogo.f} alCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "historial" && <HistorialAhorro f={dialogo.f} puedeCapturar={puedeCapturar} alCerrar={() => setDialogo(null)}
        alSaldoInicial={() => setDialogo({ tipo: "inicial", f: dialogo.f })} />}
    </div>
  );
}

function DialogoAportacion({ f, semanas, alCerrar }: { f: FilaAhorro; semanas: { inicio: string; pago: string }[]; alCerrar: () => void }) {
  const ordenadas = [...semanas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const [v, setV] = useState({ monto: n(f.ahorro_semanal) ? String(n(f.ahorro_semanal)) : "", desde: ordenadas.find((s) => sumarDias(s.inicio, 6) >= hoyISO())?.inicio ?? ordenadas[0]?.inicio ?? "", motivo: "" });
  const guardar = useAccion(() => q(supabase.rpc("fijar_ahorro_semanal", { p_empleado: f.empleado_id, p_monto: Number(v.monto || 0), p_desde: v.desde, p_motivo: v.motivo || null })),
    { exito: Number(v.monto || 0) > 0 ? "Ahorro semanal guardado" : "Dejará de ahorrar desde esa semana", invalidar: [["nomina"]], alTerminar: alCerrar });
  const valido = v.monto !== "" && Number(v.monto) >= 0 && v.desde;
  return (
    <Dialogo abierto alCambiar={(x) => !x && alCerrar()} titulo={`Ahorro de ${f.nombre}`} descripcion="Lo que la persona decidió ahorrar cada semana. Se descuenta solo en la prenómina hasta que lo cambies."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}>Guardar</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Ahorro por semana" ayuda="0 = deja de ahorrar."><Entrada autoFocus type="number" min={0} step="0.01" className="cifra" value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} /></Campo>
          <Campo etiqueta="Desde la semana">
            <Seleccion value={v.desde} onChange={(e) => setV({ ...v, desde: e.target.value })}>
              {ordenadas.map((s) => <option key={s.inicio} value={s.inicio}>Del {fecha(s.inicio)} (se paga el {fecha(s.pago)})</option>)}
            </Seleccion>
          </Campo>
        </div>
        <Campo etiqueta="Nota (opcional)"><Entrada value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} placeholder="Lo pidió por escrito el…" /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoRetiro({ f, dias, alCerrar }: { f: FilaAhorro; dias: number; alCerrar: () => void }) {
  // Se registra el día que se le entrega el dinero (así queda en la cuenta de donde salió):
  // por eso la entrega es hoy y lo que se pregunta es cuándo lo pidió.
  const [v, setV] = useState({ importe: String(n(f.saldo)), solicitado: sumarDias(hoyISO(), -dias), entrega: hoyISO(), cuenta: "", nota: "" });
  const minimo = sumarDias(v.solicitado || hoyISO(), dias);
  const guardar = useAccion(() => q<string>(supabase.rpc("retirar_ahorro", { p_empleado: f.empleado_id, p_importe: Number(v.importe), p_solicitado_el: v.solicitado, p_entrega: v.entrega, p_cuenta: v.cuenta, p_nota: v.nota || null })),
    { exito: "Retiro registrado (también en finanzas): imprime el recibo para que lo firme", invalidar: [["nomina"]], alTerminar: (id) => { abrirDocumento("retiro", id as string); alCerrar(); } });
  const valido = Number(v.importe) > 0 && Number(v.importe) <= n(f.saldo) && v.solicitado && v.entrega >= minimo && v.entrega <= hoyISO() && !!v.cuenta;
  return (
    <Dialogo abierto alCambiar={(x) => !x && alCerrar()} titulo={`Retiro de ahorro de ${f.nombre}`} descripcion={`Saldo: ${dinero(f.saldo)}. Regístralo el día que se le entrega: sale el recibo con folio para que lo firme.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!valido} onClick={() => guardar.mutate(undefined)}><Printer className="h-4 w-4" /> Registrar y ver recibo</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <Campo etiqueta="Importe" ayuda={Number(v.importe) > n(f.saldo) ? `No puede pasar de ${dinero(f.saldo)}` : undefined}>
          <Entrada autoFocus type="number" min={0.01} max={n(f.saldo)} step="0.01" className="cifra" value={v.importe} onChange={(e) => setV({ ...v, importe: e.target.value })} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Lo pidió el" ayuda={v.entrega < minimo ? `Con ${dias} días de anticipación se le puede entregar desde el ${fecha(minimo)}.` : undefined}>
            <Entrada type="date" max={hoyISO()} value={v.solicitado} onChange={(e) => setV({ ...v, solicitado: e.target.value })} />
          </Campo>
          <Campo etiqueta="Se le entrega el"><Entrada type="date" min={minimo} max={hoyISO()} value={v.entrega} onChange={(e) => setV({ ...v, entrega: e.target.value })} /></Campo>
        </div>
        <Campo etiqueta="Sale de la cuenta" ayuda="Queda en Pagos hechos de finanzas; si es caja chica, también en su libro.">
          <span data-explain={GLOSARIO.cuentaNomina} className="block"><SelectorCuenta soloDinero valor={v.cuenta} alCambiar={(c) => setV({ ...v, cuenta: c })} /></span>
        </Campo>
        <Campo etiqueta="Nota (opcional)"><Entrada value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} placeholder="Para inscripción escolar…" /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoSaldoInicial({ f, alCerrar }: { f: FilaAhorro; alCerrar: () => void }) {
  const [v, setV] = useState({ importe: "", fecha: hoyISO(), nota: "" });
  const guardar = useAccion(() => q(supabase.rpc("saldo_inicial_ahorro", { p_empleado: f.empleado_id, p_importe: Number(v.importe), p_fecha: v.fecha, p_nota: v.nota || null })),
    { exito: "Saldo inicial registrado", invalidar: [["nomina"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(x) => !x && alCerrar()} titulo={`Saldo inicial de ${f.nombre}`} descripcion="Lo que ya tenía ahorrado antes del ERP (del control en Excel). Se registra una sola vez."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={guardar.isPending} disabled={!(Number(v.importe) > 0)} onClick={() => guardar.mutate(undefined)}>Registrar</Boton></>}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (Number(v.importe) > 0) guardar.mutate(undefined); }}>
        <Campo etiqueta="Saldo"><Entrada autoFocus type="number" min={0.01} step="0.01" className="cifra" value={v.importe} onChange={(e) => setV({ ...v, importe: e.target.value })} /></Campo>
        <Campo etiqueta="Al día"><Entrada type="date" max={hoyISO()} value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} /></Campo>
        <Campo etiqueta="Nota" className="sm:col-span-2"><Entrada value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} placeholder="Control de ahorro en Excel" /></Campo>
      </form>
    </Dialogo>
  );
}

function HistorialAhorro({ f, puedeCapturar, alCerrar, alSaldoInicial }: { f: FilaAhorro; puedeCapturar: boolean; alCerrar: () => void; alSaldoInicial: () => void }) {
  const movs = useQuery({ queryKey: ["nomina", "ahorro", f.empleado_id], queryFn: () => q<MovAhorro[]>(supabase.rpc("movimientos_ahorro", { p_empleado: f.empleado_id })) });
  return (
    <Lateral abierto alCambiar={(x) => !x && alCerrar()} titulo={`Ahorro de ${f.nombre}`} subtitulo={`Saldo ${dinero(f.saldo)}`}
      acciones={puedeCapturar && n(f.saldo_inicial) === 0 && <Boton variante="secundario" tamano="sm" onClick={alSaldoInicial}><Plus className="h-4 w-4" /> Saldo inicial</Boton>}>
      {movs.isLoading ? <Cargando filas={4} /> : !movs.data?.length ? <p className="text-sm text-tenue">Sin movimientos todavía: lo de cada semana entra al cerrarla.</p> : (
        <ul className="divide-y divide-borde text-sm">
          {movs.data.map((m) => (
            <li key={m.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{TIPO_MOV[m.tipo]}{m.folio && <span className="text-tenue font-normal"> · {m.folio}</span>}</p>
                <p className="text-xs text-tenue">{fecha(m.fecha)}{m.solicitado_el && ` · lo pidió el ${fecha(m.solicitado_el)}`}{m.nota && ` · ${m.nota}`}</p>
              </div>
              <span className={m.tipo === "retiro" ? "cifra text-peligro" : "cifra"}>{m.tipo === "retiro" ? "−" : ""}{dinero(m.importe)}</span>
              {m.tipo === "retiro" && <Boton variante="fantasma" tamano="sm" onClick={() => abrirDocumento("retiro", m.id)} aria-label="Recibo"><FileText className="h-4 w-4" /></Boton>}
            </li>
          ))}
        </ul>
      )}
    </Lateral>
  );
}

// ---------------------------------------------------------------------------
// Préstamos: abono extra y pagaré
// ---------------------------------------------------------------------------
export interface PrestamoAbono { id: string; folio: string; nombre: string; saldo: number; descuento_semanal: number; pagare_firmado_el: string | null }

/** Un abono mayor al descuento: en efectivo (sale recibo) o descontando más en la nómina de una semana abierta. */
export function DialogoAbonar({ p, semanas, alCerrar }: { p: PrestamoAbono; semanas: { inicio: string; pago: string }[]; alCerrar: () => void }) {
  const ordenadas = [...semanas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const [modo, setModo] = useState<"efectivo" | "nomina">("efectivo");
  const [v, setV] = useState({ importe: "", fecha: hoyISO(), cuenta: "", semana: ordenadas.find((s) => sumarDias(s.inicio, 6) >= hoyISO())?.inicio ?? ordenadas[0]?.inicio ?? "", nota: "" });
  const efectivo = useAccion(() => q<string>(supabase.rpc("abonar_prestamo", { p_prestamo: p.id, p_importe: Number(v.importe), p_fecha: v.fecha, p_cuenta: v.cuenta, p_nota: v.nota || null })),
    { exito: "Abono registrado (también en finanzas): imprime el recibo", invalidar: [["nomina"]], alTerminar: (id) => { abrirDocumento("abono", id as string); alCerrar(); } });
  const nomina = useAccion(() => q(supabase.rpc("fijar_abono_semana", { p_prestamo: p.id, p_semana: v.semana, p_importe: Number(v.importe) })),
    { exito: "Esa semana se descuenta lo que pusiste", invalidar: [["nomina"]], alTerminar: alCerrar });
  const importe = Number(v.importe);
  const valido = importe > 0 && importe <= n(p.saldo) && (modo === "efectivo" ? !!v.fecha && !!v.cuenta : !!v.semana);
  const enviar = () => valido && (modo === "efectivo" ? efectivo.mutate(undefined) : nomina.mutate(undefined));
  return (
    <Dialogo abierto alCambiar={(x) => !x && alCerrar()} titulo={`Abonar al préstamo ${p.folio}`} descripcion={`${p.nombre} · saldo ${dinero(p.saldo)} · descuento normal ${dinero(p.descuento_semanal)} por semana.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton cargando={efectivo.isPending || nomina.isPending} disabled={!valido} onClick={enviar}>{modo === "efectivo" ? "Registrar y ver recibo" : "Guardar"}</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-fondo p-1" data-explain={GLOSARIO.abonoPrestamo} data-explain-title="Abono al préstamo">
          {([["efectivo", "Lo paga en efectivo"], ["nomina", "Se descuenta más en nómina"]] as const).map(([m, t]) => (
            <button key={m} type="button" onClick={() => setModo(m)}
              className={`rounded-md py-1.5 text-sm font-medium ${modo === m ? "bg-superficie shadow-tarjeta text-texto" : "text-tenue"}`}>{t}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta={modo === "efectivo" ? "Importe" : "Descontar esa semana"} ayuda={importe > n(p.saldo) ? `No puede pasar de ${dinero(p.saldo)}` : undefined}>
            <Entrada autoFocus type="number" min={0.01} max={n(p.saldo)} step="0.01" className="cifra" value={v.importe} onChange={(e) => setV({ ...v, importe: e.target.value })} />
          </Campo>
          {modo === "efectivo"
            ? <Campo etiqueta="Fecha"><Entrada type="date" max={hoyISO()} value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} /></Campo>
            : <Campo etiqueta="En la semana">
                <Seleccion value={v.semana} onChange={(e) => setV({ ...v, semana: e.target.value })}>
                  {ordenadas.map((s) => <option key={s.inicio} value={s.inicio}>Del {fecha(s.inicio)} (se paga el {fecha(s.pago)})</option>)}
                </Seleccion>
              </Campo>}
        </div>
        {modo === "efectivo" && <Campo etiqueta="Entra a la cuenta" ayuda="Si lo recibes en efectivo y se queda en la caja chica, elige caja chica: entra a su libro.">
          <span data-explain={GLOSARIO.cuentaNomina} className="block"><SelectorCuenta soloDinero valor={v.cuenta} alCambiar={(c) => setV({ ...v, cuenta: c })} /></span>
        </Campo>}
        {modo === "efectivo" && <Campo etiqueta="Nota (opcional)"><Entrada value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} placeholder="Abonó de su aguinaldo…" /></Campo>}
        <p className="text-xs text-tenue">{modo === "efectivo"
          ? "Baja el saldo hoy; las semanas que faltan se recalculan con el mismo descuento semanal."
          : "Reemplaza el descuento normal de esa semana (solo semanas abiertas)."}</p>
      </form>
    </Dialogo>
  );
}

/** El pagaré: imprimirlo y anotar cuándo lo firmó. */
export function DialogoPagare({ p, alCerrar }: { p: PrestamoAbono; alCerrar: () => void }) {
  const [firmado, setFirmado] = useState(p.pagare_firmado_el ?? hoyISO());
  const guardar = useAccion(() => q(supabase.rpc("marcar_pagare_firmado", { p_prestamo: p.id, p_fecha: firmado || null })),
    { exito: "Firma del pagaré anotada", invalidar: [["nomina"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(x) => !x && alCerrar()} titulo={`Pagaré del préstamo ${p.folio}`} descripcion={`${p.nombre}. Imprímelo, que lo firme, y anota la fecha de firma. Guarda el original firmado.`}
      pie={<><Boton variante="secundario" onClick={() => abrirDocumento("pagare", p.id)}><Printer className="h-4 w-4" /> Imprimir pagaré</Boton>
        <Boton cargando={guardar.isPending} disabled={!firmado} onClick={() => guardar.mutate(undefined)}>Anotar firma</Boton></>}>
      <Campo etiqueta="Lo firmó el"><Entrada type="date" max={hoyISO()} value={firmado} onChange={(e) => setFirmado(e.target.value)} /></Campo>
    </Dialogo>
  );
}

export function InsigniaPagare({ firmado }: { firmado: string | null }) {
  return <span data-explain={GLOSARIO.pagarePrestamo} data-explain-title="Pagaré">{firmado
    ? <Insignia tono="ok">Firmado {fecha(firmado)}</Insignia> : <Insignia tono="aviso">Pagaré por firmar</Insignia>}</span>;
}

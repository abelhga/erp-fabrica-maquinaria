import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Camera, CalendarPlus, Gauge, Hand, History, Pencil, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Kpi } from "@/components/ui/kpi";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { CLAVE, TIPO_MAQUINA, comprimirImagen, horas, subirArchivo, useServicioEnVivo, useUrlsFirmadas, type Maquina, type OrdenMto, type Plan, type Resguardo } from "./datos";
import { Dato, EnlaceBoton, InsigniaMaquina, InsigniaMto, usePermisosServicio } from "./componentes/piezas";
import { LateralMantenimiento } from "./componentes/LateralMantenimiento";
import { DialogoMaquina } from "./componentes/DialogoMaquina";

interface CostoOrden { mantenimiento_id: string; material: number | null; servicio_externo: number | null; mano_obra: number | null; otro: number | null; total: number }

/** Ficha de una máquina: estado, historial con costo acumulado, preventivos y quién la tiene. */
export default function FichaMaquina() {
  const { id = "" } = useParams();
  useServicioEnVivo(["maquinas", "ordenes_mantenimiento", "resguardos", "planes_preventivos"]);
  const p = usePermisosServicio();
  const qc = useQueryClient();
  const maq = useQuery({ queryKey: [...CLAVE, "maquina", id], queryFn: () => q<Maquina | null>(supabase.from("v_maquinas").select("*").eq("id", id).maybeSingle()) });
  const historial = useQuery({
    queryKey: [...CLAVE, "maquina", id, "historial"],
    queryFn: () => q<OrdenMto[]>(supabase.from("v_ordenes_mantenimiento").select("*").eq("maquina_id", id).order("reportado_en", { ascending: false })),
  });
  const planes = useQuery({ queryKey: [...CLAVE, "maquina", id, "planes"], queryFn: () => q<Plan[]>(supabase.from("v_planes_preventivos").select("*").eq("maquina_id", id).order("nombre")) });
  const resguardos = useQuery({
    queryKey: [...CLAVE, "maquina", id, "resguardos"],
    queryFn: () => q<Resguardo[]>(supabase.from("v_resguardos").select("*").eq("maquina_id", id).order("entregado_en", { ascending: false }).limit(20)),
  });
  // Costos: la RLS de costos_servicio decide; a quien no los ve le llegan vacíos y la tarjeta ni se pinta.
  const costos = useQuery({
    queryKey: [...CLAVE, "maquina", id, "costos"],
    enabled: p.costos,
    queryFn: () => q<CostoOrden[]>(supabase.from("v_costos_servicio").select("mantenimiento_id, material, servicio_externo, mano_obra, otro, total").eq("maquina_id", id)),
  });
  const foto = useUrlsFirmadas(maq.data?.foto_ruta ? [maq.data.foto_ruta] : []);
  const [orden, setOrden] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "editar" | "horas" | "plan">(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  if (maq.error) return <Pagina titulo="Máquina"><ErrorCarga error={maq.error} /></Pagina>;
  if (maq.isLoading) return <Pagina titulo="Máquina"><Cargando filas={8} /></Pagina>;
  const m = maq.data;
  if (!m) return <Pagina titulo="Máquina"><div className="tarjeta"><Vacio icono={Wrench} titulo="No existe esa máquina" accion={<Link className="text-marca-texto text-sm" to="/servicio/maquinas">Volver</Link>} /></div></Pagina>;

  const costoDe = (oid: string) => costos.data?.find((c) => c.mantenimiento_id === oid)?.total;
  const total = (costos.data ?? []).reduce((s, c) => s + Number(c.total), 0);
  const hace12 = Date.now() - 365 * 86_400_000;
  const total12 = (costos.data ?? []).filter((c) => (historial.data ?? []).some((o) => o.id === c.mantenimiento_id && new Date(o.reportado_en).getTime() > hace12))
    .reduce((s, c) => s + Number(c.total), 0);
  const abierto = (resguardos.data ?? []).find((r) => r.abierto);

  async function cambiarFoto(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const ruta = await subirArchivo(`maquinas/${m!.id}`, await comprimirImagen(archivo, 1200));
      await q(supabase.from("maquinas").update({ foto_ruta: ruta }).eq("id", m!.id));
      toast.success("Foto actualizada");
      qc.invalidateQueries({ queryKey: CLAVE });
    } catch (e) { toast.error(mensajeError(e)); } finally { setSubiendo(false); }
  }

  return (
    <Pagina
      titulo={<span className="flex flex-wrap items-center gap-3"><span className="cifra">{m.numero}</span><span className="font-normal">{m.nombre}</span><InsigniaMaquina estado={m.estado} /></span>}
      descripcion={`${TIPO_MAQUINA[m.tipo]} · ${m.categoria}${m.etapa ? ` · ${m.etapa}` : ""}${m.ubicacion ? ` · ${m.ubicacion}` : ""}`}
      acciones={<>
        <Link to="/servicio/maquinas" className="inline-flex items-center gap-1 text-sm text-tenue hover:text-texto mr-2"><ArrowLeft className="h-4 w-4" />Máquinas</Link>
        {p.pedir && m.estado !== "baja" && <EnlaceBoton a={`/servicio/reportar?maquina=${m.id}&volver=/servicio/maquinas/${m.id}`} variante="peligro"><AlertTriangle className="h-4 w-4" />Reportar falla</EnlaceBoton>}
        {m.usa_horometro && p.personal && <Boton variante="secundario" onClick={() => setDialogo("horas")}><Gauge className="h-4 w-4" />Registrar horas</Boton>}
        {(m.prestable || m.tipo === "herramienta") && !abierto && p.personal && <EnlaceBoton a={`/servicio/resguardos?prestar=${m.id}`}><Hand className="h-4 w-4" />Prestar</EnlaceBoton>}
        {p.gerencia && <Boton variante="secundario" onClick={() => setDialogo("editar")}><Pencil className="h-4 w-4" />Editar</Boton>}
      </>}
    >
      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <Tarjeta className="overflow-hidden">
          <div className="aspect-[4/3] bg-fondo flex items-center justify-center relative">
            {m.foto_ruta && foto.data?.[m.foto_ruta] ? <img src={foto.data[m.foto_ruta]} alt={m.nombre} className="h-full w-full object-cover" />
              : <Wrench className="h-14 w-14 text-tenue/50" aria-hidden />}
            {p.gerencia && (
              <>
                <input ref={entradaFoto} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => cambiarFoto(e.target.files?.[0])} aria-label="Foto de la máquina" />
                <Boton variante="secundario" tamano="sm" className="absolute bottom-2 right-2" cargando={subiendo} onClick={() => entradaFoto.current?.click()}>
                  <Camera className="h-3.5 w-3.5" />{m.foto_ruta ? "Cambiar foto" : "Agregar foto"}
                </Boton>
              </>
            )}
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Dato etiqueta="Marca y modelo">{[m.marca, m.modelo].filter(Boolean).join(" ") || "—"}</Dato>
            <Dato etiqueta="Serie">{m.numero_serie ?? "—"}</Dato>
            <Dato etiqueta="Horas de uso">{m.usa_horometro ? <>{horas(m.horas_uso)}<span className="block text-xs text-tenue">{m.horas_actualizado_en ? hace(m.horas_actualizado_en) : ""}</span></> : "Sin horómetro"}</Dato>
            <Dato etiqueta="Alta">{fecha(m.fecha_alta)}</Dato>
            {m.critica && <Dato etiqueta="Importancia"><Insignia tono="aviso">Crítica: si se para, se para el área</Insignia></Dato>}
            {m.notas && <Dato etiqueta="Notas" className="col-span-2">{m.notas}</Dato>}
          </div>
        </Tarjeta>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi titulo="Fallas en 12 meses" valor={numero(m.fallas_12m)} icono={AlertTriangle} tono={m.fallas_12m >= 3 ? "peligro" : m.fallas_12m ? "aviso" : "ok"}
                 detalle={m.ultima_falla ? `La última ${hace(m.ultima_falla)}` : "Sin fallas registradas"} />
            <Kpi titulo="Tiempo parada en 12 meses" valor={m.horas_paro_12m >= 48 ? `${Math.round(m.horas_paro_12m / 24)} días` : horas(m.horas_paro_12m)} icono={History} tono={m.horas_paro_12m > 0 ? "aviso" : "ok"}
                 detalle="Desde que se reporta parada hasta que se cierra" />
            {p.costos ? (
              <Kpi titulo="Costo acumulado" valor={dinero(total)} icono={Wrench} tono="marca"
                   detalle={`${dinero(total12)} en los últimos 12 meses${p.costosArticulo ? "" : " · sin refacciones de almacén (las ve quien tiene costos)"}`} />
            ) : (
              <Kpi titulo="Órdenes abiertas" valor={numero(m.ordenes_abiertas)} icono={Wrench} tono={m.ordenes_abiertas ? "aviso" : "ok"} detalle={m.orden_folio ?? "Ninguna"} />
            )}
          </div>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Historial de mantenimiento" descripcion={`${(historial.data ?? []).length} ${(historial.data ?? []).length === 1 ? "orden" : "órdenes"}${p.costos ? " · costo por orden" : ""}`} />
            {historial.isLoading ? <Cargando filas={3} /> : (historial.data ?? []).length === 0 ? (
              <Vacio icono={History} titulo="Sin historial todavía" texto="Cada falla reportada y cada preventivo quedan aquí, con su costo y el tiempo que estuvo parada." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead><tr><th>Folio</th><th>Qué pasó</th><th className="text-right">Parada</th>{p.costos && <th className="text-right">Costo</th>}<th>Estado</th></tr></thead>
                  <tbody>
                    {historial.data!.map((o) => (
                      <tr key={o.id} className="cursor-pointer" onClick={() => setOrden(o.id)}>
                        <td className="cifra whitespace-nowrap">{o.folio}<span className="block text-[11px] text-tenue">{o.tipo === "preventivo" ? "Preventivo" : "Falla"} · {fecha(o.reportado_en)}</span></td>
                        <td className="min-w-[220px]"><p className="leading-tight line-clamp-2">{o.trabajo_realizado ?? o.diagnostico ?? o.falla}</p>
                          <p className="text-[11px] text-tenue truncate">{o.reportado_por_nombre}</p></td>
                        <td className="text-right cifra">{o.horas_paro == null ? "—" : o.horas_paro >= 48 ? `${Math.round(o.horas_paro / 24)} d` : horas(o.horas_paro)}</td>
                        {p.costos && <td className="text-right cifra">{costoDe(o.id) != null ? dinero(costoDe(o.id)) : "—"}</td>}
                        <td><InsigniaMto estado={o.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>

          <div className="grid gap-4 md:grid-cols-2 items-start">
            <Tarjeta>
              <EncabezadoTarjeta titulo="Plan preventivo" descripcion="La orden sale sola cuando vence (por fecha o por horas)."
                acciones={p.gerencia && <Boton variante="secundario" tamano="sm" onClick={() => { setPlan(null); setDialogo("plan"); }}><CalendarPlus className="h-3.5 w-3.5" />Agregar</Boton>} />
              <div className="px-5 pb-4 space-y-2">
                {(planes.data ?? []).length === 0 ? <p className="text-sm text-tenue">Sin plan. Un preventivo a tiempo cuesta menos que la falla.</p>
                  : planes.data!.map((x) => (
                    <button key={x.id} type="button" disabled={!p.gerencia} onClick={() => { setPlan(x); setDialogo("plan"); }}
                            className="w-full text-left rounded-lg border border-borde p-3 hover:bg-fondo disabled:hover:bg-transparent">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{x.nombre}{!x.activo && <span className="text-tenue font-normal"> · pausado</span>}</p>
                        <Insignia tono={x.situacion === "vencido" ? "peligro" : x.situacion === "por_vencer" ? "aviso" : "ok"}>
                          {x.situacion === "vencido" ? "Vencido" : x.situacion === "por_vencer" ? "Por vencer" : "Al día"}
                        </Insignia>
                      </div>
                      <p className="text-xs text-tenue mt-1">
                        Cada {[x.cada_dias && `${x.cada_dias} días`, x.cada_horas && horas(x.cada_horas)].filter(Boolean).join(" o ")} ·
                        último {fecha(x.ultima_fecha)} · toca {x.proxima_fecha ? fecha(x.proxima_fecha) : `a las ${horas(x.proximas_horas)}`}
                        {x.orden_folio && ` · ${x.orden_folio}`}
                      </p>
                    </button>
                  ))}
              </div>
            </Tarjeta>

            <Tarjeta>
              <EncabezadoTarjeta titulo="Resguardo" descripcion={m.prestable || m.tipo === "herramienta" ? "Quién se la llevó y cuándo la regresó." : "Equipo fijo: no se presta."} />
              <div className="px-5 pb-4 space-y-2 text-sm">
                {abierto && (
                  <div className={`rounded-lg border p-3 ${abierto.vencido ? "border-peligro/30 bg-peligro-suave" : "border-borde"}`}>
                    <p className="font-medium">La tiene {abierto.quien}</p>
                    <p className="text-xs text-tenue">Desde {fechaYHora(abierto.entregado_en)} ({abierto.dias} {abierto.dias === 1 ? "día" : "días"}){abierto.servicio_folio && ` · ${abierto.servicio_folio}`}</p>
                    <Link to="/servicio/resguardos" className="text-xs text-marca-texto">Recibirla en resguardos</Link>
                  </div>
                )}
                {(resguardos.data ?? []).filter((r) => !r.abierto).slice(0, 5).map((r) => (
                  <p key={r.id} className="text-xs text-tenue">{fecha(r.entregado_en)} → {fecha(r.devuelto_en)} · {r.quien}{r.estado_devolucion !== "bien" && r.estado_devolucion ? ` · regresó ${r.estado_devolucion === "con_dano" ? "dañada" : "incompleta"}` : ""}</p>
                ))}
                {!abierto && (resguardos.data ?? []).length === 0 && <p className="text-tenue">Nadie la ha pedido prestada.</p>}
              </div>
            </Tarjeta>
          </div>
        </div>
      </div>

      <LateralMantenimiento id={orden} alCerrar={() => setOrden(null)} />
      {dialogo === "editar" && <DialogoMaquina m={m} alCerrar={() => setDialogo(null)} />}
      {dialogo === "horas" && <DialogoHoras m={m} alCerrar={() => setDialogo(null)} />}
      {dialogo === "plan" && <DialogoPlan maquinaId={m.id} plan={plan} horasActuales={m.horas_uso} alCerrar={() => setDialogo(null)} />}
    </Pagina>
  );
}

function DialogoHoras({ m, alCerrar }: { m: Maquina; alCerrar: () => void }) {
  const [h, setH] = useState(String(m.horas_uso));
  const registrar = useAccion(() => q<number>(supabase.rpc("registrar_horas_maquina", { p_maquina: m.id, p_horas: Number(h) })), {
    exito: (n) => (n ? "Horas registradas: ya le toca su preventivo y la orden quedó generada" : "Horas registradas"), invalidar: [CLAVE], alTerminar: alCerrar,
  });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Horómetro de ${m.numero}`} descripcion={`Última lectura: ${horas(m.horas_uso)}`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-horas" cargando={registrar.isPending} disabled={!(Number(h) >= m.horas_uso)}>Guardar</Boton></>}>
      <form id="form-horas" onSubmit={(e) => { e.preventDefault(); registrar.mutate(); }}>
        <Campo etiqueta="Lectura de hoy (horas)"><Entrada type="number" min={m.horas_uso} step="0.1" value={h} onChange={(e) => setH(e.target.value)} autoFocus /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoPlan({ maquinaId, plan, horasActuales, alCerrar }: { maquinaId: string; plan: Plan | null; horasActuales: number; alCerrar: () => void }) {
  const [f, setF] = useState({
    nombre: plan?.nombre ?? "", tareas: plan?.tareas ?? "", cada_dias: plan?.cada_dias ? String(plan.cada_dias) : "",
    cada_horas: plan?.cada_horas ? String(plan.cada_horas) : "", ultima_fecha: plan?.ultima_fecha ?? new Date().toLocaleDateString("en-CA"),
    ultima_horas: plan ? String(plan.ultima_horas) : String(horasActuales), anticipacion_dias: plan ? String(plan.anticipacion_dias) : "7",
    activo: plan?.activo ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const guardar = useAccion(async () => {
    const fila = {
      maquina_id: maquinaId, nombre: f.nombre.trim(), tareas: f.tareas.trim() || null,
      cada_dias: f.cada_dias ? Number(f.cada_dias) : null, cada_horas: f.cada_horas ? Number(f.cada_horas) : null,
      ultima_fecha: f.ultima_fecha, ultima_horas: Number(f.ultima_horas) || 0, anticipacion_dias: Number(f.anticipacion_dias) || 0, activo: f.activo,
    };
    if (plan) await q(supabase.from("planes_preventivos").update(fila).eq("id", plan.id));
    else await q(supabase.from("planes_preventivos").insert(fila));
    // Si ya vence, la orden sale de una vez (no hasta mañana).
    await q(supabase.rpc("generar_preventivos", { p_maquina: maquinaId }));
  }, { exito: "Plan guardado", invalidar: [CLAVE], alTerminar: alCerrar });
  const listo = f.nombre.trim() && (f.cada_dias || f.cada_horas);
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={plan ? "Editar plan preventivo" : "Nuevo plan preventivo"} ancho="max-w-xl"
      descripcion="Por fecha, por horas de uso o lo que pase primero. La orden se genera sola unos días antes de vencer."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-plan" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="form-plan" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) guardar.mutate(); }}>
        <Campo etiqueta="Nombre"><Entrada value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Cambio de aceite y filtros" autoFocus /></Campo>
        <Campo etiqueta="Tareas"><AreaTexto rows={2} value={f.tareas} onChange={(e) => set("tareas", e.target.value)} placeholder="Aceite, filtro, purga del tanque…" /></Campo>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <Campo etiqueta="Cada (días)"><Entrada type="number" min="1" value={f.cada_dias} onChange={(e) => set("cada_dias", e.target.value)} /></Campo>
          <Campo etiqueta="Cada (horas de uso)"><Entrada type="number" min="1" value={f.cada_horas} onChange={(e) => set("cada_horas", e.target.value)} /></Campo>
          <Campo etiqueta="Avisar días antes"><Entrada type="number" min="0" value={f.anticipacion_dias} onChange={(e) => set("anticipacion_dias", e.target.value)} /></Campo>
          <Campo etiqueta="Último hecho"><Entrada type="date" value={f.ultima_fecha} onChange={(e) => set("ultima_fecha", e.target.value)} /></Campo>
          <Campo etiqueta="A las (horas)"><Entrada type="number" min="0" step="0.1" value={f.ultima_horas} onChange={(e) => set("ultima_horas", e.target.value)} /></Campo>
        </div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} className="accent-[hsl(var(--marca))]" />Plan activo
        </label>
      </form>
    </Dialogo>
  );
}

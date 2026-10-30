import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeft, Camera, CalendarPlus, ExternalLink, FileText, Gauge, Hand, History, Link2, Pencil, Plus, QrCode, Trash2, Wrench } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Kpi } from "@/components/ui/kpi";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { CLAVE, CRITICIDAD, DIA_SEMANA, ESPECIALIDAD, SEMANA_MES, TIPO_EQUIPO, TIPO_MAQUINA, TIPO_MTTO, cadaPlan, comprimirImagen, horas, subirArchivo, useServicioEnVivo, useUrlsFirmadas, type Maquina, type ModoPlan, type OrdenMto, type Plan, type Resguardo } from "./datos";
import { Dato, EnlaceBoton, InsigniaMaquina, InsigniaMto, usePermisosServicio } from "./componentes/piezas";
import { LateralMantenimiento } from "./componentes/LateralMantenimiento";
import { DialogoMaquina } from "./componentes/DialogoMaquina";
import { DialogoEtiqueta } from "./componentes/EtiquetaQR";
import { GLOSARIO } from "@/tutorial/glosario";

interface CostoOrden { mantenimiento_id: string; material: number | null; servicio_externo: number | null; mano_obra: number | null; otro: number | null; total: number }

/** Ficha de una máquina: estado, historial con costo acumulado, preventivos y quién la tiene. */
export default function FichaMaquina() {
  const { id = "" } = useParams();
  useServicioEnVivo(["maquinas", "ordenes_mantenimiento", "resguardos", "planes_preventivos"]);
  const p = usePermisosServicio(true);
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
  // Las piezas de este tipo de máquina (y de su modelo) con lo que hay en planta.
  const refacciones = useQuery({
    queryKey: [...CLAVE, "maquina", id, "refacciones", maq.data?.categoria, maq.data?.modelo],
    enabled: !!maq.data,
    queryFn: async () => {
      const r = await q<{ modelo: string | null; articulo: { id: string; clave: string; nombre: string; unidad: string } }[]>(
        supabase.from("refacciones_maquina").select("modelo, articulo:articulos(id, clave, nombre, unidad)").eq("categoria", maq.data!.categoria) as unknown as
          PromiseLike<{ data: { modelo: string | null; articulo: { id: string; clave: string; nombre: string; unidad: string } }[] | null; error: { message: string } | null }>);
      const propias = r.filter((x) => !x.modelo || !maq.data!.modelo || x.modelo === maq.data!.modelo);
      const ids = propias.map((x) => x.articulo.id);
      const ex = ids.length ? await q<{ articulo_id: string; en_planta: number }[]>(supabase.from("v_existencias").select("articulo_id, en_planta").in("articulo_id", ids)) : [];
      return propias.map((x) => ({ ...x.articulo, disponible: Number(ex.find((e) => e.articulo_id === x.articulo.id)?.en_planta ?? 0) }));
    },
  });
  const foto = useUrlsFirmadas(maq.data?.foto_ruta ? [maq.data.foto_ruta] : []);
  const [orden, setOrden] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "editar" | "horas" | "plan" | "baja" | "etiqueta" | "documento">(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const reactivar = useAccion(() => q(supabase.rpc("reactivar_maquina", { p_maquina: id })),
    { exito: "Reactivada. Sus planes preventivos siguen apagados: prende los que sigan", invalidar: [CLAVE] });

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
  const deBaja = m.estado === "baja";

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
        {m.usa_horometro && p.personal && !deBaja && <Boton variante="secundario" onClick={() => setDialogo("horas")}><Gauge className="h-4 w-4" />Registrar horas</Boton>}
        {(m.prestable || m.tipo === "herramienta") && !abierto && p.personal && !deBaja && <EnlaceBoton a={`/servicio/resguardos?prestar=${m.id}`}><Hand className="h-4 w-4" />Prestar</EnlaceBoton>}
        {p.gerencia && <Boton variante="secundario" onClick={() => setDialogo("editar")}><Pencil className="h-4 w-4" />Editar</Boton>}
        {p.gerencia && !deBaja && <Boton variante="secundario" onClick={() => setDialogo("etiqueta")}><QrCode className="h-4 w-4" />Etiqueta QR</Boton>}
        {p.gerencia && !deBaja && <Boton variante="secundario" onClick={() => setDialogo("baja")}><Archive className="h-4 w-4" />Dar de baja</Boton>}
      </>}
    >
      {deBaja && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-fondo px-4 py-3 text-sm" data-explain={GLOSARIO.maquinaDeBaja}>
          <Archive className="h-5 w-5 text-tenue shrink-0" aria-hidden />
          <p className="flex-1 min-w-[200px]">
            <strong>Dada de baja{m.baja_en ? ` el ${fecha(m.baja_en)}` : ""}</strong>{m.baja_por_nombre && <span className="text-tenue"> por {m.baja_por_nombre}</span>}
            {m.motivo_baja && <span className="block text-tenue">{m.motivo_baja}</span>}
          </p>
          {p.gerencia && <Boton variante="secundario" tamano="sm" cargando={reactivar.isPending} onClick={() => reactivar.mutate()}><ArchiveRestore className="h-3.5 w-3.5" />Reactivar</Boton>}
        </div>
      )}
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
            <Dato etiqueta="Horas de uso" explica={GLOSARIO.horometro}>{m.usa_horometro ? <>{horas(m.horas_uso)}<span className="block text-xs text-tenue">{m.horas_actualizado_en ? hace(m.horas_actualizado_en) : ""}</span></> : "Sin horómetro"}</Dato>
            <Dato etiqueta="Alta">{fecha(m.fecha_alta)}</Dato>
            {m.criticidad ? (
              <Dato etiqueta="Criticidad" explica={GLOSARIO.criticidadMaquina}><Insignia tono={CRITICIDAD[m.criticidad].tono}>{CRITICIDAD[m.criticidad].texto}</Insignia></Dato>
            ) : m.critica && <Dato etiqueta="Importancia" explica={GLOSARIO.maquinaCritica}><Insignia tono="aviso">Crítica: si se para, se para el área</Insignia></Dato>}
            {m.tipo_mantenimiento && <Dato etiqueta="Mantenimiento" explica={GLOSARIO.tipoMantenimiento}>{TIPO_MTTO[m.tipo_mantenimiento]}{m.especialidad && <span className="block text-xs text-tenue">Lo hace: {ESPECIALIDAD[m.especialidad]}</span>}</Dato>}
            {m.tipo_equipo && <Dato etiqueta="Tipo de equipo">{TIPO_EQUIPO[m.tipo_equipo]}</Dato>}
            {m.asignada_nombre && <Dato etiqueta="Asignada a" explica={GLOSARIO.herramientaAsignada}>{m.asignada_nombre}</Dato>}
            {m.notas && <Dato etiqueta="Notas" className="col-span-2">{m.notas}</Dato>}
          </div>
        </Tarjeta>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi titulo="Fallas en 12 meses" explica={GLOSARIO.fallasUltimoAnio} valor={numero(m.fallas_12m)} icono={AlertTriangle} tono={m.fallas_12m >= 3 ? "peligro" : m.fallas_12m ? "aviso" : "ok"}
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
              <EncabezadoTarjeta titulo="Plan preventivo" explica={GLOSARIO.planPreventivo} descripcion="La orden sale sola cuando vence (por fecha o por horas)."
                acciones={p.gerencia && !deBaja && <Boton variante="secundario" tamano="sm" onClick={() => { setPlan(null); setDialogo("plan"); }}><CalendarPlus className="h-3.5 w-3.5" />Agregar</Boton>} />
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
                        {cadaPlan(x)} ·
                        último {fecha(x.ultima_fecha)} · toca {x.proxima_fecha ? fecha(x.proxima_fecha) : `a las ${horas(x.proximas_horas)}`}
                        {x.orden_folio && ` · ${x.orden_folio}`}
                      </p>
                      {x.rutina && <p className="text-xs text-tenue" data-explain={GLOSARIO.rutinaMantenimiento}>Rutina: {x.rutina} · {x.rutina_puntos} puntos</p>}
                    </button>
                  ))}
              </div>
            </Tarjeta>

            <Tarjeta>
              <EncabezadoTarjeta titulo="Resguardo" explica={GLOSARIO.resguardo} descripcion={m.prestable || m.tipo === "herramienta" ? "Quién se la llevó y cuándo la regresó." : "Equipo fijo: no se presta."} />
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

      <Documentos m={m} gerencia={p.gerencia} alAgregar={() => setDialogo("documento")} />

      {(refacciones.data ?? []).length > 0 && (
        <Tarjeta className="mt-4">
          <EncabezadoTarjeta titulo="Refacciones de este tipo de máquina" explica={GLOSARIO.refaccionesMaquina}
            descripcion={`${refacciones.data!.length} piezas · se piden desde una orden de mantenimiento`} />
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Clave</th><th>Pieza</th><th className="text-right">En planta</th></tr></thead>
              <tbody>
                {refacciones.data!.map((x) => (
                  <tr key={x.id}><td className="cifra">{x.clave}</td><td>{x.nombre}</td>
                    <td className={`text-right cifra ${x.disponible > 0 ? "" : "text-tenue"}`}>{numero(x.disponible)} {x.unidad}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      <LateralMantenimiento id={orden} alCerrar={() => setOrden(null)} />
      {dialogo === "editar" && <DialogoMaquina m={m} alCerrar={() => setDialogo(null)} />}
      {dialogo === "horas" && <DialogoHoras m={m} alCerrar={() => setDialogo(null)} />}
      {dialogo === "plan" && <DialogoPlan maquinaId={m.id} plan={plan} horasActuales={m.horas_uso} alCerrar={() => setDialogo(null)} />}
      {dialogo === "baja" && <DialogoBaja m={m} alCerrar={() => setDialogo(null)} />}
      {dialogo === "etiqueta" && <DialogoEtiqueta m={m} alCerrar={() => setDialogo(null)} />}
      {dialogo === "documento" && <DialogoDocumento m={m} alCerrar={() => setDialogo(null)} />}
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

interface Documento { id: string; tipo: TipoDocumento; titulo: string; ruta: string | null; url: string | null; compartido: boolean; alcance: string; creado_por_nombre: string | null; creado_en: string }
type TipoDocumento = "manual" | "ficha_tecnica" | "diagrama" | "garantia" | "otro";
const TIPO_DOCUMENTO: Record<TipoDocumento, string> = { manual: "Manual", ficha_tecnica: "Ficha técnica", diagrama: "Diagrama", garantia: "Garantía", otro: "Otro" };

/** Manuales y fichas técnicas: los de esta máquina y los de todas las de su tipo y modelo. */
function Documentos({ m, gerencia, alAgregar }: { m: Maquina; gerencia: boolean; alAgregar: () => void }) {
  const docs = useQuery({
    queryKey: [...CLAVE, "maquina", m.id, "documentos"],
    queryFn: () => q<Documento[]>(supabase.rpc("documentos_maquina", { p_maquina: m.id })),
  });
  const urls = useUrlsFirmadas((docs.data ?? []).map((d) => d.ruta).filter(Boolean) as string[]);
  const quitar = useAccion((id: string) => q(supabase.from("maquina_documentos").delete().eq("id", id)), { exito: "Documento quitado", invalidar: [CLAVE] });
  const lista = docs.data ?? [];
  if (!gerencia && lista.length === 0) return null;
  return (
    <Tarjeta className="mt-4">
      <EncabezadoTarjeta titulo="Manuales y fichas técnicas" explica={GLOSARIO.documentosMaquina}
        descripcion={lista.length ? `${lista.length} ${lista.length === 1 ? "documento" : "documentos"}` : "Sube el manual o pon la liga de Drive: así está a la mano cuando se repara."}
        acciones={gerencia && <Boton variante="secundario" tamano="sm" onClick={alAgregar}><Plus className="h-3.5 w-3.5" />Agregar</Boton>} />
      {lista.length > 0 && (
        <ul className="px-5 pb-4 divide-y divide-borde/60">
          {lista.map((d) => {
            const liga = d.url ?? (d.ruta ? urls.data?.[d.ruta] : undefined);
            return (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                {d.url ? <Link2 className="h-4 w-4 text-tenue shrink-0" /> : <FileText className="h-4 w-4 text-tenue shrink-0" />}
                <div className="flex-1 min-w-0">
                  {liga ? <a href={liga} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline inline-flex items-center gap-1">{d.titulo}<ExternalLink className="h-3 w-3 text-tenue" /></a>
                    : <span className="font-medium text-sm">{d.titulo}</span>}
                  <p className="text-xs text-tenue">{TIPO_DOCUMENTO[d.tipo]} · {d.alcance}{d.creado_por_nombre ? ` · subió ${d.creado_por_nombre}` : ""}</p>
                </div>
                {gerencia && <Boton variante="fantasma" tamano="sm" aria-label={`Quitar ${d.titulo}`} cargando={quitar.isPending && quitar.variables === d.id}
                  onClick={() => { if (window.confirm(`¿Quitar «${d.titulo}»${d.compartido ? " de todas las máquinas donde aparece" : ""}?`)) quitar.mutate(d.id); }}>
                  <Trash2 className="h-3.5 w-3.5" /></Boton>}
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

function DialogoDocumento({ m, alCerrar }: { m: Maquina; alCerrar: () => void }) {
  const [tipo, setTipo] = useState<TipoDocumento>("manual");
  const [titulo, setTitulo] = useState("");
  const [origen, setOrigen] = useState<"archivo" | "liga">("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  // De quién es: esta máquina, todas las de su categoría y modelo, o todas las de la categoría.
  const [alcance, setAlcance] = useState<"maquina" | "modelo" | "categoria">(m.modelo ? "modelo" : "maquina");
  const guardar = useAccion(async () => {
    let ruta: string | null = null;
    if (origen === "archivo" && archivo) {
      const ext = (archivo.name.split(".").pop() ?? "pdf").toLowerCase();
      ruta = await subirArchivo(`maquinas/${m.id}/docs`, archivo, ext);
    }
    await q(supabase.from("maquina_documentos").insert({
      maquina_id: alcance === "maquina" ? m.id : null,
      categoria: alcance === "maquina" ? null : m.categoria,
      modelo: alcance === "modelo" ? m.modelo : null,
      tipo, titulo: titulo.trim(), ruta, url: origen === "liga" ? url.trim() : null,
    }));
  }, { exito: "Documento agregado", invalidar: [CLAVE], alTerminar: alCerrar });
  const grande = !!archivo && archivo.size > 50 * 1024 * 1024;
  const listo = titulo.trim().length >= 3 && (origen === "archivo" ? !!archivo && !grande : /^https?:\/\//i.test(url.trim()));
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Agregar manual o ficha técnica" ancho="max-w-xl"
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-doc" disabled={!listo} cargando={guardar.isPending}>Agregar</Boton></>}>
      <form id="form-doc" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) guardar.mutate(); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Qué es">
            <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
              {Object.entries(TIPO_DOCUMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Título" className="sm:col-span-2"><Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Manual de usuario AXT MIG 252" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([["archivo", "Subir archivo (PDF o foto)"], ["liga", "Liga de Drive"]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setOrigen(v)} aria-pressed={origen === v}
                    className={`h-10 rounded-lg border text-sm ${origen === v ? "border-marca bg-marca/10 text-marca-texto font-medium" : "border-borde"}`}>{t}</button>
          ))}
        </div>
        {origen === "archivo" ? (
          <Campo etiqueta="Archivo" ayuda="PDF o imagen, hasta 50 MB." error={grande ? "Pesa más de 50 MB: súbelo a Drive y pon la liga." : undefined}>
            <Entrada type="file" accept="application/pdf,image/*" onChange={(e) => {
              const a = e.target.files?.[0] ?? null; setArchivo(a);
              if (a && !titulo.trim()) setTitulo(a.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
            }} />
          </Campo>
        ) : (
          <Campo etiqueta="Liga" ayuda="Que esté compartida con la gente de Hegamex para que la puedan abrir.">
            <Entrada type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </Campo>
        )}
        <Campo etiqueta="¿De qué máquinas es?">
          <Seleccion value={alcance} onChange={(e) => setAlcance(e.target.value as typeof alcance)}>
            <option value="maquina">Solo de {m.numero}</option>
            {m.modelo && <option value="modelo">De todas las «{m.categoria}» modelo {m.modelo}</option>}
            <option value="categoria">De todas las «{m.categoria}», de cualquier modelo</option>
          </Seleccion>
        </Campo>
      </form>
    </Dialogo>
  );
}

function DialogoBaja({ m, alCerrar }: { m: Maquina; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const baja = useAccion(() => q(supabase.rpc("dar_de_baja_maquina", { p_maquina: m.id, p_motivo: motivo.trim() })), {
    exito: `${m.numero} quedó dada de baja`, invalidar: [CLAVE], alTerminar: alCerrar,
  });
  const listo = motivo.trim().length >= 5;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Dar de baja ${m.numero}`}
      descripcion="Para lo que ya no conviene reparar o ya no está en el taller. Queda su historial; se puede reactivar."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-baja" variante="peligro" disabled={!listo} cargando={baja.isPending}><Archive className="h-4 w-4" />Dar de baja</Boton></>}>
      <form id="form-baja" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) baja.mutate(); }}>
        <Campo etiqueta="¿Por qué?"><AreaTexto rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
          placeholder="Ya no conviene repararla: el motor cuesta más que una nueva" /></Campo>
        <ul className="text-sm text-tenue list-disc pl-5 space-y-1">
          {m.ordenes_abiertas > 0 && <li>{m.ordenes_abiertas === 1 ? "Su orden abierta se cancela" : `Sus ${m.ordenes_abiertas} órdenes abiertas se cancelan`} con este motivo.</li>}
          <li>Sus planes preventivos se apagan y ya no generan órdenes.</li>
          <li>Sale de la lista de máquinas y de las métricas desde hoy (sigue en «Dadas de baja»).</li>
          {m.prestada_a && <li className="text-peligro">La tiene {m.prestada_a}: primero recíbela en Resguardos.</li>}
        </ul>
      </form>
    </Dialogo>
  );
}

function DialogoPlan({ maquinaId, plan, horasActuales, alCerrar }: { maquinaId: string; plan: Plan | null; horasActuales: number; alCerrar: () => void }) {
  const [f, setF] = useState({
    nombre: plan?.nombre ?? "", tareas: plan?.tareas ?? "", modo: plan?.modo ?? ("dias" as ModoPlan),
    cada_dias: plan?.cada_dias ? String(plan.cada_dias) : "", cada_meses: String(plan?.cada_meses ?? 1),
    semana_mes: String(plan?.semana_mes ?? 1), dia_semana: String(plan?.dia_semana ?? 1), dia_mes: String(plan?.dia_mes ?? 1),
    solo_laborables: plan?.solo_laborables ?? true,
    cada_horas: plan?.cada_horas ? String(plan.cada_horas) : "", ultima_fecha: plan?.ultima_fecha ?? new Date().toLocaleDateString("en-CA"),
    ultima_horas: plan ? String(plan.ultima_horas) : String(horasActuales), anticipacion_dias: plan ? String(plan.anticipacion_dias) : "7",
    activo: plan?.activo ?? true, rutina_id: plan?.rutina_id ?? "",
  });
  const rutinas = useQuery({ queryKey: [...CLAVE, "rutinas"], staleTime: 5 * 60_000,
    queryFn: () => q<{ id: string; nombre: string; puntos: unknown[] }[]>(supabase.from("rutinas_mantenimiento").select("id, nombre, puntos").eq("activa", true).order("nombre")) });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  // Lo que se guarda: cada modo solo lleva sus campos (la base revisa que estén completos).
  const regla = {
    p_modo: f.modo, p_ultima: f.ultima_fecha || null,
    p_cada_dias: f.modo === "dias" && f.cada_dias ? Number(f.cada_dias) : null,
    p_cada_meses: f.modo === "dias" ? null : Number(f.cada_meses) || 1,
    p_semana_mes: f.modo === "mes_semana" ? Number(f.semana_mes) : null,
    p_dia_semana: f.modo === "mes_semana" ? Number(f.dia_semana) : null,
    p_dia_mes: f.modo === "mes_dia" ? Math.min(31, Math.max(1, Number(f.dia_mes) || 1)) : null,
    p_solo_laborables: f.solo_laborables,
  };
  // La fecha que va a tocar con lo que lleva capturado, calculada por la misma regla que genera la orden.
  const proxima = useQuery({
    queryKey: [...CLAVE, "plan", "proxima", plan?.id, regla],
    enabled: !!regla.p_ultima && (f.modo !== "dias" || !!regla.p_cada_dias),
    staleTime: 60_000,
    queryFn: () => q<string | null>(supabase.rpc("preventivo_fecha", { ...regla, p_plan: plan?.id ?? null })),
  });
  const guardar = useAccion(async () => {
    const fila = {
      maquina_id: maquinaId, nombre: f.nombre.trim(), tareas: f.tareas.trim() || null,
      modo: regla.p_modo, cada_dias: regla.p_cada_dias, cada_meses: regla.p_cada_meses, semana_mes: regla.p_semana_mes,
      dia_semana: regla.p_dia_semana, dia_mes: regla.p_dia_mes, solo_laborables: f.solo_laborables,
      cada_horas: f.cada_horas ? Number(f.cada_horas) : null,
      ultima_fecha: f.ultima_fecha, ultima_horas: Number(f.ultima_horas) || 0, anticipacion_dias: Number(f.anticipacion_dias) || 0, activo: f.activo,
      rutina_id: f.rutina_id || null,
    };
    if (plan) await q(supabase.from("planes_preventivos").update(fila).eq("id", plan.id));
    else await q(supabase.from("planes_preventivos").insert(fila));
    // Si ya vence, la orden sale de una vez (no hasta mañana).
    await q(supabase.rpc("generar_preventivos", { p_maquina: maquinaId }));
  }, { exito: "Plan guardado", invalidar: [CLAVE], alTerminar: alCerrar });
  const listo = f.nombre.trim() && f.ultima_fecha && (f.modo === "dias" ? f.cada_dias || f.cada_horas : Number(f.cada_meses) >= 1);
  const diaDe = (d: string) => DIA_SEMANA[((new Date(`${d}T12:00`).getDay() + 6) % 7) + 1];
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={plan ? "Editar plan preventivo" : "Nuevo plan preventivo"} ancho="max-w-xl"
      descripcion="Por fecha, por horas de uso o lo que pase primero. La orden se genera sola unos días antes de vencer."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-plan" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="form-plan" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) guardar.mutate(); }}>
        <Campo etiqueta="Nombre"><Entrada value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Cambio de aceite y filtros" autoFocus /></Campo>
        <Campo etiqueta="Rutina (checklist)" ayuda={<>Sus puntos salen en cada orden para palomearlos. Se escriben en <Link to="/servicio/rutinas" className="text-marca-texto">Rutinas</Link>.</>}>
          <span data-explain={GLOSARIO.rutinaMantenimiento} className="block">
            <Seleccion value={f.rutina_id} onChange={(e) => set("rutina_id", e.target.value)}>
              <option value="">Sin checklist (solo las tareas de abajo)</option>
              {(rutinas.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.puntos.length} puntos</option>)}
            </Seleccion>
          </span>
        </Campo>
        <Campo etiqueta="Tareas"><AreaTexto rows={2} value={f.tareas} onChange={(e) => set("tareas", e.target.value)} placeholder="Aceite, filtro, purga del tanque…" /></Campo>
        <Campo etiqueta="Cuándo toca">
          <span data-explain={GLOSARIO.planPreventivo} className="block">
            <Seleccion value={f.modo} onChange={(e) => set("modo", e.target.value as ModoPlan)}>
              <option value="dias">Cada tantos días (o solo por horas de uso)</option>
              <option value="mes_semana">Un día de la semana del mes (el primer lunes…)</option>
              <option value="mes_dia">Un día fijo del mes (el 15…)</option>
            </Seleccion>
          </span>
        </Campo>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {f.modo === "dias" && <Campo etiqueta="Cada (días)"><Entrada type="number" min="1" value={f.cada_dias} onChange={(e) => set("cada_dias", e.target.value)} /></Campo>}
          {f.modo === "mes_semana" && <>
            <Campo etiqueta="El">
              <Seleccion value={f.semana_mes} onChange={(e) => set("semana_mes", e.target.value)}>
                {Object.entries(SEMANA_MES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Día">
              <Seleccion value={f.dia_semana} onChange={(e) => set("dia_semana", e.target.value)}>
                {Object.entries(DIA_SEMANA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Seleccion>
            </Campo>
          </>}
          {f.modo === "mes_dia" && <Campo etiqueta="Día del mes" ayuda="El 31 en un mes de 30 es el 30."><Entrada type="number" min="1" max="31" value={f.dia_mes} onChange={(e) => set("dia_mes", e.target.value)} /></Campo>}
          {f.modo !== "dias" && <Campo etiqueta="Cada (meses)"><Entrada type="number" min="1" max="24" value={f.cada_meses} onChange={(e) => set("cada_meses", e.target.value)} /></Campo>}
          <Campo etiqueta="Cada (horas de uso)"><Entrada type="number" min="1" value={f.cada_horas} onChange={(e) => set("cada_horas", e.target.value)} placeholder="Opcional" /></Campo>
          <Campo etiqueta="Avisar días antes"><Entrada type="number" min="0" value={f.anticipacion_dias} onChange={(e) => set("anticipacion_dias", e.target.value)} /></Campo>
          <Campo etiqueta="Último hecho"><Entrada type="date" value={f.ultima_fecha} onChange={(e) => set("ultima_fecha", e.target.value)} /></Campo>
          <Campo etiqueta="A las (horas)"><Entrada type="number" min="0" step="0.1" value={f.ultima_horas} onChange={(e) => set("ultima_horas", e.target.value)} /></Campo>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer" data-explain={GLOSARIO.diaHabilPreventivo}>
          <input type="checkbox" checked={f.solo_laborables} onChange={(e) => set("solo_laborables", e.target.checked)} className="accent-[hsl(var(--marca))] mt-0.5" />
          <span>Si cae en sábado, domingo, feriado o descanso, pasarlo al siguiente día que se trabaja</span>
        </label>
        {proxima.data && (
          <p className="rounded-lg bg-fondo px-3 py-2 text-sm">
            Con esto, el siguiente toca el <strong>{diaDe(proxima.data)} {fecha(proxima.data)}</strong>
            {Number(f.anticipacion_dias) > 0 && <span className="text-tenue"> · la orden sale {f.anticipacion_dias} {Number(f.anticipacion_dias) === 1 ? "día" : "días"} antes</span>}
          </p>
        )}
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} className="accent-[hsl(var(--marca))]" />Plan activo
        </label>
      </form>
    </Dialogo>
  );
}

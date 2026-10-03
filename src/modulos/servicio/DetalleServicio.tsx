import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, CalendarClock, CheckCircle2, ClipboardX, Crown, PackageCheck, Phone, Play } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hace } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { useSesion } from "@/lib/sesion";
import { CLAVE, PRIORIDAD, duracion, horas, periodo, subirArchivo, useServicioEnVivo, useUrlsFirmadas, type Momento, type Servicio } from "./datos";
import { Dato, InsigniaEstado, Tipo, usePermisosServicio } from "./componentes/piezas";
import { GaleriaEvidencias, SubirFotos, useEvidencias } from "./componentes/Fotos";
import { Materiales } from "./componentes/Materiales";
import { Costos } from "./componentes/Costos";
import { DialogoProgramar } from "./componentes/DialogoProgramar";
import { PanelFirma } from "./componentes/Firma";

const PASOS = [
  { estado: "solicitada", titulo: "Pedido" },
  { estado: "programada", titulo: "Programado" },
  { estado: "en_curso", titulo: "En curso" },
  { estado: "cerrada", titulo: "Cerrado" },
] as const;

export default function DetalleServicio() {
  const { id = "" } = useParams();
  useServicioEnVivo(["servicios", "servicio_cuadrilla", "servicio_materiales", "servicio_evidencias"]);
  const p = usePermisosServicio();
  const { perfil } = useSesion();
  const srv = useQuery({
    queryKey: [...CLAVE, "servicio", id],
    queryFn: () => q<Servicio | null>(supabase.from("v_servicios").select("*").eq("id", id).maybeSingle()),
  });
  const [dialogo, setDialogo] = useState<null | "programar" | "recibir" | "cerrar" | "cancelar">(null);
  const iniciar = useAccion(() => q(supabase.rpc("iniciar_servicio", { p_servicio: id })), { exito: "Servicio en curso", invalidar: [CLAVE] });

  if (srv.error) return <Pagina titulo="Servicio"><ErrorCarga error={srv.error} /></Pagina>;
  if (srv.isLoading) return <Pagina titulo="Servicio"><Cargando filas={8} /></Pagina>;
  const s = srv.data;
  if (!s) {
    return (
      <Pagina titulo="Servicio">
        <div className="tarjeta"><Vacio icono={ClipboardX} titulo="No existe ese servicio o es de un cliente que no ves"
          accion={<Link to="/servicio" className="text-marca-texto text-sm">Volver a servicios</Link>} /></div>
      </Pagina>
    );
  }

  const abierto = !["cerrada", "cancelada"].includes(s.estado);
  const enPlanta = s.tipo === "reparacion_planta" || s.tipo === "garantia";
  const falta = s.tipo === "reparacion_planta" && !s.recibido_en;
  const puedeCancelar = abierto && (p.gerencia || (s.estado === "solicitada" && s.solicitado_por === perfil?.id));
  const indice = PASOS.findIndex((x) => x.estado === s.estado);
  const fechaPaso: Record<string, { en: string | null; por: string | null }> = {
    solicitada: { en: s.solicitado_en, por: s.solicitado_por_nombre },
    programada: { en: s.programado_en, por: s.programado_por_nombre },
    en_curso: { en: s.iniciado_en, por: null },
    cerrada: { en: s.cerrado_en, por: s.cerrado_por_nombre },
  };
  const momentos: Momento[] = enPlanta ? ["recepcion", "antes", "durante", "despues", "entrega"] : ["antes", "durante", "despues", "entrega"];

  return (
    <Pagina
      titulo={<span className="flex flex-wrap items-center gap-3"><span className="cifra">{s.folio}</span><InsigniaEstado estado={s.estado} /></span>}
      descripcion={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Tipo tipo={s.tipo} /><span>{s.cliente}</span>
        {s.prioridad === 1 && <Insignia tono="peligro">Urgente</Insignia>}</span>}
      acciones={<>
        <Link to="/servicio" className="inline-flex items-center gap-1 text-sm text-tenue hover:text-texto mr-2"><ArrowLeft className="h-4 w-4" />Servicios</Link>
        {abierto && enPlanta && !s.recibido_en && p.personal && <Boton variante="secundario" onClick={() => setDialogo("recibir")}><PackageCheck className="h-4 w-4" />Recibir equipo</Boton>}
        {(s.estado === "solicitada" || s.estado === "programada") && p.gerencia && (
          <Boton variante={s.estado === "solicitada" ? "primario" : "secundario"} onClick={() => setDialogo("programar")}>
            <CalendarClock className="h-4 w-4" />{s.estado === "solicitada" ? "Programar" : "Reprogramar"}
          </Boton>
        )}
        {s.estado === "programada" && p.personal && (
          <Boton variante="secundario" onClick={() => iniciar.mutate()} cargando={iniciar.isPending} disabled={falta}
                 title={falta ? "Primero recibe el equipo, con fotos" : undefined}><Play className="h-4 w-4" />Iniciar</Boton>
        )}
        {(s.estado === "programada" || s.estado === "en_curso") && p.personal && (
          <Boton variante="exito" onClick={() => setDialogo("cerrar")} disabled={falta}><CheckCircle2 className="h-4 w-4" />Cerrar servicio</Boton>
        )}
        {puedeCancelar && <Boton variante="fantasma" onClick={() => setDialogo("cancelar")}><Ban className="h-4 w-4" />Cancelar</Boton>}
      </>}
    >
      {s.estado === "cancelada" ? (
        <div className="rounded-lg border border-borde bg-fondo p-3 text-sm">Cancelado {hace(s.cancelado_en)}: {s.motivo_cancelacion}</div>
      ) : (
        <ol className="grid grid-cols-4 gap-1" aria-label="Avance del servicio">
          {PASOS.map((x, i) => {
            const hecho = i <= indice;
            const f = fechaPaso[x.estado];
            return (
              <li key={x.estado} className={cn("rounded-lg border px-3 py-2", hecho ? "border-ok/30 bg-ok-suave" : "border-borde bg-superficie")}>
                <p className={cn("text-sm font-medium", hecho ? "text-ok" : "text-tenue")}>{x.titulo}</p>
                <p className="text-[11px] text-tenue truncate">{hecho && f.en ? `${fecha(f.en)}${f.por ? ` · ${f.por}` : ""}` : " "}</p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-4 lg:grid-cols-5 items-start">
        <div className="lg:col-span-3 space-y-4">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Lo que pide el cliente" />
            <div className="px-5 pb-5 space-y-4">
              <p className="whitespace-pre-line">{s.descripcion}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Dato etiqueta="Equipo">{s.equipo ?? "—"}{s.numero_serie && <span className="block text-xs text-tenue cifra">Serie {s.numero_serie}</span>}</Dato>
                <Dato etiqueta="Pedido">{s.pedido_folio ?? "—"}{s.op_folio && <span className="block text-xs text-tenue">{s.op_folio}</span>}</Dato>
                {s.garantia_vence && (
                  <Dato etiqueta="Garantía">
                    <Insignia tono={s.en_garantia ? "ok" : "peligro"}>{s.en_garantia ? "Vigente" : "Vencida"}</Insignia>
                    <span className="block text-xs text-tenue mt-0.5">Entregado {fecha(s.equipo_entregado)} · hasta {fecha(s.garantia_vence)}</span>
                  </Dato>
                )}
                <Dato etiqueta="Dónde">{s.lugar ?? (s.tipo === "reparacion_planta" ? "En planta" : "—")}</Dato>
                <Dato etiqueta="Contacto">{s.contacto_nombre ?? "—"}{s.contacto_telefono && (
                  <a href={`tel:${s.contacto_telefono.replace(/\s/g, "")}`} className="flex items-center gap-1 text-marca-texto text-xs"><Phone className="h-3 w-3" />{s.contacto_telefono}</a>)}</Dato>
                <Dato etiqueta="Lo quiere">{s.fecha_deseada ? fecha(s.fecha_deseada) : "Sin fecha"}<span className="block text-xs text-tenue">{PRIORIDAD[s.prioridad].texto}</span></Dato>
                <Dato etiqueta="Pidió">{s.solicitado_por_nombre ?? "—"}<span className="block text-xs text-tenue">{fechaYHora(s.solicitado_en)}</span></Dato>
                {s.referencia && <Dato etiqueta="Reporte del cliente">{s.referencia}</Dato>}
              </div>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Programación y cuadrilla"
              descripcion={s.inicio ? `${periodo(s.inicio, s.fin)} · ${duracion(s.inicio, s.fin)}` : "Todavía sin fecha"} />
            <div className="px-5 pb-5">
              {s.cuadrilla.length === 0 ? (
                <p className="text-sm text-tenue">{p.gerencia ? "Ponle fecha y cuadrilla: así el taller sabe con quién no cuenta esos días." : "La gerencia de producción le pone fecha y cuadrilla; te llega un aviso."}</p>
              ) : (
                <>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {s.cuadrilla.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg border border-borde px-3 py-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.etapa_color ?? "hsl(var(--tenue))" }} />
                        <span className="min-w-0"><span className="block text-sm truncate">{c.nombre}</span>
                          <span className="block text-[11px] text-tenue truncate">{c.puesto}{c.etapa ? ` · ${c.etapa}` : ""}</span></span>
                        {c.jefe && <Crown className="h-4 w-4 ml-auto text-marca-texto shrink-0" aria-label="Jefe de cuadrilla" />}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-tenue mt-3">
                    {horas(s.horas_por_persona)} de taller por persona · {horas(s.horas_por_persona * s.cuadrilla.length)} en total que se descuentan de la capacidad de su área.
                  </p>
                </>
              )}
            </div>
          </Tarjeta>

          {enPlanta && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Recepción del equipo en planta" descripcion="Se recibe con fotos de cómo llega, antes de tocarlo." />
              <div className="px-5 pb-5 text-sm">
                {s.recibido_en ? (
                  <p>Recibido {fechaYHora(s.recibido_en)} por {s.recibido_por_nombre}: <span className="text-tenue">{s.condicion_recepcion}</span></p>
                ) : (
                  <p className="text-tenue">{s.tipo === "reparacion_planta" ? "Todavía no llega." : "Si el cliente trae el equipo, recíbelo aquí."} {p.personal && abierto && "Usa «Recibir equipo» cuando llegue."}</p>
                )}
              </div>
            </Tarjeta>
          )}

          <Tarjeta>
            <EncabezadoTarjeta titulo="Insumos" descripcion="Lo que lleva la cuadrilla: sale de almacén o se pide a compras." />
            <div className="px-5 pb-5"><Materiales servicioId={s.id} abierto={abierto} /></div>
          </Tarjeta>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Evidencia" descripcion={`${s.fotos} ${s.fotos === 1 ? "foto" : "fotos"} · no se borran`} />
            <div className="px-5 pb-5">
              <GaleriaEvidencias servicioId={s.id} carpeta={`servicios/${s.id}`} puedeSubir={abierto && p.pedir} momentos={momentos}
                                 momentoInicial={s.estado === "en_curso" ? "despues" : enPlanta && !s.recibido_en ? "recepcion" : "antes"} />
            </div>
          </Tarjeta>

          {s.estado === "cerrada" && <Cierre s={s} />}

          {p.costos && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Viáticos y costos" descripcion="Solo lo ven la gerencia y quien maneja costos." />
              <div className="px-5 pb-5"><Costos servicioId={s.id} conceptos={["viaticos", "servicio_externo", "mano_obra", "otro"]} /></div>
            </Tarjeta>
          )}
        </div>
      </div>

      {dialogo === "programar" && <DialogoProgramar s={s} abierto alCambiar={(v) => !v && setDialogo(null)} />}
      {dialogo === "recibir" && <DialogoRecibir s={s} alCerrar={() => setDialogo(null)} />}
      {dialogo === "cerrar" && <DialogoCerrar s={s} alCerrar={() => setDialogo(null)} />}
      {dialogo === "cancelar" && <DialogoCancelar s={s} alCerrar={() => setDialogo(null)} />}
    </Pagina>
  );
}

function Cierre({ s }: { s: Servicio }) {
  const firma = useUrlsFirmadas(s.firma_ruta ? [s.firma_ruta] : []);
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Cierre" descripcion={`${fechaYHora(s.cerrado_en)} · ${s.cerrado_por_nombre ?? ""}`} />
      <div className="px-5 pb-5 space-y-3 text-sm">
        <p className="whitespace-pre-line">{s.notas_cierre}</p>
        {s.tipo === "garantia" && <Insignia tono={s.garantia_procede ? "ok" : "neutro"}>{s.garantia_procede ? "La garantía procedió" : "La garantía no procedió"}</Insignia>}
        <div>
          <p className="etiqueta">Recibió</p>
          <p>{s.recibio_nombre}</p>
          {s.firma_ruta && firma.data?.[s.firma_ruta] && (
            // La firma es "papel": siempre sobre blanco.
            <img src={firma.data[s.firma_ruta]} alt={`Firma de ${s.recibio_nombre}`} className="mt-1 h-24 rounded border border-borde bg-white" />
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

function DialogoRecibir({ s, alCerrar }: { s: Servicio; alCerrar: () => void }) {
  const ev = useEvidencias({ servicioId: s.id });
  const fotos = (ev.data ?? []).filter((e) => e.momento === "recepcion").length;
  const [condicion, setCondicion] = useState("");
  const recibir = useAccion(() => q(supabase.rpc("recibir_equipo", { p_servicio: s.id, p_condicion: condicion })),
    { exito: "Equipo recibido", invalidar: [CLAVE], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Recibir ${s.equipo ?? "el equipo"}`}
      descripcion="Fotos de cómo llega (golpes, piezas que faltan, placa con el número de serie) antes de tocarlo. Sin fotos no se recibe."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="form-recibir" disabled={fotos === 0 || condicion.trim().length < 3} cargando={recibir.isPending}>Recibir</Boton>
      </>}>
      <form id="form-recibir" className="space-y-4" onSubmit={(e) => { e.preventDefault(); recibir.mutate(); }}>
        <div className="space-y-2">
          <SubirFotos carpeta={`servicios/${s.id}`} servicioId={s.id} momento="recepcion" texto="Tomar fotos de cómo llega" grande />
          <p className={cn("text-sm", fotos ? "text-ok" : "text-tenue")}>{fotos ? `${fotos} ${fotos === 1 ? "foto" : "fotos"} de recepción` : "Todavía sin fotos"}</p>
        </div>
        <Campo etiqueta="¿Cómo llega?">
          <AreaTexto rows={3} value={condicion} onChange={(e) => setCondicion(e.target.value)} placeholder="Llega sin la tapa del motor, con golpe en la carcasa…" />
        </Campo>
      </form>
    </Dialogo>
  );
}

function DialogoCerrar({ s, alCerrar }: { s: Servicio; alCerrar: () => void }) {
  const ev = useEvidencias({ servicioId: s.id });
  const fotosTrabajo = (ev.data ?? []).filter((e) => ["antes", "durante", "despues", "entrega"].includes(e.momento)).length;
  const [recibio, setRecibio] = useState(s.contacto_nombre ?? "");
  const [notas, setNotas] = useState("");
  const [procede, setProcede] = useState<boolean | null>(null);
  const [firma, setFirma] = useState<Blob | null>(null);
  const cerrar = useAccion(async () => {
    let ruta: string | null = null;
    if (firma) {
      ruta = await subirArchivo(`servicios/${s.id}`, firma, "png");
      await q(supabase.rpc("agregar_evidencia", { p_ruta: ruta, p_momento: "firma", p_servicio: s.id, p_nota: `Firma de ${recibio}` }));
    }
    return q(supabase.rpc("cerrar_servicio", { p_servicio: s.id, p_recibio: recibio, p_notas: notas, p_firma_ruta: ruta, p_garantia_procede: procede }));
  }, { exito: "Servicio cerrado: quien lo pidió ya tiene el aviso", invalidar: [CLAVE], alTerminar: alCerrar });
  const listo = fotosTrabajo > 0 && recibio.trim().length >= 3 && notas.trim().length >= 5 && (s.tipo !== "garantia" || procede != null);

  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Cerrar ${s.folio}`} ancho="max-w-xl"
      descripcion="Se cierra con foto del trabajo terminado, el nombre (y si se puede, la firma) de quien recibe y qué se hizo."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="form-cerrar" variante="exito" disabled={!listo} cargando={cerrar.isPending}>Cerrar servicio</Boton>
      </>}>
      <form id="form-cerrar" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (listo) cerrar.mutate(); }}>
        <div className="space-y-2">
          <SubirFotos carpeta={`servicios/${s.id}`} servicioId={s.id} momento="despues" texto="Foto del trabajo terminado" grande />
          <p className={cn("text-sm", fotosTrabajo ? "text-ok" : "text-peligro")}>
            {fotosTrabajo ? `${fotosTrabajo} ${fotosTrabajo === 1 ? "foto" : "fotos"} del trabajo` : "Falta al menos una foto del trabajo"}
          </p>
        </div>
        <Campo etiqueta="¿Qué se hizo?">
          <AreaTexto rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Se instaló, se probó con carga, se capacitó a…" />
        </Campo>
        {s.tipo === "garantia" && (
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">¿La garantía procedió?</legend>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => setProcede(v)} aria-pressed={procede === v}
                        className={cn("h-9 rounded-lg border px-4 text-sm", procede === v ? "border-marca bg-marca-suave font-medium" : "border-borde")}>
                  {v ? "Sí, era defecto nuestro" : "No (mal uso, desgaste…)"}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <Campo etiqueta="Recibe de conformidad">
          <Entrada value={recibio} onChange={(e) => setRecibio(e.target.value)} placeholder="Nombre de quien recibe" />
        </Campo>
        <div>
          <p className="text-sm font-medium mb-1.5">Firma <span className="text-tenue font-normal">(opcional)</span></p>
          <PanelFirma alCambiar={setFirma} />
        </div>
      </form>
    </Dialogo>
  );
}

function DialogoCancelar({ s, alCerrar }: { s: Servicio; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const cancelar = useAccion(() => q(supabase.rpc("cancelar_servicio", { p_servicio: s.id, p_motivo: motivo })),
    { exito: "Servicio cancelado; la cuadrilla queda libre", invalidar: [CLAVE], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Cancelar ${s.folio}`}
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>No</Boton>
        <Boton type="submit" form="form-cancelar" variante="peligro" disabled={motivo.trim().length < 3} cargando={cancelar.isPending}>Cancelar servicio</Boton>
      </>}>
      <form id="form-cancelar" onSubmit={(e) => { e.preventDefault(); cancelar.mutate(); }}>
        <Campo etiqueta="¿Por qué?"><Entrada autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El cliente lo pospuso, se resolvió por teléfono…" /></Campo>
      </form>
    </Dialogo>
  );
}

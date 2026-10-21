import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, Check, CheckCircle2, Stethoscope, Undo2 } from "lucide-react";
import { Lateral } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hace } from "@/lib/formato";
import { CLAVE, horas, type OrdenMto, type PuntoChecklist } from "../datos";
import { GLOSARIO } from "@/tutorial/glosario";
import { cn } from "@/lib/utilidades";
import { Dato, InsigniaMto, usePermisosServicio } from "./piezas";
import { GaleriaEvidencias } from "./Fotos";
import { Materiales } from "./Materiales";
import { Costos } from "./Costos";

function Seccion({ titulo, children, explica }: { titulo: string; children: React.ReactNode; explica?: string }) {
  return <section className="space-y-2"><h3 className="font-semibold" data-explain={explica} data-explain-title={explica ? titulo : undefined}>{titulo}</h3>{children}</section>;
}

/** Los puntos de la rutina: cada uno bien, o con falla y qué tiene. Agrupados por sección como en la hoja. */
function Checklist({ ordenId, editable }: { ordenId: string; editable: boolean }) {
  const puntos = useQuery({
    queryKey: [...CLAVE, "mto", ordenId, "checklist"],
    queryFn: () => q<PuntoChecklist[]>(supabase.from("orden_checklist").select("id, orden, seccion, texto, bien, nota").eq("orden_id", ordenId).order("orden")),
  });
  const [falla, setFalla] = useState<{ id: string; nota: string } | null>(null);
  const marcar = useAccion((a: { id: string; bien: boolean | null; nota?: string }) =>
    q(supabase.rpc("marcar_punto", { p_punto: a.id, p_bien: a.bien, p_nota: a.nota ?? null })),
    { invalidar: [CLAVE], alTerminar: () => setFalla(null) });
  const lista = puntos.data ?? [];
  if (puntos.isLoading) return <Cargando filas={3} />;
  if (lista.length === 0) return null;
  const revisados = lista.filter((x) => x.bien !== null).length;
  let seccion: string | null = null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-tenue cifra">{revisados} de {lista.length} revisados{lista.some((x) => x.bien === false) && ` · ${lista.filter((x) => x.bien === false).length} con falla`}</p>
      <ul className="divide-y divide-borde/60 rounded-lg border border-borde">
        {lista.map((x) => {
          const titulo = x.seccion && x.seccion !== seccion ? x.seccion : null;
          seccion = x.seccion;
          return (
            <li key={x.id} className="px-3 py-2">
              {titulo && <p className="etiqueta mb-1">{titulo}</p>}
              <div className="flex items-start gap-2">
                <span className={cn("mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0",
                  x.bien === true ? "bg-ok text-white border-ok" : x.bien === false ? "bg-peligro text-white border-peligro" : "border-borde")}>
                  {x.bien === true ? <Check className="h-3.5 w-3.5" /> : x.bien === false ? <AlertTriangle className="h-3 w-3" /> : null}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <p>{x.texto}</p>
                  {x.nota && <p className="text-xs text-peligro">{x.nota}</p>}
                  {falla?.id === x.id && (
                    <form className="flex gap-2 mt-1" onSubmit={(e) => { e.preventDefault(); marcar.mutate({ id: x.id, bien: false, nota: falla.nota }); }}>
                      <Entrada autoFocus className="h-8 flex-1" value={falla.nota} onChange={(e) => setFalla({ id: x.id, nota: e.target.value })} placeholder="Qué tiene" aria-label="Qué tiene" />
                      <Boton type="submit" tamano="sm" variante="peligro" disabled={falla.nota.trim().length < 3} cargando={marcar.isPending}>Con falla</Boton>
                    </form>
                  )}
                </div>
                {editable && (x.bien === null ? (
                  <div className="flex gap-1 shrink-0">
                    <Boton tamano="sm" variante="secundario" onClick={() => marcar.mutate({ id: x.id, bien: true })} aria-label="Bien">Bien</Boton>
                    <Boton tamano="sm" variante="fantasma" className="text-peligro" onClick={() => setFalla({ id: x.id, nota: "" })} aria-label="Con falla">Falla</Boton>
                  </div>
                ) : (
                  <Boton tamano="sm" variante="fantasma" onClick={() => marcar.mutate({ id: x.id, bien: null })} aria-label="Deshacer"><Undo2 className="h-3.5 w-3.5" /></Boton>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Una orden de mantenimiento sin perder la lista: lo que se reportó, el
 * diagnóstico, las refacciones (salen de almacén), el costo y el tiempo parada.
 * El taller diagnostica y pide refacciones; cerrar es de mantenimiento o de la gerencia.
 */
export function LateralMantenimiento({ id, alCerrar }: { id: string | null; alCerrar: () => void }) {
  const p = usePermisosServicio(true);
  const orden = useQuery({
    queryKey: [...CLAVE, "mto", id],
    enabled: !!id,
    queryFn: () => q<OrdenMto | null>(supabase.from("v_ordenes_mantenimiento").select("*").eq("id", id!).maybeSingle()),
  });
  const maquina = useQuery({
    queryKey: [...CLAVE, "mto", id, "maquina", orden.data?.maquina_id],
    enabled: !!orden.data,
    queryFn: () => q<{ usa_horometro: boolean; horas_uso: number } | null>(supabase.from("maquinas").select("usa_horometro, horas_uso").eq("id", orden.data!.maquina_id).maybeSingle()),
  });
  const o = orden.data;
  const [diag, setDiag] = useState<string | null>(null);
  const [atiende, setAtiende] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState("");
  const [horometro, setHorometro] = useState("");
  const [horasTrab, setHorasTrab] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const inv = { invalidar: [CLAVE] };
  const atender = useAccion(() => q(supabase.rpc("atender_mantenimiento", {
    p_orden: id, p_diagnostico: diag ?? o?.diagnostico ?? "", p_atiende: atiende ?? o?.atendido_por ?? null,
  })), { ...inv, exito: "Diagnóstico guardado" });
  const cerrar = useAccion(() => q(supabase.rpc("cerrar_mantenimiento", {
    p_orden: id, p_trabajo: trabajo, p_horas_uso: horometro ? Number(horometro) : null, p_horas_trabajadas: horasTrab ? Number(horasTrab) : null,
  })), { ...inv, exito: "Orden cerrada: la máquina vuelve a servicio", alTerminar: () => { setTrabajo(""); setHorasTrab(""); } });
  const cancelar = useAccion(() => q(supabase.rpc("cancelar_mantenimiento", { p_orden: id, p_motivo: motivo })),
    { ...inv, exito: "Orden cancelada", alTerminar: () => setCancelando(false) });

  const abierta = o?.abierta ?? false;
  return (
    <Lateral abierto={!!id} alCambiar={(v) => { if (!v) alCerrar(); }} ancho="max-w-2xl"
      titulo={o ? `${o.folio} · ${o.numero} ${o.maquina}` : "Orden de mantenimiento"}
      subtitulo={o && <span className="flex flex-wrap items-center gap-2"><InsigniaMto estado={o.estado} />
        <Insignia tono={o.tipo === "preventivo" ? "info" : "neutro"}>{o.tipo === "preventivo" ? "Preventivo" : "Correctivo"}</Insignia>
        {o.vencida && <Insignia tono="peligro">Vencido</Insignia>}
        {o.detiene && o.abierta && <Insignia tono="peligro">Máquina parada</Insignia>}</span>}>
      {orden.isLoading || !o ? <Cargando filas={6} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Dato etiqueta={o.tipo === "preventivo" ? "Generado" : "Reportó"}>{o.reportado_por_nombre ?? "—"}<span className="block text-xs text-tenue">{fechaYHora(o.reportado_en)}</span></Dato>
            {o.tipo === "preventivo" && <Dato etiqueta="Vence">{o.vence ? fecha(o.vence) : `${horas(o.vence_horas)} de uso`}</Dato>}
            <Dato etiqueta="Tiempo parada">{o.horas_paro == null ? "No se paró" : o.horas_paro >= 48 ? `${Math.round(o.horas_paro / 24)} días` : horas(o.horas_paro)}
              {o.fuera_desde && o.abierta && <span className="block text-xs text-tenue">desde {hace(o.fuera_desde)}</span>}</Dato>
            <Dato etiqueta="Máquina"><Link className="text-marca-texto hover:underline" to={`/servicio/maquinas/${o.maquina_id}`}>{o.numero} {o.maquina}</Link>
              <span className="block text-xs text-tenue">{o.etapa ?? o.categoria}</span></Dato>
          </div>

          <Seccion titulo={o.tipo === "preventivo" ? "Qué hay que hacer" : "Lo que se reportó"}>
            <p className="text-sm whitespace-pre-line">{o.falla}</p>
          </Seccion>

          {o.puntos > 0 && (
            <Seccion titulo="Checklist" explica={GLOSARIO.checklistMantenimiento}>
              <Checklist ordenId={o.id} editable={abierta && p.personal} />
            </Seccion>
          )}

          <Seccion titulo="Fotos">
            <GaleriaEvidencias mantenimientoId={o.id} carpeta={`mantenimiento/${o.maquina_id}`} puedeSubir={abierta && p.pedir}
                               momentos={["falla", "antes", "durante", "despues"]} momentoInicial={o.estado === "pendiente" ? "falla" : "despues"} />
          </Seccion>

          <Seccion titulo="Diagnóstico">
            {abierta && p.personal ? (
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); atender.mutate(); }}>
                <AreaTexto rows={2} value={diag ?? o.diagnostico ?? ""} onChange={(e) => setDiag(e.target.value)} placeholder="Qué tiene (cable de tierra quemado, carbones gastados…)" />
                <div className="flex flex-wrap gap-2">
                  <Entrada className="flex-1 min-w-[180px]" value={atiende ?? o.atendido_por ?? ""} onChange={(e) => setAtiende(e.target.value)} placeholder="Quién la repara (del taller o externo)" aria-label="Quién la repara" />
                  <Boton type="submit" variante="secundario" cargando={atender.isPending} disabled={(diag ?? o.diagnostico ?? "").trim().length < 3}>
                    <Stethoscope className="h-4 w-4" />{o.estado === "pendiente" ? "Empezar a repararla" : "Guardar"}
                  </Boton>
                </div>
              </form>
            ) : <p className="text-sm">{o.diagnostico ?? "Sin diagnóstico."}{o.atendido_por && <span className="block text-xs text-tenue">Atendió: {o.atendido_por}</span>}</p>}
          </Seccion>

          <Seccion titulo="Refacciones">
            <Materiales mantenimientoId={o.id} abierto={abierta} />
          </Seccion>

          {p.costos && (
            <Seccion titulo="Costo">
              <Costos mantenimientoId={o.id} conceptos={["servicio_externo", "mano_obra", "otro"]} />
            </Seccion>
          )}

          {o.estado === "cerrada" && (
            <Seccion titulo="Cierre">
              <p className="text-sm whitespace-pre-line">{o.trabajo_realizado}</p>
              <p className="text-xs text-tenue">{o.cerrada_por_nombre} · {fechaYHora(o.cerrada_en)}{o.horas_trabajadas != null && ` · ${horas(o.horas_trabajadas)} trabajadas`}{o.horas_uso_al_cerrar != null && ` · horómetro ${horas(o.horas_uso_al_cerrar)}`}</p>
            </Seccion>
          )}
          {o.estado === "cancelada" && <p className="text-sm text-tenue">Cancelada: {o.motivo_cancelacion}</p>}

          {abierta && p.gerencia && (
            <section className="space-y-2 rounded-lg border border-borde p-3 bg-fondo/50">
              <h3 className="font-semibold">Cerrar la orden</h3>
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (trabajo.trim().length >= 5) cerrar.mutate(); }}>
                <AreaTexto rows={2} value={trabajo} onChange={(e) => setTrabajo(e.target.value)} placeholder="Qué se hizo: qué se cambió o reparó" />
                <div className="flex flex-wrap gap-2 items-end">
                  <Campo etiqueta="Horas trabajadas" className="w-36" ayuda="De mantenimiento, no de paro">
                    <span data-explain={GLOSARIO.horasTrabajadas} className="block">
                      <Entrada type="number" min="0" step="0.25" value={horasTrab} onChange={(e) => setHorasTrab(e.target.value)} placeholder="1.5" />
                    </span>
                  </Campo>
                  {maquina.data?.usa_horometro && (
                    <Campo etiqueta="Horómetro" className="w-36" ayuda={`Última: ${horas(maquina.data.horas_uso)}`}>
                      <Entrada type="number" min={maquina.data.horas_uso} step="0.1" value={horometro} onChange={(e) => setHorometro(e.target.value)} />
                    </Campo>
                  )}
                  <Boton type="submit" variante="exito" cargando={cerrar.isPending} disabled={trabajo.trim().length < 5 || o.puntos_revisados < o.puntos}
                         title={o.puntos_revisados < o.puntos ? `Faltan ${o.puntos - o.puntos_revisados} puntos del checklist` : undefined}>
                    <CheckCircle2 className="h-4 w-4" />Cerrar y poner en servicio
                  </Boton>
                  <Boton type="button" variante="fantasma" onClick={() => setCancelando((v) => !v)}><Ban className="h-4 w-4" />Cancelar orden</Boton>
                </div>
              </form>
              {cancelando && (
                <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); cancelar.mutate(); }}>
                  <Entrada className="flex-1 min-w-[200px]" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué (¿era el mismo reporte?)" autoFocus aria-label="Motivo de la cancelación" />
                  <Boton type="submit" variante="peligro" cargando={cancelar.isPending} disabled={motivo.trim().length < 3}>Cancelar orden</Boton>
                </form>
              )}
            </section>
          )}
          {abierta && !p.gerencia && <p className="text-xs text-tenue">Mantenimiento o la gerencia de producción cierran la orden cuando la máquina queda lista.</p>}
        </div>
      )}
    </Lateral>
  );
}

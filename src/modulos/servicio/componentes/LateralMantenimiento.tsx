import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Stethoscope } from "lucide-react";
import { Lateral } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hace } from "@/lib/formato";
import { CLAVE, horas, type OrdenMto } from "../datos";
import { Dato, InsigniaMto, usePermisosServicio } from "./piezas";
import { GaleriaEvidencias } from "./Fotos";
import { Materiales } from "./Materiales";
import { Costos } from "./Costos";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="font-semibold">{titulo}</h3>{children}</section>;
}

/**
 * Una orden de mantenimiento sin perder la lista: lo que se reportó, el
 * diagnóstico, las refacciones (salen de almacén), el costo y el tiempo parada.
 * El taller diagnostica y pide refacciones; cerrar es de la gerencia.
 */
export function LateralMantenimiento({ id, alCerrar }: { id: string | null; alCerrar: () => void }) {
  const p = usePermisosServicio();
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
  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const inv = { invalidar: [CLAVE] };
  const atender = useAccion(() => q(supabase.rpc("atender_mantenimiento", {
    p_orden: id, p_diagnostico: diag ?? o?.diagnostico ?? "", p_atiende: atiende ?? o?.atendido_por ?? null,
  })), { ...inv, exito: "Diagnóstico guardado" });
  const cerrar = useAccion(() => q(supabase.rpc("cerrar_mantenimiento", {
    p_orden: id, p_trabajo: trabajo, p_horas_uso: horometro ? Number(horometro) : null,
  })), { ...inv, exito: "Orden cerrada: la máquina vuelve a servicio", alTerminar: () => setTrabajo("") });
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
              <p className="text-xs text-tenue">{o.cerrada_por_nombre} · {fechaYHora(o.cerrada_en)}{o.horas_uso_al_cerrar != null && ` · horómetro ${horas(o.horas_uso_al_cerrar)}`}</p>
            </Seccion>
          )}
          {o.estado === "cancelada" && <p className="text-sm text-tenue">Cancelada: {o.motivo_cancelacion}</p>}

          {abierta && p.gerencia && (
            <section className="space-y-2 rounded-lg border border-borde p-3 bg-fondo/50">
              <h3 className="font-semibold">Cerrar la orden</h3>
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (trabajo.trim().length >= 5) cerrar.mutate(); }}>
                <AreaTexto rows={2} value={trabajo} onChange={(e) => setTrabajo(e.target.value)} placeholder="Qué se hizo: qué se cambió o reparó" />
                <div className="flex flex-wrap gap-2 items-end">
                  {maquina.data?.usa_horometro && (
                    <Campo etiqueta="Horómetro" className="w-36" ayuda={`Última: ${horas(maquina.data.horas_uso)}`}>
                      <Entrada type="number" min={maquina.data.horas_uso} step="0.1" value={horometro} onChange={(e) => setHorometro(e.target.value)} />
                    </Campo>
                  )}
                  <Boton type="submit" variante="exito" cargando={cerrar.isPending} disabled={trabajo.trim().length < 5}>
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
          {abierta && !p.gerencia && <p className="text-xs text-tenue">La gerencia de producción cierra la orden cuando la máquina queda lista.</p>}
        </div>
      )}
    </Lateral>
  );
}

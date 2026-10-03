import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileText, Lock, MessageSquareQuote, Plus, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Filtro } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { cn, coincide } from "@/lib/utilidades";
import {
  CLAVE, abierta, plazo, useSolicitudes, useSolicitudesEnVivo, type Solicitud,
} from "@/modulos/compras/solicitudes/datos";
import { InsigniasSolicitud, LineaTiempo, QueSePide, RespuestaVenta } from "@/modulos/compras/solicitudes/Componentes";
import { DialogoMotivo } from "../componentes/dialogos";
import { DialogoPedirPrecio } from "./DialogoPedirPrecio";

type Vista = "abiertas" | "con_precio" | "todas";

/**
 * Mis solicitudes de precio: lo que le pedí a compras, en vivo (quién la tiene, para
 * cuándo y, cuando hay, el precio de lista y la entrega). Vive en ventas porque el
 * vendedor la usa junto a sus cotizaciones; la gerencia ve las de todo su equipo.
 * Casi siempre se pide desde la cotización; aquí también se puede pedir suelto.
 */
export default function MisSolicitudes() {
  const { puede, perfil } = useSesion();
  const [params, setParams] = useSearchParams();
  const vista = (params.get("filtro") as Vista) || "abiertas";
  const resaltada = params.get("id");
  const [busqueda, setBusqueda] = useState("");
  const [pedir, setPedir] = useState(false);
  const [cancelar, setCancelar] = useState<Solicitud | null>(null);
  const gerente = puede("ventas", 3);
  const permitido = puede("ventas", 2) || puede("costeo", 3);
  useSolicitudesEnVivo();
  const lista = useSolicitudes({ habilitado: permitido });

  const todas = useMemo(() => lista.data ?? [], [lista.data]);
  const pasa = (s: Solicitud, v: Vista) => v === "abiertas" ? abierta(s) || (s.estado === "contestada" && !s.usada) || s.id === resaltada
    : v === "con_precio" ? s.estado === "contestada" : true;
  const visibles = todas.filter((s) => pasa(s, vista) && (!busqueda.trim()
    || coincide(`${s.folio} ${s.articulo ?? ""} ${s.descripcion ?? ""} ${s.marca ?? ""} ${s.modelo ?? ""} ${s.cliente ?? ""} ${s.solicitante}`, busqueda)));

  // Al llegar desde un aviso, la solicitud queda a la vista.
  useEffect(() => {
    if (!resaltada || !lista.data) return;
    document.getElementById(`sol-${resaltada}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [resaltada, lista.data]);

  const aplicar = useAccion(
    (s: Solicitud) => q<string>(supabase.rpc("aplicar_solicitud_precio", { p_solicitud: s.id })),
    { exito: "Precio aplicado a la cotización", invalidar: [[...CLAVE], ["cotizacion_lineas"], ["cotizacion"]] },
  );
  const cancelarSol = useAccion(
    (a: { s: Solicitud; motivo: string }) => q(supabase.rpc("cancelar_solicitud_precio", { p_solicitud: a.s.id, p_motivo: a.motivo })),
    { exito: "Cancelada: compras ya no la verá pendiente", invalidar: [[...CLAVE]], alTerminar: () => setCancelar(null) },
  );

  if (!permitido) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-tenue">
        <Lock className="h-8 w-8 mb-3" />
        <p className="font-medium text-texto">Esta sección no está en tu rol</p>
      </div>
    );
  }

  const cambiar = (v: Vista) => { const p = new URLSearchParams(params); if (v === "abiertas") p.delete("filtro"); else p.set("filtro", v); setParams(p, { replace: true }); };
  const sinUsar = todas.filter((s) => s.estado === "contestada" && !s.usada).length;

  return (
    <Pagina
      titulo={gerente ? "Solicitudes de precio" : "Mis solicitudes de precio"}
      descripcion={gerente ? "Lo que tu equipo le pidió a compras, en vivo: quién lo tiene, para cuándo y el precio de lista cuando ya hay."
        : "Lo que le pediste a compras, en vivo: quién lo tiene, para cuándo y el precio de lista cuando ya hay. Te avisamos en la campana."}
      acciones={<Boton onClick={() => setPedir(true)}><Plus className="h-4 w-4" />Pedir precio</Boton>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input className="campo max-w-xs" placeholder="Buscar folio, artículo, cliente…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Filtro<Vista> valor={vista} alCambiar={cambiar} opciones={[
          { valor: "abiertas", texto: "Pendientes y por usar", cuenta: todas.filter((s) => pasa(s, "abiertas")).length },
          { valor: "con_precio", texto: "Con precio", cuenta: todas.filter((s) => s.estado === "contestada").length },
          { valor: "todas", texto: "Todas" },
        ]} />
        {sinUsar > 0 && <span className="text-xs text-aviso ml-auto">{sinUsar} con precio que todavía no usas</span>}
      </div>

      {lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={5} /> : visibles.length === 0 ? (
        <div className="tarjeta">
          <Vacio icono={MessageSquareQuote} titulo={vista === "abiertas" ? "No tienes precios pendientes" : "Nada con este filtro"}
            texto="Pide un precio desde la partida de tu cotización (o desde el buscador: “¿No está? Pídeselo a compras”), o aquí con “Pedir precio”."
            accion={<Boton variante="secundario" onClick={() => setPedir(true)}><Plus className="h-4 w-4" />Pedir precio</Boton>} />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((s) => (
            <article key={s.id} id={`sol-${s.id}`} className={cn("tarjeta p-4 space-y-3", s.id === resaltada && "ring-2 ring-marca/50",
              s.semaforo === "vencida" && "border-peligro/40")}>
              <div className="flex items-start justify-between gap-3">
                <QueSePide s={s} />
                <span className="text-xs cifra text-tenue shrink-0">{s.folio}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-tenue">
                <InsigniasSolicitud s={s} />
                {gerente && s.solicitante_id !== perfil?.id && <span>{s.solicitante}</span>}
                {s.cliente && <span>{s.cliente}</span>}
                {s.cotizacion_folio && s.cotizacion_id && <Link to={`/ventas/cotizaciones/${s.cotizacion_id}`} className="text-marca-texto cifra inline-flex items-center gap-1"><FileText className="h-3 w-3" />{s.cotizacion_folio}</Link>}
              </div>
              {abierta(s) && (
                <p className={cn("text-sm", s.semaforo === "vencida" ? "text-peligro font-medium" : "text-tenue")}>
                  {s.estado === "tomada" ? <>La tiene <b className="text-texto">{s.tomada_por_nombre}</b> · </> : <>Nadie la ha tomado · </>}{plazo(s)}
                </p>
              )}
              <RespuestaVenta s={s} />
              <details className="text-sm">
                <summary className="text-xs text-marca-texto cursor-pointer">Historia</summary>
                <div className="mt-2"><LineaTiempo s={s} /></div>
              </details>
              {(abierta(s) || (s.estado === "contestada" && s.cotizacion_id && !s.aplicada_en)) && (
                <div className="flex flex-wrap justify-end gap-2">
                  {abierta(s) && (s.solicitante_id === perfil?.id || gerente) && (
                    <Boton tamano="sm" variante="fantasma" onClick={() => setCancelar(s)}><X className="h-3.5 w-3.5" />Ya no la necesito</Boton>
                  )}
                  {s.estado === "contestada" && s.cotizacion_id && !s.aplicada_en && (
                    <Boton tamano="sm" variante="exito" cargando={aplicar.isPending && aplicar.variables?.id === s.id} onClick={() => aplicar.mutate(s)}>
                      Aplicar a {s.cotizacion_folio}
                    </Boton>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <DialogoPedirPrecio abierto={pedir} alCambiar={setPedir} inicial={{}} elegirCliente />
      <DialogoMotivo abierto={!!cancelar} alCambiar={(v) => !v && setCancelar(null)} titulo={`Cancelar ${cancelar?.folio ?? ""}`}
        descripcion="Compras deja de cotizarla (y si ya la tenía alguien, le avisamos)." etiqueta="¿Por qué ya no hace falta?"
        sugerencias={["El cliente ya no lo necesita", "Lo encontré en el catálogo", "El cliente lo compró en otro lado"]}
        textoBoton="Cancelar solicitud" cargando={cancelarSol.isPending}
        alConfirmar={(motivo) => cancelar && cancelarSol.mutate({ s: cancelar, motivo })} />
    </Pagina>
  );
}

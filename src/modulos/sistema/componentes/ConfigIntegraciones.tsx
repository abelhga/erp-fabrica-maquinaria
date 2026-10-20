import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Copy, DownloadCloud, Link2, RefreshCw, Unlink } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { llamarML, URL_ML, type EstadoML, type ResultadoSincronizar } from "@/lib/mercadolibre";
import { GLOSARIO } from "@/tutorial/glosario";
import { ConfigSkydropx } from "./ConfigSkydropx";

/** Mercado Libre (conectar la cuenta, a quién le llegan las ventas, si los avisos entran) y Skydropx (guías). */
export function ConfigIntegraciones() {
  const { tieneRol, puede } = useSesion();
  const direccion = tieneRol("direccion");
  const traer = direccion || puede("ventas", 2);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const estado = useQuery({ queryKey: ["estado_mercadolibre"], queryFn: () => q<EstadoML>(supabase.rpc("estado_mercadolibre")) });
  const personas = useQuery({
    queryKey: ["perfiles", "activos"], enabled: direccion,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre")),
  });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ventasDesde, setVentasDesde] = useState("");
  const [traido, setTraido] = useState<ResultadoSincronizar | null>(null);

  // Regreso del permiso de ML: avisa una vez y limpia la URL.
  useEffect(() => {
    const ml = params.get("ml");
    if (!ml) return;
    if (ml === "conectada") toast.success("Mercado Libre quedó conectado");
    else toast.error(`No se conectó Mercado Libre: ${params.get("detalle") ?? "intenta de nuevo"}`);
    setParams({ seccion: "integraciones" }, { replace: true });
    qc.invalidateQueries({ queryKey: ["estado_mercadolibre"] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(accion: "iniciar" | "procesar" | "desconectar") {
    setOcupado(accion);
    try {
      if (accion === "iniciar") { window.location.href = (await llamarML<{ url: string }>("iniciar")).url; return; }
      if (accion === "desconectar" && !confirm("¿Desconectar Mercado Libre? Las ventas, reclamos y preguntas dejan de entrar solos hasta que se vuelva a conectar.")) return;
      const r = await llamarML<{ procesados?: number; errores?: number }>(accion);
      if (accion === "procesar") toast.success(`${numero(r.procesados ?? 0)} avisos procesados${r.errores ? `, ${r.errores} con error` : ""}`);
      else toast.success("Mercado Libre desconectado");
      qc.invalidateQueries({ queryKey: ["estado_mercadolibre"] });
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }
  // ML solo avisa lo que pasa después de conectar: lo que ya estaba (preguntas sin contestar,
  // reclamos abiertos y, si se pide, ventas desde una fecha) se trae con esto.
  async function sincronizar() {
    if (ventasDesde && !confirm(`Se van a registrar como pedidos las ventas de Mercado Libre desde el ${fecha(ventasDesde)}. Si alguna ya la capturaron a mano en Pedidos, quedaría repetida. ¿Seguir?`)) return;
    setOcupado("sincronizar");
    try {
      const r = await llamarML<ResultadoSincronizar>("sincronizar", ventasDesde ? { ventas_desde: ventasDesde } : {});
      setTraido(r);
      toast.success(`Traído de Mercado Libre: ${numero(r.preguntas)} preguntas, ${numero(r.reclamos)} reclamos, ${numero(r.ventas)} ventas`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }
  const responsable = useAccion((id: string) => q(supabase.rpc("fijar_responsable_ml", { p_usuario: id || null })), {
    exito: "Guardado: las ventas de ML van a su nombre", invalidar: [["estado_mercadolibre"]],
  });
  const atienden = useAccion((ids: string[]) => q(supabase.rpc("fijar_atienden_ml", { p_usuarios: ids })), {
    exito: "Guardado: les llegan los avisos de Mercado Libre", invalidar: [["estado_mercadolibre"]],
  });

  if (estado.error) return <ErrorCarga error={estado.error} />;
  if (!estado.data) return <Cargando filas={4} />;
  const e = estado.data;
  const copiar = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Tarjeta>
        <EncabezadoTarjeta titulo="Mercado Libre" explica={GLOSARIO.conexionML}
          descripcion="Las ventas entran solas como pedidos (con su envío), y los reclamos y las preguntas llegan con su fecha límite."
          acciones={e.conectada ? <Insignia tono="ok"><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</Insignia> : <Insignia tono="neutro">Sin conectar</Insignia>} />
        <div className="px-5 pb-5 space-y-4 text-sm">
          {e.conectada ? (
            <p>Cuenta <b>{e.nickname ?? "de Mercado Libre"}</b>, conectada {e.conectada_en ? `el ${fecha(e.conectada_en)}` : ""}{e.conectada_por ? ` por ${e.conectada_por}` : ""}.</p>
          ) : (
            <p className="text-tenue">Sin conectar, las ventas de Mercado Libre se siguen capturando a mano en Pedidos.</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Dato titulo="Ventas (30 días)" valor={numero(e.ventas_30d)} />
            <Dato titulo="Preguntas sin contestar" valor={numero(e.preguntas_pendientes)} tono={e.preguntas_pendientes ? "aviso" : undefined} />
            <Dato titulo="Publicaciones por ligar" valor={numero(e.sin_ligar)} tono={e.sin_ligar ? "aviso" : undefined} explica={GLOSARIO.publicacionPorLigar} />
          </div>
          {e.conectada && (
            <div className="rounded-lg border border-borde px-3 py-2 space-y-1">
              <p>Último aviso de ML: <b>{e.ultimo_aviso ? hace(e.ultimo_aviso) : "ninguno todavía"}</b>{e.ultimo_aviso ? <span className="text-tenue"> ({fechaYHora(e.ultimo_aviso)})</span> : null}</p>
              <p>{e.avisos_pendientes ? <>Pendientes: <b>{numero(e.avisos_pendientes)}</b>{e.avisos_con_error ? <span className="text-peligro"> · {numero(e.avisos_con_error)} con error</span> : null}</> : "Todo procesado."}</p>
              {e.ultimo_error && <p className="text-peligro text-xs break-words">{e.ultimo_error}</p>}
            </div>
          )}
          {e.conectada && traer && (
            <div className="rounded-lg border border-borde px-3 py-3 space-y-2" data-explain={GLOSARIO.traerPendienteML} data-explain-title="Traer lo pendiente">
              <p className="font-medium">Traer lo que ya estaba en Mercado Libre</p>
              <p className="text-xs text-tenue">Mercado Libre solo avisa lo que pasa después de conectar. Esto trae las preguntas sin contestar y los reclamos abiertos; las ventas, solo si eliges desde cuándo.</p>
              <div className="flex flex-wrap items-end gap-2">
                <Campo etiqueta="Traer también ventas desde (opcional)">
                  <Entrada type="date" className="w-44 block" value={ventasDesde} max={new Date().toISOString().slice(0, 10)} onChange={(x) => setVentasDesde(x.target.value)} />
                </Campo>
                <Boton variante="secundario" onClick={sincronizar} cargando={ocupado === "sincronizar"}><DownloadCloud className="h-4 w-4" /> Traer lo pendiente</Boton>
              </div>
              {traido && (
                <p className="text-xs">
                  Cuenta <b>{traido.cuenta ?? "de Mercado Libre"}</b>{traido.publicaciones != null ? <> · {numero(traido.publicaciones)} publicaciones activas</> : null}
                  {" "}· {numero(traido.preguntas)} preguntas · {numero(traido.reclamos)} reclamos · {numero(traido.ventas)} ventas
                  {traido.errores ? <span className="text-peligro"> · {numero(traido.errores)} con error</span> : null}
                </p>
              )}
            </div>
          )}
          {direccion && <>
            {/* Varias personas atienden ML (preguntas, reclamos, ventas por ligar); las ventas, en
                cambio, van a nombre de una sola por la comisión. */}
            <Campo etiqueta="Quiénes atienden Mercado Libre" ayuda="A todos les llegan los avisos de preguntas, reclamos y ventas por ligar. Si no eliges a nadie, le llegan a dirección.">
              <div className="flex flex-wrap gap-2 pt-1" data-explain={GLOSARIO.atiendenML} data-explain-title="Quiénes atienden Mercado Libre">
                {e.atienden.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-borde bg-fondo px-2.5 py-1 text-xs">
                    {p.nombre}
                    <button type="button" className="text-tenue hover:text-peligro" aria-label={`Quitar a ${p.nombre}`} disabled={atienden.isPending}
                      onClick={() => atienden.mutate(e.atienden.filter((x) => x.id !== p.id).map((x) => x.id))}>×</button>
                  </span>
                ))}
                <Seleccion value="" className="h-8 w-auto text-xs" aria-label="Agregar a alguien" disabled={atienden.isPending}
                  onChange={(x) => x.target.value && atienden.mutate([...e.atienden.map((p) => p.id), x.target.value])}>
                  <option value="">+ Agregar a alguien…</option>
                  {(personas.data ?? []).filter((p) => !e.atienden.some((a) => a.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Seleccion>
              </div>
            </Campo>
            <Campo etiqueta="Las ventas de Mercado Libre quedan a nombre de" ayuda="Una sola persona: es a quien se le cuentan para la comisión. «Nadie» = quedan sin vendedor.">
              <Seleccion value={e.responsable_elegido_id ?? ""} onChange={(x) => responsable.mutate(x.target.value)} disabled={responsable.isPending}>
                <option value="">Nadie (sin vendedor)</option>
                {(personas.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Seleccion>
            </Campo>
          </>}
          <div className="flex flex-wrap gap-2">
            {direccion && !e.conectada && <Boton onClick={() => hacer("iniciar")} cargando={ocupado === "iniciar"}><Link2 className="h-4 w-4" /> Conectar Mercado Libre</Boton>}
            {e.conectada && <Boton variante="secundario" onClick={() => hacer("procesar")} cargando={ocupado === "procesar"}><RefreshCw className="h-4 w-4" /> Revisar ahora</Boton>}
            {direccion && e.conectada && <Boton variante="fantasma" onClick={() => hacer("desconectar")} cargando={ocupado === "desconectar"}><Unlink className="h-4 w-4" /> Desconectar</Boton>}
          </div>
        </div>
      </Tarjeta>

      {direccion && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Cómo se conecta (una sola vez)" descripcion="Lo hace quien administra la cuenta de vendedor de Hegamex en Mercado Libre." />
          <ol className="px-5 pb-5 space-y-3 text-sm list-decimal pl-9">
            <li>En <a className="text-marca-texto hover:underline" href="https://developers.mercadolibre.com.mx/devcenter" target="_blank" rel="noreferrer">developers.mercadolibre.com.mx</a>, con la cuenta de Hegamex: <b>Crear aplicación</b>.</li>
            <li>URI de redirección:
              <CopiarUrl texto={`${URL_ML}/autorizar`} alCopiar={copiar} /></li>
            <li>URL de notificaciones, con los tópicos <b>Orders</b>, <b>Claims</b> y <b>Questions</b>:
              <CopiarUrl texto={`${URL_ML}/aviso`} alCopiar={copiar} /></li>
            <li>Copia el <b>Client ID</b> y el <b>Client Secret</b> a Supabase → Edge Functions → Secrets como <code>ML_CLIENT_ID</code> y <code>ML_CLIENT_SECRET</code>. No los mandes por chat ni correo.</li>
            <li>Regresa aquí y da clic en <b>Conectar Mercado Libre</b>; acepta el permiso con la cuenta de Hegamex.</li>
          </ol>
        </Tarjeta>
      )}

      <ConfigSkydropx />
    </div>
  );
}

function CopiarUrl({ texto, alCopiar }: { texto: string; alCopiar: (t: string) => void }) {
  return (
    <span className="mt-1 flex items-center gap-2 rounded-md bg-fondo border border-borde px-2 py-1">
      <code className="flex-1 min-w-0 truncate text-xs">{texto}</code>
      <button type="button" className="text-tenue hover:text-texto" onClick={() => alCopiar(texto)} aria-label="Copiar"><Copy className="h-3.5 w-3.5" /></button>
    </span>
  );
}

function Dato({ titulo, valor, tono, explica }: { titulo: string; valor: string; tono?: "aviso"; explica?: string }) {
  return (
    <div data-explain={explica} data-explain-title={explica ? titulo : undefined}>
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={`text-xl font-semibold cifra ${tono === "aviso" ? "text-aviso" : ""}`}>{valor}</p>
    </div>
  );
}

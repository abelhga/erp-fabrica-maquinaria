import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileText, Mail, MessageCircle, Send } from "lucide-react";
import { textoFichas } from "./Fichas";
import type { Estimacion } from "./EntregaRealista";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  compromisoDesde, dineroEn, enlaceWhatsApp, telefonoWa, textoWhatsApp,
  type Contacto, type Cotizacion, type Partida, type PlanMeses,
} from "../comun";

/**
 * Enviar = mandar el PDF y el mensaje por WhatsApp (como hoy) y dejar la
 * cotización como "enviada" para darle seguimiento. wa.me no permite adjuntar:
 * el PDF se descarga con "Abrir PDF" y se arrastra al chat.
 */
export function DialogoEnviar({ abierto, alCambiar, c, partidas, contacto, vendedor, plan, yaEnviada, alMarcarEnviada, alAbrirPdf, enviando, fichas = [], frenado, alPorCorreo }: {
  abierto: boolean; alCambiar: (v: boolean) => void; c: Cotizacion; partidas: Partida[]; contacto: Contacto | null | undefined;
  vendedor: { nombre?: string | null; telefono?: string | null } | null | undefined; plan: PlanMeses | null | undefined;
  yaEnviada: boolean; alMarcarEnviada: () => Promise<unknown>; alAbrirPdf: () => void; enviando?: boolean;
  /** Fichas técnicas vigentes de las partidas: el cliente las pide y antes se buscaban en Drive. */
  fichas?: { titulo: string; drive_url: string }[];
  /** Con más seguimientos vencidos que el tope, no se envía (ni se abre WhatsApp) hasta ponerse al día. */
  frenado?: { vencidos: number; tope: number } | null;
  /** Abre el envío por correo (con el PDF adjunto, desde el Gmail del vendedor). */
  alPorCorreo?: () => void;
}) {
  const bloqueado = !!frenado && !yaEnviada;
  const [tel, setTel] = useState("");
  const [texto, setTexto] = useState("");
  const [conFichas, setConFichas] = useState(false);
  const bloqueFichas = textoFichas(fichas);
  useEffect(() => {
    if (!abierto) return;
    setTel(contacto?.whatsapp || contacto?.telefono || "");
    setTexto(textoWhatsApp(c, partidas, vendedor, plan));
    setConFichas(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  // Las ligas se agregan antes de la despedida; quitarlas deja el texto como estaba (aunque se haya editado).
  function alternarFichas(si: boolean) {
    setConFichas(si);
    setTexto((t) => {
      if (!si) return t.replace(bloqueFichas, "");
      const i = t.lastIndexOf("\n\nQuedo a sus órdenes");
      return i >= 0 ? t.slice(0, i) + bloqueFichas + t.slice(i) : t + bloqueFichas;
    });
  }

  async function porWhatsApp() {
    // Se abre antes del await: los navegadores bloquean ventanas que no salen directo del clic.
    window.open(enlaceWhatsApp(tel, texto), "_blank", "noopener");
    if (!yaEnviada) await alMarcarEnviada();
    alCambiar(false);
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={yaEnviada ? "Compartir cotización" : "Enviar cotización"} ancho="max-w-xl"
      descripcion={yaEnviada ? `${c.folio} ya está enviada; puedes volver a compartirla.` : `${c.folio} quedará como enviada y empieza a contar su vigencia para el seguimiento.`}
      pie={<>
        {!yaEnviada && <Boton variante="secundario" cargando={enviando} disabled={bloqueado} onClick={async () => { await alMarcarEnviada(); alCambiar(false); }}><Send className="h-4 w-4" />Solo marcar enviada</Boton>}
        <Boton variante="secundario" onClick={alAbrirPdf} disabled={bloqueado}><FileText className="h-4 w-4" />Abrir PDF</Boton>
        {alPorCorreo && <Boton variante="secundario" onClick={() => { alCambiar(false); alPorCorreo(); }} disabled={bloqueado}><Mail className="h-4 w-4" />Por correo</Boton>}
        <Boton variante="exito" onClick={porWhatsApp} cargando={enviando} disabled={bloqueado}><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</Boton>
      </>}>
      <div className="space-y-3">
        {bloqueado && (
          <div className="flex items-start gap-3 rounded-lg border border-peligro/30 bg-peligro-suave px-3 py-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-peligro mt-0.5 shrink-0" />
            <p>Tienes <b>{frenado!.vencidos} seguimientos vencidos</b> y el tope es {frenado!.tope}: primero anota qué pasó con las cotizaciones que ya mandaste.{" "}
              <Link to="/ventas/cotizaciones?estado=seguimiento" className="font-medium text-marca-texto underline" onClick={() => alCambiar(false)}>Ponerme al día</Link>.
              {" "}Si el cliente está esperando, pide a la gerencia de ventas que te libere por hoy.</p>
          </div>
        )}
        <Campo etiqueta="WhatsApp del cliente" ayuda={tel && telefonoWa(tel).length < 12 ? "Revisa el número: le faltan dígitos." : contacto ? `Contacto: ${contacto.nombre}` : "Sin contacto ligado: escríbelo o deja vacío para elegir el chat en WhatsApp."}>
          <Entrada value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="33 1234 5678" />
        </Campo>
        <Campo etiqueta="Mensaje">
          <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-[180px] text-sm" />
        </Campo>
        {fichas.length > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={conFichas} onChange={(e) => alternarFichas(e.target.checked)} />
            Incluir las ligas de las fichas técnicas ({fichas.length})
            <span className="text-xs text-tenue">· van también en el PDF</span>
          </label>
        )}
      </div>
    </Dialogo>
  );
}

/**
 * Cotización → pedido. Aquí se eligen las partidas: las opcionales vienen sin
 * marcar (no suman), pero si el cliente eligió la alternativa se palomea.
 */
export function DialogoConvertir({ abierto, alCambiar, c, partidas, alConfirmar, cargando, estimacion }: {
  abierto: boolean; alCambiar: (v: boolean) => void; c: Cotizacion; partidas: Partida[]; estimacion?: Estimacion;
  alConfirmar: (fechaCompromiso: string, ids: string[]) => void; cargando?: boolean;
}) {
  const [fechaC, setFechaC] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!abierto) return;
    // Lo prometido en la cotización, pero nunca antes de lo que el taller puede sacar hoy.
    const prometida = compromisoDesde(c.tiempo_entrega);
    setFechaC(estimacion?.fecha_propuesta && estimacion.fecha_propuesta > prometida ? estimacion.fecha_propuesta : prometida);
    setSel(new Set(partidas.filter((p) => !p.opcional).map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  const elegidas = partidas.filter((p) => sel.has(p.id));
  const sub = elegidas.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio_unitario) * (1 - Number(p.descuento_pct)), 0) * (1 - Number(c.descuento_pct));
  const sinIva = c.precios_con_iva ? sub / (1 + Number(c.tasa_iva)) : sub;

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Convertir en pedido" ancho="max-w-2xl"
      descripcion="El pedido toma precios, descuentos y condiciones de la cotización; producción y cobranza lo ven al instante."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton disabled={!elegidas.length || !c.cliente_id} cargando={cargando} onClick={() => alConfirmar(fechaC, elegidas.map((p) => p.id))}>
          Crear pedido por {dineroEn(sinIva * (1 + Number(c.tasa_iva)), c.moneda)}
        </Boton>
      </>}>
      <div className="space-y-4">
        {!c.cliente_id && <p className="rounded-lg bg-aviso-suave text-aviso text-sm p-3">Liga la cotización a un cliente antes de convertirla (arriba, en “Cliente”).</p>}
        <Campo etiqueta="Fecha compromiso de entrega"
          ayuda={estimacion?.fecha_propuesta
            ? `Con el taller como está hoy, lo realista es el ${fecha(estimacion.fecha_propuesta)}${c.tiempo_entrega ? ` (la cotización dice “${c.tiempo_entrega}”)` : ""}.`
            : c.tiempo_entrega ? `Propuesta según “${c.tiempo_entrega}”` : undefined}>
          <Entrada type="date" value={fechaC} onChange={(e) => setFechaC(e.target.value)} className="sm:w-52" />
        </Campo>
        {estimacion?.fecha_propuesta && fechaC && fechaC < estimacion.fecha_propuesta && (
          <p className="rounded-lg bg-aviso-suave text-aviso text-sm p-3">
            Esa fecha es antes de lo que el taller puede sacar ({fecha(estimacion.fecha_propuesta)}): el pedido nacería atrasado. Si de todos modos la prometes, avísale a producción.
          </p>
        )}
        <div className="tarjeta divide-y divide-borde">
          {partidas.map((p) => (
            <label key={p.id} className={cn("flex items-start gap-3 px-3 py-2.5 cursor-pointer", !sel.has(p.id) && "opacity-60")}>
              <input type="checkbox" className="mt-1" checked={sel.has(p.id)}
                onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{p.titulo}</span>
                <span className="text-xs text-tenue">{Number(p.cantidad)} {p.unidad} × {dineroEn(Number(p.precio_unitario), c.moneda)}</span>
                {p.opcional && <Insignia tono="info" className="ml-2">opcional</Insignia>}
              </span>
              <span className="text-sm cifra">{dineroEn(Number(p.cantidad) * Number(p.precio_unitario) * (1 - Number(p.descuento_pct)), c.moneda)}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-tenue text-right">
          Subtotal sin IVA <b className="cifra text-texto">{dineroEn(sinIva, c.moneda)}</b>
          {c.moneda !== "MXN" && <> · {dinero(sinIva * Number(c.tipo_cambio))} MXN al TC {Number(c.tipo_cambio)}</>}
        </p>
      </div>
    </Dialogo>
  );
}

/** El vendedor explica el descuento: la gerente lo lee en su cola antes de autorizar. */
export function DialogoPedirAutorizacion({ abierto, alCambiar, partidasBajo, alConfirmar, cargando, pedidaEn }: {
  abierto: boolean; alCambiar: (v: boolean) => void; partidasBajo: Partida[]; alConfirmar: (nota: string) => void; cargando?: boolean; pedidaEn?: string | null;
}) {
  const [nota, setNota] = useState("");
  useEffect(() => { if (abierto) setNota(""); }, [abierto]);
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Pedir autorización de precios"
      descripcion={pedidaEn ? `Ya la pediste el ${fecha(pedidaEn)}; puedes mandar otra nota.` : "La gerencia de ventas la verá en su cola de autorización."}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => alConfirmar(nota)} cargando={cargando}>Pedir autorización</Boton>
      </>}>
      <div className="space-y-3">
        <div className="rounded-lg border border-peligro/30 bg-peligro-suave p-3 text-sm">
          <p className="font-medium text-peligro mb-1">{partidasBajo.length} partida(s) abajo del precio mínimo</p>
          <ul className="list-disc pl-5 text-texto/90">{partidasBajo.map((p) => <li key={p.id}>{p.titulo}</li>)}</ul>
        </div>
        <Campo etiqueta="¿Por qué este precio?" ayuda="Ej.: cliente frecuente, compra 4 equipos, la competencia lo dejó en…">
          <AreaTexto autoFocus value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
    </Dialogo>
  );
}

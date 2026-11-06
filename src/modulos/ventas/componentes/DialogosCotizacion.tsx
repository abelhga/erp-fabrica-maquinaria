import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FileText, Mail, MessageCircle, Send } from "lucide-react";
import { textoFichas } from "./Fichas";
import type { Estimacion } from "./EntregaRealista";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { LlenarConConstancia } from "@/components/datos/LlenarConConstancia";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { Insignia } from "@/components/ui/insignia";
import { dinero, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  RFC_VALIDO, compromisoDesde, dineroEn, enlaceWhatsApp, normalizarRfc, telefonoWa, textoWhatsApp, useFuentes,
  type CanalEnvio, type Contacto, type Cotizacion, type Partida, type PlanMeses,
} from "../comun";
import { GLOSARIO } from "@/tutorial/glosario";

const CANALES_MARCAR: { valor: CanalEnvio; texto: string; ayuda: string }[] = [
  { valor: "whatsapp", texto: "WhatsApp desde mi celular", ayuda: "Se la mandaste tú por WhatsApp, fuera del ERP." },
  { valor: "correo", texto: "Correo fuera del ERP", ayuda: "La mandaste desde otro correo." },
  { valor: "en_persona", texto: "En persona o impresa", ayuda: "Se la entregaste o se la enseñaste en persona." },
  { valor: "solo_marcada", texto: "Solo marcarla (sin decir por dónde)", ayuda: "Queda enviada, pero no se sabe si le llegó." },
];

/**
 * Enviar = mandar el PDF y el mensaje por WhatsApp (como hoy) y dejar la
 * cotización como "enviada" para darle seguimiento. wa.me no permite adjuntar:
 * el PDF se descarga con "Abrir PDF" y se arrastra al chat.
 * Cada envío (y cada vez que se vuelve a compartir) queda anotado con su canal: antes
 * «Enviar por WhatsApp» y «Solo marcar enviada» guardaban lo mismo y no se sabía cuáles
 * le habían llegado al cliente.
 */
export function DialogoEnviar({ abierto, alCambiar, c, partidas, contacto, vendedor, plan, yaEnviada, alRegistrarEnvio, alAbrirPdf, enviando, fichas = [], frenado, alPorCorreo }: {
  abierto: boolean; alCambiar: (v: boolean) => void; c: Cotizacion; partidas: Partida[]; contacto: Contacto | null | undefined;
  vendedor: { nombre?: string | null; telefono?: string | null } | null | undefined; plan: PlanMeses | null | undefined;
  yaEnviada: boolean; alAbrirPdf: () => void; enviando?: boolean;
  /** Anota el envío (la base la deja «enviada» si no lo estaba). WhatsApp: el número en dígitos o null. */
  alRegistrarEnvio: (canal: CanalEnvio, destino: string | null) => Promise<unknown>;
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
  const [paso, setPaso] = useState<"enviar" | "marcar">("enviar");
  // Sin canal elegido a propósito: si viniera uno marcado, todos dirían ese.
  const [canal, setCanal] = useState<CanalEnvio | null>(null);
  const [correo, setCorreo] = useState("");
  const bloqueFichas = textoFichas(fichas);
  useEffect(() => {
    if (!abierto) return;
    setTel(contacto?.whatsapp || contacto?.telefono || "");
    setTexto(textoWhatsApp(c, partidas, vendedor, plan));
    setConFichas(false);
    setPaso("enviar");
    setCanal(null);
    setCorreo(contacto?.correo || "");
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

  // El error ya lo avisa useAccion; aquí solo se evita cerrar el diálogo.
  async function registrar(canalElegido: CanalEnvio, destino: string | null) {
    try { await alRegistrarEnvio(canalElegido, destino); alCambiar(false); } catch { /* aviso ya mostrado */ }
  }

  async function porWhatsApp() {
    // La base rechaza un número de menos de 10 dígitos; si se revisara después de abrir WhatsApp,
    // el mensaje ya habría salido (a un número equivocado) y la cotización seguiría sin enviar.
    if (tel.trim() && tel.replace(/\D/g, "").length < 10) {
      toast.error("Revisa el número de WhatsApp: le faltan dígitos (o déjalo vacío para elegir el chat)");
      return;
    }
    // Se abre antes del await: los navegadores bloquean ventanas que no salen directo del clic.
    window.open(enlaceWhatsApp(tel, texto), "_blank", "noopener");
    // También al volver a compartirla: así se sabe a qué número salió cada vez.
    await registrar("whatsapp", tel.trim() ? telefonoWa(tel) : null);
  }

  const listoMarcar = !!canal && (canal !== "correo" || correo.includes("@"));
  async function marcar() {
    if (!canal || !listoMarcar) return;
    await registrar(canal, canal === "whatsapp" ? (tel.trim() ? telefonoWa(tel) : null) : canal === "correo" ? correo.trim() : null);
  }

  if (paso === "marcar") return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="¿Por dónde la mandaste?" ancho="max-w-xl"
      descripcion={`${c.folio} quedará como enviada y se agenda su seguimiento. Anota por dónde salió para saber si le llegó al cliente.`}
      pie={<>
        <Boton variante="secundario" onClick={() => setPaso("enviar")}>Regresar</Boton>
        <Boton onClick={marcar} cargando={enviando} disabled={!listoMarcar || bloqueado}><Send className="h-4 w-4" />Marcar enviada</Boton>
      </>}>
      <div className="space-y-3" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void marcar(); } }}>
        <div role="radiogroup" aria-label="Por dónde la mandaste" className="grid gap-2"
          data-explain={GLOSARIO.canalEnvioCotizacion} data-explain-title="Por dónde salió">
          {CANALES_MARCAR.map((o) => (
            <label key={o.valor} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5", canal === o.valor ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
              <input type="radio" name="canal_envio" className="mt-1 h-4 w-4 accent-marca" checked={canal === o.valor} onChange={() => setCanal(o.valor)} />
              <span><span className="font-medium">{o.texto}</span><span className="block text-xs text-tenue">{o.ayuda}</span></span>
            </label>
          ))}
        </div>
        {canal === "whatsapp" && (
          <Campo etiqueta="¿A qué número?" ayuda={tel && telefonoWa(tel).length < 12 ? "Revisa el número: le faltan dígitos." : "Déjalo vacío si no lo tienes a la mano."}>
            <Entrada value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="33 1234 5678" autoFocus />
          </Campo>
        )}
        {canal === "correo" && (
          <Campo etiqueta="¿A qué correo?">
            <Entrada type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="compras@cliente.mx" autoFocus />
          </Campo>
        )}
      </div>
    </Dialogo>
  );

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={yaEnviada ? "Compartir cotización" : "Enviar cotización"} ancho="max-w-xl"
      descripcion={yaEnviada ? `${c.folio} ya está enviada; puedes volver a compartirla.` : `${c.folio} quedará como enviada y empieza a contar su vigencia para el seguimiento.`}
      pie={<>
        {!yaEnviada && <Boton variante="secundario" disabled={bloqueado} onClick={() => setPaso("marcar")}><Send className="h-4 w-4" />Solo marcar enviada</Boton>}
        <Boton variante="secundario" onClick={alAbrirPdf} disabled={bloqueado}><FileText className="h-4 w-4" />Abrir PDF</Boton>
        {alPorCorreo && <Boton variante="secundario" onClick={() => { alCambiar(false); alPorCorreo(); }} disabled={bloqueado}><Mail className="h-4 w-4" />Por correo</Boton>}
        <Boton variante="exito" onClick={porWhatsApp} cargando={enviando} disabled={bloqueado}><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</Boton>
      </>}>
      <div className="space-y-3">
        {bloqueado && (
          <div className="flex items-start gap-3 rounded-lg border border-peligro/30 bg-peligro-suave px-3 py-2.5 text-sm"
            data-explain={GLOSARIO.frenoSeguimientos} data-explain-title="Freno">
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
          <label className="flex items-center gap-2 text-sm cursor-pointer" data-explain={GLOSARIO.fichaTecnica} data-explain-title="Fichas técnicas">
            <input type="checkbox" checked={conFichas} onChange={(e) => alternarFichas(e.target.checked)} />
            Incluir las ligas de las fichas técnicas ({fichas.length})
            <span className="text-xs text-tenue">· van también en el PDF</span>
          </label>
        )}
      </div>
    </Dialogo>
  );
}

/** Lo que convertir_a_pedido() guarda en la ficha del cliente si le falta (nunca pisa lo que hay). */
export interface DatosClientePedido {
  rfc?: string | null; razon_social?: string | null; publico_general?: boolean; estado?: string | null; pais?: string | null; fuente_id?: number | null;
}
/** Fuente «Ya había comprado»: la mitad de las conversiones sin fuente eran clientes de la hoja. */
const FUENTE_YA_HABIA_COMPRADO = 13;
const FUERA = "__fuera__";

/**
 * Cotización → pedido. Aquí se eligen las partidas: las opcionales vienen sin
 * marcar (no suman), pero si el cliente eligió la alternativa se palomea.
 * Si al cliente le falta algo para facturar o medir (faltan, de cliente_falta_para_pedido),
 * se pide aquí: al cotizar no se pide nada para no frenar la venta.
 */
export function DialogoConvertir({ abierto, alCambiar, c, partidas, alConfirmar, cargando, estimacion, faltan = [], cliente }: {
  abierto: boolean; alCambiar: (v: boolean) => void; c: Cotizacion; partidas: Partida[]; estimacion?: Estimacion;
  alConfirmar: (fechaCompromiso: string, ids: string[], datos: DatosClientePedido | null) => void; cargando?: boolean;
  faltan?: string[]; cliente?: { legacy_ref: string | null } | null;
}) {
  const [fechaC, setFechaC] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [d, setD] = useState({ rfc: "", razon_social: "", publico: false, estado: "", pais: "", fuente: "" });
  const fuentes = useFuentes();
  const estados = useQuery({
    queryKey: ["geo_estados"], staleTime: Infinity, enabled: abierto && faltan.includes("estado"),
    queryFn: () => q<{ cve_ent: string; nombre_corto: string }[]>(supabase.from("geo_estados").select("cve_ent, nombre_corto").order("nombre_corto")),
  });
  const pideFiscal = faltan.includes("fiscal"), pideEstado = faltan.includes("estado"), pideFuente = faltan.includes("fuente");
  // Ya tiene RFC (de verdad): solo falta la razón social. Ni se vuelve a pedir el RFC (la base no lo
  // pisaría) ni se ofrece «Público en general» (un RFC de verdad lo apaga).
  const pideRazon = faltan.includes("razon_social");
  const rfcN = normalizarRfc(d.rfc);
  const rfcMalo = rfcN !== "" && !RFC_VALIDO.test(rfcN);
  const fiscalOk = (!pideFiscal || d.publico || (RFC_VALIDO.test(rfcN) && d.razon_social.trim() !== ""))
    && (!pideRazon || d.razon_social.trim() !== "");
  const estadoOk = !pideEstado || (d.estado === FUERA ? d.pais.trim() !== "" : d.estado !== "");
  const fuenteOk = !pideFuente || d.fuente !== "";
  const datosOk = fiscalOk && estadoOk && fuenteOk;
  function datos(): DatosClientePedido | null {
    if (!faltan.length) return null;
    return {
      ...(pideFiscal ? (d.publico ? { publico_general: true } : { rfc: rfcN, razon_social: d.razon_social.trim() }) : {}),
      ...(pideRazon ? { razon_social: d.razon_social.trim() } : {}),
      ...(pideEstado ? (d.estado === FUERA ? { pais: d.pais.trim() } : { estado: d.estado }) : {}),
      ...(pideFuente ? { fuente_id: Number(d.fuente) } : {}),
    };
  }
  useEffect(() => {
    if (!abierto) return;
    setD({ rfc: "", razon_social: "", publico: false, estado: "", pais: "", fuente: cliente?.legacy_ref ? String(FUENTE_YA_HABIA_COMPRADO) : "" });
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
        <Boton disabled={!elegidas.length || !c.cliente_id || !datosOk} cargando={cargando} onClick={() => alConfirmar(fechaC, elegidas.map((p) => p.id), datos())}>
          Crear pedido por {dineroEn(sinIva * (1 + Number(c.tasa_iva)), c.moneda)}
        </Boton>
      </>}>
      <div className="space-y-4">
        {!c.cliente_id && <p className="rounded-lg bg-aviso-suave text-aviso text-sm p-3">Liga la cotización a un cliente antes de convertirla (arriba, en “Cliente”).</p>}
        {c.cliente_id && faltan.length > 0 && (
          <section className="rounded-lg border border-aviso/40 bg-aviso-suave p-3 space-y-3" data-explain={GLOSARIO.datosParaPedido} data-explain-title="Datos del cliente para el pedido">
            <div>
              <p className="text-sm font-medium">Datos del cliente para el pedido</p>
              <p className="text-xs text-tenue">Le faltan a su ficha; se guardan ahí.</p>
            </div>
            {pideFiscal && (
              <div className="grid gap-3 sm:grid-cols-2">
                <LlenarConConstancia para="cliente" excluir={c.cliente_id} className="sm:col-span-2"
                  alLeer={(k) => setD((x) => ({ ...x, publico: false, rfc: k.rfc ?? x.rfc, razon_social: k.razon_social ?? x.razon_social }))} />
                <Campo etiqueta="RFC" error={rfcMalo && !d.publico ? "RFC con formato inválido (ej. CBA160202AB1)" : undefined}>
                  <Entrada value={d.rfc} disabled={d.publico} onChange={(e) => setD({ ...d, rfc: e.target.value })} className="uppercase" maxLength={15} />
                </Campo>
                <Campo etiqueta="Razón social">
                  <Entrada value={d.razon_social} disabled={d.publico} onChange={(e) => setD({ ...d, razon_social: e.target.value })} />
                </Campo>
                <label className="sm:col-span-2 flex items-center gap-2 text-sm" data-explain={GLOSARIO.publicoGeneral} data-explain-title="Público en general">
                  <input type="checkbox" checked={d.publico} onChange={(e) => setD({ ...d, publico: e.target.checked })} />
                  Público en general (no pide factura a su nombre)
                </label>
              </div>
            )}
            {pideRazon && (
              <div className="grid gap-3 sm:grid-cols-2">
                <LlenarConConstancia para="cliente" excluir={c.cliente_id} className="sm:col-span-2"
                  alLeer={(k) => setD((x) => ({ ...x, razon_social: k.razon_social ?? x.razon_social }))} />
                <Campo etiqueta="Razón social" className="sm:col-span-2" ayuda="Ya tiene RFC; falta la razón social, como viene en su constancia.">
                  <Entrada value={d.razon_social} onChange={(e) => setD({ ...d, razon_social: e.target.value })} />
                </Campo>
              </div>
            )}
            {(pideEstado || pideFuente) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {pideEstado && (<>
                  <Campo etiqueta="Estado">
                    <Seleccion value={d.estado} onChange={(e) => setD({ ...d, estado: e.target.value })}>
                      <option value="">— elegir —</option>
                      {estados.data?.map((x) => <option key={x.cve_ent} value={x.nombre_corto}>{x.nombre_corto}</option>)}
                      <option value={FUERA}>Fuera de México</option>
                    </Seleccion>
                  </Campo>
                  {d.estado === FUERA && (
                    <Campo etiqueta="País"><Entrada value={d.pais} onChange={(e) => setD({ ...d, pais: e.target.value })} placeholder="Guatemala" /></Campo>
                  )}
                </>)}
                {pideFuente && (
                  <Campo etiqueta="¿Cómo llegó?">
                    <Seleccion value={d.fuente} onChange={(e) => setD({ ...d, fuente: e.target.value })}
                      data-explain={GLOSARIO.fuenteCliente} data-explain-title="¿Cómo llegó?">
                      <option value="">— elegir —</option>
                      {fuentes.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </Seleccion>
                  </Campo>
                )}
              </div>
            )}
          </section>
        )}
        <div data-explain={GLOSARIO.fechaCompromisoPedido} data-explain-title="Fecha compromiso">
          <Campo etiqueta="Fecha compromiso de entrega"
            ayuda={estimacion?.fecha_propuesta
              ? `Con el taller como está hoy, lo realista es el ${fecha(estimacion.fecha_propuesta)}${c.tiempo_entrega ? ` (la cotización dice “${c.tiempo_entrega}”)` : ""}.`
              : c.tiempo_entrega ? `Propuesta según “${c.tiempo_entrega}”` : undefined}>
            <Entrada type="date" value={fechaC} onChange={(e) => setFechaC(e.target.value)} className="sm:w-52" />
          </Campo>
        </div>
        {estimacion?.fecha_propuesta && fechaC && fechaC < estimacion.fecha_propuesta && (
          <p className="rounded-lg bg-aviso-suave text-aviso text-sm p-3" data-explain={GLOSARIO.entregaRealista} data-explain-title="Entrega realista">
            Esa fecha es antes de lo que el taller puede sacar ({fecha(estimacion.fecha_propuesta)}): el pedido nacería atrasado. Si de todos modos la prometes, avísale a producción.
          </p>
        )}
        <div className="tarjeta divide-y divide-borde" data-explain={GLOSARIO.partidasAlConvertir} data-explain-title="Partidas del pedido">
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

/** El vendedor explica el descuento (o la partida libre cara): la gerente lo lee en su cola antes de autorizar. */
export function DialogoPedirAutorizacion({ abierto, alCambiar, partidasBajo, alConfirmar, cargando, pedidaEn }: {
  abierto: boolean; alCambiar: (v: boolean) => void; partidasBajo: Partida[]; alConfirmar: (nota: string) => void; cargando?: boolean; pedidaEn?: string | null;
}) {
  const [nota, setNota] = useState("");
  useEffect(() => { if (abierto) setNota(""); }, [abierto]);
  const bajo = partidasBajo.filter((p) => p.bajo_minimo);
  const libres = partidasBajo.filter((p) => p.libre_cara && !p.bajo_minimo);
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Pedir autorización de precios"
      descripcion={pedidaEn ? `Ya la pediste el ${fecha(pedidaEn)}; puedes mandar otra nota.` : "La gerencia de ventas la verá en su cola de autorización."}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => alConfirmar(nota)} cargando={cargando} data-explain={GLOSARIO.autorizacionPrecios}>Pedir autorización</Boton>
      </>}>
      <div className="space-y-3">
        {bajo.length > 0 && (
          <div className="rounded-lg border border-peligro/30 bg-peligro-suave p-3 text-sm" data-explain={GLOSARIO.bajoMinimo} data-explain-title="Bajo el mínimo">
            <p className="font-medium text-peligro mb-1">{bajo.length} partida(s) abajo del precio mínimo</p>
            <ul className="list-disc pl-5 text-texto/90">{bajo.map((p) => <li key={p.id}>{p.titulo}</li>)}</ul>
          </div>
        )}
        {libres.length > 0 && (
          <div className="rounded-lg border border-aviso/40 bg-aviso-suave p-3 text-sm" data-explain={GLOSARIO.partidaLibreCara} data-explain-title="Partida libre por autorizar">
            <p className="font-medium text-aviso mb-1">{libres.length} partida(s) libre(s) de $20,000 o más</p>
            <ul className="list-disc pl-5 text-texto/90">{libres.map((p) => <li key={p.id}>{p.titulo}</li>)}</ul>
          </div>
        )}
        <Campo etiqueta="¿Por qué este precio?" ayuda="Ej.: cliente frecuente, compra 4 equipos, la competencia lo dejó en…">
          <AreaTexto autoFocus value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
    </Dialogo>
  );
}

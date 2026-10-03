import { useEffect, useState } from "react";
import { FileText, MessageCircle, Send } from "lucide-react";
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
export function DialogoEnviar({ abierto, alCambiar, c, partidas, contacto, vendedor, plan, yaEnviada, alMarcarEnviada, alAbrirPdf, enviando }: {
  abierto: boolean; alCambiar: (v: boolean) => void; c: Cotizacion; partidas: Partida[]; contacto: Contacto | null | undefined;
  vendedor: { nombre?: string | null; telefono?: string | null } | null | undefined; plan: PlanMeses | null | undefined;
  yaEnviada: boolean; alMarcarEnviada: () => Promise<unknown>; alAbrirPdf: () => void; enviando?: boolean;
}) {
  const [tel, setTel] = useState("");
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (!abierto) return;
    setTel(contacto?.whatsapp || contacto?.telefono || "");
    setTexto(textoWhatsApp(c, partidas, vendedor, plan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

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
        {!yaEnviada && <Boton variante="secundario" cargando={enviando} onClick={async () => { await alMarcarEnviada(); alCambiar(false); }}><Send className="h-4 w-4" />Solo marcar enviada</Boton>}
        <Boton variante="secundario" onClick={alAbrirPdf}><FileText className="h-4 w-4" />Abrir PDF</Boton>
        <Boton variante="exito" onClick={porWhatsApp} cargando={enviando}><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</Boton>
      </>}>
      <div className="space-y-3">
        <Campo etiqueta="WhatsApp del cliente" ayuda={tel && telefonoWa(tel).length < 12 ? "Revisa el número: le faltan dígitos." : contacto ? `Contacto: ${contacto.nombre}` : "Sin contacto ligado: escríbelo o deja vacío para elegir el chat en WhatsApp."}>
          <Entrada value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="33 1234 5678" />
        </Campo>
        <Campo etiqueta="Mensaje">
          <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-[180px] text-sm" />
        </Campo>
      </div>
    </Dialogo>
  );
}

/**
 * Cotización → pedido. Aquí se eligen las partidas: las opcionales vienen sin
 * marcar (no suman), pero si el cliente eligió la alternativa se palomea.
 */
export function DialogoConvertir({ abierto, alCambiar, c, partidas, alConfirmar, cargando }: {
  abierto: boolean; alCambiar: (v: boolean) => void; c: Cotizacion; partidas: Partida[];
  alConfirmar: (fechaCompromiso: string, ids: string[]) => void; cargando?: boolean;
}) {
  const [fechaC, setFechaC] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!abierto) return;
    setFechaC(compromisoDesde(c.tiempo_entrega));
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
        <Campo etiqueta="Fecha compromiso de entrega" ayuda={c.tiempo_entrega ? `Propuesta según “${c.tiempo_entrega}”` : undefined}>
          <Entrada type="date" value={fechaC} onChange={(e) => setFechaC(e.target.value)} className="sm:w-52" />
        </Campo>
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

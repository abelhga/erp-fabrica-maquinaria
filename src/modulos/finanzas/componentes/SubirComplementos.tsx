import { useRef, useState } from "react";
import { FileCode2, Upload } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha } from "@/lib/formato";
import { folioCfdi, leerCfdi, metodoDeFormaPago } from "@/lib/cfdi";
import { useEmpresa } from "@/modulos/ventas/comun";
import { GLOSARIO } from "@/tutorial/glosario";

interface Resultado { factura: string | null; uuid: string; monto: number; pedido_id: string | null; estado: string; mensaje: string | null }
interface Archivo { nombre: string; folio: string | null; fechaPago: string | null; total: number; error: string | null; resultados?: Resultado[] }

const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  registrado: { texto: "Cobro registrado", tono: "ok" },
  repetido: { texto: "Ya estaba", tono: "neutro" },
  sin_factura: { texto: "Factura no registrada", tono: "aviso" },
  sin_monto: { texto: "Sin importe", tono: "neutro" },
  rechazado: { texto: "Rechazado", tono: "peligro" },
};
const INVALIDAR = [["v_cobranza"], ["cobranza_por_mes"], ["cobros"], ["indicadores"], ["tablero_direccion"]];

/**
 * Subir complementos de pago (los XML que timbramos cuando un cliente a crédito paga).
 * Cada uno dice qué facturas paga y cuánto: el cobro va solo al pedido de cada factura.
 * Se pueden subir muchos a la vez (la carpeta del mes) y repetirlos no duplica nada.
 */
export function SubirComplementos({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const empresa = useEmpresa();
  const rfcPropio = (empresa.data?.fiscal.rfc ?? "").toUpperCase();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const entrada = useRef<HTMLInputElement>(null);
  const registrar = useAccion(async (lista: { archivo: Archivo; uuid: string; pagos: unknown }[]) => {
    const salida: Archivo[] = [];
    for (const x of lista) {
      const r = await q<Resultado[]>(supabase.rpc("registrar_complemento_pago", { p_uuid: x.uuid, p_folio: x.archivo.folio, p_pagos: x.pagos }));
      salida.push({ ...x.archivo, resultados: r });
    }
    return salida;
  }, {
    exito: (s) => {
      const n = s.flatMap((a) => a.resultados ?? []).filter((r) => r.estado === "registrado").length;
      return n ? `${n} cobro${n === 1 ? "" : "s"} registrado${n === 1 ? "" : "s"}` : "No había cobros nuevos";
    },
    invalidar: INVALIDAR,
    alTerminar: (s) => setArchivos((a) => a.map((x) => s.find((y) => y.nombre === x.nombre) ?? x)),
  });

  async function leer(lista: FileList | null) {
    if (!lista?.length) return;
    const pendientes: { archivo: Archivo; uuid: string; pagos: unknown }[] = [];
    const leidos: Archivo[] = [];
    for (const f of [...lista]) {
      try {
        const c = leerCfdi(await f.text());
        const total = c.pagos.reduce((s, p) => s + (p.monto ?? 0), 0);
        const a: Archivo = { nombre: f.name, folio: folioCfdi(c), fechaPago: c.pagos[0]?.fecha ?? null, total, error: null };
        if (c.tipo !== "P") a.error = c.tipo === "I" ? "Es una factura, no un complemento: súbela en el pedido (Registrar factura)." : "No es un complemento de pago.";
        else if (rfcPropio && c.emisor.rfc !== rfcPropio) a.error = `Lo emitió otro RFC (${c.emisor.rfc}): no es nuestro.`;
        else if (!c.uuid) a.error = "No trae folio fiscal (¿está timbrado?).";
        else pendientes.push({ archivo: a, uuid: c.uuid, pagos: c.pagos.map((p) => ({ fecha: p.fecha, metodo: metodoDeFormaPago(p.formaPago), doctos: p.doctos })) });
        leidos.push(a);
      } catch (e) {
        leidos.push({ nombre: f.name, folio: null, fechaPago: null, total: 0, error: e instanceof Error ? e.message : "No se pudo leer" });
      }
    }
    setArchivos(leidos);
    if (entrada.current) entrada.current.value = "";
    if (pendientes.length) registrar.mutate(pendientes);
  }

  return (
    <Dialogo abierto={abierto} alCambiar={(v) => { alCambiar(v); if (!v) setArchivos([]); }} ancho="max-w-2xl"
      titulo="Subir complementos de pago" descripcion="El XML que se timbra cuando un cliente paga una factura a crédito. Cada pago se registra en el pedido de su factura."
      pie={<Boton variante="secundario" onClick={() => alCambiar(false)}>Cerrar</Boton>}>
      <div className="space-y-4">
        <label className="flex items-center gap-3 rounded-xl border border-dashed border-borde px-4 py-3 cursor-pointer hover:bg-fondo"
          data-explain={GLOSARIO.complementoPago} data-explain-title="Complemento de pago">
          <Upload className="h-5 w-5 text-tenue shrink-0" />
          <span className="flex-1 text-sm">
            <span className="font-medium">Elige los XML</span>
            <span className="block text-tenue">Puedes elegir varios (la carpeta del mes). Si alguno ya se había subido, no se duplica.</span>
          </span>
          <input ref={entrada} type="file" accept=".xml,text/xml,application/xml" multiple className="sr-only" onChange={(e) => leer(e.target.files)} />
        </label>
        {registrar.isPending && <p className="text-sm text-tenue">Registrando…</p>}
        {archivos.map((a) => (
          <div key={a.nombre} className="rounded-xl border border-borde p-3 text-sm space-y-2">
            <p className="flex flex-wrap items-center gap-2">
              <FileCode2 className="h-4 w-4 text-tenue" />
              <span className="font-medium break-all">{a.nombre}</span>
              {a.folio && <span className="text-tenue">· {a.folio}</span>}
              {a.fechaPago && <span className="text-tenue">· pagado el {fecha(a.fechaPago)}</span>}
              {a.total > 0 && <span className="ml-auto cifra">{dinero(a.total)}</span>}
            </p>
            {a.error && <p className="text-aviso">{a.error}</p>}
            {a.resultados?.map((r) => (
              <p key={r.uuid} className="flex flex-wrap items-center gap-2 pl-6">
                <Insignia tono={ESTADO[r.estado]?.tono ?? "neutro"}>{ESTADO[r.estado]?.texto ?? r.estado}</Insignia>
                <span>Factura {r.factura ?? r.uuid.slice(0, 8)}</span>
                <span className="cifra">{dinero(r.monto)}</span>
                {r.estado === "sin_factura" && <span className="text-xs text-tenue">Regístrala en su pedido (con su XML) y vuelve a subir este complemento.</span>}
                {r.mensaje && <span className="text-xs text-peligro">{r.mensaje}</span>}
              </p>
            ))}
          </div>
        ))}
      </div>
    </Dialogo>
  );
}

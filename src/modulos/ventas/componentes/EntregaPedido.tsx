import { useRef, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileCheck2, FileUp, Loader2, Printer, RotateCcw, Truck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useRpc } from "@/lib/consultas";
import { fechaYHora } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * La entrega de un pedido, igual en Ventas y en los pedidos de la planta (donde entrega
 * almacén). Todo lo decide la base: quién puede (hoja_salida dice puede_entregar), el
 * deshacer de 15 minutos y la reapertura con motivo.
 */

export interface Salida {
  id: string; numero: number; recibio: string; nota: string | null; evidencia_ruta: string | null;
  entregado_en: string; entregado_por: string | null; mia: boolean; anulada_en: string | null; motivo_anulacion: string | null;
}
export interface HojaSalida {
  pedido: { id: string; folio: string; folio_anterior: string | null; fecha: string; fecha_compromiso: string | null; estado: string; direccion_entrega: string | null; canal: string };
  cliente: { nombre: string; razon_social: string | null; rfc: string | null; ciudad: string | null; estado: string | null } | null;
  vendedor: { nombre: string; telefono: string | null } | null;
  puede_entregar: boolean; puede_reabrir: boolean;
  partidas: { id: string; cantidad: number; unidad: string; titulo: string; descripcion: string | null; clave: string | null; series: string[] }[];
  sueltas: { equipo: string; clave: string | null; serie: string | null; folio: string }[];
  salidas: Salida[];
}

const BUCKET = "entregas";
export const claveHoja = (pedido: string) => ["hoja_salida", pedido];

export function useHojaSalida(pedido: string | undefined) {
  return useRpc<HojaSalida>("hoja_salida", { p_pedido: pedido }, { clave: claveHoja(pedido ?? ""), habilitado: !!pedido });
}

/** Sube la hoja firmada a la carpeta del pedido; regresa su ruta. */
async function subirHoja(pedido: string, archivo: File) {
  if (!/^image\/|^application\/pdf$/.test(archivo.type)) throw new Error("Sube una foto o un PDF de la hoja firmada.");
  if (archivo.size > 15 * 1024 * 1024) throw new Error("El archivo pesa más de 15 MB: toma la foto con menos resolución.");
  const limpio = archivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-60);
  const ruta = `${pedido}/${crypto.randomUUID().slice(0, 8)}-${limpio}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type });
  if (error) throw new Error(/row-level|policy|unauthorized|403/i.test(error.message) ? "Tu rol no puede subir la hoja de este pedido." : error.message);
  return ruta;
}

async function abrirHoja(ruta: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300);
  if (error || !data) throw new Error("No tienes permiso para abrir la hoja o ya no existe.");
  window.open(data.signedUrl, "_blank", "noopener");
}

export const abrirHojaSalida = (pedido: string) => window.open(`/pedidos/${pedido}/salida`, "_blank", "noopener");

/** «Entregar»: pide quién recibió y, si ya la hay, la hoja firmada. El aviso trae «Deshacer». */
export function BotonEntregar({ pedido, invalidar = [], antes }: {
  pedido: string; invalidar?: QueryKey[];
  /** Una pregunta antes de abrir (p. ej. órdenes sin terminar); false = no abrir. */
  antes?: () => boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [recibio, setRecibio] = useState("");
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const entregar = useAccion(async () => {
    const evidencia = archivo ? await subirHoja(pedido, archivo) : null;
    return q<string>(supabase.rpc("entregar_pedido", { p_id: pedido, p_recibio: recibio, p_nota: nota || null, p_evidencia: evidencia }));
  }, {
    exito: "Pedido entregado",
    invalidar: [claveHoja(pedido), ...invalidar],
    alTerminar: () => { setAbierto(false); setRecibio(""); setNota(""); setArchivo(null); },
    deshacer: () => q(supabase.rpc("deshacer_entrega", { p_pedido: pedido })),
  });
  const valido = recibio.trim().length >= 3;
  return (
    <>
      <Boton variante="exito" onClick={() => { if (!antes || antes()) setAbierto(true); }}><Truck className="h-4 w-4" />Entregar</Boton>
      <Dialogo abierto={abierto} alCambiar={setAbierto} titulo="Registrar la entrega"
        descripcion="Imprime la hoja de salida, que el cliente la firme y anota quién recibió. La foto de la hoja firmada la puedes subir ahora o después."
        pie={<>
          <Boton variante="fantasma" onClick={() => setAbierto(false)}>No, todavía no</Boton>
          <Boton variante="exito" disabled={!valido} cargando={entregar.isPending} onClick={() => entregar.mutate(undefined)}>
            <Truck className="h-4 w-4" />Registrar entrega
          </Boton>
        </>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valido) entregar.mutate(undefined); }}>
          <Boton type="button" variante="secundario" onClick={() => abrirHojaSalida(pedido)}><Printer className="h-4 w-4" />Imprimir hoja de salida</Boton>
          <Campo etiqueta="¿Quién recibió?" ayuda="Nombre de quien firmó la hoja (el cliente o quien recogió).">
            <Entrada autoFocus value={recibio} onChange={(e) => setRecibio(e.target.value)} placeholder="Nombre completo" />
          </Campo>
          <Campo etiqueta="Nota (opcional)">
            <Entrada value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Recogió en planta con su camioneta, se fue por flete…" />
          </Campo>
          <Campo etiqueta="Hoja firmada (foto o PDF, opcional)">
            {/* En el celular abre la cámara: se le toma foto a la hoja recién firmada. */}
            <input ref={archivoRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-3 min-w-0">
              <Boton type="button" variante="secundario" tamano="sm" onClick={() => archivoRef.current?.click()}><FileUp className="h-4 w-4" />{archivo ? "Cambiar" : "Elegir foto o PDF"}</Boton>
              <span className="text-sm text-tenue truncate">{archivo ? archivo.name : "Sin archivo: la puedes subir después"}</span>
            </div>
          </Campo>
        </form>
      </Dialogo>
    </>
  );
}

/** Lo que pasó con la entrega: quién y cuándo, la hoja firmada, y reabrir (gerencia de ventas). */
export function RecuadroEntrega({ hoja, invalidar = [] }: { hoja: HojaSalida; invalidar?: QueryKey[] }) {
  const pedido = hoja.pedido.id;
  const vigente = hoja.salidas.find((s) => !s.anulada_en);
  const anuladas = hoja.salidas.filter((s) => s.anulada_en);
  const [reabrir, setReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inv = [claveHoja(pedido), ...invalidar];
  const reabrirEntrega = useAccion(() => q(supabase.rpc("deshacer_entrega", { p_pedido: pedido, p_motivo: motivo })), {
    exito: "La entrega se reabrió", invalidar: inv, alTerminar: () => { setReabrir(false); setMotivo(""); },
  });
  const adjuntar = useAccion((ruta: string) => q(supabase.rpc("adjuntar_hoja_salida", { p_salida: vigente!.id, p_ruta: ruta })), {
    exito: "Se guardó la hoja firmada", invalidar: inv,
  });
  if (!vigente && !anuladas.length) return null;
  return (
    <section className="tarjeta p-4 space-y-3" data-explain={GLOSARIO.hojaSalida} data-explain-title="Entrega">
      {vigente ? (
        <div className="flex flex-wrap items-start gap-3">
          <div className={cn("h-9 w-9 shrink-0 rounded-lg grid place-items-center", vigente.evidencia_ruta ? "bg-ok-suave text-ok" : "bg-aviso-suave text-aviso")}>
            {vigente.evidencia_ruta ? <FileCheck2 className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Recibió {vigente.recibio}</p>
            <p className="text-tenue">{fechaYHora(vigente.entregado_en)}{vigente.entregado_por ? ` · entregó ${vigente.entregado_por}` : ""}{vigente.nota ? ` · ${vigente.nota}` : ""}</p>
            {!vigente.evidencia_ruta && <p className="text-aviso mt-0.5">Falta subir la hoja de salida firmada.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" tamano="sm" onClick={() => abrirHojaSalida(pedido)}><Printer className="h-4 w-4" />Hoja de salida</Boton>
            {vigente.evidencia_ruta ? (
              <Boton variante="secundario" tamano="sm" onClick={() => abrirHoja(vigente.evidencia_ruta!).catch((e) => toast.error(e.message))}>
                <FileCheck2 className="h-4 w-4" />Ver hoja firmada
              </Boton>
            ) : hoja.puede_entregar && (
              <>
                <input ref={entrada} type="file" accept="image/*,application/pdf" hidden onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setSubiendo(true);
                  try { adjuntar.mutate(await subirHoja(pedido, f)); } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setSubiendo(false); }
                }} />
                <Boton tamano="sm" onClick={() => entrada.current?.click()} cargando={subiendo || adjuntar.isPending}>
                  {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Subir hoja firmada
                </Boton>
              </>
            )}
            {hoja.puede_reabrir && (
              <Boton variante="fantasma" tamano="sm" onClick={() => setReabrir(true)} data-explain={GLOSARIO.reabrirEntrega}>
                <RotateCcw className="h-4 w-4" />Reabrir entrega
              </Boton>
            )}
          </div>
        </div>
      ) : <p className="text-sm text-tenue">Sin entrega vigente.</p>}
      {anuladas.length > 0 && (
        <ul className="text-xs text-tenue space-y-0.5 border-t border-borde pt-2">
          {anuladas.map((s) => (
            <li key={s.id}>Entrega {s.numero} (recibió {s.recibio}, {fechaYHora(s.entregado_en)}) reabierta {fechaYHora(s.anulada_en)}: {s.motivo_anulacion}</li>
          ))}
        </ul>
      )}
      <Dialogo abierto={reabrir} alCambiar={setReabrir} titulo="Reabrir la entrega"
        descripcion="El pedido regresa a como estaba antes de entregarlo. Queda anotado quién lo reabrió y por qué."
        pie={<>
          <Boton variante="fantasma" onClick={() => setReabrir(false)}>Cancelar</Boton>
          <Boton variante="peligro" disabled={motivo.trim().length < 3} cargando={reabrirEntrega.isPending} onClick={() => reabrirEntrega.mutate(undefined)}>Reabrir</Boton>
        </>}>
        <Campo etiqueta="¿Por qué se reabre?">
          <Entrada autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se marcó entregado por error, el cliente no recogió…" />
        </Campo>
      </Dialogo>
    </section>
  );
}

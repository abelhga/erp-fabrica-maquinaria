import { useEffect, useRef, useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FileCheck2, FileUp, Loader2, Printer, RotateCcw, Truck } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useRpc } from "@/lib/consultas";
import { fechaYHora, numero } from "@/lib/formato";
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
  /** Lo que salió en esta entrega; null en las de antes de las entregas por partes (fueron de todo el pedido). */
  lineas: { id: string; cantidad: number; series: string[] }[] | null;
  /** Lo que no se pudo descontar del inventario (no había en el ERP): almacén lo revisa. */
  sin_inventario: { articulo: string; cantidad: number; hay: number }[];
}
export interface PartidaEntrega { id: string; cantidad: number; unidad: string; entregado: number; titulo: string }
export interface HojaSalida {
  pedido: { id: string; folio: string; folio_anterior: string | null; fecha: string; fecha_compromiso: string | null; estado: string; direccion_entrega: string | null; canal: string };
  cliente: { nombre: string; razon_social: string | null; rfc: string | null; ciudad: string | null; estado: string | null } | null;
  vendedor: { nombre: string; telefono: string | null } | null;
  puede_entregar: boolean; puede_reabrir: boolean;
  partidas: (PartidaEntrega & { descripcion: string | null; clave: string | null; series: string[] })[];
  /** Pedidos que vinieron de la hoja: sus partidas de texto, para entregar por partes. */
  partidas_texto?: PartidaEntrega[] | null;
  sueltas: { equipo: string; clave: string | null; serie: string | null; folio: string }[];
  /** Pedidos de la hoja: el texto de sus partidas, que describe los mismos equipos sueltos (no se cuenta otra vez). */
  como_venia?: string | null;
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

/** La hoja de una entrega ya registrada (salida), o la de lo que va a salir (lineas, antes de registrarla). */
export const abrirHojaSalida = (pedido: string, cual?: { salida?: string; lineas?: { id: string; cantidad: number }[] }) => {
  const q = cual?.salida ? `?salida=${cual.salida}` : cual?.lineas?.length ? `?lineas=${cual.lineas.map((l) => `${l.id}:${l.cantidad}`).join(",")}` : "";
  window.open(`/pedidos/${pedido}/salida${q}`, "_blank", "noopener");
};

/** Las partidas que se pueden entregar, con lo que falta de cada una. */
export const partidasDeEntrega = (h: HojaSalida | undefined) =>
  (h ? (h.partidas.length ? h.partidas : h.partidas_texto ?? []) : []).map((p) => ({ ...p, falta: Math.max(Number(p.cantidad) - Number(p.entregado ?? 0), 0) }));

/**
 * «Entregar»: qué sale de cada partida (todo lo que falta, o una parte), quién recibió y, si ya
 * la hay, la hoja firmada. Lo que sale se descuenta del inventario. El aviso trae «Deshacer».
 */
export function BotonEntregar({ pedido, invalidar = [], antes }: {
  pedido: string; invalidar?: QueryKey[];
  /** Una pregunta antes de abrir (p. ej. órdenes sin terminar); false = no abrir. */
  antes?: () => boolean;
}) {
  const hoja = useHojaSalida(pedido);
  const [abierto, setAbierto] = useState(false);
  const [recibio, setRecibio] = useState("");
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cant, setCant] = useState<Record<string, string>>({});
  const archivoRef = useRef<HTMLInputElement>(null);
  const pendientes = partidasDeEntrega(hoja.data).filter((p) => p.falta > 0);
  const yaSalio = partidasDeEntrega(hoja.data).some((p) => Number(p.entregado) > 0);
  // Al abrir se propone todo lo que falta: lo normal es entregar completo.
  useEffect(() => {
    if (abierto) setCant(Object.fromEntries(pendientes.map((p) => [p.id, String(p.falta)])));
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineas = pendientes.map((p) => ({ id: p.id, cantidad: Number(cant[p.id] || 0) })).filter((l) => l.cantidad > 0);
  const demas = pendientes.find((p) => Number(cant[p.id] || 0) > p.falta);
  const completa = pendientes.every((p) => Number(cant[p.id] || 0) >= p.falta);
  const entregar = useAccion(async () => {
    const evidencia = archivo ? await subirHoja(pedido, archivo) : null;
    return q<string>(supabase.rpc("entregar_pedido", { p_id: pedido, p_recibio: recibio, p_nota: nota || null, p_evidencia: evidencia,
      p_lineas: pendientes.length ? lineas : null }));
  }, {
    exito: completa ? "Pedido entregado" : "Entrega parcial registrada: lo demás queda por entregar",
    invalidar: [claveHoja(pedido), ...invalidar],
    alTerminar: () => { setAbierto(false); setRecibio(""); setNota(""); setArchivo(null); },
    deshacer: () => q(supabase.rpc("deshacer_entrega", { p_pedido: pedido })),
  });
  const valido = recibio.trim().length >= 3 && !demas && (pendientes.length === 0 || lineas.length > 0);
  return (
    <>
      <Boton variante="exito" onClick={() => { if (!antes || antes()) setAbierto(true); }}><Truck className="h-4 w-4" />{yaSalio ? "Entregar lo que falta" : "Entregar"}</Boton>
      <Dialogo abierto={abierto} alCambiar={setAbierto} titulo="Registrar la entrega" ancho="max-w-2xl"
        descripcion="Escribe lo que sale de cada partida (si es una parte, lo demás queda por entregar). Imprime la hoja de salida, que el cliente la firme y anota quién recibió. Lo que sale se descuenta del inventario."
        pie={<>
          <Boton variante="fantasma" onClick={() => setAbierto(false)}>No, todavía no</Boton>
          <Boton variante="exito" disabled={!valido} cargando={entregar.isPending} onClick={() => entregar.mutate(undefined)}>
            <Truck className="h-4 w-4" />{completa ? "Registrar entrega" : "Registrar entrega parcial"}
          </Boton>
        </>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valido) entregar.mutate(undefined); }}>
          {pendientes.length > 0 && (
            <div data-explain={GLOSARIO.entregaParcial} data-explain-title="Entregar por partes">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-sm font-medium flex-1">¿Qué sale?</p>
                <Boton type="button" tamano="sm" variante="fantasma" onClick={() => setCant(Object.fromEntries(pendientes.map((p) => [p.id, String(p.falta)])))}>Todo</Boton>
                <Boton type="button" tamano="sm" variante="fantasma" onClick={() => setCant({})}>Nada</Boton>
              </div>
              <table className="tabla">
                <thead><tr><th>Partida</th><th className="text-right">Falta</th><th className="text-right w-28">Sale</th></tr></thead>
                <tbody>
                  {pendientes.map((p) => (
                    <tr key={p.id}>
                      <td className="max-w-[280px]"><p className="truncate" title={p.titulo}>{p.titulo}</p>
                        {Number(p.entregado) > 0 && <p className="text-[11px] text-tenue">Ya salieron {numero(Number(p.entregado))} de {numero(Number(p.cantidad))}</p>}</td>
                      <td className="text-right cifra whitespace-nowrap">{numero(p.falta)} <span className="text-xs text-tenue">{p.unidad}</span></td>
                      <td className="text-right">
                        <input className={cn("campo h-8 text-right cifra", Number(cant[p.id] || 0) > p.falta && "border-peligro")} inputMode="decimal" placeholder="0"
                          value={cant[p.id] ?? ""} aria-label={`Cuánto sale de ${p.titulo}`} onChange={(e) => setCant((c) => ({ ...c, [p.id]: e.target.value }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {demas && <p className="text-xs text-peligro mt-1">De «{demas.titulo}» faltan {numero(demas.falta)}: no puede salir más.</p>}
            </div>
          )}
          <Boton type="button" variante="secundario" onClick={() => abrirHojaSalida(pedido, completa ? undefined : { lineas })} disabled={pendientes.length > 0 && lineas.length === 0}>
            <Printer className="h-4 w-4" />Imprimir hoja de salida
          </Boton>
          <Campo etiqueta="¿Quién recibió?" ayuda="Nombre de quien firmó la hoja (el cliente o quien recogió).">
            <Entrada value={recibio} onChange={(e) => setRecibio(e.target.value)} placeholder="Nombre completo" />
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

/**
 * Lo que pasó con las entregas: cada una con lo que salió, quién recibió y cuándo, su hoja (para
 * imprimir y la firmada), y lo que no se pudo descontar del inventario. Reabrir deshace la última.
 */
export function RecuadroEntrega({ hoja, invalidar = [] }: { hoja: HojaSalida; invalidar?: QueryKey[] }) {
  const pedido = hoja.pedido.id;
  const vigentes = hoja.salidas.filter((s) => !s.anulada_en);
  const anuladas = hoja.salidas.filter((s) => s.anulada_en);
  const partidas = partidasDeEntrega(hoja);
  const titulo = (id: string) => partidas.find((p) => p.id === id)?.titulo ?? "Partida";
  const parcial = partidas.some((p) => p.falta > 0) && partidas.some((p) => Number(p.entregado) > 0);
  const [reabrir, setReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendoA, setSubiendoA] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inv = [claveHoja(pedido), ...invalidar];
  const reabrirEntrega = useAccion(() => q(supabase.rpc("deshacer_entrega", { p_pedido: pedido, p_motivo: motivo })), {
    exito: "La entrega se reabrió", invalidar: inv, alTerminar: () => { setReabrir(false); setMotivo(""); },
  });
  const adjuntar = useAccion((a: { salida: string; ruta: string }) => q(supabase.rpc("adjuntar_hoja_salida", { p_salida: a.salida, p_ruta: a.ruta })), {
    exito: "Se guardó la hoja firmada", invalidar: inv,
  });
  if (!vigentes.length && !anuladas.length) return null;
  return (
    <section className="tarjeta p-4 space-y-3" data-explain={GLOSARIO.hojaSalida} data-explain-title="Entrega">
      <input ref={entrada} type="file" accept="image/*,application/pdf" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f || !subiendoA) return;
        setSubiendo(true);
        try { adjuntar.mutate({ salida: subiendoA, ruta: await subirHoja(pedido, f) }); } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setSubiendo(false); }
      }} />
      {parcial && (
        <p className="text-sm rounded-lg bg-aviso-suave text-aviso px-3 py-2" data-explain={GLOSARIO.entregaParcial} data-explain-title="Entrega parcial">
          <b>Entrega parcial:</b> {partidas.filter((p) => p.falta > 0).map((p) => `faltan ${numero(p.falta)} de ${p.titulo}`).join(" · ")}.
        </p>
      )}
      {vigentes.length === 0 && <p className="text-sm text-tenue">Sin entrega vigente.</p>}
      {vigentes.map((s, k) => (
        <div key={s.id} className={cn("flex flex-wrap items-start gap-3", k > 0 && "border-t border-borde pt-3")}>
          <div className={cn("h-9 w-9 shrink-0 rounded-lg grid place-items-center", s.evidencia_ruta ? "bg-ok-suave text-ok" : "bg-aviso-suave text-aviso")}>
            {s.evidencia_ruta ? <FileCheck2 className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{vigentes.length > 1 || s.lineas ? `Entrega ${s.numero} · ` : ""}Recibió {s.recibio}</p>
            <p className="text-tenue">{fechaYHora(s.entregado_en)}{s.entregado_por ? ` · entregó ${s.entregado_por}` : ""}{s.nota ? ` · ${s.nota}` : ""}</p>
            {s.lineas && <p className="text-tenue">{s.lineas.map((l) => `${numero(Number(l.cantidad))} × ${titulo(l.id)}`).join(" · ")}</p>}
            {!s.evidencia_ruta && <p className="text-aviso mt-0.5">Falta subir la hoja de salida firmada.</p>}
            {s.sin_inventario?.length > 0 && (
              <p className="text-aviso mt-0.5 flex gap-1.5" data-explain={GLOSARIO.sinSalidaInventario} data-explain-title="Sin salida de inventario">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>No se descontó del inventario (no alcanzaba en el ERP): {s.sin_inventario.map((x) => `${x.articulo} (${numero(Number(x.cantidad))}, había ${numero(Number(x.hay))})`).join(" · ")}. Almacén lo revisa.</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" tamano="sm" onClick={() => abrirHojaSalida(pedido, { salida: s.id })}><Printer className="h-4 w-4" />Hoja de salida</Boton>
            {s.evidencia_ruta ? (
              <Boton variante="secundario" tamano="sm" onClick={() => abrirHoja(s.evidencia_ruta!).catch((e) => toast.error(e.message))}>
                <FileCheck2 className="h-4 w-4" />Ver hoja firmada
              </Boton>
            ) : hoja.puede_entregar && (
              <Boton tamano="sm" onClick={() => { setSubiendoA(s.id); entrada.current?.click(); }} cargando={(subiendo || adjuntar.isPending) && subiendoA === s.id}>
                {subiendo && subiendoA === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Subir hoja firmada
              </Boton>
            )}
            {hoja.puede_reabrir && k === 0 && (
              <Boton variante="fantasma" tamano="sm" onClick={() => setReabrir(true)} data-explain={GLOSARIO.reabrirEntrega}>
                <RotateCcw className="h-4 w-4" />Reabrir entrega
              </Boton>
            )}
          </div>
        </div>
      ))}
      {anuladas.length > 0 && (
        <ul className="text-xs text-tenue space-y-0.5 border-t border-borde pt-2">
          {anuladas.map((s) => (
            <li key={s.id}>Entrega {s.numero} (recibió {s.recibio}, {fechaYHora(s.entregado_en)}) reabierta {fechaYHora(s.anulada_en)}: {s.motivo_anulacion}</li>
          ))}
        </ul>
      )}
      <Dialogo abierto={reabrir} alCambiar={setReabrir} titulo={`Reabrir la entrega ${vigentes[0]?.numero ?? ""}`}
        descripcion="Se deshace la última entrega: lo que salió regresa a las partidas y al inventario, y el pedido a como estaba. Queda anotado quién la reabrió y por qué."
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

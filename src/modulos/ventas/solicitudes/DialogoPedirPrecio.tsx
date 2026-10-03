import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, MessageSquareQuote, Siren, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { cn } from "@/lib/utilidades";
import { SelectorCliente } from "@/components/datos/SelectorCliente";
import { CampoNumero } from "../componentes/campos";
import { CLAVE, cuando, subirFotoSolicitud } from "@/modulos/compras/solicitudes/datos";

export interface DatosPedido {
  descripcion: string; marca: string; modelo: string; cantidad: number; urgente: boolean; notas: string;
}
export interface InicialPedido {
  descripcion?: string; cantidad?: number; articulo?: { id: string; clave: string; nombre: string } | null;
  cotizacionId?: string | null; partidaId?: string | null; clienteId?: string | null; para?: string | null;
}

/**
 * "@compras me ayudas a cotizar esta polea?", pero con folio y plazo: qué es (con
 * marca, modelo o foto), cuántas, y si el cliente está esperando (4 horas hábiles
 * en vez de un día). Enter la manda; el vendedor no sale de su cotización.
 * `crear` deja que el cotizador agregue primero la partida libre ("¿No está?").
 */
export function DialogoPedirPrecio({ abierto, alCambiar, inicial, crear, alCreada, elegirCliente }: {
  abierto: boolean; alCambiar: (v: boolean) => void; inicial: InicialPedido;
  crear?: (d: DatosPedido) => Promise<string>; alCreada?: (id: string) => void; elegirCliente?: boolean;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<DatosPedido>({ descripcion: "", marca: "", modelo: "", cantidad: 1, urgente: false, notas: "" });
  const [foto, setFoto] = useState<File | null>(null);
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const conArticulo = !!inicial.articulo;

  useEffect(() => {
    if (!abierto) return;
    setD({ descripcion: inicial.descripcion ?? "", marca: "", modelo: "", cantidad: inicial.cantidad ?? 1, urgente: false, notas: "" });
    setFoto(null);
    setCliente(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (enviando) return;
    if (!conArticulo && d.descripcion.trim().length < 3) { toast.error("Escribe qué necesitas (qué es, medida, marca o modelo)."); return; }
    setEnviando(true);
    try {
      const id = crear ? await crear(d) : await q<string>(supabase.rpc("pedir_precio", {
        p_descripcion: d.descripcion.trim() || null, p_articulo: inicial.articulo?.id ?? null, p_cantidad: d.cantidad || 1,
        p_urgente: d.urgente, p_marca: d.marca.trim() || null, p_modelo: d.modelo.trim() || null, p_notas: d.notas.trim() || null,
        p_cotizacion: inicial.cotizacionId ?? null, p_partida: inicial.partidaId ?? null, p_cliente: cliente?.id ?? inicial.clienteId ?? null,
      }));
      let avisoFoto = "";
      if (foto) {
        try { await subirFotoSolicitud(id, foto); } catch (err) { avisoFoto = ` (la foto no se subió: ${mensajeError(err)})`; }
      }
      const { data } = await supabase.from("v_solicitudes_precio").select("folio, vence_en").eq("id", id).maybeSingle();
      toast.success(`${data?.folio ?? "Solicitud"} enviada a compras · vence ${cuando(data?.vence_en)}${avisoFoto}`);
      qc.invalidateQueries({ queryKey: [...CLAVE] });
      alCreada?.(id);
      alCambiar(false);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-lg"
      titulo={<span className="inline-flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-marca" />Pedir precio a compras</span>}
      descripcion={inicial.para ? `Para ${inicial.para}. Te avisamos cuando lo tomen y cuando haya precio.` : "Te avisamos cuando lo tomen y cuando haya precio."}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => enviar()} cargando={enviando}>Enviar a compras <kbd className="ml-1 text-[10px] opacity-75">Enter</kbd></Boton>
      </>}>
      <form onSubmit={enviar} className="space-y-3">
        {conArticulo ? (
          <div className="rounded-lg bg-fondo px-3 py-2 text-sm">
            <span className="cifra text-xs text-tenue mr-2">{inicial.articulo!.clave}</span>{inicial.articulo!.nombre}
            <span className="block text-xs text-tenue">Está en el catálogo pero sin precio (o desactualizado).</span>
          </div>
        ) : null}
        <Campo etiqueta={conArticulo ? "Algo más que deba saber compras" : "¿Qué necesitas?"}>
          <Entrada autoFocus value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })}
            placeholder={conArticulo ? "Opcional" : "Polea 10\" doble canal, rodamiento 22218, motorreductor 5 HP…"} />
        </Campo>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px] gap-3">
          <Campo etiqueta="Marca"><Entrada value={d.marca} onChange={(e) => setD({ ...d, marca: e.target.value })} placeholder="Opcional" /></Campo>
          <Campo etiqueta="Modelo"><Entrada value={d.modelo} onChange={(e) => setD({ ...d, modelo: e.target.value })} placeholder="Opcional" /></Campo>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Cantidad</span>
            <CampoNumero valor={d.cantidad} alCambiar={(n) => setD({ ...d, cantidad: n })} decimales={3} min={0.001} etiqueta="Cantidad" alEnter={() => enviar()} />
          </label>
        </div>

        <label className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition",
          d.urgente ? "border-peligro/40 bg-peligro-suave" : "border-borde hover:bg-fondo")}>
          <input type="checkbox" className="mt-1" checked={d.urgente} onChange={(e) => setD({ ...d, urgente: e.target.checked })} />
          <span className="text-sm">
            <span className="font-medium inline-flex items-center gap-1.5"><Siren className={cn("h-4 w-4", d.urgente ? "text-peligro" : "text-tenue")} />El cliente está esperando</span>
            <span className="block text-xs text-tenue">{d.urgente ? "Compras tiene 4 horas hábiles." : "Si no, compras tiene un día hábil (lun–vie 8–18, sáb 8–14)."}</span>
          </span>
        </label>

        {elegirCliente && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Para el cliente (opcional)</span>
            <SelectorCliente valor={cliente} alCambiar={(c) => setCliente(c ? { id: c.id, nombre: c.nombre } : null)} />
          </div>
        )}
        <Campo etiqueta="Nota (opcional)">
          <Entrada value={d.notas} onChange={(e) => setD({ ...d, notas: e.target.value })} placeholder="Para qué equipo es, medidas, a dónde se envía…" />
        </Campo>

        <div className="flex items-center gap-2">
          <input ref={archivo} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          <Boton type="button" variante="secundario" tamano="sm" onClick={() => archivo.current?.click()}><Camera className="h-4 w-4" />{foto ? "Cambiar foto" : "Foto o ficha (opcional)"}</Boton>
          {foto && (
            <span className="inline-flex items-center gap-1 text-xs text-tenue min-w-0">
              <span className="truncate max-w-[200px]">{foto.name}</span>
              <button type="button" aria-label="Quitar foto" className="p-0.5 rounded hover:bg-fondo" onClick={() => setFoto(null)}><X className="h-3.5 w-3.5" /></button>
            </span>
          )}
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialogo>
  );
}

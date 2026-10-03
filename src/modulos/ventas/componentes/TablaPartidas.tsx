import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, Info, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { Imagen } from "./Imagen";
import * as P from "@radix-ui/react-popover";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { CampoNumero, MenuAcciones, OpcionMenu, SeparadorMenu } from "./campos";
import { dineroEn, type Moneda, type Partida } from "../comun";

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Importe de la partida mientras se escribe (la columna generada de la base hace lo mismo al guardar). */
export const importeLocal = (l: Partida) => (l.opcional ? 0 : r2(Number(l.cantidad) * Number(l.precio_unitario) * (1 - Number(l.descuento_pct))));

export interface AccionesPartida {
  editar: (id: string, cambios: Partial<Partida>) => void;
  eliminar: (id: string) => void;
  duplicar: (l: Partida) => void;
  reordenar: (ids: string[]) => void;
  restaurarPrecio: (l: Partida) => void;
  verFicha: (l: Partida) => void;
}

/**
 * Partidas de la cotización con el formato de la hoja (renglón de artículo y
 * renglón de descripción con foto), pero con lo que faltaba: unidad, descuento
 * por partida, opcional/alternativa que no suma, partidas libres, reordenar y
 * la insignia de "bajo el mínimo" que pone la base.
 * Teclado: Tab avanza; Enter en cantidad/precio/descuento baja a la misma
 * columna de la siguiente partida, como en la hoja.
 */
export function TablaPartidas({ lineas, moneda, editable, sucias, seleccion, alSeleccionar, acciones, ancho }: {
  lineas: Partida[]; moneda: Moneda; editable: boolean; sucias: Set<string>; seleccion: string | null;
  alSeleccionar: (id: string) => void; acciones: AccionesPartida; ancho: boolean;
}) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const cont = useRef<HTMLDivElement>(null);

  const saltar = (campo: string, idx: number) => {
    const sig = cont.current?.querySelector<HTMLInputElement>(`[data-campo="${campo}"][data-fila="${idx + 1}"] input`);
    if (sig) sig.focus(); else (document.activeElement as HTMLElement | null)?.blur();
  };

  function soltar(e: DragEvent, destino: string) {
    e.preventDefault();
    if (!arrastrando || arrastrando === destino) return;
    const ids = lineas.map((l) => l.id).filter((i) => i !== arrastrando);
    ids.splice(ids.indexOf(destino), 0, arrastrando);
    acciones.reordenar(ids);
    setArrastrando(null); setSobre(null);
  }
  const mover = (id: string, d: -1 | 1) => {
    const ids = lineas.map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    acciones.reordenar(ids);
  };

  const menu = (l: Partida, i: number) => (
    <MenuAcciones disparador={<button className="h-8 w-8 rounded-lg hover:bg-fondo text-tenue flex items-center justify-center" aria-label="Opciones de la partida"><MoreVertical className="h-4 w-4" /></button>}>
      {l.articulo_id && <OpcionMenu icono={Info} alElegir={() => acciones.verFicha(l)}>Ver ficha de venta</OpcionMenu>}
      {editable && (
        <>
          {l.articulo_id && <OpcionMenu icono={RotateCcw} alElegir={() => acciones.restaurarPrecio(l)}>Volver al precio de lista</OpcionMenu>}
          <OpcionMenu icono={Copy} alElegir={() => acciones.duplicar(l)}>Duplicar partida</OpcionMenu>
          <OpcionMenu icono={ArrowUp} deshabilitado={i === 0} alElegir={() => mover(l.id, -1)}>Subir</OpcionMenu>
          <OpcionMenu icono={ArrowDown} deshabilitado={i === lineas.length - 1} alElegir={() => mover(l.id, 1)}>Bajar</OpcionMenu>
          <SeparadorMenu />
          <OpcionMenu icono={Trash2} peligro alElegir={() => acciones.eliminar(l.id)}>Quitar partida</OpcionMenu>
        </>
      )}
    </MenuAcciones>
  );

  const insignias = (l: Partida) => (
    <>
      {l.bajo_minimo && !sucias.has(l.id) && <Insignia tono="peligro" punto>Bajo el mínimo</Insignia>}
      {l.opcional && <Insignia tono="info">Opcional · no suma</Insignia>}
      {!l.articulo_id && <Insignia>Partida libre</Insignia>}
      {l.articulo_id && !Number(l.precio_lista) && <Insignia tono="aviso">Sin precio de lista: escribe el precio</Insignia>}
    </>
  );

  const opcional = (l: Partida) => (
    <label className="inline-flex items-center gap-1.5 text-xs text-tenue cursor-pointer select-none">
      <input type="checkbox" checked={l.opcional} disabled={!editable} onChange={(e) => acciones.editar(l.id, { opcional: e.target.checked })} />
      Opcional
    </label>
  );

  if (ancho) {
    const columnas = "grid-cols-[14px_18px_minmax(0,1fr)_68px_108px_62px_112px_28px]";
    return (
      <div ref={cont} className="text-sm">
        <div className={cn("grid gap-x-2 px-3 py-2 border-y border-borde bg-fondo/60 text-xs font-medium uppercase tracking-wide text-tenue", columnas)}>
          <span /><span>#</span><span>Artículo y descripción</span><span className="text-right">Cant.</span>
          <span className="text-right">P. unitario</span><span className="text-right">Desc.</span><span className="text-right">Importe</span><span />
        </div>
        {lineas.map((l, i) => {
          const imp = sucias.has(l.id) ? importeLocal(l) : Number(l.importe);
          const bruto = r2(Number(l.cantidad) * Number(l.precio_unitario));
          return (
            <div key={l.id}
              onClick={() => alSeleccionar(l.id)}
              onDragOver={(e) => { if (arrastrando) { e.preventDefault(); setSobre(l.id); } }}
              onDrop={(e) => soltar(e, l.id)}
              className={cn("grid gap-x-2 gap-y-1.5 px-3 py-2.5 border-b border-borde/70 transition-colors", columnas,
                seleccion === l.id ? "bg-marca-suave/50" : "hover:bg-fondo/60",
                l.opcional && seleccion !== l.id && "bg-info-suave/30",
                sobre === l.id && arrastrando && "border-t-2 border-t-marca",
                arrastrando === l.id && "opacity-40")}>
              <div className="pt-2">
                {editable && (
                  <span draggable onDragStart={() => setArrastrando(l.id)} onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                    className="cursor-grab text-tenue hover:text-texto" title="Arrastra para reordenar"><GripVertical className="h-4 w-4" /></span>
                )}
              </div>
              <span className="pt-2 text-tenue cifra">{i + 1}</span>
              <AreaAuto valor={l.titulo} deshabilitado={!editable} titulo alCambiar={(v) => acciones.editar(l.id, { titulo: v })} />
              <div data-campo="cantidad" data-fila={i}>
                <CampoNumero valor={Number(l.cantidad)} decimales={3} min={0.001} deshabilitado={!editable} etiqueta="Cantidad"
                  alCambiar={(n) => acciones.editar(l.id, { cantidad: n })} alEnter={() => saltar("cantidad", i)} />
              </div>
              <div data-campo="precio" data-fila={i}>
                <CampoNumero valor={Number(l.precio_unitario)} min={0} deshabilitado={!editable} etiqueta="Precio unitario"
                  className={cn(l.bajo_minimo && !sucias.has(l.id) && "[&_input]:border-peligro [&_input]:text-peligro")}
                  alCambiar={(n) => acciones.editar(l.id, { precio_unitario: n })} alEnter={() => saltar("precio", i)} />
              </div>
              <div data-campo="descuento" data-fila={i}>
                <CampoNumero valor={Number(l.descuento_pct)} escala={100} decimales={2} min={0} max={0.99} sufijo="%" deshabilitado={!editable}
                  etiqueta="Descuento de la partida" alCambiar={(n) => acciones.editar(l.id, { descuento_pct: n })} alEnter={() => saltar("descuento", i)} />
              </div>
              <div className="text-right pt-2">
                <p className={cn("font-semibold cifra", l.opcional && "text-tenue line-through decoration-1")}>
                  {dineroEn(l.opcional ? bruto * (1 - Number(l.descuento_pct)) : imp, moneda)}
                </p>
                {Number(l.descuento_pct) > 0 && !l.opcional && <p className="text-xs text-tenue line-through cifra">{dineroEn(bruto, moneda)}</p>}
              </div>
              <div className="pt-0.5">{menu(l, i)}</div>

              {/* Segundo renglón: foto + descripción, como la hoja */}
              <span /><span />
              <div className="col-span-5 flex gap-3">
                <ImagenPartida l={l} editable={editable} alCambiar={(url) => acciones.editar(l.id, { imagen_url: url })} />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <AreaAuto valor={l.descripcion ?? ""} deshabilitado={!editable} placeholder="Descripción / ficha técnica (una viñeta por renglón)"
                    alCambiar={(v) => acciones.editar(l.id, { descripcion: v || null })} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs text-tenue">
                      Unidad
                      <input className="campo h-7 w-24 text-xs" value={l.unidad} disabled={!editable}
                        onChange={(e) => acciones.editar(l.id, { unidad: e.target.value })} />
                    </label>
                    {opcional(l)}{insignias(l)}
                  </div>
                </div>
              </div>
              <span />
            </div>
          );
        })}
      </div>
    );
  }

  // Celular: una tarjeta por partida, con lo que se toca más (cantidad y precio) a la mano.
  return (
    <div ref={cont} className="divide-y divide-borde">
      {lineas.map((l, i) => {
        const imp = sucias.has(l.id) ? importeLocal(l) : Number(l.importe);
        return (
          <div key={l.id} className={cn("p-3 space-y-2", l.opcional && "bg-info-suave/30", seleccion === l.id && "bg-marca-suave/40")} onClick={() => alSeleccionar(l.id)}>
            <div className="flex items-start gap-2">
              <span className="text-xs text-tenue cifra pt-2.5 w-4">{i + 1}</span>
              <ImagenPartida l={l} editable={editable} chica alCambiar={(url) => acciones.editar(l.id, { imagen_url: url })} />
              <textarea className={cn("campo h-auto min-h-[38px] py-2 font-medium flex-1 resize-none", !editable && "border-transparent bg-transparent px-0")} rows={2}
                value={l.titulo} disabled={!editable} onChange={(e) => acciones.editar(l.id, { titulo: e.target.value })} aria-label="Artículo" />
              {menu(l, i)}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1" data-campo="cantidad" data-fila={i}>
                <span className="text-[11px] text-tenue">Cantidad ({l.unidad})</span>
                <CampoNumero valor={Number(l.cantidad)} decimales={3} min={0.001} deshabilitado={!editable}
                  alCambiar={(n) => acciones.editar(l.id, { cantidad: n })} alEnter={() => saltar("cantidad", i)} />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-tenue">P. unitario</span>
                <CampoNumero valor={Number(l.precio_unitario)} min={0} deshabilitado={!editable}
                  className={cn(l.bajo_minimo && !sucias.has(l.id) && "[&_input]:border-peligro [&_input]:text-peligro")}
                  alCambiar={(n) => acciones.editar(l.id, { precio_unitario: n })} />
              </label>
              <div className="space-y-1 text-right">
                <span className="text-[11px] text-tenue">Importe</span>
                <p className={cn("h-9 flex items-center justify-end font-semibold cifra", l.opcional && "text-tenue line-through")}>
                  {dineroEn(l.opcional ? r2(Number(l.cantidad) * Number(l.precio_unitario) * (1 - Number(l.descuento_pct))) : imp, moneda)}
                </p>
              </div>
            </div>
            <details className="group">
              <summary className="text-xs text-marca-texto cursor-pointer list-none">Descripción, unidad y descuento…</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <AreaAuto className="col-span-2" valor={l.descripcion ?? ""} deshabilitado={!editable} placeholder="Descripción / ficha técnica"
                  alCambiar={(v) => acciones.editar(l.id, { descripcion: v || null })} />
                <input className="campo" value={l.unidad} disabled={!editable} onChange={(e) => acciones.editar(l.id, { unidad: e.target.value })} aria-label="Unidad" />
                <CampoNumero valor={Number(l.descuento_pct)} escala={100} min={0} max={0.99} sufijo="%" deshabilitado={!editable} etiqueta="Descuento"
                  alCambiar={(n) => acciones.editar(l.id, { descuento_pct: n })} />
              </div>
            </details>
            <div className="flex flex-wrap items-center gap-2">{opcional(l)}{insignias(l)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Textarea que crece con el texto (las fichas técnicas son de 3 a 15 viñetas). */
function AreaAuto({ valor, alCambiar, deshabilitado, placeholder, className, titulo }: {
  valor: string; alCambiar: (v: string) => void; deshabilitado?: boolean; placeholder?: string; className?: string; titulo?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight + 2, 260) + "px";
  }, [valor]);
  return (
    <textarea ref={ref} rows={titulo ? 1 : 2} value={valor} disabled={deshabilitado} placeholder={placeholder} aria-label={titulo ? "Artículo" : "Descripción"}
      onChange={(e) => alCambiar(titulo ? e.target.value.replace(/\n/g, " ") : e.target.value)}
      onKeyDown={(e) => { if (titulo && e.key === "Enter") { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
      className={cn("campo h-auto resize-none leading-snug", titulo ? "py-[7px] font-medium" : "py-1.5 text-[13px] text-tenue focus:text-texto",
        deshabilitado && "border-transparent bg-transparent px-0 disabled:opacity-100", className)} />
  );
}

/** Foto de la partida: viene del catálogo; se puede pegar otra liga. */
function ImagenPartida({ l, editable, alCambiar, chica }: { l: Partida; editable: boolean; alCambiar: (url: string | null) => void; chica?: boolean }) {
  const [url, setUrl] = useState(l.imagen_url ?? "");
  useEffect(() => setUrl(l.imagen_url ?? ""), [l.imagen_url]);
  const tam = chica ? "h-10 w-10" : "h-16 w-16";
  const contenido = <Imagen key={l.imagen_url ?? ""} src={l.imagen_url} className={tam} />;
  if (!editable) return <div className="shrink-0">{contenido}</div>;
  return (
    <P.Root>
      <P.Trigger asChild><button type="button" className="shrink-0 self-start" title="Cambiar foto">{contenido}</button></P.Trigger>
      <P.Portal>
        <P.Content sideOffset={6} align="start" className="z-50 tarjeta shadow-xl p-3 w-80 space-y-2">
          <p className="text-sm font-medium">Foto de la partida</p>
          <input className="campo" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega la liga de la imagen (https://…)" autoFocus />
          <div className="flex justify-end gap-2">
            {l.imagen_url && <P.Close asChild><button className="text-sm text-peligro" onClick={() => alCambiar(null)}>Quitar</button></P.Close>}
            <P.Close asChild><button className="text-sm text-marca-texto font-medium" onClick={() => alCambiar(url.trim() || null)}>Usar esta</button></P.Close>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

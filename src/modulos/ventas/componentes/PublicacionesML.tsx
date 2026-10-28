import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, Link2, Package, Pencil, Undo2, Unlink } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, hace, numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

export interface SinLigar { item_id: string; titulo: string | null; sku: string | null; precio: number | null; veces: number; visto_en: string }
interface Ligada {
  id: string; id_externo: string; titulo: string | null; precio: number | null; piezas_por_paquete: number;
  articulo: { id: string; clave: string; nombre: string } | null;
}

const INVALIDAR = [["ml_publicaciones_sin_ligar"], ["ml_publicaciones_ligadas"], ["ml_publicaciones_ajenas"], ["estado_mercadolibre"], ["pedidos"], ["envios"]];

/** Piezas por venta: más de cero, con fracción si cada venta es parte de lo que el ERP cuenta (1 juego de una caja de 4). */
const piezasValidas = (v: string) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) > 0;

/** «24 Cangilones…» → 24. Solo sugiere: quien liga lo confirma. */
function piezasDelTitulo(titulo: string | null) {
  const m = titulo?.match(/^\s*(\d{1,3})\s+(pzas?|piezas?|[a-záéíóúñ]+s)\b/i);
  return m && Number(m[1]) > 1 ? Number(m[1]) : 1;
}

function CampoPiezas({ valor, alCambiar }: { valor: string; alCambiar: (v: string) => void }) {
  return (
    <Campo etiqueta="Piezas por venta" ayuda="Paquete de 24 cangilones: 24. Si cada venta es una parte de lo que tienes en el catálogo (1 juego y la clave es una caja de 4), 0.25.">
      <span data-explain={GLOSARIO.piezasPorVentaML} data-explain-title="Piezas por venta">
        <Entrada type="number" min="0" step="any" className="cifra w-24 block" value={valor} onChange={(e) => alCambiar(e.target.value)} />
      </span>
    </Campo>
  );
}

/** Elegir el artículo y las piezas de una publicación. Lo usan «Por ligar» y el envío (almacén). */
export function FormaLigar({ item, titulo, alTerminar }: { item: string; titulo: string | null; alTerminar?: () => void }) {
  const [art, setArt] = useState<ArticuloEncontrado | null>(null);
  const [piezas, setPiezas] = useState(String(piezasDelTitulo(titulo)));
  const ligar = useAccion(() => q<number>(supabase.rpc("ml_ligar_publicacion", { p_item: item, p_articulo: art!.id, p_piezas: Number(piezas) })), {
    exito: "Publicación ligada: sus ventas y sus envíos ya tienen artículo", invalidar: INVALIDAR, alTerminar,
  });
  const valido = art && piezasValidas(piezas);
  if (!art) return <BuscadorArticulo placeholder="¿Qué artículo es? Busca por clave o nombre…" mostrarPrecio={false} alElegir={setArt} />;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valido) ligar.mutate(undefined); }}>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium truncate">{art.clave} · {art.nombre}</p>
        <button type="button" className="text-xs text-marca-texto hover:underline" onClick={() => setArt(null)}>Elegir otro</button>
      </div>
      <CampoPiezas valor={piezas} alCambiar={setPiezas} />
      <Boton type="submit" disabled={!valido} cargando={ligar.isPending}><Link2 className="h-4 w-4" /> Ligar</Boton>
    </form>
  );
}

/** Una publicación vendida que el ERP no conoce: se elige el artículo y cuántas piezas trae cada venta,
 *  o se marca como de otra tienda (en la misma cuenta se vende algo que no es de Hegamex). */
export function Ligar({ s, editable }: { s: SinLigar; editable: boolean }) {
  const ajena = useAccion(() => q<number>(supabase.rpc("ml_marcar_ajena", { p_item: s.item_id })), {
    exito: (n) => n ? `Marcada: ${n} venta(s) se cancelaron sin cobro y las siguientes ya no entran` : "Marcada: sus ventas ya no entran al ERP",
    invalidar: INVALIDAR,
  });
  return (
    <li className="px-5 py-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="min-w-0">
        <p className="font-medium truncate">{s.titulo ?? s.item_id}</p>
        <p className="text-xs text-tenue">{s.item_id}{s.sku ? ` · SKU ${s.sku}` : " · sin SKU"}{s.precio != null ? ` · ${dinero(s.precio)}` : ""} · se vendió {s.veces} {s.veces === 1 ? "vez" : "veces"}, la última {hace(s.visto_en)}</p>
        {editable && (
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-tenue hover:text-peligro" data-explain={GLOSARIO.publicacionAjenaML}
            disabled={ajena.isPending}
            onClick={() => confirm(`¿«${s.titulo ?? s.item_id}» no es de Hegamex? Sus ventas en el ERP se cancelan sin cobro (si ya se empacaron, no te deja) y las siguientes ya no entran.`) && ajena.mutate(undefined)}>
            <Ban className="h-3.5 w-3.5" /> No es de Hegamex
          </button>
        )}
      </div>
      {editable && <FormaLigar item={s.item_id} titulo={s.titulo} />}
    </li>
  );
}

/** Publicaciones de otra tienda en la misma cuenta: sus ventas no entran. Por si se marcó una por error. */
export function PublicacionesAjenas({ editable }: { editable: boolean }) {
  const ajenas = useQuery({
    queryKey: ["ml_publicaciones_ajenas"],
    queryFn: () => q<{ item_id: string; titulo: string | null; sku: string | null; marcada_en: string }[]>(
      supabase.from("ml_publicaciones_ajenas").select("item_id, titulo, sku, marcada_en").order("marcada_en", { ascending: false })),
  });
  const regresar = useAccion((item: string) => q(supabase.rpc("ml_desmarcar_ajena", { p_item: item })), {
    exito: "Regresó a «Por ligar»", invalidar: INVALIDAR,
  });
  if (!ajenas.data?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" data-explain={GLOSARIO.publicacionAjenaML}>No son de Hegamex ({numero(ajenas.data.length)})</p>
      <Tarjeta>
        <ul className="divide-y divide-borde">
          {ajenas.data.map((a) => (
            <li key={a.item_id} className="px-5 py-2.5 flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{a.titulo ?? a.item_id}</p>
                <p className="text-xs text-tenue">{a.item_id}{a.sku ? ` · SKU ${a.sku}` : ""} · marcada {hace(a.marcada_en)}</p>
              </div>
              {editable && <Boton variante="fantasma" tamano="sm" cargando={regresar.isPending && regresar.variables === a.item_id}
                onClick={() => regresar.mutate(a.item_id)}><Undo2 className="h-3.5 w-3.5" /> Sí es nuestra</Boton>}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

/** Las publicaciones ya ligadas, para corregir el artículo o las piezas, o deshacer la liga. */
export function PublicacionesLigadas({ editable }: { editable: boolean }) {
  const ligadas = useQuery({
    queryKey: ["ml_publicaciones_ligadas"],
    queryFn: () => q<Ligada[]>(supabase.from("publicaciones").select("id, id_externo, titulo, precio, piezas_por_paquete, articulo:articulos(id, clave, nombre)")
      .eq("canal", "mercadolibre").order("titulo").returns<Ligada[]>()),
  });
  const [abierta, setAbierta] = useState<Ligada | null>(null);
  if (ligadas.error) return <ErrorCarga error={ligadas.error} />;
  if (ligadas.isLoading) return <Cargando filas={3} />;
  if (!ligadas.data?.length) {
    return <div className="tarjeta"><Vacio icono={Link2} titulo="Todavía no hay publicaciones ligadas" texto="Se ligan solas cuando el SKU de la publicación es la clave del ERP, o a mano desde «Por ligar» cuando se vende una que el ERP no conoce." /></div>;
  }
  return (
    <Tarjeta>
      <ul className="divide-y divide-borde">
        {ligadas.data.map((p) => (
          <li key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{p.titulo ?? p.id_externo}</p>
              <p className="text-xs text-tenue">{p.id_externo}{p.precio != null ? ` · ${dinero(p.precio)}` : ""}</p>
            </div>
            <div className="min-w-0 text-sm flex items-center gap-2">
              {p.articulo ? <Link to={`/costeo/componentes/${p.articulo.id}`} className="text-marca-texto hover:underline truncate">{p.articulo.clave} · {p.articulo.nombre}</Link> : "—"}
              {Number(p.piezas_por_paquete) !== 1 && <span data-explain={GLOSARIO.piezasPorVentaML} data-explain-title="Piezas por venta"><Insignia tono="info"><Package className="h-3 w-3" /> {numero(Number(p.piezas_por_paquete))} por venta</Insignia></span>}
            </div>
            {editable && <Boton variante="secundario" tamano="sm" onClick={() => setAbierta(p)}><Pencil className="h-3.5 w-3.5" /> Corregir</Boton>}
          </li>
        ))}
      </ul>
      {abierta && <Corregir p={abierta} alCerrar={() => setAbierta(null)} />}
    </Tarjeta>
  );
}

function Corregir({ p, alCerrar }: { p: Ligada; alCerrar: () => void }) {
  const [art, setArt] = useState<{ id: string; clave: string; nombre: string } | null>(p.articulo);
  const [piezas, setPiezas] = useState(String(p.piezas_por_paquete));
  const resumen = (r: { ventas: number; ya_en_camino: number }) =>
    `${r.ventas ? `Se corrigieron ${r.ventas} venta(s) abiertas` : "Sin ventas abiertas que corregir"}${r.ya_en_camino ? `; ${r.ya_en_camino} ya tenían guía y se quedaron como estaban` : ""}`;
  const guardar = useAccion(() => q<{ ventas: number; ya_en_camino: number }>(supabase.rpc("ml_corregir_publicacion", { p_item: p.id_externo, p_articulo: art!.id, p_piezas: Number(piezas) })),
    { exito: resumen, invalidar: INVALIDAR, alTerminar: alCerrar });
  const desligar = useAccion(() => q<{ ventas: number; ya_en_camino: number }>(supabase.rpc("ml_corregir_publicacion", { p_item: p.id_externo, p_articulo: null })),
    { exito: (r) => `Desligada: vuelve a «Por ligar». ${resumen(r)}`, invalidar: INVALIDAR, alTerminar: alCerrar });
  const valido = art && piezasValidas(piezas);
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Corregir publicación" descripcion={p.titulo ?? p.id_externo}
      pie={<>
        <Boton variante="fantasma" className="mr-auto" cargando={desligar.isPending}
          onClick={() => confirm("¿Desligar esta publicación? Vuelve a «Por ligar» y sus ventas abiertas se quedan sin artículo hasta que la ligues otra vez.") && desligar.mutate(undefined)}>
          <Unlink className="h-4 w-4" /> Desligar</Boton>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton form="corregir-pub" type="submit" disabled={!valido} cargando={guardar.isPending}>Guardar</Boton>
      </>}>
      <form id="corregir-pub" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valido) guardar.mutate(undefined); }}>
        <Campo etiqueta="Artículo">
          <div className="space-y-2">
            {art && <p className="text-sm font-medium">{art.clave} · {art.nombre}</p>}
            <BuscadorArticulo placeholder="Cambiar por otro artículo…" mostrarPrecio={false} alElegir={(a) => setArt({ id: a.id, clave: a.clave, nombre: a.nombre })} />
          </div>
        </Campo>
        <CampoPiezas valor={piezas} alCambiar={setPiezas} />
        <p className="text-xs text-tenue">Las ventas abiertas de esta publicación se rehacen con el artículo y las piezas nuevas (cantidad y precio por pieza). Las que ya tienen guía o se enviaron no cambian.</p>
      </form>
    </Dialogo>
  );
}

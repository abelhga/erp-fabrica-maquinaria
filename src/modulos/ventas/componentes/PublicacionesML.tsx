import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link2, Package, Pencil, Unlink } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, hace } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

export interface SinLigar { item_id: string; titulo: string | null; sku: string | null; precio: number | null; veces: number; visto_en: string }
interface Ligada {
  id: string; id_externo: string; titulo: string | null; precio: number | null; piezas_por_paquete: number;
  articulo: { id: string; clave: string; nombre: string } | null;
}

const INVALIDAR = [["ml_publicaciones_sin_ligar"], ["ml_publicaciones_ligadas"], ["estado_mercadolibre"], ["pedidos"], ["envios"]];

/** «24 Cangilones…» → 24. Solo sugiere: quien liga lo confirma. */
function piezasDelTitulo(titulo: string | null) {
  const m = titulo?.match(/^\s*(\d{1,3})\s+(pzas?|piezas?|[a-záéíóúñ]+s)\b/i);
  return m && Number(m[1]) > 1 ? Number(m[1]) : 1;
}

function CampoPiezas({ valor, alCambiar }: { valor: string; alCambiar: (v: string) => void }) {
  return (
    <Campo etiqueta="Piezas por venta" ayuda="Si la publicación es un paquete (24 cangilones), pon 24: cada venta descuenta 24 piezas.">
      <span data-explain={GLOSARIO.piezasPorVentaML} data-explain-title="Piezas por venta">
        <Entrada type="number" min="1" step="1" className="cifra w-24 block" value={valor} onChange={(e) => alCambiar(e.target.value)} />
      </span>
    </Campo>
  );
}

/** Una publicación vendida que el ERP no conoce: se elige el artículo y cuántas piezas trae cada venta. */
export function Ligar({ s, editable }: { s: SinLigar; editable: boolean }) {
  const [art, setArt] = useState<ArticuloEncontrado | null>(null);
  const [piezas, setPiezas] = useState(String(piezasDelTitulo(s.titulo)));
  const ligar = useAccion(() => q<number>(supabase.rpc("ml_ligar_publicacion", { p_item: s.item_id, p_articulo: art!.id, p_piezas: Number(piezas) })), {
    exito: "Publicación ligada: sus ventas ya tienen artículo y el envío se pidió", invalidar: INVALIDAR,
  });
  const valido = art && Number.isInteger(Number(piezas)) && Number(piezas) >= 1;
  return (
    <li className="px-5 py-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="min-w-0">
        <p className="font-medium truncate">{s.titulo ?? s.item_id}</p>
        <p className="text-xs text-tenue">{s.item_id}{s.sku ? ` · SKU ${s.sku}` : " · sin SKU"}{s.precio != null ? ` · ${dinero(s.precio)}` : ""} · se vendió {s.veces} {s.veces === 1 ? "vez" : "veces"}, la última {hace(s.visto_en)}</p>
      </div>
      {editable && (!art ? (
        <BuscadorArticulo placeholder="¿Qué artículo es? Busca por clave o nombre…" mostrarPrecio={false} alElegir={setArt} />
      ) : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valido) ligar.mutate(undefined); }}>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium truncate">{art.clave} · {art.nombre}</p>
            <button type="button" className="text-xs text-marca-texto hover:underline" onClick={() => setArt(null)}>Elegir otro</button>
          </div>
          <CampoPiezas valor={piezas} alCambiar={setPiezas} />
          <Boton type="submit" disabled={!valido} cargando={ligar.isPending}><Link2 className="h-4 w-4" /> Ligar</Boton>
        </form>
      ))}
    </li>
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
              {p.piezas_por_paquete > 1 && <span data-explain={GLOSARIO.piezasPorVentaML} data-explain-title="Piezas por venta"><Insignia tono="info"><Package className="h-3 w-3" /> {p.piezas_por_paquete} por venta</Insignia></span>}
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
  const valido = art && Number.isInteger(Number(piezas)) && Number(piezas) >= 1;
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

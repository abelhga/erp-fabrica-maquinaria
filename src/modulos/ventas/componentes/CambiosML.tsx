import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Bot, History, Send, Wand2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Interruptor } from "@/components/ui/interruptor";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fechaYHora, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { llamarML } from "@/lib/mercadolibre";
import { GLOSARIO } from "@/tutorial/glosario";

export interface CambioPropuesto {
  item_id: string; titulo: string | null; campo: "precio" | "existencia"; actual: number; propuesto: number;
  motivo: string; automatico: boolean; por_que_no: string | null;
}
interface Resultado { item_id: string; campo: string; estado: "aplicado" | "omitido" | "error"; detalle: string | null }

const clave = (c: { item_id: string; campo: string }) => `${c.item_id}·${c.campo}`;
const valor = (campo: string, n: number | null) => (n == null ? "—" : campo === "precio" ? dinero(n) : numero(Number(n)));
const CLAVES = [["ml_cambios_propuestos"], ["ml_tablero"], ["ml_cambios"]];

export function useCambiosPropuestos(activo: boolean) {
  return useQuery({ queryKey: ["ml_cambios_propuestos"], enabled: activo, queryFn: () => q<CambioPropuesto[]>(supabase.rpc("ml_cambios_propuestos")) });
}

/**
 * Lo que habría que cambiar en ML para que cuadre con el ERP, con el antes y el después. Se palomea
 * lo que se quiere y se manda; el valor lo pone la base (el sugerido), no la pantalla.
 */
export function DialogoCambiosML({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const qc = useQueryClient();
  const cambios = useCambiosPropuestos(abierto);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [mandando, setMandando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  // De entrada van palomeados todos menos los que dejarían la publicación en 0 (ML la pausa).
  useEffect(() => {
    if (abierto && cambios.data) setElegidos(new Set(cambios.data.filter((c) => !(c.campo === "existencia" && Number(c.propuesto) === 0)).map(clave)));
    if (!abierto) setResultados(null);
  }, [abierto, cambios.data]);
  const lista = cambios.data ?? [];
  const nombre = useMemo(() => new Map(lista.map((c) => [c.item_id, c.titulo ?? c.item_id])), [lista]);

  async function mandar() {
    setMandando(true);
    try {
      const r = await llamarML<{ aplicados: number; omitidos: number; errores: number; resultados: Resultado[] }>("aplicar", {
        cambios: lista.filter((c) => elegidos.has(clave(c))).map((c) => ({ item_id: c.item_id, campo: c.campo })),
      });
      const partes = [`${numero(r.aplicados)} cambiado${r.aplicados === 1 ? "" : "s"} en Mercado Libre`];
      if (r.omitidos) partes.push(`${numero(r.omitidos)} sin tocar`);
      if (r.errores) partes.push(`${numero(r.errores)} con error`);
      (r.errores || r.omitidos ? toast.warning : toast.success)(partes.join(" · "));
      setResultados(r.resultados.filter((x) => x.estado !== "aplicado"));
      for (const k of CLAVES) qc.invalidateQueries({ queryKey: k });
      if (!r.errores && !r.omitidos) alCambiar(false);
    } catch (e) { toast.error(mensajeError(e)); } finally { setMandando(false); }
  }

  const n = lista.filter((c) => elegidos.has(clave(c))).length;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Cambios sugeridos" ancho="max-w-3xl"
      descripcion="Lo que cambiaría en Mercado Libre para que cuadre con el catálogo y lo libre en planta. Antes de mandar se vuelve a leer cada publicación: si alguien la cambió en ML, esa no se toca."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cerrar</Boton>
        <Boton onClick={mandar} disabled={!n} cargando={mandando}><Send className="h-4 w-4" /> Mandar {n ? numero(n) : ""} a Mercado Libre</Boton>
      </>}>
      {resultados && resultados.length > 0 && (
        <div className="mb-4 rounded-lg border border-aviso/40 bg-aviso-suave px-3 py-2 text-sm space-y-1">
          <p className="font-medium">No se cambiaron:</p>
          {resultados.map((r) => <p key={clave(r)} className="text-xs">{nombre.get(r.item_id) ?? r.item_id} · {r.campo}: {r.detalle}</p>)}
        </div>
      )}
      {cambios.isLoading ? <p className="text-sm text-tenue">Calculando…</p> : !lista.length ? (
        <p className="text-sm text-tenue">Todo cuadra: no hay nada que cambiar. Si acabas de mover precios o existencias, da «Traer de Mercado Libre».</p>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {lista.map((c) => {
            const k = clave(c);
            return (
              <li key={k}>
                <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-fondo">
                  <input type="checkbox" className="mt-1" checked={elegidos.has(k)}
                    onChange={(e) => setElegidos((s) => { const x = new Set(s); if (e.target.checked) x.add(k); else x.delete(k); return x; })} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.titulo ?? c.item_id}</p>
                    <p className="text-xs text-tenue">{c.item_id} · {c.motivo}</p>
                    {c.por_que_no && <p className="text-xs text-tenue">No se haría solo: {c.por_que_no}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-tenue">{c.campo === "precio" ? "Precio" : "Existencia"}</p>
                    <p className="cifra text-sm whitespace-nowrap flex items-center gap-1 justify-end">
                      <span className="text-tenue line-through">{valor(c.campo, c.actual)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-tenue" />
                      <span className={cn("font-semibold", c.campo === "existencia" && Number(c.propuesto) === 0 && "text-peligro")}>{valor(c.campo, c.propuesto)}</span>
                    </p>
                    {c.automatico && <span data-explain={GLOSARIO.automaticoML} data-explain-title="Se puede hacer solo"><Insignia tono="info">automático</Insignia></span>}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Dialogo>
  );
}

interface Automatico {
  precio: boolean; existencia: boolean; cambiado_por_nombre: string | null; cambiado_en: string | null;
  ultima_corrida?: { en: string; aplicados?: number; omitidos?: number; errores?: number; pendientes?: number; error?: string };
}

/** El interruptor de los cambios solos. Lo cambia gerencia de ventas o dirección; los demás lo ven. */
export function AutomaticoML({ puedeCambiar }: { puedeCambiar: boolean }) {
  const datos = useQuery({ queryKey: ["ml_automatico"], queryFn: () => q<Automatico | null>(supabase.rpc("ml_automatico")) });
  const fijar = useAccion((v: { precio: boolean; existencia: boolean }) => q(supabase.rpc("fijar_ml_automatico", { p_precio: v.precio, p_existencia: v.existencia })),
    { exito: "Guardado", invalidar: [["ml_automatico"]] });
  const a = datos.data;
  if (!a) return null;
  const u = a.ultima_corrida;
  const fila = (campo: "precio" | "existencia", texto: string, regla: string) => (
    <div className="flex items-start justify-between gap-3 py-2">
      <div><p className="text-sm font-medium">{texto}</p><p className="text-xs text-tenue">{regla}</p></div>
      {puedeCambiar ? (
        <Interruptor activo={a[campo]} cargando={fijar.isPending} aria-label={`${texto} solo`}
          alCambiar={(v) => fijar.mutate({ precio: a.precio, existencia: a.existencia, [campo]: v })} />
      ) : <Insignia tono={a[campo] ? "ok" : "neutro"}>{a[campo] ? "Prendido" : "Apagado"}</Insignia>}
    </div>
  );
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Corregir solo" descripcion="Cada hora, de 7:41 a 19:41, lo seguro; lo demás espera al botón" explica={GLOSARIO.automaticoML} />
      <div className="px-5 pb-4 divide-y divide-borde">
        {fila("precio", "Precio", "Si la comisión y el envío los dio ML, la publicación está activa y el cambio es de 15 % o menos.")}
        {fila("existencia", "Existencia", "Nunca la deja en 0 ni la sube si el artículo está en otra publicación activa.")}
        <p className="pt-2 text-xs text-tenue flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          {u ? (u.error ? <span className="text-peligro">Última vuelta {hace(u.en)}: {u.error}</span>
            : <>Última vuelta {hace(u.en)}: {numero(u.aplicados ?? 0)} cambiados{u.omitidos ? `, ${numero(u.omitidos)} sin tocar` : ""}{u.errores ? `, ${numero(u.errores)} con error` : ""}{u.pendientes ? `, ${numero(u.pendientes)} para la siguiente` : ""}</>)
            : (a.precio || a.existencia ? "Todavía no ha corrido" : "Apagado: nada se cambia solo")}
          {a.cambiado_por_nombre && a.cambiado_en && <> · lo cambió {a.cambiado_por_nombre} {hace(a.cambiado_en)}</>}
        </p>
      </div>
    </Tarjeta>
  );
}

interface Hecho {
  id: number; item_id: string; titulo: string | null; campo: "precio" | "existencia"; antes: number | null; despues: number | null;
  origen: "boton" | "automatico"; estado: "aplicado" | "omitido" | "error"; detalle: string | null; creado_en: string; usuario: { nombre: string } | null;
}

/** Lo que el ERP le mandó a ML, con quién y lo que contestó. */
export function HistorialCambiosML() {
  const datos = useQuery({
    queryKey: ["ml_cambios"],
    queryFn: () => q<Hecho[]>(supabase.from("ml_cambios").select("id, item_id, titulo, campo, antes, despues, origen, estado, detalle, creado_en, usuario:perfiles(nombre)")
      .order("creado_en", { ascending: false }).limit(40).returns<Hecho[]>()),
  });
  return (
    <Tarjeta className="overflow-hidden">
      <EncabezadoTarjeta titulo="Cambios hechos desde el ERP" descripcion="Los últimos 40, con quién y lo que contestó ML" explica={GLOSARIO.historialCambiosML} />
      {!datos.data?.length ? <p className="px-5 pb-5 text-sm text-tenue">Todavía no se ha cambiado nada desde aquí.</p> : (
        <ul className="divide-y divide-borde text-sm">
          {datos.data.map((h) => (
            <li key={h.id} className="px-5 py-2.5 flex flex-wrap items-start gap-x-3 gap-y-0.5">
              <History className="h-3.5 w-3.5 mt-1 text-tenue" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{h.titulo ?? h.item_id} · {h.campo === "precio" ? "precio" : "existencia"}{" "}
                  <span className="cifra text-tenue">{valor(h.campo, h.antes)} → {valor(h.campo, h.despues)}</span></p>
                <p className="text-xs text-tenue">{fechaYHora(h.creado_en)} · {h.origen === "automatico" ? "automático" : h.usuario?.nombre ?? "—"}{h.detalle ? ` · ${h.detalle}` : ""}</p>
              </div>
              <Insignia tono={h.estado === "aplicado" ? "ok" : h.estado === "omitido" ? "aviso" : "peligro"}>{h.estado === "aplicado" ? "Cambiado" : h.estado === "omitido" ? "Sin tocar" : "Error"}</Insignia>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/** El botón del tablero: cuántos cambios hay y abre la vista previa. */
export function BotonCambiosML() {
  const [abierto, setAbierto] = useState(false);
  const cambios = useCambiosPropuestos(true);
  const n = cambios.data?.length ?? 0;
  return (
    <>
      <Boton tamano="sm" variante={n ? "primario" : "secundario"} onClick={() => setAbierto(true)} data-explain={GLOSARIO.cambiosSugeridosML} data-explain-title="Cambios sugeridos">
        <Wand2 className="h-3.5 w-3.5" /> Cambios sugeridos{n ? ` (${numero(n)})` : ""}
      </Boton>
      <DialogoCambiosML abierto={abierto} alCambiar={setAbierto} />
    </>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Vacio, Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, numero } from "@/lib/formato";
import { normalizar } from "@/lib/utilidades";
import { CeldaNumero, CeldaTexto } from "./Celdas";
import { cant, leerNumero, type ArticuloCatalogo, type Parametro } from "./comun";
import { useArbol } from "./datosLista";

interface Operacion {
  id: string; articulo_id: string; etapa_id: number; horas: number; parametro: string | null; horas_por_parametro: number;
  notas: string | null; horas_operacion: number;
}
interface Etapa { id: number; nombre: string; orden: number; color: string }

function useOperaciones(id: string) {
  return useQuery({
    queryKey: ["costeo", "operaciones", id],
    queryFn: () => q<Operacion[]>(supabase.from("bom_operaciones").select("*, horas_operacion").eq("articulo_id", id) as unknown as
      PromiseLike<{ data: Operacion[] | null; error: { message: string } | null }>),
  });
}

/** "Largo en metros" → "largo_en_metros": el nombre de un parámetro va en las fórmulas, sin acentos ni espacios. */
const nombreParametro = (t: string) => normalizar(t).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "p_$1");

/**
 * Parámetros del artículo (largo_m = 20, ancho_pulg = 18…). Cambiar un valor
 * recalcula cantidades, costo y precio. Cada parámetro dice qué líneas y qué
 * horas dependen de él, para que nadie cambie el largo sin saber qué mueve.
 */
export function Parametros({ articulo, parametros }: { articulo: ArticuloCatalogo; parametros: Parametro[] }) {
  const { puede } = useSesion();
  const editar = puede("costeo", 2);
  const qc = useQueryClient();
  const arbol = useArbol(articulo.id);
  const ops = useOperaciones(articulo.id);
  const etapas = useEtapas();
  const [nuevo, setNuevo] = useState({ nombre: "", valor: "", unidad: "" });

  const usos = useMemo(() => {
    const m = new Map<string, string[]>();
    const por = (p: string) => parametros.find((x) => x.nombre === p)?.unidad || "unidad";
    for (const l of arbol.data ?? []) {
      if (l.nivel !== 1 || !l.parametro) continue;
      const extras = [l.redondear_arriba && "en enteros", l.merma > 0 && `+${cant(l.merma * 100)} % de merma`].filter(Boolean).join(", ");
      const t = `${l.nombre}: ${cant(l.cantidad)} + ${cant(l.por_parametro)} por ${por(l.parametro)}${extras ? ` (${extras})` : ""} = ${cant(Math.round(l.cantidad_efectiva * 100) / 100)} ${l.unidad}`;
      m.set(l.parametro, [...(m.get(l.parametro) ?? []), t]);
    }
    for (const o of ops.data ?? []) {
      if (!o.parametro) continue;
      const e = etapas.data?.find((x) => x.id === o.etapa_id)?.nombre ?? "Horas";
      m.set(o.parametro, [...(m.get(o.parametro) ?? []), `${e}: ${cant(o.horas)} h + ${cant(o.horas_por_parametro)} h por ${por(o.parametro)} = ${cant(o.horas_operacion)} h`]);
    }
    return m;
  }, [arbol.data, ops.data, etapas.data, parametros]);

  async function guardar(p: Parametro, cambios: Partial<Parametro>) {
    const { error } = await supabase.from("articulo_parametros").update(cambios).eq("articulo_id", articulo.id).eq("nombre", p.nombre);
    if (error) toast.error(mensajeError(error));
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }
  async function quitar(p: Parametro) {
    const { error } = await supabase.from("articulo_parametros").delete().eq("articulo_id", articulo.id).eq("nombre", p.nombre);
    if (error) toast.error(mensajeError(error)); else toast.success(`Parámetro ${p.nombre} eliminado.`);
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }
  async function agregar(e: FormEvent) {
    e.preventDefault();
    const nombre = nombreParametro(nuevo.nombre);
    const valor = leerNumero(nuevo.valor);
    if (!nombre || valor == null) { toast.error("Escribe el nombre y el valor del parámetro."); return; }
    const { error } = await supabase.from("articulo_parametros").insert({ articulo_id: articulo.id, nombre, valor, unidad: nuevo.unidad.trim() || null });
    if (error) { toast.error(mensajeError(error)); return; }
    setNuevo({ nombre: "", valor: "", unidad: "" });
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-tenue max-w-3xl">
        Una cantidad puede depender de un parámetro: <b className="text-texto">cantidad = fija + por parámetro × valor</b>.
        Así la banda de 22 m es la de 20 m con otro largo. Cambiar aquí un valor mueve las cantidades, el costo y el precio
        de <b className="text-texto">este</b> artículo; para otra medida sin tocar este, usa «Duplicar con otros parámetros».
      </p>
      {parametros.length === 0 && !editar ? (
        <div className="tarjeta"><Vacio icono={SlidersHorizontal} titulo="Sin parámetros" texto="Sus cantidades son fijas." /></div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla [&_td]:py-1.5 [&_td]:align-top">
            <thead><tr><th className="w-40">Nombre</th><th className="text-right w-28">Valor</th><th className="w-24">Unidad</th><th className="w-56">Descripción</th><th>Qué depende de él</th>{editar && <th className="w-10" />}</tr></thead>
            <tbody>
              {parametros.map((p) => {
                const u = usos.get(p.nombre) ?? [];
                return (
                  <tr key={p.nombre} className="align-top">
                    <td className="pt-2.5"><code className="text-sm font-medium">{p.nombre}</code></td>
                    <td>{editar ? <CeldaNumero col="valor" valor={Number(p.valor)} etiqueta={`Valor de ${p.nombre}`} alGuardar={(v) => v != null && guardar(p, { valor: v })} />
                      : <span className="cifra">{cant(p.valor)}</span>}</td>
                    <td>{editar ? <CeldaTexto col="unidad" valor={p.unidad} etiqueta="Unidad" placeholder="m" alGuardar={(v) => guardar(p, { unidad: v })} /> : p.unidad}</td>
                    <td>{editar ? <CeldaTexto col="descripcion" valor={p.descripcion} etiqueta="Descripción" placeholder="Largo entre centros" alGuardar={(v) => guardar(p, { descripcion: v })} /> : p.descripcion}</td>
                    <td className="text-sm pt-2">
                      {u.length === 0 ? <span className="text-tenue">Nada todavía: elígelo en una línea de la lista o en una etapa de horas.</span>
                        : <ul className="space-y-0.5">{u.map((t) => { const i = t.indexOf(": "); return <li key={t} className="text-tenue"><span className="text-texto">{t.slice(0, i)}</span>{t.slice(i)}</li>; })}</ul>}
                    </td>
                    {editar && (
                      <td className="pt-2">
                        <button className="p-1 rounded text-tenue hover:text-peligro disabled:opacity-30" disabled={u.length > 0}
                          title={u.length ? "Primero quítalo de las líneas y horas que lo usan" : "Eliminar"} onClick={() => quitar(p)} aria-label="Eliminar parámetro">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editar && (
            <form onSubmit={agregar} className="flex flex-wrap items-center gap-2 border-t border-borde p-3 bg-fondo/50">
              <Entrada className="w-48" placeholder="largo_m" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} aria-label="Nombre del parámetro nuevo" />
              <Entrada className="w-28 text-right cifra" placeholder="20" inputMode="decimal" value={nuevo.valor} onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })} aria-label="Valor" />
              <Entrada className="w-24" placeholder="m" value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })} aria-label="Unidad" />
              <Boton type="submit" variante="secundario"><Plus className="h-4 w-4" /> Agregar parámetro</Boton>
              {nuevo.nombre && nombreParametro(nuevo.nombre) !== nuevo.nombre && <span className="text-xs text-tenue">Se guardará como <code>{nombreParametro(nuevo.nombre)}</code></span>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function useEtapas() {
  return useQuery({
    queryKey: ["costeo", "etapas"],
    queryFn: () => q<Etapa[]>(supabase.from("etapas").select("id, nombre, orden, color").eq("activa", true).order("orden")),
    staleTime: 10 * 60_000,
  });
}

/**
 * Horas hombre por etapa (sin contar las de sus subensambles, que traen las
 * suyas). Sirven para costear y para que producción planee la carga del taller.
 */
export function HorasEtapa({ articulo, parametros }: { articulo: ArticuloCatalogo; parametros: Parametro[] }) {
  const { puede } = useSesion();
  const editar = puede("costeo", 2);
  const costos = puede("costos");
  const qc = useQueryClient();
  const etapas = useEtapas();
  const ops = useOperaciones(articulo.id);
  const tarifas = useQuery({
    queryKey: ["costeo", "tarifas"],
    enabled: costos,
    queryFn: async () => new Map((await q<{ etapa_id: number; costo_hora: number }[]>(supabase.from("tarifas_mano_obra").select("etapa_id, costo_hora")))
      .map((t) => [t.etapa_id, Number(t.costo_hora)])),
  });

  async function guardar(etapa: Etapa, op: Operacion | undefined, cambios: Partial<Operacion>) {
    const fila = { horas: op?.horas ?? 0, parametro: op?.parametro ?? null, horas_por_parametro: op?.horas_por_parametro ?? 0, notas: op?.notas ?? null, ...cambios };
    if (!fila.parametro) fila.horas_por_parametro = 0;
    let r;
    if (!op) r = await supabase.from("bom_operaciones").insert({ articulo_id: articulo.id, etapa_id: etapa.id, ...fila });
    else if (!Number(fila.horas) && !Number(fila.horas_por_parametro) && !fila.notas) r = await supabase.from("bom_operaciones").delete().eq("id", op.id);
    else r = await supabase.from("bom_operaciones").update(cambios).eq("id", op.id);
    if (r.error) toast.error(mensajeError(r.error));
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }

  if (etapas.isLoading || ops.isLoading) return <Cargando filas={6} />;
  const propias = (ops.data ?? []).reduce((s, o) => s + Number(o.horas_operacion ?? 0), 0);
  const moPropia = tarifas.data ? (ops.data ?? []).reduce((s, o) => s + Number(o.horas_operacion ?? 0) * (tarifas.data!.get(o.etapa_id) ?? 0), 0) : null;
  const deSubensambles = articulo.horas != null ? Number(articulo.horas) - propias : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-tenue max-w-3xl">
        Horas de este {articulo.tipo} por etapa, <b className="text-texto">sin</b> las de sus subensambles (cada uno trae las suyas).
        Pueden depender de un parámetro: horas = fijas + por parámetro × valor. Producción usa estas mismas horas para planear el taller.
      </p>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla [&_td]:py-1">
          <thead>
            <tr>
              <th className="w-44">Etapa</th><th className="text-right w-28">Horas fijas</th><th className="w-32">Parámetro</th>
              <th className="text-right w-28 whitespace-nowrap" title="Horas que se suman por cada unidad del parámetro">h por parám.</th><th className="text-right w-24">Total</th>
              {costos && <th className="text-right w-28">Tarifa</th>}{costos && <th className="text-right w-32">Mano de obra</th>}
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {(etapas.data ?? []).map((e) => {
              const op = ops.data?.find((o) => o.etapa_id === e.id);
              const total = Number(op?.horas_operacion ?? 0);
              const tarifa = tarifas.data?.get(e.id);
              return (
                <tr key={e.id} className={total ? "" : "text-tenue"}>
                  <td><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />{e.nombre}</span></td>
                  <td>{editar ? <CeldaNumero col="horas" valor={op ? Number(op.horas) : null} placeholder="0" etiqueta={`Horas de ${e.nombre}`} alGuardar={(v) => guardar(e, op, { horas: v ?? 0 })} />
                    : <span className="cifra block text-right">{op ? cant(op.horas) : ""}</span>}</td>
                  <td>
                    {editar ? (
                      <select className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-sm hover:border-borde focus:border-marca outline-none"
                        value={op?.parametro ?? ""} aria-label={`Parámetro de ${e.nombre}`} disabled={!parametros.length}
                        onChange={(ev) => guardar(e, op, { parametro: ev.target.value || null, ...(ev.target.value ? {} : { horas_por_parametro: 0 }) })}>
                        <option value="">{parametros.length ? "—" : "sin parámetros"}</option>
                        {parametros.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    ) : <code className="text-xs">{op?.parametro ?? ""}</code>}
                  </td>
                  <td>{editar ? <CeldaNumero col="hpp" valor={op?.parametro ? Number(op.horas_por_parametro) : null} vacioEsNull deshabilitado={!op?.parametro} etiqueta="Horas por parámetro"
                    alGuardar={(v) => guardar(e, op, { horas_por_parametro: v ?? 0 })} />
                    : <span className="cifra block text-right">{op?.parametro ? cant(op.horas_por_parametro) : ""}</span>}</td>
                  <td className="text-right cifra font-medium">{total ? `${cant(total)} h` : "—"}</td>
                  {costos && <td className="text-right cifra text-tenue">{tarifa != null ? `${dinero(tarifa)}/h` : "—"}</td>}
                  {costos && <td className="text-right cifra">{total && tarifa != null ? dinero(total * tarifa) : "—"}</td>}
                  <td>{editar ? <CeldaTexto col="notas-h" valor={op?.notas} etiqueta="Notas" alGuardar={(v) => guardar(e, op, { notas: v })} /> : <span className="text-xs">{op?.notas}</span>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-fondo/60">
              <td className="font-medium">Total propias</td><td colSpan={3} />
              <td className="text-right cifra font-semibold">{numero(propias)} h</td>
              {costos && <td />}{costos && <td className="text-right cifra font-semibold">{dinero(moPropia)}</td>}
              <td className="text-sm text-tenue">
                {deSubensambles != null && deSubensambles > 0.001 && <>+ {numero(deSubensambles)} h de sus subensambles = <b className="text-texto">{numero(articulo.horas)} h</b> en total</>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!ops.data?.length && (
        <p className="text-sm text-tenue inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Todavía no tiene horas: escribe las horas de cada etapa; Enter baja a la siguiente.</p>
      )}
    </div>
  );
}

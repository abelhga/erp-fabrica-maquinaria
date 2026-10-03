import { Fragment, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, ArrowUpToLine, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, FolderInput,
  Layers, ListPlus, Loader2, PackageOpen, Trash2,
} from "lucide-react";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Vacio, Cargando, ErrorCarga } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CeldaCasilla, CeldaNumero, CeldaTexto } from "./Celdas";
import { cant, esFabricado, rutaArticulo, type ArticuloCatalogo, type Parametro } from "./comun";
import { claveArbol, llaveRuta, useArbol, useCostosDe, type CostoHijo, type LineaArbol } from "./datosLista";
import { DialogoConvertir, DialogoGrupo, DialogoUsarExistente } from "./DialogosSubensamble";

type CambioLinea = Partial<Pick<LineaArbol, "cantidad" | "parametro" | "por_parametro" | "redondear_arriba" | "merma" | "notas" | "grupo">>;

function formula(l: LineaArbol, parametros: Parametro[]) {
  if (!l.parametro) return null;
  const p = parametros.find((x) => x.nombre === l.parametro);
  const partes = `${cant(l.cantidad)} + ${cant(l.por_parametro)} × ${p ? cant(p.valor) : "?"} (${l.parametro})`;
  return `${partes}${l.redondear_arriba ? ", hacia arriba" : ""}${l.merma ? `, + ${cant(l.merma * 100)} % de merma` : ""} = ${cant(l.cantidad_efectiva)}`;
}

/**
 * Lista de materiales editable. Solo las líneas propias (nivel 1) se editan;
 * lo de adentro de un subensamble se muestra en gris con un enlace para
 * abrirlo, porque cambiarlo aquí lo cambiaría en todos los equipos que lo usan.
 */
export function ListaMateriales({ articulo, parametros }: { articulo: ArticuloCatalogo; parametros: Parametro[] }) {
  const { puede } = useSesion();
  const editar = puede("costeo", 2);
  const costos = puede("costos");
  const qc = useQueryClient();
  const arbol = useArbol(articulo.id);
  const ids = useMemo(() => [...new Set((arbol.data ?? []).map((l) => l.articulo_id))], [arbol.data]);
  const costosHijos = useCostosDe(ids, costos);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [grupoDestino, setGrupoDestino] = useState("");
  const [enfocar, setEnfocar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(0);
  const [dialogo, setDialogo] = useState<"convertir" | "usar" | "grupo" | null>(null);

  const nivel1 = useMemo(() => (arbol.data ?? []).filter((l) => l.nivel === 1), [arbol.data]);
  const hijos = useMemo(() => {
    const m = new Map<string, LineaArbol[]>();
    for (const l of arbol.data ?? []) {
      if (l.nivel === 1) continue;
      const k = llaveRuta(l.ruta.slice(0, -1));
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  }, [arbol.data]);
  const grupos = useMemo(() => {
    const orden: (string | null)[] = [];
    const m = new Map<string | null, LineaArbol[]>();
    for (const l of nivel1) {
      if (!m.has(l.grupo)) { m.set(l.grupo, []); orden.push(l.grupo); }
      m.get(l.grupo)!.push(l);
    }
    return orden.map((g) => ({ nombre: g, lineas: m.get(g)! }));
  }, [nivel1]);
  const nombresGrupo = grupos.map((g) => g.nombre).filter(Boolean) as string[];
  const usaParametros = parametros.length > 0 || nivel1.some((l) => l.parametro);
  const lineasElegidas = nivel1.filter((l) => elegidas.has(l.linea_id));
  const mapa = costosHijos.data;

  useEffect(() => { // limpia selección de líneas que ya no existen
    setElegidas((s) => new Set([...s].filter((id) => nivel1.some((l) => l.linea_id === id))));
  }, [nivel1]);
  useEffect(() => { if (enfocar) { const t = setTimeout(() => setEnfocar(null), 800); return () => clearTimeout(t); } }, [enfocar]);

  const refrescar = () => qc.invalidateQueries({ queryKey: ["costeo"] });
  async function ejecutar(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setGuardando((g) => g + 1);
    try {
      const { error } = await fn();
      if (error) throw error;
      return true;
    } catch (e) {
      toast.error(mensajeError(e));
      return false;
    } finally {
      setGuardando((g) => g - 1);
      refrescar();
    }
  }

  function actualizar(l: LineaArbol, cambios: CambioLinea) {
    qc.setQueryData<LineaArbol[]>(claveArbol(articulo.id), (prev) => prev?.map((x) => (x.linea_id === l.linea_id ? { ...x, ...cambios } : x)));
    ejecutar(() => supabase.from("bom_lineas").update(cambios).eq("id", l.linea_id));
  }

  async function insertar(a: { id: string }, extra: Partial<LineaArbol> = {}) {
    const orden = Math.max(0, ...nivel1.map((l) => l.orden)) + 10;
    setGuardando((g) => g + 1);
    const { data, error } = await supabase.from("bom_lineas")
      .insert({ padre_id: articulo.id, hijo_id: a.id, cantidad: 1, orden, grupo: grupoDestino.trim() || null, ...extra })
      .select("id").single();
    setGuardando((g) => g - 1);
    if (error) { toast.error(mensajeError(error)); return; }
    await qc.invalidateQueries({ queryKey: claveArbol(articulo.id) });
    setEnfocar(data.id);
    refrescar();
  }

  function agregar(a: ArticuloEncontrado) {
    if (a.id === articulo.id) { toast.error("Un artículo no puede llevarse a sí mismo."); return; }
    const ya = nivel1.find((l) => l.articulo_id === a.id);
    if (ya) {
      // Las líneas repetidas eran un error frecuente de la hoja: primero se ofrece ajustar la que ya está.
      setEnfocar(ya.linea_id);
      toast(`«${a.nombre}» ya está en la lista: ajusta su cantidad.`, { action: { label: "Agregar otra línea", onClick: () => insertar(a) } });
      return;
    }
    insertar(a);
  }

  async function quitar(lineas: LineaArbol[]) {
    if (!lineas.length) return;
    const ok = await ejecutar(() => supabase.from("bom_lineas").delete().in("id", lineas.map((l) => l.linea_id)));
    if (!ok) return;
    setElegidas(new Set());
    toast(lineas.length === 1 ? `Se quitó «${lineas[0].nombre}».` : `Se quitaron ${lineas.length} líneas.`, {
      action: {
        label: "Deshacer",
        onClick: () => ejecutar(() => supabase.from("bom_lineas").insert(lineas.map((l) => ({
          padre_id: articulo.id, hijo_id: l.articulo_id, cantidad: l.cantidad, parametro: l.parametro, por_parametro: l.por_parametro,
          redondear_arriba: l.redondear_arriba, merma: l.merma, grupo: l.grupo, notas: l.notas, orden: l.orden,
        })))),
      },
    });
  }

  function mover(l: LineaArbol, dir: -1 | 1) {
    const g = grupos.find((x) => x.lineas.includes(l));
    if (!g) return;
    const i = g.lineas.indexOf(l);
    const j = i + dir;
    if (j < 0 || j >= g.lineas.length) return;
    const nuevas = [...g.lineas];
    [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]];
    const orden = grupos.flatMap((x) => (x === g ? nuevas : x.lineas)).map((x) => x.linea_id);
    qc.setQueryData<LineaArbol[]>(claveArbol(articulo.id), (prev) => {
      if (!prev) return prev;
      const pos = new Map(orden.map((id, k) => [id, (k + 1) * 10]));
      const n1 = prev.filter((x) => x.nivel === 1).map((x) => ({ ...x, orden: pos.get(x.linea_id) ?? x.orden })).sort((a, b) => a.orden - b.orden);
      return [...n1, ...prev.filter((x) => x.nivel > 1)];
    });
    ejecutar(() => supabase.rpc("reordenar_bom", { p_padre: articulo.id, p_lineas: orden }));
  }

  function renombrarGrupo(viejo: string | null, nuevo: string | null) {
    const ids = nivel1.filter((l) => l.grupo === viejo).map((l) => l.linea_id);
    ejecutar(() => supabase.from("bom_lineas").update({ grupo: nuevo }).in("id", ids));
  }

  const alternar = (id: string) => setElegidas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandibles = nivel1.filter((l) => l.lineas_hijo > 0);
  const todoAbierto = expandibles.length > 0 && expandibles.every((l) => abiertos.has(l.linea_id));
  const sumaLista = mapa ? nivel1.reduce((s, l) => s + l.cantidad_efectiva * (mapa.get(l.articulo_id)?.costo_total ?? 0), 0) : null;
  const columnas = 5 + (usaParametros ? 1 : 0) + (costos ? 1 : 0) + (editar ? 2 : 0);

  if (arbol.isLoading) return <Cargando filas={8} />;
  if (arbol.error) return <ErrorCarga error={arbol.error} />;

  return (
    <div className="space-y-3">
      {editar && (
        <div className="flex flex-wrap items-center gap-2">
          <BuscadorArticulo className="flex-1 min-w-[260px] max-w-xl" alElegir={agregar} mostrarPrecio={!costos}
            placeholder="Agregar: escribe clave o nombre y Enter (entra con cantidad 1)…" />
          <div className="flex items-center gap-1.5 text-sm text-tenue">
            en
            <input list="grupos-bom" value={grupoDestino} onChange={(e) => setGrupoDestino(e.target.value)} placeholder="sin grupo"
              className="campo h-9 w-40" aria-label="Grupo para las líneas nuevas" />
            <datalist id="grupos-bom">{nombresGrupo.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <Boton variante="secundario" onClick={() => { setElegidas(new Set()); setDialogo("usar"); }}>
            <Layers className="h-4 w-4" /> Agregar subensamble existente
          </Boton>
          <span className="ml-auto text-xs text-tenue inline-flex items-center gap-1.5 min-w-[90px] justify-end">
            {guardando > 0 ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</> : "Se guarda solo"}
          </span>
        </div>
      )}

      {lineasElegidas.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-marca/30 bg-marca-suave px-3 py-2 text-sm">
          <b>{lineasElegidas.length} {lineasElegidas.length === 1 ? "línea elegida" : "líneas elegidas"}</b>
          <Boton tamano="sm" onClick={() => setDialogo("convertir")}><PackageOpen className="h-3.5 w-3.5" /> Convertir en subensamble</Boton>
          <Boton tamano="sm" variante="secundario" onClick={() => setDialogo("usar")}><Layers className="h-3.5 w-3.5" /> Usar subensamble existente</Boton>
          <Boton tamano="sm" variante="secundario" onClick={() => setDialogo("grupo")}><FolderInput className="h-3.5 w-3.5" /> Mover a grupo</Boton>
          <Boton tamano="sm" variante="fantasma" className="text-peligro" onClick={() => quitar(lineasElegidas)}><Trash2 className="h-3.5 w-3.5" /> Quitar</Boton>
          <button className="ml-auto text-tenue hover:text-texto" onClick={() => setElegidas(new Set())}>Cancelar</button>
        </div>
      )}

      {nivel1.length === 0 ? (
        <div className="tarjeta">
          <Vacio icono={ListPlus} titulo="La lista de materiales está vacía"
            texto={editar ? "Escribe arriba la clave o el nombre de un componente y presiona Enter; entra con cantidad 1 y el cursor queda en la cantidad." : "Ingeniería todavía no captura este equipo."} />
        </div>
      ) : (
        <div className="tarjeta overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabla [&_td]:py-1 [&_td]:px-2 [&_th]:px-2">
              <thead>
                <tr>
                  {editar && <th className="w-8">
                    <CeldaCasilla etiqueta="Elegir todas" valor={elegidas.size > 0 && elegidas.size === nivel1.length}
                      alCambiar={(v) => setElegidas(v ? new Set(nivel1.map((l) => l.linea_id)) : new Set())} />
                  </th>}
                  <th className="min-w-[260px]">
                    <span className="inline-flex items-center gap-2">
                      Artículo
                      {expandibles.length > 0 && (
                        <button className="normal-case tracking-normal font-normal text-marca-texto inline-flex items-center gap-1"
                          onClick={() => setAbiertos(todoAbierto ? new Set() : new Set(expandibles.map((l) => l.linea_id)))}>
                          {todoAbierto ? <><ChevronsDownUp className="h-3.5 w-3.5" /> cerrar subensambles</> : <><ChevronsUpDown className="h-3.5 w-3.5" /> ver contenido</>}
                        </button>
                      )}
                    </span>
                  </th>
                  <th className="text-right w-20">Cantidad</th>
                  {usaParametros && <th className="w-[200px]" title="Cantidad que se suma por cada unidad del parámetro (largo_m…)">Por parámetro</th>}
                  <th className="w-10 text-center" title="Redondear hacia arriba a piezas enteras"><ArrowUpToLine className="h-3.5 w-3.5 inline" /></th>
                  <th className="text-right w-16">Merma</th>
                  <th className="text-right w-24">Efectiva</th>
                  {costos && <th className="text-right w-32">Importe</th>}
                  {editar && <th className="w-20" />}
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const subtotal = mapa ? g.lineas.reduce((s, l) => s + l.cantidad_efectiva * (mapa.get(l.articulo_id)?.costo_total ?? 0), 0) : null;
                  return (
                    <Fragment key={g.nombre ?? "__sin"}>
                      {(grupos.length > 1 || g.nombre) && (
                        <tr className="bg-fondo/70 hover:bg-fondo/70">
                          <td colSpan={columnas} className="py-1.5">
                            <div className="flex items-center gap-3">
                              {editar ? (
                                <CeldaTexto valor={g.nombre} placeholder="Sin grupo" etiqueta="Nombre del grupo" className="font-semibold max-w-[260px]"
                                  alGuardar={(v) => renombrarGrupo(g.nombre, v)} />
                              ) : <span className="font-semibold px-1.5">{g.nombre ?? "Sin grupo"}</span>}
                              <span className="text-xs text-tenue whitespace-nowrap">{g.lineas.length} {g.lineas.length === 1 ? "línea" : "líneas"}</span>
                              {subtotal != null && <span className="ml-auto text-sm cifra font-medium pr-2">{dinero(subtotal)}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      {g.lineas.map((l, k) => (
                        <FilaLinea key={l.linea_id} l={l} parametros={parametros} usaParametros={usaParametros} editar={editar} costos={costos}
                          mapa={mapa} elegida={elegidas.has(l.linea_id)} alElegir={() => alternar(l.linea_id)}
                          abierta={abiertos.has(l.linea_id)} alAbrir={() => setAbiertos((s) => { const n = new Set(s); if (n.has(l.linea_id)) n.delete(l.linea_id); else n.add(l.linea_id); return n; })}
                          enfocar={enfocar === l.linea_id} primera={k === 0} ultima={k === g.lineas.length - 1}
                          alCambiar={(c) => actualizar(l, c)} alMover={(d) => mover(l, d)} alQuitar={() => quitar([l])}
                          hijos={hijos} columnas={columnas} />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
              {costos && sumaLista != null && (
                <tfoot>
                  <tr className="bg-fondo/60">
                    <td colSpan={columnas} className="py-2.5">
                      <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 text-sm pr-2">
                        <span className="text-tenue">Suma de la lista <b className="text-texto cifra ml-2">{dinero(sumaLista)}</b></span>
                        <span className="text-tenue">Mano de obra propia <b className="text-texto cifra ml-2">{dinero(Math.max((articulo.costo_total ?? 0) - sumaLista, 0))}</b></span>
                        <span className="text-tenue">Costo del {articulo.tipo} <b className="text-texto cifra ml-2">{dinero(articulo.costo_total)}</b></span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
      {editar && nivel1.length > 0 && (
        <p className="text-xs text-tenue">
          Enter guarda y baja a la siguiente fila · Tab avanza · Esc deshace · Alt+↑/↓ mueve la línea · marca varias líneas para volverlas subensamble.
          {!usaParametros && " Para que una cantidad dependa del largo o ancho, define el parámetro en la pestaña Parámetros."}
        </p>
      )}

      <DialogoConvertir abierto={dialogo === "convertir"} alCambiar={(v) => !v && setDialogo(null)} padre={articulo}
        lineas={lineasElegidas} alTerminar={() => setElegidas(new Set())} />
      <DialogoUsarExistente abierto={dialogo === "usar"} alCambiar={(v) => !v && setDialogo(null)} padre={articulo}
        lineas={lineasElegidas} grupo={grupoDestino.trim() || null} alTerminar={() => setElegidas(new Set())} />
      <DialogoGrupo abierto={dialogo === "grupo"} alCambiar={(v) => !v && setDialogo(null)} padre={articulo.id}
        lineas={lineasElegidas} grupos={nombresGrupo} alTerminar={() => setElegidas(new Set())} />
    </div>
  );
}

function FilaLinea({ l, parametros, usaParametros, editar, costos, mapa, elegida, alElegir, abierta, alAbrir, enfocar, primera, ultima,
  alCambiar, alMover, alQuitar, hijos, columnas }: {
  l: LineaArbol; parametros: Parametro[]; usaParametros: boolean; editar: boolean; costos: boolean; mapa: Map<string, CostoHijo> | undefined;
  elegida: boolean; alElegir: () => void; abierta: boolean; alAbrir: () => void; enfocar: boolean; primera: boolean; ultima: boolean;
  alCambiar: (c: CambioLinea) => void; alMover: (d: -1 | 1) => void; alQuitar: () => void; hijos: Map<string, LineaArbol[]>; columnas: number;
}) {
  const c = mapa?.get(l.articulo_id);
  const sinCosto = costos && c && !esFabricado(l.tipo) && !c.costo_total;
  const fab = esFabricado(l.tipo);
  const f = formula(l, parametros);
  const teclas = (e: KeyboardEvent) => {
    if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); alMover(-1); }
    if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); alMover(1); }
  };
  return (
    <>
      <tr onKeyDown={teclas} className={cn(elegida && "bg-marca-suave/60", sinCosto && "bg-peligro-suave/50")}>
        {editar && <td><CeldaCasilla etiqueta={`Elegir ${l.nombre}`} valor={elegida} alCambiar={alElegir} /></td>}
        <td>
          <div className="flex items-center gap-1.5 min-w-0">
            {l.lineas_hijo > 0 ? (
              <button onClick={alAbrir} className="p-0.5 rounded hover:bg-fondo text-tenue" aria-label={abierta ? "Ocultar contenido" : "Ver contenido"}>
                {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : <span className="w-5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <Link to={rutaArticulo({ id: l.articulo_id, tipo: l.tipo })} className="flex items-center gap-1.5 group" title="Abrir su ficha">
                {fab && <Layers className="h-3.5 w-3.5 text-marca shrink-0" aria-label={l.tipo} />}
                <span className="truncate max-w-[320px] group-hover:underline">{l.nombre}</span>
                {costos && fab && (c?.sin_costo ?? 0) > 0 && <Insignia tono="peligro" className="shrink-0">{c!.sin_costo} sin costo</Insignia>}
              </Link>
              <div className="flex items-center gap-1 text-xs text-tenue">
                <span className="cifra whitespace-nowrap">{l.clave} · {l.unidad}{fab ? ` · ${l.tipo}` : ""}</span>
                {editar
                  ? <CeldaTexto col="notas" valor={l.notas} etiqueta="Nota de la línea" placeholder="+ nota" alGuardar={(v) => alCambiar({ notas: v })}
                      className="h-5 text-xs px-1 max-w-[260px] placeholder:text-transparent hover:placeholder:text-tenue focus:placeholder:text-tenue" />
                  : l.notas && <span className="truncate">· {l.notas}</span>}
              </div>
            </div>
          </div>
        </td>
        <td className="text-right">
          {editar ? <CeldaNumero col="cantidad" valor={l.cantidad} autoFocus={enfocar} etiqueta="Cantidad" alGuardar={(v) => alCambiar({ cantidad: v ?? 0 })} />
            : <span className="cifra">{cant(l.cantidad)}</span>}
        </td>
        {usaParametros && (
          <td className="whitespace-nowrap">
            {editar ? (
              <div className="flex items-center gap-1">
                <span className="text-tenue text-xs">+</span>
                <CeldaNumero col="por_parametro" valor={l.parametro ? l.por_parametro : null} vacioEsNull deshabilitado={!l.parametro}
                  etiqueta="Cantidad por unidad del parámetro" className="w-16" alGuardar={(v) => alCambiar({ por_parametro: v ?? 0 })} />
                <span className="text-tenue text-xs">×</span>
                <select className="h-7 w-[92px] rounded-md border border-transparent bg-transparent px-1 text-sm hover:border-borde focus:border-marca outline-none"
                  value={l.parametro ?? ""} aria-label="Parámetro"
                  onChange={(e) => alCambiar({ parametro: e.target.value || null, ...(e.target.value ? {} : { por_parametro: 0 }) })}>
                  <option value="">—</option>
                  {parametros.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                  {l.parametro && !parametros.some((p) => p.nombre === l.parametro) && <option value={l.parametro}>{l.parametro} (no definido)</option>}
                </select>
              </div>
            ) : l.parametro ? <span className="cifra text-sm">+ {cant(l.por_parametro)} × <code className="text-xs">{l.parametro}</code></span> : null}
          </td>
        )}
        <td className="text-center">
          {editar ? <CeldaCasilla etiqueta="Redondear hacia arriba a piezas enteras" valor={l.redondear_arriba}
            alCambiar={(v) => alCambiar({ redondear_arriba: v })} />
            : l.redondear_arriba && <ArrowUpToLine className="h-3.5 w-3.5 inline text-tenue" aria-label="Se redondea hacia arriba" />}
        </td>
        <td className="text-right">
          {editar ? <CeldaNumero col="merma" valor={l.merma || null} vacioEsNull porcentaje etiqueta="Merma en %" placeholder="0" alGuardar={(v) => alCambiar({ merma: Math.min(Math.max(v ?? 0, 0), 0.95) })} />
            : <span className="cifra">{l.merma ? `${cant(l.merma * 100)} %` : ""}</span>}
        </td>
        <td className="text-right whitespace-nowrap cifra" title={f ?? undefined}>
          <span className={cn(f && "underline decoration-dotted decoration-tenue underline-offset-4")}>{cant(l.cantidad_efectiva)}</span>
          <span className="text-xs text-tenue ml-1">{l.unidad}</span>
        </td>
        {costos && (
          <td className="text-right cifra whitespace-nowrap">
            {sinCosto ? <Insignia tono="peligro">sin costo</Insignia> : <span className="font-medium">{c ? dinero(l.cantidad_efectiva * c.costo_total) : "—"}</span>}
            {c && !sinCosto && <span className="block text-xs text-tenue">{dinero(c.costo_total)} c/u</span>}
          </td>
        )}
        {editar && (
          <td className="whitespace-nowrap text-right">
            <button className="p-0.5 rounded text-tenue hover:text-texto hover:bg-fondo disabled:opacity-30" disabled={primera} onClick={() => alMover(-1)} aria-label="Subir" title="Subir (Alt+↑)"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button className="p-0.5 rounded text-tenue hover:text-texto hover:bg-fondo disabled:opacity-30" disabled={ultima} onClick={() => alMover(1)} aria-label="Bajar" title="Bajar (Alt+↓)"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button className="p-0.5 ml-0.5 rounded text-tenue hover:text-peligro hover:bg-peligro-suave" onClick={alQuitar} aria-label="Quitar línea" title="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>
          </td>
        )}
      </tr>
      {abierta && <Contenido ruta={l.ruta} hijos={hijos} mapa={mapa} costos={costos} editar={editar} usaParametros={usaParametros} columnas={columnas} padre={l} />}
    </>
  );
}

/** Contenido de un subensamble dentro del padre: gris y de solo lectura, con enlace para abrirlo. */
function Contenido({ ruta, hijos, mapa, costos, editar, usaParametros, columnas, padre }: {
  ruta: string[]; hijos: Map<string, LineaArbol[]>; mapa: Map<string, CostoHijo> | undefined; costos: boolean; editar: boolean;
  usaParametros: boolean; columnas: number; padre: LineaArbol;
}) {
  const filas: LineaArbol[] = [];
  const recorrer = (r: string[]) => { for (const h of hijos.get(llaveRuta(r)) ?? []) { filas.push(h); recorrer(h.ruta); } };
  recorrer(ruta);
  // Lo que el subensamble cuesta de más sobre sus piezas directas: sus propias horas.
  const directas = filas.filter((h) => h.nivel === padre.nivel + 1);
  const cp = mapa?.get(padre.articulo_id);
  const moPropia = mapa && cp ? padre.cantidad_efectiva * cp.costo_total - directas.reduce((s2, h) => s2 + h.cantidad_total * (mapa.get(h.articulo_id)?.costo_total ?? 0), 0) : null;
  return (
    <>
      {filas.map((h) => {
        const c = mapa?.get(h.articulo_id);
        const sinCosto = costos && c && !esFabricado(h.tipo) && !c.costo_total;
        return (
          <tr key={h.ruta.join("/")} className={cn("text-tenue bg-fondo/40", sinCosto && "bg-peligro-suave/40")}>
            {editar && <td />}
            <td>
              <div className="flex items-center gap-1.5 min-w-0" style={{ paddingLeft: (h.nivel - 1) * 18 + 20 }}>
                <span className="border-l-2 border-borde h-6 mr-1" />
                <span className="min-w-0">
                  <span className="block truncate max-w-[300px]">{h.nombre}</span>
                  <span className="block text-xs cifra truncate max-w-[300px]">{h.clave} · {h.unidad}{h.notas ? ` · ${h.notas}` : ""}</span>
                </span>
                {sinCosto && <Insignia tono="peligro" className="shrink-0">sin costo</Insignia>}
              </div>
            </td>
            <td className="text-right cifra text-xs" title="Por cada pieza del subensamble">{cant(h.cantidad_efectiva)} c/u</td>
            {usaParametros && <td className="text-xs">{h.parametro ? <>+ {cant(h.por_parametro)} × <code>{h.parametro}</code></> : ""}</td>}
            <td /><td />
            <td className="text-right cifra whitespace-nowrap">{cant(h.cantidad_total)} <span className="text-xs">{h.unidad}</span></td>
            {costos && (
              <td className="text-right cifra whitespace-nowrap">
                {c && (sinCosto ? "—" : dinero(h.cantidad_total * c.costo_total))}
                {c && !sinCosto && <span className="block text-xs">{dinero(c.costo_total)} c/u</span>}
              </td>
            )}
            {editar && <td />}
          </tr>
        );
      })}
      <tr className="bg-fondo/40">
        <td colSpan={columnas} className="py-1.5 text-xs text-tenue" style={{ paddingLeft: editar ? 64 : 40 }}>
          {moPropia != null && moPropia > 0.005 && <>Además lleva {dinero(moPropia)} de mano de obra propia. </>}
          Esto se edita en el subensamble y cambia en todos los equipos que lo usan.{" "}
          <Link to={rutaArticulo({ id: padre.articulo_id, tipo: padre.tipo }) + "?pestana=lista"} className="text-marca-texto hover:underline inline-flex items-center gap-1">
            Abrir {padre.clave} <ExternalLink className="h-3 w-3" />
          </Link>
        </td>
      </tr>
    </>
  );
}

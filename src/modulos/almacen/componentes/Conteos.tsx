import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, ClipboardList, Lock, Plus, Search } from "lucide-react";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { Filtro } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, numero } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";
import { CantidadConSigno, useAlmacenes } from "./comun";

interface Conteo {
  id: string; nombre: string; almacen_id: number; almacen: string; estado: "abierto" | "cerrado"; creado_por_nombre: string | null;
  creado_en: string; cerrado_en: string | null; capturados: number; en_sistema: number; ajustes: number; ajustes_pendientes: number;
}
interface LineaCaptura {
  articulo_id: string; clave: string; nombre: string; unidad: string; sistema: number; contada: number | null; diferencia: number | null;
  contado_por: string | null; contado_en: string | null; valor_diferencia: number | null;
}

/** Conteos físicos: reemplazan las hojas C1, C2 e INVENTARIADO. Cerrar uno convierte cada diferencia en un ajuste por autorizar. */
export function Conteos({ irAAjustes }: { irAAjustes: () => void }) {
  const [params, setParams] = useSearchParams();
  const abierto = params.get("conteo");
  const abrir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set("conteo", id); else p.delete("conteo");
    setParams(p, { replace: true });
  };
  return abierto ? <Captura id={abierto} volver={() => abrir(null)} irAAjustes={irAAjustes} /> : <Lista abrir={abrir} />;
}

function Lista({ abrir }: { abrir: (id: string) => void }) {
  const { puede } = useSesion();
  const almacenes = useAlmacenes();
  const [nombre, setNombre] = useState("");
  const [almacen, setAlmacen] = useState("");
  const conteos = useQuery({
    queryKey: ["v_conteos"],
    queryFn: () => q<Conteo[]>(supabase.from("v_conteos").select("*").order("estado").order("creado_en", { ascending: false }).limit(100)),
  });
  const crear = useAccion(async () => {
    const al = almacenes.data!.find((a) => a.id === Number(almacen))!;
    const n = nombre.trim() || `${al.nombre} · ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;
    return q<{ id: string }>(supabase.from("conteos").insert({ nombre: n, almacen_id: al.id }).select("id").single());
  }, { exito: "Conteo abierto: captura lo que hay en cada estante", invalidar: [["v_conteos"]], alTerminar: (r) => abrir(r.id) });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr] items-start">
      {puede("inventario", 2) ? (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Nuevo conteo" descripcion="Un almacén a la vez. Lo que no se capture no se ajusta." />
          <form className="px-5 pb-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (almacen) crear.mutate(undefined); }}>
            <Seleccion value={almacen} onChange={(e) => setAlmacen(e.target.value)} aria-label="Almacén">
              <option value="">Elige el almacén…</option>
              {(almacenes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Seleccion>
            <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (opcional): cierre de octubre…" />
            <Boton type="submit" className="w-full" disabled={!almacen} cargando={crear.isPending}><Plus className="h-4 w-4" /> Empezar a contar</Boton>
          </form>
        </Tarjeta>
      ) : <Tarjeta className="p-5 text-sm text-tenue">Los conteos los captura almacén. Aquí ves su avance y sus diferencias.</Tarjeta>}

      <Tarjeta className="overflow-hidden">
        <EncabezadoTarjeta titulo="Conteos" descripcion="Abiertos primero" />
        {conteos.error ? <ErrorCarga error={conteos.error} /> : conteos.isLoading ? <Cargando filas={3} /> : (conteos.data?.length ?? 0) === 0 ? (
          <Vacio icono={ClipboardList} titulo="Todavía no hay conteos" texto="Abre uno por almacén: la lista de artículos sale del sistema y tú capturas lo que hay." />
        ) : (
          <ul className="divide-y divide-borde">
            {conteos.data!.map((c) => (
              <li key={c.id}>
                <button onClick={() => abrir(c.id)} className="w-full text-left px-5 py-3 hover:bg-fondo flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.nombre}</p>
                    <p className="text-xs text-tenue">{c.almacen} · {c.creado_por_nombre ?? "—"} · {fecha(c.creado_en)}</p>
                  </div>
                  {c.estado === "abierto" ? (
                    <div className="text-right">
                      <Insignia tono="marca" punto>Abierto</Insignia>
                      <p className="text-xs text-tenue mt-1 cifra">{numero(c.capturados)} de {numero(c.en_sistema)} contados</p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <Insignia tono="neutro">Cerrado {fecha(c.cerrado_en)}</Insignia>
                      <p className="text-xs text-tenue mt-1">{c.ajustes} ajuste(s){c.ajustes_pendientes ? `, ${c.ajustes_pendientes} por autorizar` : ""}</p>
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

type FiltroCaptura = "todos" | "pendientes" | "contados" | "diferencias";

function Captura({ id, volver, irAAjustes }: { id: string; volver: () => void; irAAjustes: () => void }) {
  const { puede } = useSesion();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroCaptura>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [cerrando, setCerrando] = useState(false);
  const entradas = useRef(new Map<string, HTMLInputElement>());
  const verCostos = puede("costos", 1);

  const conteo = useQuery({ queryKey: ["v_conteos", id], queryFn: () => q<Conteo>(supabase.from("v_conteos").select("*").eq("id", id).single()) });
  const lineas = useQuery({ queryKey: ["conteo_captura", id], queryFn: () => q<LineaCaptura[]>(supabase.rpc("conteo_captura", { p_conteo: id })) });
  const editable = conteo.data?.estado === "abierto" && puede("inventario", 2);

  const visibles = useMemo(() => (lineas.data ?? []).filter((l) => {
    if (busqueda && !coincide(`${l.clave} ${l.nombre}`, busqueda)) return false;
    if (filtro === "pendientes") return l.contada == null;
    if (filtro === "contados") return l.contada != null;
    if (filtro === "diferencias") return l.contada != null && Number(l.diferencia) !== 0;
    return true;
  }), [lineas.data, filtro, busqueda]);
  const mostradas = visibles.slice(0, 400);

  const resumen = useMemo(() => {
    const c = (lineas.data ?? []).filter((l) => l.contada != null);
    const dif = c.filter((l) => Number(l.diferencia) !== 0);
    return {
      contados: c.length, total: lineas.data?.length ?? 0, diferencias: dif.length,
      sobrantes: dif.filter((l) => Number(l.diferencia) > 0).length, faltantes: dif.filter((l) => Number(l.diferencia) < 0).length,
      valor: dif.reduce((s, l) => s + Number(l.valor_diferencia ?? 0), 0),
    };
  }, [lineas.data]);

  // Enter baja de inmediato al siguiente renglón y guarda en segundo plano; el
  // blur del renglón que se deja no vuelve a guardar lo mismo.
  const enviado = useRef(new Map<string, number>());
  async function guardar(l: LineaCaptura) {
    const texto = valores[l.articulo_id];
    if (texto == null || texto === "") return;
    const n = Number(texto.replace(",", "."));
    if (Number.isNaN(n) || n < 0) { toast.error("La cantidad contada no puede ser negativa"); return; }
    if (enviado.current.get(l.articulo_id) === n || (enviado.current.get(l.articulo_id) == null && l.contada != null && Number(l.contada) === n)) return;
    enviado.current.set(l.articulo_id, n);
    const { error } = await supabase.from("conteo_lineas").upsert({ conteo_id: id, articulo_id: l.articulo_id, cantidad_contada: n }, { onConflict: "conteo_id,articulo_id" });
    if (error) { enviado.current.delete(l.articulo_id); toast.error(mensajeError(error)); return; }
    setGuardados((s) => new Set(s).add(l.articulo_id));
    qc.invalidateQueries({ queryKey: ["conteo_captura", id] });
    qc.invalidateQueries({ queryKey: ["v_conteos"] });
  }
  const irA = (articuloId?: string) => { if (!articuloId) return; const e = entradas.current.get(articuloId); e?.focus(); e?.select(); };

  async function agregar(articuloId: string) {
    if (!(lineas.data ?? []).some((l) => l.articulo_id === articuloId)) {
      const { error } = await supabase.from("conteo_lineas").upsert({ conteo_id: id, articulo_id: articuloId, cantidad_contada: 0 }, { onConflict: "conteo_id,articulo_id" });
      if (error) { toast.error(mensajeError(error)); return; }
      await qc.invalidateQueries({ queryKey: ["conteo_captura", id] });
    }
    setFiltro("todos"); setBusqueda("");
    setTimeout(() => { const e = entradas.current.get(articuloId); e?.focus(); e?.select(); }, 150);
  }

  const cerrar = useAccion(() => q<number>(supabase.rpc("cerrar_conteo", { p_conteo: id })), {
    exito: (n) => n ? `Conteo cerrado: ${n} ajuste(s) quedaron por autorizar` : "Conteo cerrado: todo cuadró, no hubo ajustes",
    invalidar: [["v_conteos"], ["v_ajustes"], ["ajustes_pendientes_cuenta"], ["conteo_captura", id]],
    alTerminar: (n) => { setCerrando(false); if (n) irAAjustes(); },
  });

  if (conteo.error) return <ErrorCarga error={conteo.error} />;
  const c = conteo.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="fantasma" tamano="sm" onClick={volver}><ArrowLeft className="h-4 w-4" /> Conteos</Boton>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold truncate">{c?.nombre ?? "Conteo"}</h2>
          <p className="text-sm text-tenue">{c?.almacen} · abrió {c?.creado_por_nombre ?? "—"} el {fecha(c?.creado_en)}
            {c?.estado === "cerrado" && <> · cerrado el {fecha(c.cerrado_en)}</>}</p>
        </div>
        {editable && <Boton onClick={() => setCerrando(true)} disabled={!resumen.contados}><Lock className="h-4 w-4" /> Cerrar conteo</Boton>}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Resumen titulo="Contados" valor={`${numero(resumen.contados)} / ${numero(resumen.total)}`}
          barra={resumen.total ? resumen.contados / resumen.total : 0} />
        <Resumen titulo="Con diferencia" valor={numero(resumen.diferencias)} tono={resumen.diferencias ? "aviso" : undefined} />
        <Resumen titulo="Sobran · faltan" valor={`${numero(resumen.sobrantes)} · ${numero(resumen.faltantes)}`} />
        {verCostos ? <Resumen titulo="Valor neto de diferencias" valor={dinero(resumen.valor)} tono={resumen.valor < 0 ? "peligro" : undefined} />
          : <Resumen titulo="Estado" valor={c?.estado === "abierto" ? "Abierto" : "Cerrado"} />}
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-borde">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="h-4 w-4 text-tenue absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="campo pl-9" placeholder="Buscar en este almacén…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <Filtro<FiltroCaptura> valor={filtro} alCambiar={setFiltro} opciones={[
            { valor: "todos", texto: "Todos" }, { valor: "pendientes", texto: "Sin contar", cuenta: resumen.total - resumen.contados },
            { valor: "contados", texto: "Contados", cuenta: resumen.contados }, { valor: "diferencias", texto: "Con diferencia", cuenta: resumen.diferencias },
          ]} />
          {editable && (
            <div className="w-full sm:w-72 sm:ml-auto">
              <BuscadorArticulo alElegir={(a) => agregar(a.id)} tipos={["componente", "materia_prima"]} mostrarPrecio={false}
                placeholder="¿Encontraste algo que no está? Agrégalo…" />
            </div>
          )}
        </div>
        {lineas.error ? <ErrorCarga error={lineas.error} /> : lineas.isLoading ? <Cargando /> : visibles.length === 0 ? (
          <Vacio icono={ClipboardList} titulo={filtro === "diferencias" ? "Sin diferencias por ahora" : "Nada con este filtro"} texto="Cambia el filtro o busca otro artículo." />
        ) : (
          <div className="overflow-x-auto max-h-[64vh]">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="hidden sm:table-cell">Clave</th><th>Artículo</th>
                  <th className="text-right">Sistema</th><th className="text-right w-32">Contado</th><th className="text-right">Diferencia</th>
                  {verCostos && <th className="text-right hidden md:table-cell">Valor</th>}
                  <th className="hidden lg:table-cell">Contó</th>
                </tr>
              </thead>
              <tbody>
                {mostradas.map((l, i) => {
                  const sig = mostradas[i + 1]?.articulo_id;
                  const texto = valores[l.articulo_id] ?? (l.contada == null ? "" : String(Number(l.contada)));
                  const dif = l.contada == null ? null : Number(l.diferencia);
                  return (
                    <tr key={l.articulo_id} className={cn(dif != null && dif !== 0 && "bg-aviso-suave/40")}>
                      <td className="hidden sm:table-cell text-tenue whitespace-nowrap text-xs">{l.clave}</td>
                      <td className="max-w-[300px]"><p className="truncate text-sm">{l.nombre}</p><p className="text-xs text-tenue">{l.unidad}</p></td>
                      <td className="text-right cifra text-tenue">{numero(l.sistema)}</td>
                      <td className="text-right">
                        {editable ? (
                          <div className="relative">
                            <input
                              ref={(e) => { if (e) entradas.current.set(l.articulo_id, e); else entradas.current.delete(l.articulo_id); }}
                              inputMode="decimal" className={cn("campo h-8 text-right cifra pr-7", guardados.has(l.articulo_id) && "border-ok/60")}
                              value={texto} placeholder="—" aria-label={`Contado de ${l.nombre}`}
                              onChange={(e) => setValores((v) => ({ ...v, [l.articulo_id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); guardar(l); irA(sig); }
                                if (e.key === "ArrowUp") { e.preventDefault(); guardar(l); irA(mostradas[i - 1]?.articulo_id); }
                                if (e.key === "Escape") setValores((v) => { const n = { ...v }; delete n[l.articulo_id]; return n; });
                              }}
                              onBlur={() => guardar(l)}
                            />
                            {l.contada != null && <Check className="h-3.5 w-3.5 text-ok absolute right-2 top-1/2 -translate-y-1/2" />}
                          </div>
                        ) : <span className="cifra">{l.contada == null ? "—" : numero(l.contada)}</span>}
                      </td>
                      <td className="text-right">{dif == null ? <span className="text-tenue/50">·</span> : <CantidadConSigno n={dif} />}</td>
                      {verCostos && <td className="text-right cifra hidden md:table-cell text-xs">{l.valor_diferencia ? dinero(l.valor_diferencia) : ""}</td>}
                      <td className="hidden lg:table-cell text-xs text-tenue whitespace-nowrap">{l.contado_por ? `${l.contado_por} · ${fechaYHora(l.contado_en)}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibles.length > mostradas.length && (
              <p className="p-3 text-center text-sm text-tenue">Se muestran 400 de {numero(visibles.length)}. Busca o filtra para llegar al resto.</p>
            )}
          </div>
        )}
        {editable && <p className="border-t border-borde px-3 py-2 text-xs text-tenue">Escribe la cantidad y Enter: guarda y baja al siguiente. Esc deshace lo escrito. Quién contó y la hora las pone el servidor.</p>}
      </Tarjeta>

      <Dialogo abierto={cerrando} alCambiar={setCerrando} titulo="¿Cerrar el conteo?"
        descripcion="Cada diferencia se vuelve un ajuste que debe autorizar la gerencia. Lo que no contaste no se ajusta."
        pie={<><Boton variante="secundario" onClick={() => setCerrando(false)}>Seguir contando</Boton>
          <Boton onClick={() => cerrar.mutate(undefined)} cargando={cerrar.isPending}>Cerrar y pedir {resumen.diferencias} ajuste(s)</Boton></>}>
        <ul className="text-sm space-y-1.5">
          <li><b className="cifra">{numero(resumen.contados)}</b> artículos contados de {numero(resumen.total)} en {c?.almacen}.</li>
          <li><b className="cifra">{numero(resumen.diferencias)}</b> con diferencia: {resumen.sobrantes} sobran, {resumen.faltantes} faltan.</li>
          {verCostos && <li>Valor neto: <b className={cn("cifra", resumen.valor < 0 && "text-peligro")}>{dinero(resumen.valor)}</b></li>}
          <li className="text-tenue">La existencia no cambia hasta que se autorice cada ajuste (y se ajusta a lo contado, aunque haya habido movimientos entre tanto).</li>
        </ul>
      </Dialogo>
    </div>
  );
}

function Resumen({ titulo, valor, tono, barra }: { titulo: string; valor: string; tono?: "aviso" | "peligro"; barra?: number }) {
  return (
    <div className="tarjeta px-4 py-3">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={cn("text-lg font-semibold cifra", tono === "aviso" && "text-aviso", tono === "peligro" && "text-peligro")}>{valor}</p>
      {barra != null && <div className="mt-1.5 h-1.5 rounded-full bg-fondo overflow-hidden"><div className="h-full bg-marca rounded-full" style={{ width: `${Math.round(barra * 100)}%` }} /></div>}
    </div>
  );
}


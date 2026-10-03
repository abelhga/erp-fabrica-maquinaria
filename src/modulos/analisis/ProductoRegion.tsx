import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FlaskConical, ListFilter, Plus, Tags, Trash2 } from "lucide-react";
import { MapaMexico, FUENTE_MAPAS } from "@/components/graficas/MapaMexico";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha, numero, porcentaje } from "@/lib/formato";
import { cn, normalizar } from "@/lib/utilidades";
import { BarraRanking, Cifra, LeyendaEscala, SEQ_TINTA, TarjetaGrafica, VACIO, escalaCuantiles, usePeriodo } from "./comun";

interface FamiliaMonto { clave: string; nombre: string; monto: number; ventas: number; participacion: number | null }
interface DatosProducto {
  total: number;
  clasificado: { pct: number | null; sin_clasificar_monto: number; sin_clasificar_ventas: number; ventas: number };
  familias: FamiliaMonto[];
  estados: { cve: string; nombre: string; monto: number }[];
  matriz: { cve: string; familia: string; monto: number }[];
  estado: null | {
    cve: string; nombre: string; total: number;
    familias: { clave: string; nombre: string; monto: number; participacion: number; participacion_nacional: number | null; indice: number | null }[];
    productos: { descripcion: string; familia: string; ventas: number; monto: number }[];
    municipios: { cvegeo: string; nombre: string; monto: number }[];
  };
  familia: null | { clave: string; nombre: string; estados: { cve: string; monto: number; clientes: number }[] };
}
interface Regla { id: number; patron: string; familia: string; prioridad: number; activo: boolean; nota: string | null; creado_por: string | null }
interface SinClasificar { texto: string; ejemplo: string; ventas: number; monto: number; ultima: string }
interface Prueba { coinciden: number; monto: number; sin_clasificar: number; cambian: number; ejemplos: { descripcion: string; familia: string | null; monto: number }[]; error?: string }

const COLUMNAS_MATRIZ = 12;

export default function ProductoRegion() {
  const { puede } = useSesion();
  const esDireccion = puede("analisis", 3);
  const { periodo, params, setParams } = usePeriodo();
  const estado = params.get("estado");
  const familia = params.get("familia");
  const [modo, setModo] = useState<"mezcla" | "monto">("mezcla");
  const poner = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v == null || n.get(k) === v) n.delete(k); else n.set(k, v);
    setParams(n, { replace: true });
  };

  const p = useQuery({
    queryKey: ["analisis_producto_region", periodo.desde, periodo.hasta, estado, familia],
    queryFn: () => q<DatosProducto>(supabase.rpc("analisis_producto_region", { p_desde: periodo.desde, p_hasta: periodo.hasta, p_cve_ent: estado, p_familia: familia })),
    placeholderData: keepPreviousData,
  });
  const d = p.data;

  // Columnas: los estados que más compran; el resto en una sola.
  const { cols, celdas, escala, totalCol } = useMemo(() => {
    const top = (d?.estados ?? []).slice(0, COLUMNAS_MATRIZ);
    const enTop = new Set(top.map((e) => e.cve));
    const cols = [...top.map((e) => ({ cve: e.cve, nombre: e.nombre })), ...((d?.estados.length ?? 0) > COLUMNAS_MATRIZ ? [{ cve: "resto", nombre: "Resto" }] : [])];
    const celdas = new Map<string, number>();
    const totalCol = new Map<string, number>();
    for (const m of d?.matriz ?? []) {
      const c = enTop.has(m.cve) ? m.cve : "resto";
      celdas.set(`${m.familia}|${c}`, (celdas.get(`${m.familia}|${c}`) ?? 0) + Number(m.monto));
      totalCol.set(c, (totalCol.get(c) ?? 0) + Number(m.monto));
    }
    const valores = [...celdas.entries()].map(([k, v]) => modo === "monto" ? v : v / (totalCol.get(k.split("|")[1]) || 1));
    return { cols, celdas, totalCol, escala: escalaCuantiles(valores) };
  }, [d, modo]);

  if (p.error) return <ErrorCarga error={p.error} />;
  if (!d) return <Cargando filas={8} />;

  const filas = d.familias;
  const maxFam = Math.max(...filas.map((f) => f.monto), 1);
  const familiaElegida = d.familia;
  const porEstadoFam = new Map((familiaElegida?.estados ?? []).map((e) => [e.cve, Number(e.monto)]));
  const escalaFam = escalaCuantiles([...porEstadoFam.values()]);
  const mejor = [...filas].filter((f) => f.clave !== "sin_clasificar").sort((a, b) => b.monto - a.monto)[0];

  return (
    <div className={cn("space-y-4 transition-opacity", p.isFetching && p.isPlaceholderData && "opacity-60")}>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Venta del periodo" valor={dineroCompacto(d.total)} detalle={<>{numero(d.clasificado.ventas)} renglones de venta</>} />
        <Cifra titulo="Familia que más vende" valor={mejor ? porcentaje(mejor.participacion, 0) : "—"} detalle={mejor?.nombre ?? "—"} />
        <Cifra titulo="Clasificado por familia" valor={porcentaje(d.clasificado.pct, 1)}
          detalle={<>{dineroCompacto(d.clasificado.sin_clasificar_monto)} en {numero(d.clasificado.sin_clasificar_ventas)} ventas sin clasificar</>} />
        <Cifra titulo={estado && d.estado ? `Venta en ${d.estado.nombre}` : "Estados con venta"} valor={estado && d.estado ? dineroCompacto(d.estado.total) : numero(d.estados.length)}
          detalle={estado && d.estado ? <button type="button" className="text-marca-texto hover:underline" onClick={() => poner("estado", null)}>Quitar el estado</button> : "Elige uno en la matriz para ver qué se vende ahí"} />
      </div>

      <TarjetaGrafica titulo="Qué se vende dónde: familia × estado"
        descripcion={modo === "mezcla" ? "Cada columna suma 100 %: la mezcla de cada estado. Clic en un estado para verlo de cerca; en una familia, para su mapa."
          : "Monto de cada familia en cada estado. Clic en un estado para verlo de cerca; en una familia, para su mapa."}
        acciones={<Filtro opciones={[{ valor: "mezcla", texto: "Mezcla del estado" }, { valor: "monto", texto: "Monto" }]} valor={modo} alCambiar={setModo} />}
        tabla={<div className="overflow-x-auto px-1 pb-2"><table className="tabla text-xs">
          <thead><tr><th>Familia</th>{cols.map((c) => <th key={c.cve} className="text-right">{c.nombre}</th>)}</tr></thead>
          <tbody>{filas.map((f) => <tr key={f.clave}><td className="whitespace-nowrap">{f.nombre}</td>
            {cols.map((c) => <td key={c.cve} className="text-right cifra">{dinero(celdas.get(`${f.clave}|${c.cve}`) ?? 0)}</td>)}</tr>)}</tbody>
        </table></div>}
        pie={<div className="space-y-1"><LeyendaEscala escala={escala} formato={(v) => modo === "monto" ? dineroCompacto(v) : porcentaje(v, v < 0.1 ? 1 : 0)} vacio="Nada" />
          <p>{escala.explicacion}</p></div>}>
        <div className="px-5 pb-2 overflow-x-auto">
          <table className="w-full text-[11px] border-separate min-w-[760px]" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th className="text-left font-medium text-tenue w-48" />
                {cols.map((c) => (
                  <th key={c.cve} className="font-medium align-bottom">
                    {c.cve === "resto" ? <span className="text-tenue">Resto</span> : (
                      <button type="button" onClick={() => poner("estado", c.cve)}
                        className={cn("px-1 rounded hover:text-marca-texto leading-tight", estado === c.cve ? "text-marca-texto underline" : "text-tenue")}>
                        {c.nombre}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave}>
                  <th className="text-left font-medium pr-2">
                    <button type="button" onClick={() => poner("familia", f.clave)}
                      className={cn("text-left hover:text-marca-texto", familia === f.clave && "text-marca-texto underline", f.clave === "sin_clasificar" && "text-tenue italic")}>
                      {f.nombre}
                    </button>
                  </th>
                  {cols.map((c) => {
                    const v = celdas.get(`${f.clave}|${c.cve}`) ?? 0;
                    const x = modo === "monto" ? v : v / (totalCol.get(c.cve) || 1);
                    const k = escala.claseDe(x);
                    const tono = escala.colores[k];
                    const n = Number(tono.match(/\d+/)?.[0] ?? 1);
                    return (
                      <td key={c.cve} className="h-7 rounded-[3px] text-center cifra"
                        title={`${f.nombre} en ${c.nombre}: ${dinero(v)} (${porcentaje(v / (totalCol.get(c.cve) || 1), 1)} del estado)`}
                        style={{ background: v > 0 ? tono : VACIO, color: v > 0 ? SEQ_TINTA(n) : undefined }}>
                        {v > 0 ? (modo === "monto" ? dineroCompacto(v).replace("$", "") : x < 0.005 ? "<1%" : porcentaje(x, 0)) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TarjetaGrafica>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* De cerca: un estado */}
        <section className="tarjeta min-w-0">
          <div className="px-5 pt-4 pb-2">
            <h3 className="font-semibold">{d.estado ? `Qué se vende en ${d.estado.nombre}` : "Qué se vende en cada estado"}</h3>
            <p className="text-sm text-tenue mt-0.5">
              {d.estado ? <>Cada familia con su peso en el estado; la marca es su peso en todo el país. Índice mayor a 1: ahí pesa más que en el resto.</>
                : "Elige un estado en la matriz de arriba."}
            </p>
          </div>
          {!d.estado ? (
            <div className="px-5 pb-5 space-y-2.5">
              {filas.filter((f) => f.monto > 0).map((f) => (
                <div key={f.clave}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="truncate">{f.nombre}</span>
                    <span className="ml-auto cifra font-medium">{dineroCompacto(f.monto)}</span>
                    <span className="w-12 text-right text-xs text-tenue cifra">{porcentaje(f.participacion, 0)}</span>
                  </div>
                  <BarraRanking valor={f.monto} max={maxFam} className="mt-1" />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-4">
              <ul className="space-y-2.5">
                {d.estado.familias.map((f) => (
                  <li key={f.clave}>
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="truncate">{f.nombre}</span>
                      <span className="ml-auto cifra font-medium">{dineroCompacto(f.monto)}</span>
                      <span className="w-12 text-right text-xs cifra">{porcentaje(f.participacion, 0)}</span>
                      <span className={cn("w-14 text-right text-xs cifra", (f.indice ?? 0) >= 1.25 ? "text-marca-texto font-semibold" : "text-tenue")} title="Índice: peso en el estado ÷ peso en el país">
                        ×{numero(f.indice)}
                      </span>
                    </div>
                    <div className="relative mt-1">
                      <BarraRanking valor={f.participacion} max={1} />
                      {f.participacion_nacional != null && (
                        <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-texto" style={{ left: `${Math.min(100, f.participacion_nacional * 100)}%` }} title={`País: ${porcentaje(f.participacion_nacional, 0)}`} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {d.estado.municipios.length > 0 && (
                <div>
                  <p className="etiqueta mb-1">Dónde, dentro del estado</p>
                  <p className="text-sm">{d.estado.municipios.map((m) => `${m.nombre} ${dineroCompacto(m.monto)}`).join(" · ")}</p>
                </div>
              )}
              {d.estado.productos.length > 0 && (
                <div>
                  <p className="etiqueta mb-1">Lo que más se vendió (texto de la venta)</p>
                  <table className="tabla text-xs">
                    <tbody>{d.estado.productos.map((x) => (
                      <tr key={x.descripcion}><td className="max-w-[280px] truncate" title={x.descripcion}>{x.descripcion}</td>
                        <td className="text-right cifra text-tenue">{x.ventas}×</td><td className="text-right cifra">{dineroCompacto(x.monto)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Dónde se vende una familia */}
        <section className="tarjeta min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4 pb-2">
            <div>
              <h3 className="font-semibold">{familiaElegida ? `Dónde se vende: ${familiaElegida.nombre}` : "Dónde se vende cada familia"}</h3>
              <p className="text-sm text-tenue mt-0.5">{familiaElegida ? `Venta de esa familia por estado en ${periodo.etiqueta}.` : "Elige una familia en la matriz o aquí."}</p>
            </div>
            <Seleccion className="w-auto h-8 text-xs" value={familia ?? ""} onChange={(e) => poner("familia", e.target.value || null)} aria-label="Familia">
              <option value="">Elegir familia…</option>
              {filas.filter((f) => f.clave !== "sin_clasificar").map((f) => <option key={f.clave} value={f.clave}>{f.nombre}</option>)}
            </Seleccion>
          </div>
          {familiaElegida ? (
            <div className="px-3 sm:px-5 pb-4">
              <MapaMexico color={(cve) => (porEstadoFam.get(cve) ?? 0) > 0 ? escalaFam.colores[escalaFam.claseDe(porEstadoFam.get(cve)!)] : VACIO}
                alClic={(cve) => poner("estado", cve)}
                etiqueta={(cve, nombre) => `${nombre}: ${dinero(porEstadoFam.get(cve) ?? 0)}`}
                tooltip={(cve, nombre) => (<><p className="font-medium">{nombre}</p>
                  <p className="cifra mt-0.5"><b>{dinero(porEstadoFam.get(cve) ?? 0)}</b> en {familiaElegida.nombre.toLowerCase()}</p>
                  <p className="text-tenue mt-1">Clic para ver qué más se vende ahí</p></>)} />
              <LeyendaEscala escala={escalaFam} formato={dineroCompacto} className="mt-2" />
              <p className="text-[11px] text-tenue mt-1">{FUENTE_MAPAS}.</p>
            </div>
          ) : <Vacio icono={ListFilter} titulo="Elige una familia" texto="Verás en el mapa en qué estados se vende y cuánto." />}
        </section>
      </div>

      <ReglasFamilia esDireccion={esDireccion} familias={filas.filter((f) => f.clave !== "sin_clasificar")} />
    </div>
  );
}

/** Reglas de texto → familia, y la cola de lo que no cae en ninguna. Dirección edita; la gerencia solo ve. */
function ReglasFamilia({ esDireccion, familias }: { esDireccion: boolean; familias: FamiliaMonto[] }) {
  const reglas = useQuery({ queryKey: ["reglas_familia_venta"], queryFn: () => q<Regla[]>(supabase.from("reglas_familia_venta").select("id, patron, familia, prioridad, activo, nota, creado_por").order("prioridad").order("id")) });
  const cola = useQuery({ queryKey: ["analisis_sin_clasificar"], queryFn: () => q<SinClasificar[]>(supabase.rpc("analisis_sin_clasificar", { p_limite: 80 })) });
  const nombres = useMemo(() => new Map(familias.map((f) => [f.clave, f.nombre])), [familias]);
  const [patron, setPatron] = useState("");
  const [fam, setFam] = useState("");
  const [prioridad, setPrioridad] = useState("50");
  const [prueba, setPrueba] = useState<Prueba | null>(null);
  const invalidar = [["reglas_familia_venta"], ["analisis_sin_clasificar"], ["analisis_producto_region"], ["analisis_tendencias"]];

  // Probar mientras se escribe: a cuántas ventas les pegaría la regla antes de guardarla.
  useEffect(() => {
    if (patron.trim().length < 3) { setPrueba(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("probar_regla_familia", { p_patron: patron.trim().toLowerCase(), p_familia: fam || null });
      setPrueba((data as Prueba) ?? null);
    }, 300);
    return () => clearTimeout(t);
  }, [patron, fam]);

  const guardar = useAccion(
    () => q<{ reclasificadas: number }>(supabase.rpc("guardar_regla_familia", { p_id: null, p_patron: patron.trim(), p_familia: fam, p_prioridad: Number(prioridad) || 50, p_activo: true, p_nota: null })),
    { exito: (r) => `Regla guardada: ${numero(r.reclasificadas)} ventas cambiaron de familia`, invalidar, alTerminar: () => { setPatron(""); setPrueba(null); } });
  const borrar = useAccion((id: number) => q(supabase.rpc("borrar_regla_familia", { p_id: id })), { exito: "Regla quitada y ventas reclasificadas", invalidar });

  /** Del texto de una venta a un patrón que lo atrape: sin números ni medidas, escapado. */
  const patronDe = (t: string) => normalizar(t).replace(/[0-9."'/×-]+|\bx\b/g, " ").replace(/\s+/g, " ").trim().split(" ").filter((w) => w.length > 2).slice(0, 3).join(" ")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const columnas: Columna<Regla>[] = [
    { clave: "prioridad", titulo: "Orden", alinear: "der", clase: "w-16" },
    { clave: "patron", titulo: "Patrón (expresión regular)", celda: (r) => <code className="text-xs break-all line-clamp-3 max-w-[340px]" title={r.patron}>{r.patron}</code> },
    { clave: "familia", titulo: "Familia", valor: (r) => nombres.get(r.familia) ?? r.familia },
    { clave: "nota", titulo: "Por qué", valor: (r) => r.nota ?? "", celda: (r) => <span className="text-xs text-tenue line-clamp-3 max-w-[220px]" title={r.nota ?? ""}>{r.nota ?? (r.creado_por ? "Agregada por dirección" : "")}</span> },
    ...(esDireccion ? [{ clave: "acciones", titulo: "", sinBusqueda: true, celda: (r: Regla) => r.creado_por ? (
      <button type="button" className="p-1 text-tenue hover:text-peligro" aria-label="Quitar regla" onClick={(e) => { e.stopPropagation(); borrar.mutate(r.id); }}><Trash2 className="h-4 w-4" /></button>
    ) : <span className="text-[11px] text-tenue">de fábrica</span> } as Columna<Regla>] : []),
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="space-y-3 min-w-0">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Tags className="h-4 w-4 text-marca" /> Reglas de familia</h3>
          <p className="text-sm text-tenue">El libro de la hoja solo trae texto («zeus 30 fija», «20 mts g.t. 18"»). Cada regla busca un patrón en el texto, en minúsculas y sin acentos; gana la de orden más bajo. Los pedidos del ERP usan la categoría del artículo.</p>
        </div>
        {esDireccion && (
          <form className="tarjeta p-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (patron.trim() && fam && !prueba?.error) guardar.mutate(undefined); }}>
            <div className="flex flex-wrap gap-2">
              <Entrada className="flex-1 min-w-[200px] font-mono text-xs" placeholder="Patrón, p. ej. molino|martillo" value={patron} onChange={(e) => setPatron(e.target.value)} aria-label="Patrón" />
              <Seleccion className="w-auto" value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Familia">
                <option value="">Familia…</option>
                {familias.map((f) => <option key={f.clave} value={f.clave}>{f.nombre}</option>)}
              </Seleccion>
              <Entrada className="w-20" type="number" min={1} max={999} value={prioridad} onChange={(e) => setPrioridad(e.target.value)} aria-label="Orden" title="Orden: gana la regla con el número más bajo" />
              <Boton type="submit" cargando={guardar.isPending} disabled={!patron.trim() || !fam || !!prueba?.error}><Plus className="h-4 w-4" /> Guardar</Boton>
            </div>
            {prueba && (
              prueba.error ? <p className="text-xs text-peligro">{prueba.error}</p> : (
                <div className="text-xs text-tenue">
                  <p className="flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" />
                    Le pega a <b className="text-texto">{numero(prueba.coinciden)}</b> ventas ({dineroCompacto(prueba.monto)}); {numero(prueba.sin_clasificar)} estaban sin clasificar{fam && <>, {numero(prueba.cambian)} cambiarían de familia</>}.</p>
                  {prueba.ejemplos.length > 0 && <p className="mt-1 truncate">Ej.: {prueba.ejemplos.slice(0, 4).map((x) => `«${x.descripcion}»`).join(", ")}</p>}
                </div>
              )
            )}
          </form>
        )}
        <TablaDatos filas={reglas.data} cargando={reglas.isLoading} error={reglas.error} columnas={columnas} claveFila={(r) => String(r.id)} compacta buscable={false} limite={50} exportarComo="reglas-familia" />
      </section>

      <section className="space-y-3 min-w-0">
        <div>
          <h3 className="font-semibold">Sin clasificar</h3>
          <p className="text-sm text-tenue">Textos de venta que no cayeron en ninguna regla, de más a menos dinero.{esDireccion && " «Usar» pone el texto como patrón arriba."}</p>
        </div>
        <TablaDatos filas={cola.data} cargando={cola.isLoading} error={cola.error} claveFila={(x) => x.texto} compacta limite={30} exportarComo="ventas-sin-clasificar"
          vacio={{ icono: Tags, titulo: "Todo está clasificado", texto: "Cada venta del periodo cayó en una familia." }}
          columnas={[
            { clave: "ejemplo", titulo: "Texto de la venta", celda: (x) => <span className="text-xs">{x.ejemplo}</span> },
            { clave: "ventas", titulo: "Ventas", alinear: "der", sinBusqueda: true },
            { clave: "monto", titulo: "Monto", alinear: "der", celda: (x) => dineroCompacto(x.monto), sinBusqueda: true },
            { clave: "ultima", titulo: "Última", celda: (x) => <span className="text-xs text-tenue">{fecha(x.ultima)}</span> },
            ...(esDireccion ? [{ clave: "usar", titulo: "", sinBusqueda: true, celda: (x: SinClasificar) => (
              <button type="button" className="text-xs text-marca-texto hover:underline" onClick={() => setPatron(patronDe(x.texto))}>Usar</button>
            ) } as Columna<SinClasificar>] : []),
          ]} />
        {!esDireccion && <p className="text-xs text-tenue"><Insignia>Solo lectura</Insignia> Las reglas las cambia dirección.</p>}
      </section>
    </div>
  );
}


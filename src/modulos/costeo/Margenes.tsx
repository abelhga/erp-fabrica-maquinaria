import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, DollarSign, Hammer, History, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, fechaYHora, hace, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CeldaNumero } from "./componentes/Celdas";
import { leerNumero, pct, rutaArticulo, type TipoArticulo } from "./componentes/comun";

interface Recargo { nombre: string; pct: number }
interface Tramo { hasta: number | null; multiplo: number }
interface Politica {
  id: number; nombre: string; utilidad: number; compensar_isr: boolean; recargos_costo: Recargo[]; recargos_precio: Recargo[];
  pct_medida_especial: number; redondeo: Tramo[]; por_defecto_para: TipoArticulo | null; descuento_maximo: number; actualizado_en: string;
}
interface Simulado { articulo_id: string; clave: string; nombre: string; tipo: TipoArticulo; politica: string; costo: number; precio_actual: number | null; precio_simulado: number | null }

const TIPO_PLURAL: Record<string, string> = { equipo: "equipos", subensamble: "subensambles", componente: "componentes", materia_prima: "materia prima", servicio: "servicios" };

function textoRedondeo(r: Tramo[]) {
  const orden = [...r].sort((a, b) => (a.hasta ?? Infinity) - (b.hasta ?? Infinity));
  if (orden.length === 1 && orden[0].multiplo < 1) return "al centavo";
  return orden.map((t, i) => {
    const m = t.multiplo >= 1 ? dinero(t.multiplo).replace(".00", "") : "centavo";
    if (t.hasta == null) return i === 0 ? `a ${m}` : `a ${m} arriba`;
    return `a ${m} abajo de ${dinero(t.hasta).replace(".00", "")}`;
  }).join("; ");
}
const suma = (r: Recargo[]) => r.reduce((s, x) => s + Number(x.pct || 0), 0);

/** Lo que cambiaría: cuántos precios se mueven, cuánto en promedio y los diez que más. */
function resumir(filas: Simulado[] | undefined) {
  const f = filas ?? [];
  const cambian = f.filter((x) => x.precio_simulado != null && x.precio_actual != null && Number(x.precio_simulado) !== Number(x.precio_actual));
  const sinSolucion = f.filter((x) => x.precio_simulado == null).length;
  const promedio = cambian.length ? cambian.reduce((s, x) => s + (Number(x.precio_simulado) / Number(x.precio_actual) - 1), 0) / cambian.length : 0;
  const mayores = [...cambian].sort((a, b) => Math.abs(Number(b.precio_simulado) - Number(b.precio_actual)) - Math.abs(Number(a.precio_simulado) - Number(a.precio_actual))).slice(0, 10);
  const nuevos = f.filter((x) => x.precio_actual == null && x.precio_simulado != null).length;
  return { total: f.length, cambian: cambian.length + nuevos, promedio, mayores, sinSolucion };
}

function ResumenSimulacion({ filas, cargando, alcance }: { filas: Simulado[] | undefined; cargando: boolean; alcance: string }) {
  const r = resumir(filas);
  if (cargando && !filas) return <Cargando filas={4} />;
  return (
    <div className={cn("space-y-3 transition-opacity", cargando && "opacity-60")}>
      {r.sinSolucion > 0 ? (
        <p className="rounded-lg bg-peligro-suave text-peligro px-3 py-2 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> Con estos valores la utilidad compensada más los recargos sobre precio llegan a 100 %: la fórmula no tiene precio para {r.sinSolucion} artículos.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-fondo px-3 py-2"><p className="text-xs text-tenue">Precios que cambian</p><p className="text-xl font-semibold cifra">{r.cambian} <span className="text-sm font-normal text-tenue">de {r.total}</span></p></div>
          <div className="rounded-lg bg-fondo px-3 py-2"><p className="text-xs text-tenue">Cambio promedio</p><p className={cn("text-xl font-semibold cifra", r.promedio > 0 && "text-peligro", r.promedio < 0 && "text-ok")}>{r.cambian ? `${r.promedio > 0 ? "+" : ""}${porcentaje(r.promedio)}` : "—"}</p></div>
          <div className="rounded-lg bg-fondo px-3 py-2"><p className="text-xs text-tenue">Alcance</p><p className="text-sm font-medium mt-1 leading-tight">{alcance}</p></div>
        </div>
      )}
      {r.mayores.length > 0 && (
        <div className="border border-borde rounded-lg overflow-hidden">
          <p className="etiqueta px-3 pt-2.5 pb-1">Los {r.mayores.length} que más se mueven</p>
          <table className="tabla [&_td]:py-1.5">
            <tbody>
              {r.mayores.map((x) => {
                const d = Number(x.precio_simulado) - Number(x.precio_actual);
                return (
                  <tr key={x.articulo_id}>
                    <td><Link to={rutaArticulo({ id: x.articulo_id, tipo: x.tipo })} className="hover:underline block truncate max-w-[230px]" title={x.nombre}>
                      <span className="cifra text-tenue">{x.clave}</span> {x.nombre}</Link></td>
                    <td className="text-right cifra whitespace-nowrap">
                      <span className="text-tenue">{dinero(x.precio_actual)}</span> <ArrowRight className="inline h-3 w-3 text-tenue" /> <b>{dinero(x.precio_simulado)}</b>
                      <span className={cn("block text-xs", d > 0 ? "text-peligro" : "text-ok")}>{d > 0 ? "+" : "−"}{dinero(Math.abs(d))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Retrasa un valor para no simular en cada tecla. */
function useDiferido<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function ListaRecargos({ titulo, ayuda, valor, alCambiar }: { titulo: string; ayuda: string; valor: Recargo[]; alCambiar: (r: Recargo[]) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{titulo} <span className="text-tenue font-normal">· suman {pct(suma(valor))}</span></p>
        <button type="button" className="text-xs text-marca-texto inline-flex items-center gap-1" onClick={() => alCambiar([...valor, { nombre: "", pct: 0 }])}><Plus className="h-3 w-3" /> Agregar</button>
      </div>
      <p className="text-xs text-tenue">{ayuda}</p>
      {valor.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Entrada value={r.nombre} placeholder="Concepto" aria-label="Concepto" onChange={(e) => alCambiar(valor.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} />
          <div className="relative w-28 shrink-0">
            <Entrada inputMode="decimal" className="text-right cifra pr-7" aria-label={`Porcentaje de ${r.nombre}`}
              defaultValue={String(Math.round(Number(r.pct) * 1e6) / 1e4)}
              onChange={(e) => { const n = leerNumero(e.target.value); alCambiar(valor.map((x, k) => (k === i ? { ...x, pct: n == null ? 0 : n / 100 } : x))); }} />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-tenue">%</span>
          </div>
          <button type="button" className="p-1.5 rounded text-tenue hover:text-peligro" aria-label="Quitar concepto" onClick={() => alCambiar(valor.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

/** Edición de una política con el simulador al lado: antes de guardar se ve cuántos precios se mueven. */
function EditarPolitica({ politica, alCerrar, categorias }: { politica: Politica; alCerrar: () => void; categorias: string[] }) {
  const qc = useQueryClient();
  const [b, setB] = useState<Politica>(politica);
  const [guardando, setGuardando] = useState(false);
  const cambios = useMemo(() => {
    const c: Record<string, unknown> = {};
    if (Number(b.utilidad) !== Number(politica.utilidad)) c.utilidad = Number(b.utilidad);
    if (b.compensar_isr !== politica.compensar_isr) c.compensar_isr = b.compensar_isr;
    const limpia = (r: Recargo[]) => r.filter((x) => x.nombre.trim()).map((x) => ({ nombre: x.nombre.trim(), pct: Number(x.pct) }));
    if (JSON.stringify(limpia(b.recargos_costo)) !== JSON.stringify(limpia(politica.recargos_costo))) c.recargos_costo = limpia(b.recargos_costo);
    if (JSON.stringify(limpia(b.recargos_precio)) !== JSON.stringify(limpia(politica.recargos_precio))) c.recargos_precio = limpia(b.recargos_precio);
    if (Number(b.pct_medida_especial) !== Number(politica.pct_medida_especial)) c.pct_medida_especial = Number(b.pct_medida_especial);
    if (JSON.stringify(b.redondeo) !== JSON.stringify(politica.redondeo)) c.redondeo = b.redondeo;
    if (Number(b.descuento_maximo) !== Number(politica.descuento_maximo)) c.descuento_maximo = Number(b.descuento_maximo);
    return c;
  }, [b, politica]);
  const diferidos = useDiferido(cambios);
  const sim = useQuery({
    queryKey: ["costeo", "simular", politica.id, JSON.stringify(diferidos)],
    queryFn: () => q<Simulado[]>(supabase.rpc("simular_precios", { p_politica: politica.id, p_valores: diferidos })),
    placeholderData: (prev) => prev,
  });
  const r = resumir(sim.data);
  const hayCambios = Object.keys(cambios).length > 0;
  const calculando = sim.isFetching || JSON.stringify(diferidos) !== JSON.stringify(cambios);
  const valida = b.utilidad >= 0 && b.utilidad < 1 && b.descuento_maximo >= 0 && b.descuento_maximo < 1 && r.sinSolucion === 0;

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase.from("politicas_precio").update(cambios).eq("id", politica.id);
    setGuardando(false);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success(`${politica.nombre}: ${r.cambian} precios actualizados. El cambio quedó en la bitácora.`);
    qc.invalidateQueries({ queryKey: ["costeo"] });
    alCerrar();
  }

  const num = (v: number) => String(Math.round(Number(v) * 1e6) / 1e4);
  return (
    <Lateral abierto alCambiar={(v) => !v && alCerrar()} titulo={`Política: ${politica.nombre}`} ancho="max-w-5xl"
      subtitulo={<>{categorias.length ? `Tipos de equipo: ${categorias.join(", ")}` : ""}{politica.por_defecto_para ? `${categorias.length ? " · " : ""}Por defecto para ${TIPO_PLURAL[politica.por_defecto_para]} sin categoría` : ""}</>}
      acciones={<Boton disabled={!hayCambios || !valida || calculando} cargando={guardando} onClick={guardar}>
        {!hayCambios ? "Sin cambios" : calculando ? "Calculando…" : `Guardar y mover ${r.cambian} ${r.cambian === 1 ? "precio" : "precios"}`}
      </Boton>}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Utilidad" ayuda={b.compensar_isr ? "Neta después de ISR" : "Sobre el precio"}>
              <div className="relative">
                <Entrada autoFocus inputMode="decimal" className="text-right cifra pr-7 text-base font-semibold" defaultValue={num(politica.utilidad)}
                  onChange={(e) => { const n = leerNumero(e.target.value); setB({ ...b, utilidad: n == null ? 0 : n / 100 }); }} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-tenue">%</span>
              </div>
            </Campo>
            <Campo etiqueta="Descuento máximo" ayuda="Sin pedir autorización">
              <div className="relative">
                <Entrada inputMode="decimal" className="text-right cifra pr-7" defaultValue={num(politica.descuento_maximo)}
                  onChange={(e) => { const n = leerNumero(e.target.value); setB({ ...b, descuento_maximo: n == null ? 0 : n / 100 }); }} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-tenue">%</span>
              </div>
            </Campo>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={b.compensar_isr} onChange={(e) => setB({ ...b, compensar_isr: e.target.checked })} className="h-4 w-4 mt-0.5 accent-[hsl(var(--marca))]" />
            <span>Compensar ISR <span className="block text-xs text-tenue">La utilidad se divide entre (1 − ISR) para que quede libre después de impuestos. Así trabaja la hoja con los equipos; los componentes no.</span></span>
          </label>
          <ListaRecargos titulo="Recargos sobre el costo" ayuda="Se suman al costo: mermas, luz, administración…" valor={b.recargos_costo} alCambiar={(v) => setB({ ...b, recargos_costo: v })} />
          <ListaRecargos titulo="Recargos sobre el precio" ayuda="Porcentaje del precio de venta: comisiones, garantía, MKT…" valor={b.recargos_precio} alCambiar={(v) => setB({ ...b, recargos_precio: v })} />
          <Campo etiqueta="Medida especial" ayuda="Se suma sobre el costo solo a los equipos marcados como medida especial.">
            <div className="relative w-32">
              <Entrada inputMode="decimal" className="text-right cifra pr-7" defaultValue={num(politica.pct_medida_especial)}
                onChange={(e) => { const n = leerNumero(e.target.value); setB({ ...b, pct_medida_especial: n == null ? 0 : n / 100 }); }} />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-tenue">%</span>
            </div>
          </Campo>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Redondeo hacia arriba</p>
            {b.redondeo.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-tenue w-12">a</span>
                <Entrada inputMode="decimal" className="w-28 text-right cifra" aria-label="Múltiplo" defaultValue={String(t.multiplo)}
                  onChange={(e) => { const n = leerNumero(e.target.value); setB({ ...b, redondeo: b.redondeo.map((x, k) => (k === i ? { ...x, multiplo: n && n > 0 ? n : 0.01 } : x)) }); }} />
                <span className="text-tenue">{t.hasta == null ? "en adelante" : "abajo de"}</span>
                {t.hasta != null && <Entrada inputMode="decimal" className="w-32 text-right cifra" aria-label="Hasta" defaultValue={String(t.hasta)}
                  onChange={(e) => { const n = leerNumero(e.target.value); setB({ ...b, redondeo: b.redondeo.map((x, k) => (k === i ? { ...x, hasta: n } : x)) }); }} />}
              </div>
            ))}
            <p className="text-xs text-tenue">Hoy: {textoRedondeo(b.redondeo)}.</p>
          </div>
        </div>
        <div className="space-y-3">
          <p className="font-semibold">Qué pasaría</p>
          {!hayCambios
            ? <p className="text-sm text-tenue">Cambia la utilidad o un recargo y aquí ves, antes de guardar, cuántos precios se mueven y cuáles más.</p>
            : <ResumenSimulacion filas={sim.data} cargando={sim.isFetching} alcance={`${r.total} artículos con esta política`} />}
          {hayCambios && <p className="text-xs text-tenue">Respeta los artículos con utilidad propia y deja fuera los de precio fijo, igual que el cálculo real.</p>}
        </div>
      </div>
    </Lateral>
  );
}

const sinPct = (r: Recargo[]) => r.map((x) => `${x.nombre} ${(Math.round(x.pct * 1e5) / 1e3).toLocaleString("es-MX")}`).join(" · ");

function TarjetaPolitica({ p, categorias, editar, alEditar }: { p: Politica; categorias: string[]; editar: boolean; alEditar: () => void }) {
  // Si la política solo tiene la categoría de su mismo nombre, repetirla no dice nada.
  const otras = categorias.filter((c) => c !== p.nombre);
  const descripcion = otras.length ? `También para: ${otras.join(", ")}` : p.por_defecto_para ? `Por defecto para ${TIPO_PLURAL[p.por_defecto_para]} sin categoría` : categorias.length ? undefined : "Ningún tipo de equipo la usa";
  return (
    <Tarjeta className="flex flex-col">
      <EncabezadoTarjeta titulo={p.nombre} descripcion={descripcion}
        acciones={editar && <Boton tamano="sm" variante="secundario" onClick={alEditar}><Pencil className="h-3.5 w-3.5" /> Editar</Boton>} />
      <div className="px-5 pb-4 flex-1 space-y-2.5 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold cifra whitespace-nowrap">{pct(p.utilidad)}</span>
          <span className="text-tenue">utilidad {p.compensar_isr ? "neta de ISR" : "sobre precio"}</span>
        </div>
        <div>
          <p className="flex justify-between gap-2"><span>Recargos sobre costo</span><b className="cifra whitespace-nowrap">{pct(suma(p.recargos_costo))}</b></p>
          {p.recargos_costo.length > 0 && <p className="text-xs text-tenue">{sinPct(p.recargos_costo)}</p>}
        </div>
        <div>
          <p className="flex justify-between gap-2"><span>Recargos sobre precio</span><b className="cifra whitespace-nowrap">{pct(suma(p.recargos_precio))}</b></p>
          {p.recargos_precio.length > 0 && <p className="text-xs text-tenue">{sinPct(p.recargos_precio)}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {Number(p.pct_medida_especial) > 0 && <Insignia>medida especial +{pct(p.pct_medida_especial)}</Insignia>}
          <Insignia>redondeo {textoRedondeo(p.redondeo)}</Insignia>
          <Insignia>descuento máx. {pct(p.descuento_maximo)}</Insignia>
        </div>
      </div>
      <p className="px-5 py-2 border-t border-borde text-xs text-tenue">Cambió {hace(p.actualizado_en)}</p>
    </Tarjeta>
  );
}

function TarjetaIsr({ isr, editar }: { isr: number | undefined; editar: boolean }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");
  const nuevo = leerNumero(valor);
  const diferido = useDiferido(nuevo);
  const sim = useQuery({
    queryKey: ["costeo", "simular-isr", diferido],
    enabled: abierto && diferido != null && isr != null && diferido / 100 !== isr,
    queryFn: () => q<Simulado[]>(supabase.rpc("simular_precios", { p_politica: null, p_valores: {}, p_isr: diferido! / 100 })),
    placeholderData: (prev) => prev,
  });
  const r = resumir(sim.data);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (nuevo == null) return;
    const { error } = await supabase.rpc("fijar_isr_compensacion", { p_valor: nuevo / 100 });
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success(`ISR de compensación: ${nuevo} %. ${r.cambian} precios actualizados.`);
    qc.invalidateQueries({ queryKey: ["costeo"] });
    setAbierto(false);
  }
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="ISR de compensación" descripcion="La utilidad de los equipos es neta de este ISR (EQUIPOS!AC1 de la hoja)"
        acciones={editar && <Boton tamano="sm" variante="secundario" onClick={() => { setValor(isr != null ? String(Math.round(isr * 1e4) / 100) : ""); setAbierto(true); }}><Pencil className="h-3.5 w-3.5" /> Cambiar</Boton>} />
      <div className="px-5 pb-4 -mt-1"><span className="text-3xl font-semibold cifra">{pct(isr)}</span></div>
      <Dialogo abierto={abierto} alCambiar={setAbierto} ancho="max-w-2xl" titulo="Cambiar ISR de compensación"
        descripcion="Mueve el precio de todos los artículos cuya política compensa ISR."
        pie={<><Boton variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Boton>
          <Boton type="submit" form="isr" disabled={nuevo == null || nuevo < 0 || nuevo >= 60 || r.sinSolucion > 0}>{sim.data ? `Guardar y mover ${r.cambian} precios` : "Guardar"}</Boton></>}>
        <form id="isr" onSubmit={guardar} className="space-y-4">
          <Campo etiqueta="ISR de compensación (%)">
            <Entrada autoFocus inputMode="decimal" className="w-32 text-right cifra" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Campo>
          {sim.data && <ResumenSimulacion filas={sim.data} cargando={sim.isFetching} alcance="Todas las políticas que compensan ISR" />}
        </form>
      </Dialogo>
    </Tarjeta>
  );
}

interface TipoCambio { fecha: string; moneda: "USD" | "EUR"; valor: number; fuente: string | null }

function TarjetaTipoCambio() {
  const { puede } = useSesion();
  const qc = useQueryClient();
  const editar = puede("compras", 2) || puede("finanzas", 2);
  const tc = useQuery({
    queryKey: ["costeo", "tipos-cambio"],
    queryFn: () => q<TipoCambio[]>(supabase.from("tipos_cambio").select("fecha, moneda, valor, fuente").order("fecha", { ascending: false }).limit(60)),
  });
  async function capturar(moneda: "USD" | "EUR", v: number | null) {
    if (v == null || v <= 0) return;
    const hoy = new Date().toLocaleDateString("en-CA");
    const { error } = await supabase.from("tipos_cambio").upsert({ fecha: hoy, moneda, valor: v, fuente: "manual" });
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success(`${moneda} a ${dinero(v)}: costos importados y precios recalculados.`);
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Tipo de cambio" descripcion="Convierte a pesos los costos de lo importado" />
      <div className="px-5 pb-5 grid grid-cols-2 gap-4">
        {(["USD", "EUR"] as const).map((m) => {
          const ult = tc.data?.find((t) => t.moneda === m);
          const ant = tc.data?.filter((t) => t.moneda === m)[1];
          return (
            <div key={m}>
              <p className="text-xs text-tenue">{m === "USD" ? "Dólar" : "Euro"}</p>
              {editar ? (
                <div className="-ml-1.5 text-2xl font-semibold w-32">
                  <CeldaNumero valor={ult ? Number(ult.valor) : null} etiqueta={`Tipo de cambio ${m}`} className="h-9 text-2xl font-semibold text-left" alGuardar={(v) => capturar(m, v)} />
                </div>
              ) : <p className="text-2xl font-semibold cifra">{ult ? Number(ult.valor).toFixed(4) : "—"}</p>}
              <p className="text-xs text-tenue">{ult ? <>al {fecha(ult.fecha)}{ant && <> · antes {Number(ant.valor).toFixed(2)}</>}</> : "sin capturar"}</p>
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
}

function TarjetaTarifas({ editar }: { editar: boolean }) {
  const qc = useQueryClient();
  const t = useQuery({
    queryKey: ["costeo", "tarifas-etapas"],
    queryFn: () => q<{ etapa_id: number; costo_hora: number; actualizado_en: string; etapa: { nombre: string; orden: number; color: string } }[]>(
      supabase.from("tarifas_mano_obra").select("etapa_id, costo_hora, actualizado_en, etapa:etapas(nombre, orden, color)") as never),
  });
  async function guardar(etapa: number, v: number | null) {
    if (v == null || v < 0) return;
    const { error } = await supabase.from("tarifas_mano_obra").update({ costo_hora: v, actualizado_en: new Date().toISOString() }).eq("etapa_id", etapa);
    if (error) { toast.error(mensajeError(error)); return; }
    toast.success("Tarifa actualizada: costos y precios recalculados.");
    qc.invalidateQueries({ queryKey: ["costeo"] });
  }
  const filas = [...(t.data ?? [])].sort((a, b) => a.etapa.orden - b.etapa.orden);
  return (
    <Tarjeta className="lg:col-span-2">
      <EncabezadoTarjeta titulo="Mano de obra por etapa" descripcion="Costo por hora hombre: se multiplica por las horas de cada etapa de cada equipo." />
      <div className="px-5 pb-4 grid sm:grid-cols-2 gap-x-6">
        {filas.map((f) => (
          <div key={f.etapa_id} className="flex items-center gap-2 border-b border-borde/70 py-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: f.etapa.color }} />
            <span className="flex-1">{f.etapa.nombre}</span>
            <span className="w-28 text-right inline-flex items-center gap-0.5">{editar && <span className="text-tenue text-xs">$</span>}{editar ? <CeldaNumero col="tarifa" valor={Number(f.costo_hora)} etiqueta={`Tarifa de ${f.etapa.nombre}`} alGuardar={(v) => guardar(f.etapa_id, v)} />
              : <span className="cifra">{dinero(f.costo_hora)}</span>}</span>
            <span className="text-xs text-tenue w-5">/h</span>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

interface CambioBitacora { id: number; tabla: string; registro_id: string; accion: string; cambios: Record<string, [unknown, unknown]> | null; usuario_id: string | null; en: string }
const TABLAS: Record<string, string> = { politicas_precio: "Política", configuracion: "Configuración", tarifas_mano_obra: "Tarifa", tipos_cambio: "Tipo de cambio", categorias: "Categoría" };

function UltimosCambios({ politicas }: { politicas: Politica[] }) {
  const b = useQuery({
    queryKey: ["costeo", "bitacora-margenes"],
    queryFn: async () => {
      const filas = await q<CambioBitacora[]>(supabase.from("bitacora").select("*").in("tabla", Object.keys(TABLAS)).order("en", { ascending: false }).limit(12));
      const ids = [...new Set(filas.map((f) => f.usuario_id).filter(Boolean))] as string[];
      const nombres = ids.length ? await q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre").in("id", ids)) : [];
      return filas.map((f) => ({ ...f, quien: nombres.find((n) => n.id === f.usuario_id)?.nombre ?? "sistema" }));
    },
  });
  const describir = (f: CambioBitacora) => {
    const objeto = f.tabla === "politicas_precio" ? politicas.find((p) => String(p.id) === f.registro_id)?.nombre ?? f.registro_id
      : f.tabla === "configuracion" ? (f.registro_id === "isr_compensacion" ? "ISR de compensación" : f.registro_id) : "";
    if (f.accion !== "cambio" || !f.cambios) return `${TABLAS[f.tabla]} ${objeto} ${f.accion === "alta" ? "agregada" : "eliminada"}`;
    const partes = Object.entries(f.cambios).filter(([k]) => k !== "actualizado_en").map(([k, [a, d]]) => {
      const fmt = (v: unknown) => (typeof v === "number" && v < 1 && v > 0 ? pct(v) : typeof v === "object" ? "…" : String(v));
      return `${k.replace(/_/g, " ")}: ${fmt(a)} → ${fmt(d)}`;
    });
    return `${TABLAS[f.tabla]} ${objeto} · ${partes.join(", ")}`;
  };
  if (b.error) return null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Últimos cambios" descripcion="Cada cambio queda solo en la bitácora, con quién y cuándo (ya no hace falta la nota en la columna N)"
        acciones={<Link to="/sistema/bitacora" className="text-sm text-marca-texto">Ver bitácora</Link>} />
      {(b.data?.length ?? 0) === 0 ? <p className="px-5 pb-5 text-sm text-tenue">Sin cambios registrados todavía.</p> : (
        <ul className="px-5 pb-4 divide-y divide-borde text-sm">
          {b.data!.map((f) => (
            <li key={f.id} className="py-2 flex gap-3">
              <History className="h-4 w-4 text-tenue shrink-0 mt-0.5" />
              <span className="flex-1 min-w-0">{describir(f)}</span>
              <span className="text-xs text-tenue whitespace-nowrap">{f.quien} · {fechaYHora(f.en)}</span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export default function Margenes() {
  const { puede, tieneRol } = useSesion();
  const editar = puede("costos", 3);
  const [editando, setEditando] = useState<Politica | null>(null);
  const pol = useQuery({
    queryKey: ["costeo", "politicas"],
    queryFn: async () => (await q<Politica[]>(supabase.from("politicas_precio").select("*").order("id"))).map((p) => ({
      ...p, utilidad: Number(p.utilidad), pct_medida_especial: Number(p.pct_medida_especial), descuento_maximo: Number(p.descuento_maximo),
      recargos_costo: p.recargos_costo.map((r) => ({ ...r, pct: Number(r.pct) })), recargos_precio: p.recargos_precio.map((r) => ({ ...r, pct: Number(r.pct) })),
    })),
  });
  const cats = useQuery({
    queryKey: ["costeo", "categorias-politica"],
    queryFn: () => q<{ id: number; nombre: string; politica_id: number | null }[]>(supabase.from("categorias").select("id, nombre, politica_id").not("politica_id", "is", null)),
  });
  const isr = useQuery({
    queryKey: ["costeo", "isr"],
    queryFn: async () => Number((await q<{ valor: unknown }>(supabase.from("configuracion").select("valor").eq("clave", "isr_compensacion").single())).valor),
  });
  const catsDe = (id: number) => (cats.data ?? []).filter((c) => c.politica_id === id).map((c) => c.nombre).sort();
  const equipos = (pol.data ?? []).filter((p) => p.compensar_isr);
  const otras = (pol.data ?? []).filter((p) => !p.compensar_isr);

  return (
    <Pagina titulo="Márgenes y precios"
      descripcion={editar ? "El panel de utilidad (antes la pestaña Reglas). Antes de guardar ves cuántos precios se mueven; cada cambio queda en la bitácora."
        : "El panel de utilidad (antes la pestaña Reglas). Solo dirección puede cambiarlo."}>
      {pol.isLoading ? <Cargando filas={6} /> : pol.error ? <ErrorCarga error={pol.error} /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <div className="space-y-4">
              <TarjetaIsr isr={isr.data} editar={editar} />
              <TarjetaTipoCambio />
            </div>
            <TarjetaTarifas editar={editar} />
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-3"><Hammer className="h-4 w-4 text-tenue" /> Equipos y subensambles <span className="text-sm font-normal text-tenue">· utilidad neta de ISR, como en Nuevo Costeo</span></h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {equipos.map((p) => <TarjetaPolitica key={p.id} p={p} categorias={catsDe(p.id)} editar={editar} alEditar={() => setEditando(p)} />)}
            </div>
          </div>
          {otras.length > 0 && (
            <div>
              <h2 className="font-semibold flex items-center gap-2 mb-3"><DollarSign className="h-4 w-4 text-tenue" /> Lo que se revende <span className="text-sm font-normal text-tenue">· margen sobre precio (costo ÷ 0.70)</span></h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {otras.map((p) => <TarjetaPolitica key={p.id} p={p} categorias={catsDe(p.id)} editar={editar} alEditar={() => setEditando(p)} />)}
              </div>
            </div>
          )}
          {(tieneRol("direccion") || puede("admin")) && <UltimosCambios politicas={pol.data ?? []} />}
          {!editar && (
            <p className="text-sm text-tenue flex items-center gap-2"><Percent className="h-4 w-4" /> Para cambiar una utilidad o un recargo, pídeselo a dirección: el simulador le muestra cuántos precios se mueven antes de guardar.</p>
          )}
        </>
      )}
      {editando && <EditarPolitica politica={editando} categorias={catsDe(editando.id)} alCerrar={() => setEditando(null)} />}
    </Pagina>
  );
}

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero } from "@/lib/formato";
import { CeldaCheck, CeldaTexto, SoloLectura } from "./Editables";
import { TarjetaForm, useConfiguracion, useGuardarConfig } from "./ConfigEmpresa";

interface Texto { id: number; tipo: "pago" | "entrega" | "vigencia" | "nota"; texto: string; por_defecto: boolean; orden: number; activo: boolean }
interface Plan { meses: number; etiqueta: string; tasa: number; activo: boolean }
interface Canal { canal: string; comision_pct: number; cuota_fija: number; umbral_cuota_fija: number; costo_envio: number; notas: string | null }

const TIPOS_TEXTO: { tipo: Texto["tipo"]; titulo: string; ayuda: string }[] = [
  { tipo: "pago", titulo: "Condiciones de pago", ayuda: "Una por defecto." },
  { tipo: "entrega", titulo: "Tiempo de entrega", ayuda: "Una por defecto." },
  { tipo: "vigencia", titulo: "Vigencia", ayuda: "Una por defecto." },
  { tipo: "nota", titulo: "Notas al pie", ayuda: "Las marcadas por defecto salen en cada cotización nueva." },
];
const NOMBRE_CANAL: Record<string, string> = {
  directo: "Venta directa", mostrador: "Mostrador", distribuidor: "Distribuidor", mercadolibre: "Mercado Libre", sitio_web: "Sitio web", amazon: "Amazon",
};

export function ConfigVentas() {
  const { puede } = useSesion();
  const cfg = useConfiguracion();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {cfg.data ? <EnvioGratis inicial={(cfg.data.envio_gratis?.valor ?? {}) as { desde_neto?: number; excluir_palabras?: string[] }} editable={puede("admin", 3)} /> : <Cargando />}
        {cfg.data ? <MesesTope inicial={Number(cfg.data.meses_tope?.valor ?? 0)} editable={puede("admin", 3)} /> : <Cargando />}
      </div>
      {cfg.data && <Cartera inicial={(cfg.data.propiedad_clientes?.valor ?? {}) as Propiedad} editable={puede("admin", 3)} />}
      <TextosComerciales editable={puede("ventas", 3) || puede("admin", 3)} />
      <div className="grid gap-4 xl:grid-cols-2 items-start">
        <PlanesMeses editable={puede("ventas", 3)} />
        <Canales editable={puede("ventas", 3)} />
      </div>
    </div>
  );
}

interface Propiedad { meses_venta?: number; dias_seguimiento?: number; activa?: boolean }
const ESTADOS_CARTERA = [
  { estado: "vigente", texto: "Vigentes", tono: "text-ok" },
  { estado: "vencido", texto: "Vencidos (se liberarían)", tono: "text-aviso" },
  { estado: "libre", texto: "Libres", tono: "text-tenue" },
] as const;

/** Regla de cartera: de quién es cada cliente. Se revisa la vista previa antes de encenderla. */
function Cartera({ inicial, editable }: { inicial: Propiedad; editable: boolean }) {
  const [f, setF] = useState({ meses: String(inicial.meses_venta ?? 12), dias: String(inicial.dias_seguimiento ?? 90), activa: !!inicial.activa });
  const guardar = useGuardarConfig("Regla de cartera guardada");
  const cartera = useQuery({
    queryKey: ["v_cartera", "resumen"],
    queryFn: () => q<{ estado: "vigente" | "vencido" | "libre"; vendedor: string | null }[]>(supabase.from("v_cartera").select("estado, vendedor")),
  });
  const vendedores = [...new Set((cartera.data ?? []).filter((c) => c.vendedor).map((c) => c.vendedor!))].sort();
  const cuenta = (estado: string, vendedor?: string) => (cartera.data ?? []).filter((c) => c.estado === estado && (vendedor === undefined || c.vendedor === vendedor)).length;
  const cambiaParametros = String(inicial.meses_venta ?? 12) !== f.meses || String(inicial.dias_seguimiento ?? 90) !== f.dias;
  return (
    <TarjetaForm titulo="Cartera de clientes" editable={editable} quien="sistemas o dirección" guardando={guardar.isPending}
      descripcion="Un cliente es del vendedor mientras le haya vendido en los últimos meses o le dé seguimiento. Vencido = queda libre; libre = es del primero que lo cotiza."
      pie={f.activa ? "Encendida: cada noche se liberan los vencidos y no se puede cotizar a un cliente vigente de otro." : "Apagada: solo se calcula y se muestra."}
      alGuardar={() => guardar.mutate({ clave: "propiedad_clientes", valor: { ...inicial, meses_venta: Number(f.meses), dias_seguimiento: Number(f.dias), activa: f.activa } })}>
      <div className="grid gap-4 sm:grid-cols-3 items-end">
        <Campo etiqueta="Meses desde la última venta" ayuda="Si le vendió en este plazo, es suyo.">
          <Entrada type="number" min="1" value={f.meses} onChange={(e) => setF({ ...f, meses: e.target.value })} className="cifra w-28 block" />
        </Campo>
        <Campo etiqueta="Días desde el último seguimiento" ayuda="Una llamada o visita registrada también lo conserva.">
          <Entrada type="number" min="1" value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} className="cifra w-28 block" />
        </Campo>
        <label className="flex items-start gap-2 text-sm pb-6">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} />
          <span><b>Regla encendida</b><span className="block text-xs text-tenue">Enciéndela después de revisar la vista previa con los vendedores.</span></span>
        </label>
      </div>
      <div className="rounded-xl border border-borde overflow-hidden">
        <div className="px-3 py-2 bg-fondo/60 border-b border-borde flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Vista previa con la regla guardada</p>
          {cambiaParametros && <p className="text-xs text-aviso">Guarda los cambios para recalcularla.</p>}
        </div>
        {cartera.isLoading ? <Cargando filas={3} /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Vendedor</th>{ESTADOS_CARTERA.slice(0, 2).map((e) => <th key={e.estado} className="!text-right">{e.texto}</th>)}</tr></thead>
              <tbody>
                {vendedores.map((v) => (
                  <tr key={v}><td>{v}</td>{ESTADOS_CARTERA.slice(0, 2).map((e) => <td key={e.estado} className={`text-right cifra ${e.tono}`}>{cuenta(e.estado, v)}</td>)}</tr>
                ))}
                <tr className="font-medium">
                  <td>Total</td>{ESTADOS_CARTERA.slice(0, 2).map((e) => <td key={e.estado} className={`text-right cifra ${e.tono}`}>{cuenta(e.estado)}</td>)}
                </tr>
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-tenue border-t border-borde">Además hay <b className="cifra">{cuenta("libre")}</b> clientes libres (sin vendedor): son del primero que los cotice.</p>
          </div>
        )}
      </div>
    </TarjetaForm>
  );
}

function EnvioGratis({ inicial, editable }: { inicial: { desde_neto?: number; excluir_palabras?: string[] }; editable: boolean }) {
  const [desde, setDesde] = useState(String(inicial.desde_neto ?? 5000));
  const [palabras, setPalabras] = useState<string[]>(inicial.excluir_palabras ?? []);
  const [nueva, setNueva] = useState("");
  const guardar = useGuardarConfig("Regla de envío gratis guardada");
  const agregar = () => { const p = nueva.trim().toLowerCase(); if (p && !palabras.includes(p)) setPalabras([...palabras, p]); setNueva(""); };
  return (
    <TarjetaForm titulo="Envío gratis" descripcion="La regla del BUSCADOR: desde cierto monto con IVA, salvo productos pesados." editable={editable} quien="sistemas o dirección"
      guardando={guardar.isPending} alGuardar={() => guardar.mutate({ clave: "envio_gratis", valor: { ...inicial, desde_neto: Number(desde), excluir_palabras: palabras } })}>
      <Campo etiqueta="Desde (con IVA)" ayuda={`Hoy: envío gratis desde ${dinero(Number(desde) || 0)}.`}>
        <Entrada type="number" step="100" min="0" value={desde} onChange={(e) => setDesde(e.target.value)} className="cifra w-40 block" />
      </Campo>
      <div>
        <p className="text-sm font-medium mb-1.5">No aplica si el nombre lleva</p>
        <div className="flex flex-wrap gap-1.5">
          {palabras.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-fondo border border-borde px-2.5 py-0.5 text-xs">
              {p}{editable && <button type="button" aria-label={`Quitar ${p}`} onClick={() => setPalabras(palabras.filter((x) => x !== p))}><X className="h-3 w-3" /></button>}
            </span>
          ))}
          {editable && (
            <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Agregar palabra y Enter"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
              className="h-6 rounded-full border border-dashed border-borde bg-transparent px-2.5 text-xs w-44 focus:outline-none focus:border-marca" />
          )}
        </div>
      </div>
    </TarjetaForm>
  );
}

function MesesTope({ inicial, editable }: { inicial: number; editable: boolean }) {
  const [v, setV] = useState(String(inicial));
  const guardar = useGuardarConfig("Tope de meses guardado");
  return (
    <TarjetaForm titulo="Meses con tarjeta" descripcion="Monto máximo que el banco deja diferir por transacción." editable={editable} quien="sistemas o dirección"
      guardando={guardar.isPending} alGuardar={() => guardar.mutate({ clave: "meses_tope", valor: Number(v) })}>
      <Campo etiqueta="Tope por transacción" ayuda={`Arriba de ${dinero(Number(v) || 0)} el cotizador no ofrece meses.`}>
        <Entrada type="number" step="1000" min="0" value={v} onChange={(e) => setV(e.target.value)} className="cifra w-40 block" />
      </Campo>
    </TarjetaForm>
  );
}

function TextosComerciales({ editable }: { editable: boolean }) {
  const textos = useQuery({ queryKey: ["textos_comerciales"], queryFn: () => q<Texto[]>(supabase.from("textos_comerciales").select("*").order("orden")) });
  const cambiar = useAccion(({ id, datos }: { id: number; datos: Partial<Texto> }) => q(supabase.from("textos_comerciales").update(datos).eq("id", id)),
    { invalidar: [["textos_comerciales"]] });
  const agregar = useAccion((t: { tipo: Texto["tipo"]; texto: string; orden: number }) => q(supabase.from("textos_comerciales").insert(t)),
    { exito: "Texto agregado", invalidar: [["textos_comerciales"]] });
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Textos comerciales" descripcion="Las opciones que el vendedor elige en la cotización (pestaña PoliticaDePago de la hoja). Se guarda al salir del campo." />
      <div className="px-5 pb-5 space-y-4">
        {!editable && <SoloLectura quien="gerencia de ventas, sistemas o dirección" />}
        {textos.isLoading ? <Cargando /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {TIPOS_TEXTO.map((t) => {
              const lista = (textos.data ?? []).filter((x) => x.tipo === t.tipo);
              return (
                <div key={t.tipo} className="rounded-xl border border-borde overflow-hidden">
                  <div className="px-3 py-2 bg-fondo/60 border-b border-borde flex items-baseline justify-between gap-2">
                    <p className="font-medium text-sm">{t.titulo}</p><p className="text-xs text-tenue">{t.ayuda}</p>
                  </div>
                  <table className="tabla">
                    <thead><tr><th className="w-14">Orden</th><th>Texto</th><th className="w-16 !text-center" title="Por defecto">Def.</th><th className="w-16 !text-center">Activo</th></tr></thead>
                    <tbody>
                      {lista.length === 0 && <tr><td colSpan={4} className="text-tenue text-xs">Sin opciones todavía.</td></tr>}
                      {lista.map((x) => (
                        <tr key={x.id} className={x.activo ? "" : "opacity-60"}>
                          <td><CeldaTexto tipo="number" valor={x.orden} deshabilitado={!editable} ariaLabel="Orden" className="w-14 px-2" alGuardar={(v) => cambiar.mutate({ id: x.id, datos: { orden: Number(v) } })} /></td>
                          <td><CeldaTexto valor={x.texto} deshabilitado={!editable} ariaLabel="Texto" alGuardar={(v) => v.trim() && cambiar.mutate({ id: x.id, datos: { texto: v.trim() } })} /></td>
                          <td className="text-center"><CeldaCheck valor={x.por_defecto} deshabilitado={!editable} ariaLabel="Por defecto" alCambiar={(v) => cambiar.mutate({ id: x.id, datos: { por_defecto: v } })} /></td>
                          <td className="text-center"><CeldaCheck valor={x.activo} deshabilitado={!editable} ariaLabel="Activo" alCambiar={(v) => cambiar.mutate({ id: x.id, datos: { activo: v } })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {editable && <NuevoTexto alAgregar={(texto) => agregar.mutate({ tipo: t.tipo, texto, orden: Math.max(0, ...lista.map((x) => x.orden)) + 1 })} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

function NuevoTexto({ alAgregar }: { alAgregar: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="flex gap-2 p-2 border-t border-borde" onSubmit={(e: FormEvent) => { e.preventDefault(); if (t.trim()) { alAgregar(t.trim()); setT(""); } }}>
      <Entrada value={t} onChange={(e) => setT(e.target.value)} placeholder="Nueva opción…" className="h-8" />
      <Boton type="submit" tamano="sm" variante="secundario" disabled={!t.trim()}><Plus className="h-4 w-4" /> Agregar</Boton>
    </form>
  );
}

function PlanesMeses({ editable }: { editable: boolean }) {
  const planes = useQuery({ queryKey: ["planes_meses"], queryFn: () => q<Plan[]>(supabase.from("planes_meses").select("*").order("meses")) });
  const cambiar = useAccion(({ meses, datos }: { meses: number; datos: Partial<Plan> }) => q(supabase.from("planes_meses").update(datos).eq("meses", meses)),
    { invalidar: [["planes_meses"]] });
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Planes de meses" descripcion="Mensualidad = total ÷ (1 − tasa) ÷ meses. La tasa es la comisión del banco con IVA que paga el cliente." />
      <div className="px-5 pb-5 space-y-3">
        {!editable && <SoloLectura quien="gerencia de ventas o dirección (mueve lo que paga el cliente)" />}
        {planes.isLoading ? <Cargando /> : (
          <table className="tabla">
            <thead><tr><th className="w-16">Meses</th><th>Leyenda en la cotización</th><th className="w-28 !text-right">Tasa %</th><th className="w-16 !text-center">Activo</th></tr></thead>
            <tbody>
              {(planes.data ?? []).map((p) => (
                <tr key={p.meses} className={p.activo ? "" : "opacity-60"}>
                  <td className="cifra font-medium">{p.meses}</td>
                  <td><CeldaTexto valor={p.etiqueta} deshabilitado={!editable} ariaLabel="Leyenda" alGuardar={(v) => cambiar.mutate({ meses: p.meses, datos: { etiqueta: v } })} /></td>
                  <td><CeldaTexto tipo="number" paso="0.01" valor={Math.round(Number(p.tasa) * 10000) / 100} deshabilitado={!editable} ariaLabel="Tasa"
                    alGuardar={(v) => cambiar.mutate({ meses: p.meses, datos: { tasa: Number(v) / 100 } })} /></td>
                  <td className="text-center"><CeldaCheck valor={p.activo} deshabilitado={!editable} ariaLabel="Activo" alCambiar={(v) => cambiar.mutate({ meses: p.meses, datos: { activo: v } })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Tarjeta>
  );
}

function Canales({ editable }: { editable: boolean }) {
  const canales = useQuery({ queryKey: ["canales"], queryFn: () => q<Canal[]>(supabase.from("canales").select("*")) });
  const cambiar = useAccion(({ canal, datos }: { canal: string; datos: Partial<Canal> }) => q(supabase.from("canales").update(datos).eq("canal", canal)),
    { exito: "Canal actualizado: los precios de ese canal se recalculan", invalidar: [["canales"]] });
  const orden = Object.keys(NOMBRE_CANAL);
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Canales y comisiones" descripcion="Precio en el canal = precio ÷ (1 − comisión), más la cuota fija abajo del umbral y el envío si se publica con envío." />
      <div className="px-5 pb-5 space-y-3">
        {!editable && <SoloLectura quien="gerencia de ventas o dirección (mueve los precios publicados)" />}
        {canales.isLoading ? <Cargando /> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Canal</th><th className="!text-right">Comisión %</th><th className="!text-right">Cuota fija</th><th className="!text-right">Umbral</th><th className="!text-right">Envío</th></tr></thead>
              <tbody>
                {[...(canales.data ?? [])].sort((a, b) => orden.indexOf(a.canal) - orden.indexOf(b.canal)).map((c) => (
                  <tr key={c.canal}>
                    <td><p className="font-medium whitespace-nowrap">{NOMBRE_CANAL[c.canal] ?? c.canal}</p>{c.notas && <p className="text-xs text-tenue max-w-[220px]">{c.notas}</p>}</td>
                    <td><CeldaTexto tipo="number" paso="0.01" className="w-20" valor={Math.round(Number(c.comision_pct) * 10000) / 100} deshabilitado={!editable} ariaLabel="Comisión"
                      alGuardar={(v) => cambiar.mutate({ canal: c.canal, datos: { comision_pct: Number(v) / 100 } })} /></td>
                    <td><CeldaTexto tipo="number" paso="0.01" className="w-20" valor={c.cuota_fija} deshabilitado={!editable} ariaLabel="Cuota fija"
                      alGuardar={(v) => cambiar.mutate({ canal: c.canal, datos: { cuota_fija: Number(v) } })} /></td>
                    <td><CeldaTexto tipo="number" paso="1" className="w-20" valor={c.umbral_cuota_fija} deshabilitado={!editable} ariaLabel="Umbral"
                      alGuardar={(v) => cambiar.mutate({ canal: c.canal, datos: { umbral_cuota_fija: Number(v) } })} /></td>
                    <td><CeldaTexto tipo="number" paso="1" className="w-20" valor={c.costo_envio} deshabilitado={!editable} ariaLabel="Envío"
                      alGuardar={(v) => cambiar.mutate({ canal: c.canal, datos: { costo_envio: Number(v) } })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

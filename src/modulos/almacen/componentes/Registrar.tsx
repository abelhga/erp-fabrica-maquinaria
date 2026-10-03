import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, ArrowLeftRight, Lock, X } from "lucide-react";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fechaYHora, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CantidadConSigno, InsigniaMovimiento, nombreCorto, unidadEn, useAlmacenes, type TipoMovimiento } from "./comun";

type Modo = "salida" | "devolucion" | "traspaso";
type TipoSalida = "salida_venta" | "salida_consumo";

const MOTIVOS: Record<string, string[]> = {
  salida_venta: ["Venta mostrador", "Venta ML", "Venta ML Full", "Venta web"],
  salida_consumo: ["Taller", "EPP", "Plasma", "Torno", "Pintura", "Uniformes", "Mantenimiento"],
  devolucion: ["Sobró de la orden", "Devolución de cliente", "Garantía"],
  traspaso: ["Cambio de almacén", "Envío a ML Full", "Reacomodo"],
};

interface ArticuloElegido { id: string; clave: string; nombre: string; unidad: string }

/**
 * Captura de una sola línea pensada para el celular del almacenista: artículo,
 * de dónde, cuánto y para qué. Reemplaza la fila de A·Registro, donde 1,736
 * salidas quedaron sin motivo y cualquiera podía regresar a cambiar una vieja.
 */
export function Registrar({ irAAjustes }: { irAAjustes: () => void }) {
  const { perfil } = useSesion();
  const [params, setParams] = useSearchParams();
  const almacenes = useAlmacenes();
  const [modo, setModo] = useState<Modo>("salida");
  const [tipoSalida, setTipoSalida] = useState<TipoSalida>("salida_consumo");
  const [articulo, setArticulo] = useState<ArticuloElegido | null>(null);
  const [almacen, setAlmacen] = useState<number | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const refCantidad = useRef<HTMLInputElement>(null);
  const refMotivo = useRef<HTMLInputElement>(null);

  // Llega desde Existencias con ?articulo=…: se precarga.
  const desdeUrl = params.get("articulo");
  useEffect(() => {
    if (!desdeUrl) return;
    supabase.from("articulos").select("id, clave, nombre, unidad").eq("id", desdeUrl).maybeSingle().then(({ data }) => {
      if (data) elegir(data as ArticuloElegido);
      const p = new URLSearchParams(params); p.delete("articulo"); setParams(p, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeUrl]);

  const existencias = useQuery({
    queryKey: ["existencias_articulo", articulo?.id],
    enabled: !!articulo,
    queryFn: () => q<{ almacen_id: number; cantidad: number }[]>(supabase.from("existencias").select("almacen_id, cantidad").eq("articulo_id", articulo!.id)),
  });
  const hayEn = (id: number | null) => Number(existencias.data?.find((e) => e.almacen_id === id)?.cantidad ?? 0);

  // Al elegir artículo se propone el almacén donde más hay (lo normal es sacar de ahí).
  useEffect(() => {
    if (!existencias.data || almacen != null) return;
    const mayor = [...existencias.data].filter((e) => Number(e.cantidad) > 0).sort((a, b) => Number(b.cantidad) - Number(a.cantidad))[0];
    if (mayor && modo !== "devolucion") setAlmacen(mayor.almacen_id);
    else if (modo === "devolucion") setAlmacen(mayor?.almacen_id ?? almacenes.data?.[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existencias.data]);

  function elegir(a: ArticuloElegido | ArticuloEncontrado) {
    setArticulo({ id: a.id, clave: a.clave, nombre: a.nombre, unidad: a.unidad });
    setAlmacen(null);
    setTimeout(() => refCantidad.current?.focus(), 50);
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const mios = useQuery({
    queryKey: ["mis_movimientos_hoy", perfil?.id],
    enabled: !!perfil,
    queryFn: () => q<{ id: number; en: string; tipo: TipoMovimiento; clave: string; nombre: string; unidad: string; almacen: string; cantidad: number; referencia: string | null; motivo: string | null }[]>(
      supabase.from("v_movimientos").select("id, en, tipo, clave, nombre, unidad, almacen, cantidad, referencia, motivo")
        .eq("usuario_id", perfil!.id).gte("en", hoy.toISOString()).order("en", { ascending: false }).order("id", { ascending: false }).limit(30)),
  });

  const n = Number(cantidad.replace(",", "."));
  const sale = modo !== "devolucion";
  const insuficiente = sale && almacen != null && existencias.data && n > hayEn(almacen);
  const listo = !!articulo && almacen != null && n > 0 && motivo.trim().length > 0 && (modo !== "traspaso" || (destino != null && destino !== almacen));

  const guardar = useAccion(async () => {
    const base = { p_articulo: articulo!.id, p_cantidad: n };
    if (modo === "salida") return q(supabase.rpc("registrar_salida", { ...base, p_almacen: almacen, p_tipo: tipoSalida, p_motivo: motivo.trim() }));
    if (modo === "devolucion") return q(supabase.rpc("registrar_devolucion", { ...base, p_almacen: almacen, p_motivo: motivo.trim() }));
    return q(supabase.rpc("traspasar", { ...base, p_de: almacen, p_a: destino, p_motivo: motivo.trim() }));
  }, {
    exito: () => `${modo === "salida" ? "Salida" : modo === "devolucion" ? "Devolución" : "Traspaso"} registrada: ${numero(n)} ${unidadEn(articulo?.unidad ?? "", n)} de ${articulo?.nombre ?? ""}`,
    invalidar: [["mis_movimientos_hoy"], ["v_existencias"], ["existencias_articulo"], ["kardex"], ["v_movimientos"]],
    alTerminar: () => { setArticulo(null); setAlmacen(null); setDestino(null); setCantidad(""); setMotivo(""); },
  });

  const motivos = MOTIVOS[modo === "salida" ? tipoSalida : modo];
  const nombreAlm = (id: number | null) => almacenes.data?.find((a) => a.id === id)?.nombre ?? "";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,560px)_1fr] items-start">
      <div className="space-y-4">
        <div className="rounded-xl border border-aviso/30 bg-aviso-suave px-4 py-3 text-sm flex gap-3">
          <Lock className="h-4 w-4 text-aviso shrink-0 mt-0.5" />
          <p>
            <b>Un movimiento registrado no se edita ni se borra.</b> Si te equivocaste, no lo vuelvas a capturar al revés:{" "}
            <button className="underline font-medium text-marca-texto" onClick={irAAjustes}>pide un ajuste</button> y lo autoriza otra persona.
          </p>
        </div>

        <Tarjeta className="p-4 sm:p-5">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (listo && !guardar.isPending) guardar.mutate(undefined); }}>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-fondo p-1" role="radiogroup" aria-label="Tipo de movimiento">
              {([
                ["salida", "Salida", ArrowUpFromLine], ["devolucion", "Devolución", ArrowDownToLine], ["traspaso", "Traspaso", ArrowLeftRight],
              ] as const).map(([v, t, I]) => (
                <button key={v} type="button" role="radio" aria-checked={modo === v} onClick={() => { setModo(v); setMotivo(""); }}
                  className={cn("h-10 rounded-md text-sm font-medium inline-flex items-center justify-center gap-1.5 transition",
                    modo === v ? "bg-superficie shadow-sm text-marca-texto" : "text-tenue hover:text-texto")}>
                  <I className="h-4 w-4" />{t}
                </button>
              ))}
            </div>

            {modo === "salida" && (
              <div className="flex gap-2">
                {([["salida_consumo", "Consumo (taller, EPP, plasma…)"], ["salida_venta", "Venta (mostrador, ML)"]] as const).map(([v, t]) => (
                  <button key={v} type="button" onClick={() => { setTipoSalida(v); setMotivo(""); }}
                    className={cn("flex-1 rounded-lg border px-3 py-2 text-sm text-left transition",
                      tipoSalida === v ? "border-marca bg-marca-suave text-marca-texto font-medium" : "border-borde text-tenue hover:text-texto")}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Artículo</span>
              {articulo ? (
                <div className="flex items-center gap-2 rounded-lg border border-marca/40 bg-marca-suave/40 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{articulo.nombre}</p>
                    <p className="text-xs text-tenue">{articulo.clave} · {articulo.unidad}</p>
                  </div>
                  <button type="button" onClick={() => { setArticulo(null); setAlmacen(null); }} className="p-1 rounded text-tenue hover:bg-fondo" aria-label="Cambiar artículo">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <BuscadorArticulo alElegir={elegir} tipos={["componente", "materia_prima"]} mostrarPrecio={false} autoFocus
                  placeholder="Nombre o clave: chumacera 1, cangilón 5x4…" />
              )}
            </div>

            {articulo && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">{modo === "devolucion" ? "Regresa a" : modo === "traspaso" ? "Sale de" : "Sale de"}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(almacenes.data ?? []).map((a) => {
                    const hay = hayEn(a.id);
                    const vacio = sale && hay <= 0;
                    return (
                      <button key={a.id} type="button" onClick={() => setAlmacen(a.id)}
                        className={cn("rounded-lg border px-2.5 py-1.5 text-left transition min-w-[84px]",
                          almacen === a.id ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo", vacio && almacen !== a.id && "opacity-50")}>
                        <span className="block text-xs text-tenue">{nombreCorto(a.nombre)}</span>
                        <span className={cn("block text-sm font-semibold cifra", hay < 0 && "text-peligro")}>{numero(hay)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {articulo && modo === "traspaso" && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Entra a</span>
                <div className="flex flex-wrap gap-1.5">
                  {(almacenes.data ?? []).filter((a) => a.id !== almacen).map((a) => (
                    <button key={a.id} type="button" onClick={() => setDestino(a.id)}
                      className={cn("rounded-lg border px-3 py-2 text-sm transition",
                        destino === a.id ? "border-marca bg-marca-suave text-marca-texto font-medium" : "border-borde hover:bg-fondo")}>
                      {nombreCorto(a.nombre)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Cantidad</span>
                <input ref={refCantidad} inputMode="decimal" className={cn("campo h-11 text-lg cifra text-right", insuficiente && "border-peligro")}
                  value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter" && n > 0) { e.preventDefault(); refMotivo.current?.focus(); } }}
                  placeholder="0" aria-label="Cantidad" />
              </label>
              <label className="space-y-1.5 min-w-0">
                <span className="text-sm font-medium">{modo === "salida" ? "Para qué o para quién" : "Motivo"}</span>
                <input ref={refMotivo} className="campo h-11" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder={modo === "salida" ? (tipoSalida === "salida_venta" ? "Venta mostrador · cliente" : "Taller · Juan") : "Obligatorio"} />
              </label>
            </div>
            {insuficiente && (
              <p className="text-xs text-peligro -mt-2">En {nombreAlm(almacen)} solo hay {numero(hayEn(almacen))}. La base no deja sacar más de lo que hay.</p>
            )}
            <div className="flex flex-wrap gap-1.5 -mt-1">
              {motivos.map((m) => (
                <button key={m} type="button" onClick={() => { setMotivo((v) => (v.trim() && !motivos.includes(v.trim()) ? `${m} · ${v.trim()}` : m)); refMotivo.current?.focus(); }}
                  className={cn("h-7 rounded-full border px-2.5 text-xs", motivo.startsWith(m) ? "border-marca bg-marca-suave text-marca-texto" : "border-borde text-tenue hover:text-texto")}>
                  {m}
                </button>
              ))}
            </div>

            <Boton type="submit" tamano="lg" className="w-full" disabled={!listo} cargando={guardar.isPending}>
              {modo === "salida" ? "Registrar salida" : modo === "devolucion" ? "Registrar devolución" : "Registrar traspaso"}
              {listo && modo === "traspaso" && <span className="inline-flex items-center gap-1 font-normal opacity-90">· {nombreCorto(nombreAlm(almacen))} <ArrowRight className="h-3.5 w-3.5" /> {nombreCorto(nombreAlm(destino))}</span>}
            </Boton>
            <p className="text-xs text-tenue text-center">La fecha y la hora las pone el servidor. Quedas registrado como quien lo hizo.</p>
          </form>
        </Tarjeta>
      </div>

      <Tarjeta className="overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
          <h3 className="font-semibold">Lo que registraste hoy</h3>
          <span className="text-xs text-tenue cifra">{mios.data?.length ?? 0}</span>
        </div>
        {(mios.data?.length ?? 0) === 0 ? (
          <p className="px-4 pb-5 text-sm text-tenue">Todavía nada. Cada movimiento que guardes aparece aquí para que confirmes que quedó bien.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {mios.data!.map((m) => (
              <li key={m.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{m.nombre}</p>
                  <p className="text-xs text-tenue truncate">
                    <InsigniaMovimiento tipo={m.tipo} /> <span className="ml-1">{nombreCorto(m.almacen)}{m.referencia ? ` · ${m.referencia}` : ""}{m.motivo ? ` · ${m.motivo}` : ""}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <CantidadConSigno n={Number(m.cantidad)} unidad={m.unidad} />
                  <p className="text-[11px] text-tenue">{fechaYHora(m.en).split(", ").pop()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

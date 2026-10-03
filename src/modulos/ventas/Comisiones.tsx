import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, ChevronRight, Info, Plus, Trash2, Trophy } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Barra, CampoNumero } from "./componentes/campos";
import { CANAL, hoyMx, type Canal } from "./comun";

interface FilaComision {
  vendedor_id: string; vendedor: string; plan: string; venta_maquinaria: number; venta_refacciones: number; venta_otros: number;
  comision: number; bono_meta: number; bono_refacciones: number; ajustes: number; total: number; siguiente_meta: number | null; pagado_en: string | null;
}
interface Plan { id: number; nombre: string; pct_maquinaria: number; otros_como_maquinaria: boolean; base: "pedido" | "factura" | "cobro" }
interface Escalon { plan_id: number; tipo: "meta_maquinaria" | "bono_refacciones"; desde: number; bono: number }
interface Ajuste { id: string; vendedor_id: string; concepto: string; monto: number }

/** Los meses para el selector, del actual hacia atrás (y el elegido aunque sea más viejo). */
function ultimosMeses(n: number, elegido: string) {
  const hoy = new Date(hoyMx() + "T12:00:00");
  const r = Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  return r.includes(elegido) ? r : [elegido, ...r];
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const BASE: Record<Plan["base"], string> = { pedido: "la fecha del pedido (como hoy en los paneles)", factura: "la fecha de la primera factura", cobro: "lo cobrado en el mes, en proporción" };

/**
 * Comisiones sin rangos de filas que alguien mueve a mano cada mes: salen de
 * los pedidos (comisiones_mes en la base). El vendedor ve la suya; gerencia,
 * dirección y finanzas ven a todos, agregan ajustes y marcan el pago.
 */
export default function Comisiones() {
  const { tieneRol, puede } = useSesion();
  const [params, setParams] = useSearchParams();
  const mesTexto = params.get("mes") ?? hoyMx().slice(0, 7);
  const mes = `${mesTexto}-01`;
  const [anio, m] = mesTexto.split("-").map(Number);
  const mover = (d: number) => { const f = new Date(anio, m - 1 + d, 1); setParams({ mes: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}` }, { replace: true }); };
  const puedeAjustar = tieneRol("direccion") || tieneRol("gerente_ventas");
  const puedePagar = puede("finanzas", 2);

  const filas = useQuery({ queryKey: ["comisiones_mes", mes], queryFn: () => q<FilaComision[]>(supabase.rpc("comisiones_mes", { p_mes: mes })) });
  const planes = useQuery({ queryKey: ["planes_comision"], staleTime: 10 * 60_000, queryFn: () => q<Plan[]>(supabase.from("planes_comision").select("id, nombre, pct_maquinaria, otros_como_maquinaria, base").eq("activo", true).order("id")) });
  const escalones = useQuery({ queryKey: ["plan_escalones"], staleTime: 10 * 60_000, queryFn: () => q<Escalon[]>(supabase.from("plan_escalones").select("*").order("desde")) });
  const ajustes = useQuery({ queryKey: ["comision_ajustes", mes], queryFn: () => q<Ajuste[]>(supabase.from("comision_ajustes").select("id, vendedor_id, concepto, monto").eq("mes", mes).order("creado_en")) });
  const pagos = useQuery({ queryKey: ["comision_pagos", mes], queryFn: () => q<{ vendedor_id: string; total: number; referencia: string | null }[]>(supabase.from("comision_pagos").select("vendedor_id, total, referencia").eq("mes", mes)) });
  const [ajustar, setAjustar] = useState<FilaComision | null>(null);
  const [pagar, setPagar] = useState<FilaComision | null>(null);

  const planDe = (f: FilaComision) => planes.data?.find((p) => p.nombre === f.plan);
  const esc = (planId: number | undefined, tipo: Escalon["tipo"]) => (escalones.data ?? []).filter((e) => e.plan_id === planId && e.tipo === tipo);
  const totalMes = (filas.data ?? []).reduce((s, f) => s + Number(f.total), 0);
  const quitar = useAccion((id: string) => q(supabase.from("comision_ajustes").delete().eq("id", id)), { exito: "Ajuste quitado", invalidar: [["comision_ajustes", mes], ["comisiones_mes", mes]] });

  return (
    <Pagina titulo="Comisiones" ancho="max-w-[1400px]"
      descripcion={(filas.data?.length ?? 0) > 1 ? `${filas.data!.length} vendedores · ${dinero(totalMes)} en el mes` : "Tu comisión del mes, calculada sola con tus pedidos."}
      acciones={
        <div className="flex items-center gap-1">
          <Boton variante="secundario" tamano="icono" aria-label="Mes anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Boton>
          <select className="campo w-auto pr-8" value={mesTexto} onChange={(e) => setParams({ mes: e.target.value }, { replace: true })} aria-label="Mes">
            {ultimosMeses(24, mesTexto).map((x) => <option key={x} value={x}>{MESES[Number(x.slice(5)) - 1]} {x.slice(0, 4)}</option>)}
          </select>
          <Boton variante="secundario" tamano="icono" aria-label="Mes siguiente" onClick={() => mover(1)} disabled={mesTexto >= hoyMx().slice(0, 7)}><ChevronRight className="h-4 w-4" /></Boton>
        </div>
      }>
      {filas.isLoading ? <div className="tarjeta"><Cargando /></div> : (filas.data?.length ?? 0) === 0 ? (
        <div className="tarjeta"><Vacio icono={Trophy} titulo="Sin plan de comisión" texto="Dirección asigna el plan de cada vendedor; mientras tanto no hay cálculo." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3 items-start">
          {filas.data!.map((f) => {
            const plan = planDe(f);
            const metas = esc(plan?.id, "meta_maquinaria");
            const refs = esc(plan?.id, "bono_refacciones");
            const baseMeta = Number(f.venta_maquinaria) + (plan?.otros_como_maquinaria ? Number(f.venta_otros) : 0);
            const piso = [...metas].reverse().find((e) => e.desde <= baseMeta)?.desde ?? 0;
            const sig = f.siguiente_meta != null ? Number(f.siguiente_meta) : null;
            const avanceMeta = sig ? ((baseMeta - piso) / (sig - piso)) * 100 : 100;
            const bonoSig = metas.find((e) => Number(e.desde) === sig)?.bono;
            const refSig = refs.find((e) => Number(e.desde) > Number(f.venta_refacciones));
            const refPiso = [...refs].reverse().find((e) => Number(e.desde) <= Number(f.venta_refacciones))?.desde ?? 0;
            const misAjustes = (ajustes.data ?? []).filter((a) => a.vendedor_id === f.vendedor_id);
            // Pagada con un total y hoy el cálculo da otro: alguien movió un pedido después del pago.
            const pago = f.pagado_en ? pagos.data?.find((x) => x.vendedor_id === f.vendedor_id) : undefined;
            const difiere = !!pago && Math.abs(Number(pago.total) - Number(f.total)) > 0.5;
            return (
              <Tarjeta key={f.vendedor_id} className="flex flex-col">
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-borde">
                  <div>
                    <p className="font-semibold">{f.vendedor}</p>
                    <p className="text-xs text-tenue">Plan {f.plan}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold cifra leading-tight">{dinero(f.total)}</p>
                    {f.pagado_en ? <Insignia tono="ok"><BadgeCheck className="h-3 w-3" />Pagada {fecha(f.pagado_en)}</Insignia> : <Insignia tono="aviso">Pendiente de pago</Insignia>}
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4 flex-1">
                  <section>
                    <div className="flex justify-between text-sm">
                      <span className="text-tenue">Venta de maquinaria{plan?.otros_como_maquinaria ? " y otros" : ""}</span>
                      <span className="font-medium cifra">{dinero(baseMeta)}</span>
                    </div>
                    <div className="flex justify-between text-sm"><span className="text-tenue">Comisión {porcentaje(Number(plan?.pct_maquinaria ?? 0.02), 0)}</span><span className="cifra">{dinero(f.comision)}</span></div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-tenue">Bono de meta: <b className="text-texto cifra">{dinero(f.bono_meta)}</b></span>
                        <span className="text-tenue cifra">{sig ? `meta ${dineroCompacto(sig)}` : "meta máxima"}</span>
                      </div>
                      <Barra valor={avanceMeta} tono={sig ? (avanceMeta >= 80 ? "aviso" : "marca") : "ok"} alto="h-2.5" />
                      <p className="text-xs text-tenue mt-1">
                        {sig ? <>Faltan <b className="text-texto cifra">{dinero(sig - baseMeta)}</b> para el bono de {dinero(bonoSig)}</> : "Alcanzó el escalón más alto del plan."}
                      </p>
                    </div>
                  </section>
                  <section className="border-t border-borde pt-3">
                    <div className="flex justify-between text-sm"><span className="text-tenue">Venta de refacciones</span><span className="font-medium cifra">{dinero(f.venta_refacciones)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-tenue">Bono de refacciones</span><span className="cifra">{dinero(f.bono_refacciones)}</span></div>
                    {refSig && (
                      <>
                        <Barra className="mt-2" valor={((Number(f.venta_refacciones) - Number(refPiso)) / (Number(refSig.desde) - Number(refPiso))) * 100} tono="ok" />
                        <p className="text-xs text-tenue mt-1">Faltan <b className="text-texto cifra">{dinero(Number(refSig.desde) - Number(f.venta_refacciones))}</b> para {dinero(refSig.bono)}</p>
                      </>
                    )}
                  </section>
                  <section className="border-t border-borde pt-3 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-tenue">Ajustes y bonos extra</span>
                      <span className="flex items-center gap-2">
                        <span className="cifra">{dinero(f.ajustes)}</span>
                        {puedeAjustar && <Boton variante="fantasma" tamano="sm" className="h-7 px-2" onClick={() => setAjustar(f)}><Plus className="h-3.5 w-3.5" />Ajuste</Boton>}
                      </span>
                    </div>
                    {misAjustes.map((a) => (
                      <p key={a.id} className="flex items-center justify-between text-xs text-tenue pl-3">
                        <span>{a.concepto}</span>
                        <span className="flex items-center gap-1 cifra">{dinero(a.monto)}
                          {puedeAjustar && !f.pagado_en && <button aria-label="Quitar ajuste" className="hover:text-peligro" onClick={() => quitar.mutate(a.id)}><Trash2 className="h-3 w-3" /></button>}
                        </span>
                      </p>
                    ))}
                  </section>
                  <DetallePedidos vendedorId={f.vendedor_id} mes={mes} />
                </div>
                {difiere && (
                  <p className="mx-5 mb-3 rounded-lg bg-aviso-suave px-3 py-2 text-xs">
                    Se pagaron <b className="cifra">{dinero(pago!.total)}</b>{pago!.referencia ? ` (${pago!.referencia})` : ""}; con los pedidos de hoy el cálculo
                    da <b className="cifra">{dinero(f.total)}</b>. La diferencia va como ajuste del mes siguiente.
                  </p>
                )}
                <div className="px-5 py-3 border-t border-borde bg-fondo/50 rounded-b-xl flex items-center justify-between">
                  <span className="text-sm font-medium">{f.pagado_en ? "Total pagado" : "Total a pagar"}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-lg font-semibold cifra">{dinero(pago ? pago.total : f.total)}</span>
                    {puedePagar && !f.pagado_en && <Boton tamano="sm" variante="exito" onClick={() => setPagar(f)}>Marcar pagada</Boton>}
                  </span>
                </div>
              </Tarjeta>
            );
          })}
        </div>
      )}

      <ReglaPlan planes={(planes.data ?? []).filter((p) => (filas.data ?? []).some((f) => f.plan === p.nombre))} escalones={escalones.data ?? []} />

      <DialogoAjuste f={ajustar} mes={mes} alCerrar={() => setAjustar(null)} />
      <DialogoPago f={pagar} mes={mes} alCerrar={() => setPagar(null)} />
    </Pagina>
  );
}

function DetallePedidos({ vendedorId, mes }: { vendedorId: string; mes: string }) {
  const [abierto, setAbierto] = useState(false);
  const pedidos = useQuery({
    queryKey: ["pedidos_comision", vendedorId, mes], enabled: abierto,
    queryFn: () => q<{ pedido_id: string; folio: string; fecha: string; cliente: string; canal: Canal; parte: number; maquinaria: number; refacciones: number; otros: number }[]>(
      supabase.rpc("pedidos_comision", { p_vendedor: vendedorId, p_mes: mes })),
  });
  return (
    <details className="border-t border-borde pt-3" onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary className="text-sm text-marca-texto cursor-pointer">Pedidos que cuentan este mes</summary>
      {pedidos.isLoading ? <Cargando filas={2} /> : (
        <div className="mt-2 max-h-64 overflow-y-auto">
          {(pedidos.data?.length ?? 0) === 0 ? <p className="text-xs text-tenue">Sin pedidos en el mes (o no los puedes ver).</p> : (
            <table className="w-full text-xs">
              <tbody>
                {pedidos.data!.map((p) => (
                  <tr key={p.pedido_id} className="border-b border-borde/60 last:border-0">
                    <td className="py-1 pr-2"><Link to={`/ventas/pedidos/${p.pedido_id}`} className="font-medium text-marca-texto cifra">{p.folio}</Link>
                      <span className="block text-tenue truncate max-w-[170px]">{p.cliente}{p.canal !== "directo" ? ` · ${CANAL[p.canal]}` : ""}{Number(p.parte) < 1 ? ` · ${porcentaje(Number(p.parte), 0)} del crédito` : ""}</span></td>
                    <td className="py-1 text-right cifra align-top">{dinero(Number(p.maquinaria) + Number(p.otros))}<span className="block text-tenue">{Number(p.refacciones) ? `${dinero(p.refacciones)} ref.` : ""}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </details>
  );
}

/** La regla escrita, para que nadie dependa de una hoja para saber cuánto va a cobrar. */
function ReglaPlan({ planes, escalones }: { planes: Plan[]; escalones: Escalon[] }) {
  if (!planes.length) return null;
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo={<span className="inline-flex items-center gap-2"><Info className="h-4 w-4 text-marca" />Cómo se calcula</span>}
        descripcion="Montos sin IVA. Con crédito compartido, a cada vendedor le cuenta su porcentaje del pedido." />
      <div className="px-5 pb-5 grid gap-x-10 gap-y-5 md:grid-cols-[repeat(auto-fit,minmax(320px,max-content))]">
        <div className="text-sm space-y-2 max-w-2xl md:col-span-full">
          {planes.map((p) => (
            <p key={p.id}><b>{p.nombre}:</b> {porcentaje(Number(p.pct_maquinaria), 0)} de todo lo que no es refacción
              {p.otros_como_maquinaria ? " (maquinaria y “otros”: fletes, servicios, instalaciones)" : " (solo maquinaria)"}, más un bono fijo por el
              escalón de meta alcanzado y otro por el de refacciones. Los escalones no se suman: se paga el más alto alcanzado. Cuenta según {BASE[p.base]}.</p>
          ))}
          <p className="text-tenue">Ajustes (bonos de Mercado Libre, correcciones) los agrega la gerencia o dirección; finanzas marca la comisión como pagada.</p>
        </div>
        {planes.map((p) => (
          <div key={p.id} className="text-sm">
            <p className="font-medium mb-1">{p.nombre}</p>
            <table className="text-xs">
              <thead><tr className="text-tenue"><th className="text-left pr-4 font-medium">Maquinaria desde</th><th className="text-right font-medium pr-6">Bono</th><th className="text-left pr-4 font-medium">Refacciones desde</th><th className="text-right font-medium">Bono</th></tr></thead>
              <tbody>
                {Array.from({ length: Math.max(...["meta_maquinaria", "bono_refacciones"].map((t) => escalones.filter((e) => e.plan_id === p.id && e.tipo === t).length)) }).map((_, i) => {
                  const a = escalones.filter((e) => e.plan_id === p.id && e.tipo === "meta_maquinaria")[i];
                  const b = escalones.filter((e) => e.plan_id === p.id && e.tipo === "bono_refacciones")[i];
                  return (
                    <tr key={i} className={cn("cifra", i % 2 && "bg-fondo/60")}>
                      <td className="pr-4 py-0.5">{a ? dineroCompacto(a.desde) : ""}</td><td className="text-right pr-6">{a ? dinero(a.bono) : ""}</td>
                      <td className="pr-4">{b ? dineroCompacto(b.desde) : ""}</td><td className="text-right">{b ? dinero(b.bono) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function DialogoAjuste({ f, mes, alCerrar }: { f: FilaComision | null; mes: string; alCerrar: () => void }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState<number | null>(null);
  const guardar = useAccion(
    () => q(supabase.from("comision_ajustes").insert({ vendedor_id: f!.vendedor_id, mes, concepto: concepto.trim(), monto })),
    { exito: "Ajuste agregado", invalidar: [["comision_ajustes", mes], ["comisiones_mes", mes]], alTerminar: () => { setConcepto(""); setMonto(null); alCerrar(); } },
  );
  const sugerencias = ["Bono MercadoLíder Gold", "Bono MercadoLíder Platino", "Tiempo de respuesta < 1 h", "Cuenta en verde", "Corrección de pedido mal clasificado"];
  return (
    <Dialogo abierto={!!f} alCambiar={(v) => !v && alCerrar()} titulo={`Ajuste para ${f?.vendedor ?? ""}`} descripcion="Negativo para descontar. Queda registrado quién lo autorizó."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending} disabled={!concepto.trim() || !monto}>Agregar</Boton></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{sugerencias.map((s) => <button key={s} type="button" onClick={() => setConcepto(s)} className="rounded-full border border-borde px-3 py-1 text-xs text-tenue hover:text-texto">{s}</button>)}</div>
        <Campo etiqueta="Concepto"><Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Campo>
        <Campo etiqueta="Monto"><CampoNumero valor={monto} prefijo="$" vacioEsCero={false} alCambiar={setMonto} /></Campo>
      </div>
    </Dialogo>
  );
}

function DialogoPago({ f, mes, alCerrar }: { f: FilaComision | null; mes: string; alCerrar: () => void }) {
  const [ref, setRef] = useState("");
  const [cuando, setCuando] = useState(hoyMx());
  // La base calcula el total y guarda la foto del desglose al momento del pago
  // (no lo que traiga el navegador) y no deja pagar dos veces el mismo mes.
  const guardar = useAccion(
    () => q<number>(supabase.rpc("pagar_comision", { p_vendedor: f!.vendedor_id, p_mes: mes, p_pagado_en: cuando, p_referencia: ref })),
    { exito: (t) => `Comisión de ${dinero(t)} marcada como pagada`, invalidar: [["comisiones_mes", mes], ["comision_pagos", mes]], alTerminar: () => { setRef(""); alCerrar(); } },
  );
  return (
    <Dialogo abierto={!!f} alCambiar={(v) => !v && alCerrar()} titulo={`Pagar comisión de ${f?.vendedor ?? ""}`}
      descripcion={`Se guarda una foto del cálculo (${dinero(f?.total)}) para que no cambie si después se mueve un pedido.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton variante="exito" onClick={() => guardar.mutate(undefined)} cargando={guardar.isPending}>Marcar pagada</Boton></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha de pago"><Entrada type="date" value={cuando} onChange={(e) => setCuando(e.target.value)} /></Campo>
        <Campo etiqueta="Referencia"><Entrada value={ref} onChange={(e) => setRef(e.target.value)} placeholder="SPEI, nómina…" /></Campo>
      </div>
    </Dialogo>
  );
}

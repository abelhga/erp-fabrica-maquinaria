// El dinero del embarque: pagos al proveedor en USD con el TC real (no hay cuenta
// en dólares), gastos con su criterio de prorrateo y el IVA aparte, el pedimento,
// y lo que nos tienen que regresar. Solo lo ve quien ve dinero (la RLS lo filtra).
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileText, Landmark, Plus, Receipt, Trash2, Undo2, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { abrirArchivo, CLAVE_EMBARQUES, CONCEPTOS_GASTO, ESTADOS_PAGO, subirArchivo, type Dinero, type Embarque, type Moneda } from "./comun";

interface Pago {
  id: string; orden_compra_id: string; concepto: string; estado: string; fecha: string; moneda: Moneda; monto: number; tipo_cambio: number | null;
  monto_mxn: number | null; metodo: string; cuenta_origen: string | null; referencia: string | null; comprobante: string | null; confirmado_en: string | null;
}
interface Gasto {
  id: string; concepto: string; descripcion: string | null; proveedor: string | null; factura: string | null; fecha: string; moneda: Moneda;
  monto: number; tipo_cambio: number; monto_mxn: number; iva: number; criterio: string; orden_compra_id: string | null; articulo_id: string | null; estimado: boolean;
}
interface Pedimento { id: string; numero: string; clave: string; aduana: string | null; fecha_pago: string; tipo_cambio: number | null; valor_aduana: number | null; igi: number; dta: number; iva: number; prv: number; otros: number; total: number }
interface Saldo { id: string; tipo: string; descripcion: string | null; deudor: string | null; moneda: Moneda; monto: number; fecha_origen: string; fecha_esperada: string | null; recuperado_en: string | null; monto_recuperado: number | null }

const mon = (m: Moneda) => (m === "USD" ? "USD" : "MXN");
const num = (s: string) => { const n = Number(s.replace(/[$,\s]/g, "")); return s.trim() === "" || Number.isNaN(n) ? null : n; };

export function DineroEmbarque({ e }: { e: Embarque }) {
  const { puede } = useSesion();
  const captura = puede("importaciones", 2);
  const capturaPagos = captura || puede("finanzas", 2);
  const [dialogo, setDialogo] = useState<"pago" | "gasto" | "pedimento" | "saldo" | null>(null);
  const resumen = useQuery({ queryKey: ["v_embarque_dinero", e.id], queryFn: () => q<Dinero | null>(supabase.from("v_embarque_dinero").select("*").eq("embarque_id", e.id).maybeSingle()) });
  const pagos = useQuery({ queryKey: ["embarque_pagos", e.id], queryFn: () => q<Pago[]>(supabase.from("embarque_pagos").select("*").eq("embarque_id", e.id).order("fecha")) });
  const gastos = useQuery({ queryKey: ["embarque_gastos", e.id], queryFn: () => q<Gasto[]>(supabase.from("embarque_gastos").select("*").eq("embarque_id", e.id).order("fecha")) });
  const pedimentos = useQuery({ queryKey: ["pedimentos", e.id], queryFn: () => q<Pedimento[]>(supabase.from("pedimentos").select("*").eq("embarque_id", e.id).order("fecha_pago")) });
  const saldos = useQuery({ queryKey: ["embarque_saldos", e.id], queryFn: () => q<Saldo[]>(supabase.from("embarque_saldos").select("*").eq("embarque_id", e.id).order("fecha_origen")) });
  const invalidar = [["embarque_pagos", e.id], ["embarque_gastos", e.id], ["pedimentos", e.id], ["embarque_saldos", e.id], ["v_embarque_dinero"],
    ["alertas_importacion"], CLAVE_EMBARQUES, ["embarque_eventos", e.id], ["v_importacion_por_pagar"], ["embarque_saldos", "pendientes"]];
  const cambiarPago = useAccion(({ id, cambios }: { id: string; cambios: Record<string, unknown> }) => q(supabase.from("embarque_pagos").update(cambios).eq("id", id)), { invalidar });
  const borrarGasto = useAccion((id: string) => q(supabase.from("embarque_gastos").delete().eq("id", id)), { exito: "Gasto quitado", invalidar });
  const recuperar = useAccion((s: Saldo) => q(supabase.from("embarque_saldos").update({ recuperado_en: hoyISO(), monto_recuperado: s.monto }).eq("id", s.id)),
    { exito: "Anotado como recuperado", invalidar });
  const comprobante = async (p: Pago, f: File | undefined) => {
    if (!f) return;
    try { const ruta = await subirArchivo(e.id, "comprobante", f); await cambiarPago.mutateAsync({ id: p.id, cambios: { comprobante: ruta } }); toast.success("Comprobante guardado"); }
    catch (err) { toast.error(mensajeError(err)); }
  };
  const folioOC = (id: string | null) => e.ordenes.find((o) => o.id === id)?.folio ?? "";
  const r = resumen.data;

  return (
    <div className="space-y-5">
      {r && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Cifra titulo="Mercancía" valor={dinero(r.comprometido_usd, "USD")} detalle={`Pagado ${dinero(r.pagado_usd, "USD")}${r.tc_promedio ? ` · TC real ${numero(r.tc_promedio)}` : ""}`} />
          <Cifra titulo="Por pagar al proveedor" valor={dinero(r.por_pagar_usd, "USD")} detalle={`≈ ${dinero(r.por_pagar_mxn)} hoy`} tono={Number(r.por_pagar_usd) > 0 ? "aviso" : undefined} />
          <Cifra titulo="Gastos e impuestos" valor={dinero(Number(r.gastos_mxn) + Number(r.impuestos_mxn))} detalle={`IVA acreditable aparte: ${dinero(r.iva_acreditable_mxn)}`} />
          <Cifra titulo="Por recuperar" valor={dinero(r.por_recuperar_mxn)} detalle={`Recuperado ${dinero(r.recuperado_mxn)}`} tono={Number(r.por_recuperar_mxn) > 0 ? "aviso" : undefined} />
        </div>
      )}

      <Tarjeta className="overflow-hidden">
        <EncabezadoTarjeta titulo="Pagos al proveedor" descripcion="Con el tipo de cambio real de cada pago: los pesos que salieron entre los dólares. Nunca más de lo que se debe."
          acciones={capturaPagos && e.ordenes.length > 0 && <Boton tamano="sm" onClick={() => setDialogo("pago")}><Plus className="h-4 w-4" /> Pago</Boton>} />
        {pagos.isLoading ? <Cargando filas={2} /> : !pagos.data?.length ? (
          <Vacio icono={Landmark} titulo="Sin pagos" texto={e.ordenes.length ? "Registra el anticipo cuando salga; el saldo puede quedar programado con su fecha." : "Primero liga la orden de compra del proveedor."} className="py-8" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Orden</th><th>Concepto</th><th className="text-right">Monto</th><th className="text-right">TC real</th><th className="text-right">Pesos</th><th>Estado</th><th>Comprobante</th></tr></thead>
              <tbody>
                {pagos.data.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{fecha(p.fecha)}</td>
                    <td className="text-xs">{folioOC(p.orden_compra_id)}</td>
                    <td className="capitalize text-sm">{p.concepto}{p.metodo === "ebanx" && <span className="text-xs text-tenue"> · EBANX</span>}</td>
                    <td className="text-right cifra">{dinero(p.monto, mon(p.moneda))}</td>
                    <td className="text-right cifra">{p.tipo_cambio ? numero(p.tipo_cambio) : "—"}</td>
                    <td className="text-right cifra">{p.monto_mxn != null ? dinero(p.monto_mxn) : "—"}</td>
                    <td>
                      {capturaPagos ? (
                        <select className="campo h-8 w-32 text-xs" value={p.estado} aria-label="Estado del pago"
                          onChange={(ev) => cambiarPago.mutate({ id: p.id, cambios: { estado: ev.target.value } })}>
                          {Object.entries(ESTADOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
                        </select>
                      ) : <Insignia tono={ESTADOS_PAGO[p.estado]?.tono}>{ESTADOS_PAGO[p.estado]?.texto}</Insignia>}
                    </td>
                    <td>
                      {p.comprobante
                        ? <button className="text-xs text-marca-texto hover:underline inline-flex items-center gap-1" onClick={() => abrirArchivo(p.comprobante!).catch((x) => toast.error(mensajeError(x)))}><ExternalLink className="h-3.5 w-3.5" /> Ver</button>
                        : p.estado === "programado" ? <span className="text-xs text-tenue">—</span>
                        : capturaPagos ? <label className="text-xs text-aviso inline-flex items-center gap-1 cursor-pointer hover:underline"><Upload className="h-3.5 w-3.5" /> Falta: subir
                            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(ev) => comprobante(p, ev.target.files?.[0])} /></label>
                        : <span className="text-xs text-aviso">Falta</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <Tarjeta className="overflow-hidden">
          <EncabezadoTarjeta titulo="Gastos" descripcion="Sin IVA y con su criterio de prorrateo. Los estimados entran al costeo preliminar, no al final."
            acciones={captura && <Boton tamano="sm" variante="secundario" onClick={() => setDialogo("gasto")}><Plus className="h-4 w-4" /> Gasto</Boton>} />
          {!gastos.data?.length ? <Vacio icono={Receipt} titulo="Sin gastos" texto="Flete, cargos locales, honorarios, flete a Atotonilco… o lee la cuenta de gastos con Claude." className="py-8" /> : (
            <ul className="divide-y divide-borde border-t border-borde">
              {gastos.data.map((g) => (
                <li key={g.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{CONCEPTOS_GASTO[g.concepto] ?? g.concepto}{g.descripcion && <span className="text-tenue"> · {g.descripcion}</span>}</p>
                    <p className="text-xs text-tenue">{[g.proveedor, g.factura, fecha(g.fecha), g.moneda !== "MXN" ? `${dinero(g.monto, mon(g.moneda))} × ${Number(g.tipo_cambio).toFixed(2)}` : null,
                      g.criterio === "valor" ? "por valor" : g.criterio === "volumen" ? "por volumen" : "directo",
                      g.orden_compra_id ? `solo ${folioOC(g.orden_compra_id)}` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  {g.estimado && <Insignia tono="info">estimado</Insignia>}
                  <div className="text-right">
                    <p className="cifra">{dinero(g.monto_mxn)}</p>
                    {Number(g.iva) > 0 && <p className="text-[11px] text-tenue cifra">IVA {dinero(Number(g.iva) * Number(g.tipo_cambio))}</p>}
                  </div>
                  {captura && <button className="p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label="Quitar gasto" onClick={() => borrarGasto.mutate(g.id)}><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="space-y-5">
          <Tarjeta className="overflow-hidden">
            <EncabezadoTarjeta titulo="Pedimento" descripcion="IGI, DTA y PRV son costo; el IVA de importación es acreditable."
              acciones={captura && <Boton tamano="sm" variante="secundario" onClick={() => setDialogo("pedimento")}><Plus className="h-4 w-4" /> Pedimento</Boton>} />
            {!pedimentos.data?.length ? <Vacio icono={FileText} titulo="Sin pedimento" texto="Al pagarlo se puede calcular el costeo preliminar." className="py-8" /> : (
              <ul className="divide-y divide-borde border-t border-borde">
                {pedimentos.data.map((p) => (
                  <li key={p.id} className="px-5 py-3 text-sm space-y-1">
                    <p className="font-medium cifra">{p.numero} <span className="text-tenue font-normal">· {p.clave} · pagado el {fecha(p.fecha_pago)}{p.tipo_cambio ? ` · TC ${numero(p.tipo_cambio)}` : ""}</span></p>
                    <p className="text-xs text-tenue cifra">IGI {dinero(p.igi)} · DTA {dinero(p.dta)} · PRV {dinero(p.prv)}{Number(p.otros) ? ` · otros ${dinero(p.otros)}` : ""} · IVA {dinero(p.iva)} · total {dinero(p.total)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta className="overflow-hidden">
            <EncabezadoTarjeta titulo="Por recuperar" descripcion="Saldo a favor con el agente y garantía de contenedor. No es costo: es dinero nuestro."
              acciones={capturaPagos && <Boton tamano="sm" variante="secundario" onClick={() => setDialogo("saldo")}><Plus className="h-4 w-4" /> Saldo</Boton>} />
            {!saldos.data?.length ? <Vacio icono={Undo2} titulo="Nada por recuperar" className="py-8" /> : (
              <ul className="divide-y divide-borde border-t border-borde">
                {saldos.data.map((s) => (
                  <li key={s.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p>{s.tipo === "saldo_agente" ? "Saldo a favor" : s.tipo === "garantia_contenedor" ? "Garantía de contenedor" : s.descripcion ?? "Otro"}</p>
                      <p className="text-xs text-tenue">{s.deudor ?? "—"} · {s.recuperado_en ? `recuperado el ${fecha(s.recuperado_en)}` : `se espera el ${fecha(s.fecha_esperada)}`}</p>
                    </div>
                    <span className={cn("cifra", !s.recuperado_en && s.fecha_esperada && s.fecha_esperada < hoyISO() && "text-peligro font-medium")}>{dinero(s.monto, mon(s.moneda))}</span>
                    {capturaPagos && !s.recuperado_en && <Boton tamano="sm" variante="fantasma" onClick={() => recuperar.mutate(s)}><CheckCircle2 className="h-3.5 w-3.5" /> Recuperado</Boton>}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>

      <DialogoPago abierto={dialogo === "pago"} alCambiar={(v) => !v && setDialogo(null)} e={e} invalidar={invalidar} />
      <DialogoGasto abierto={dialogo === "gasto"} alCambiar={(v) => !v && setDialogo(null)} e={e} invalidar={invalidar} />
      <DialogoPedimento abierto={dialogo === "pedimento"} alCambiar={(v) => !v && setDialogo(null)} e={e} invalidar={invalidar} />
      <DialogoSaldo abierto={dialogo === "saldo"} alCambiar={(v) => !v && setDialogo(null)} e={e} invalidar={invalidar} />
    </div>
  );
}

function Cifra({ titulo, valor, detalle, tono }: { titulo: string; valor: ReactNode; detalle?: ReactNode; tono?: "aviso" }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={cn("text-xl font-semibold cifra mt-0.5", tono === "aviso" && "text-aviso")}>{valor}</p>
      {detalle && <p className="text-xs text-tenue mt-0.5">{detalle}</p>}
    </div>
  );
}

type Invalidar = unknown[][];

function DialogoPago({ abierto, alCambiar, e, invalidar }: { abierto: boolean; alCambiar: (v: boolean) => void; e: Embarque; invalidar: Invalidar }) {
  const [d, setD] = useState({ oc: "", concepto: "anticipo", estado: "pagado", fecha: hoyISO(), monto: "", pesos: "", metodo: "transferencia", cuenta: "", referencia: "" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const oc = d.oc || (e.ordenes.length === 1 ? e.ordenes[0].id : "");
  const monto = num(d.monto), pesos = num(d.pesos);
  const tc = monto && pesos ? pesos / monto : null;
  const hecho = d.estado !== "programado";
  const guardar = useAccion(async () => {
    const comprobante = archivo ? await subirArchivo(e.id, "comprobante", archivo) : null;
    return q(supabase.from("embarque_pagos").insert({
      embarque_id: e.id, orden_compra_id: oc, concepto: d.concepto, estado: d.estado, fecha: d.fecha, monto,
      tipo_cambio: hecho && tc ? Math.round(tc * 10000) / 10000 : null, metodo: d.metodo, cuenta_origen: d.cuenta || null, referencia: d.referencia || null, comprobante,
    }));
  }, { exito: "Pago registrado", invalidar, alTerminar: () => { alCambiar(false); setD((x) => ({ ...x, monto: "", pesos: "", referencia: "" })); setArchivo(null); } });
  const listo = !!oc && !!monto && (!hecho || !!tc);
  const poner = (k: keyof typeof d) => (ev: { target: { value: string } }) => setD((x) => ({ ...x, [k]: ev.target.value }));
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Pago al proveedor" ancho="max-w-xl"
      descripcion="El tipo de cambio sale de lo que de verdad salió: pesos ÷ dólares. Es lo que pide el agente para demostrarlo ante la aduana."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton type="submit" form="form-pago" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="form-pago" className="grid gap-4 sm:grid-cols-2" onSubmit={(ev: FormEvent) => { ev.preventDefault(); if (listo) guardar.mutate(undefined); }}>
        <Campo etiqueta="Orden de compra" className="sm:col-span-2">
          <Seleccion value={oc} onChange={poner("oc")}>
            <option value="">Elegir…</option>
            {e.ordenes.map((o) => <option key={o.id} value={o.id}>{o.folio} · {o.proveedor}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Concepto">
          <Seleccion value={d.concepto} onChange={poner("concepto")}><option value="anticipo">Anticipo</option><option value="saldo">Saldo</option><option value="total">Pago total</option><option value="otro">Otro</option></Seleccion>
        </Campo>
        <Campo etiqueta="Estado">
          <Seleccion value={d.estado} onChange={poner("estado")}>{Object.entries(ESTADOS_PAGO).filter(([k]) => k !== "devuelto").map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}</Seleccion>
        </Campo>
        <Campo etiqueta={hecho ? "Fecha del pago" : "Fecha programada"}><Entrada type="date" value={d.fecha} max={hecho ? hoyISO() : undefined} onChange={poner("fecha")} /></Campo>
        <Campo etiqueta="Monto (moneda de la orden)"><Entrada inputMode="decimal" autoFocus value={d.monto} onChange={poner("monto")} placeholder="3,200.00" /></Campo>
        {hecho && (
          <Campo etiqueta="Pesos que salieron" ayuda={tc ? `Tipo de cambio real: ${tc.toFixed(4)}` : "Del estado de cuenta o del comprobante de EBANX"}>
            <Entrada inputMode="decimal" value={d.pesos} onChange={poner("pesos")} placeholder="62,400.00" />
          </Campo>
        )}
        <Campo etiqueta="Método">
          <Seleccion value={d.metodo} onChange={poner("metodo")}><option value="transferencia">Transferencia internacional</option><option value="ebanx">EBANX (Alibaba)</option><option value="otro">Otro</option></Seleccion>
        </Campo>
        <Campo etiqueta="Cuenta de origen"><Entrada value={d.cuenta} onChange={poner("cuenta")} placeholder="Banorte pesos" /></Campo>
        <Campo etiqueta="Referencia"><Entrada value={d.referencia} onChange={poner("referencia")} /></Campo>
        {hecho && (
          <Campo etiqueta="Comprobante" className="sm:col-span-2" ayuda="Si no lo tienes ahora, queda como alerta hasta que lo subas.">
            <input type="file" accept="application/pdf,image/*" className="text-sm" onChange={(ev) => setArchivo(ev.target.files?.[0] ?? null)} />
          </Campo>
        )}
      </form>
    </Dialogo>
  );
}

function DialogoGasto({ abierto, alCambiar, e, invalidar }: { abierto: boolean; alCambiar: (v: boolean) => void; e: Embarque; invalidar: Invalidar }) {
  const [d, setD] = useState({ concepto: "flete_local", descripcion: "", proveedor: "", factura: "", fecha: hoyISO(), moneda: "MXN", monto: "", tc: "", iva: "", criterio: "valor", oc: "", estimado: false });
  const poner = (k: keyof typeof d) => (ev: { target: { value: string } }) => setD((x) => ({ ...x, [k]: ev.target.value }));
  const monto = num(d.monto);
  const guardar = useAccion(() => q(supabase.from("embarque_gastos").insert({
    embarque_id: e.id, concepto: d.concepto, descripcion: d.descripcion || null, proveedor: d.proveedor || null, factura: d.factura || null, fecha: d.fecha,
    moneda: d.moneda, monto, tipo_cambio: d.moneda === "MXN" ? 1 : num(d.tc) ?? 1, iva: num(d.iva) ?? 0, criterio: d.criterio,
    orden_compra_id: d.oc || null, estimado: d.estimado,
  })), { exito: "Gasto agregado", invalidar, alTerminar: () => { alCambiar(false); setD((x) => ({ ...x, monto: "", iva: "", descripcion: "", factura: "" })); } });
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Gasto del embarque" ancho="max-w-xl"
      descripcion="Captura el monto sin IVA; el IVA va aparte porque se acredita, no es costo."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton type="submit" form="form-gasto" disabled={monto == null} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="form-gasto" className="grid gap-4 sm:grid-cols-2" onSubmit={(ev: FormEvent) => { ev.preventDefault(); if (monto != null) guardar.mutate(undefined); }}>
        <Campo etiqueta="Concepto"><Seleccion value={d.concepto} onChange={poner("concepto")}>{Object.entries(CONCEPTOS_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Seleccion></Campo>
        <Campo etiqueta="Quién lo cobra"><Entrada value={d.proveedor} onChange={poner("proveedor")} placeholder="Naviera, agente, transportista…" /></Campo>
        <Campo etiqueta="Descripción"><Entrada value={d.descripcion} onChange={poner("descripcion")} /></Campo>
        <Campo etiqueta="Factura o CFDI"><Entrada value={d.factura} onChange={poner("factura")} /></Campo>
        <Campo etiqueta="Moneda"><Seleccion value={d.moneda} onChange={poner("moneda")}><option value="MXN">MXN</option><option value="USD">USD</option></Seleccion></Campo>
        {d.moneda === "USD" && <Campo etiqueta="Tipo de cambio"><Entrada inputMode="decimal" value={d.tc} onChange={poner("tc")} placeholder="19.85" /></Campo>}
        <Campo etiqueta="Monto sin IVA"><Entrada inputMode="decimal" autoFocus value={d.monto} onChange={poner("monto")} /></Campo>
        <Campo etiqueta="IVA (acreditable)"><Entrada inputMode="decimal" value={d.iva} onChange={poner("iva")} placeholder="0" /></Campo>
        <Campo etiqueta="Fecha"><Entrada type="date" value={d.fecha} onChange={poner("fecha")} /></Campo>
        <Campo etiqueta="Se reparte" ayuda={d.criterio === "volumen" ? "Pide el volumen de cada orden (pestaña Órdenes)." : undefined}>
          <Seleccion value={d.criterio} onChange={poner("criterio")}><option value="valor">Por valor de la mercancía</option><option value="volumen">Por volumen (consolidado)</option></Seleccion>
        </Campo>
        {e.ordenes.length > 1 && (
          <Campo etiqueta="¿Solo de una orden?" className="sm:col-span-2">
            <Seleccion value={d.oc} onChange={poner("oc")}><option value="">Todo el embarque</option>{e.ordenes.map((o) => <option key={o.id} value={o.id}>{o.folio} · {o.proveedor}</option>)}</Seleccion>
          </Campo>
        )}
        <label className="sm:col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.estimado} onChange={(ev) => setD((x) => ({ ...x, estimado: ev.target.checked }))} />
          Es un estimado (antes de la cuenta de gastos): entra al preliminar, no al final
        </label>
      </form>
    </Dialogo>
  );
}

function DialogoPedimento({ abierto, alCambiar, e, invalidar }: { abierto: boolean; alCambiar: (v: boolean) => void; e: Embarque; invalidar: Invalidar }) {
  const [d, setD] = useState({ numero: "", clave: "A1", aduana: "Manzanillo", fecha_pago: hoyISO(), tipo_cambio: "", valor_aduana: "", igi: "", dta: "", iva: "", prv: "", otros: "" });
  const poner = (k: keyof typeof d) => (ev: { target: { value: string } }) => setD((x) => ({ ...x, [k]: ev.target.value }));
  const guardar = useAccion(() => q(supabase.from("pedimentos").insert({
    embarque_id: e.id, numero: d.numero, clave: d.clave || "A1", aduana: d.aduana || null, fecha_pago: d.fecha_pago, tipo_cambio: num(d.tipo_cambio),
    valor_aduana: num(d.valor_aduana), igi: num(d.igi) ?? 0, dta: num(d.dta) ?? 0, iva: num(d.iva) ?? 0, prv: num(d.prv) ?? 0, otros: num(d.otros) ?? 0,
  })), { exito: "Pedimento registrado: ya se puede calcular el costeo preliminar", invalidar, alTerminar: () => alCambiar(false) });
  const listo = d.numero.replace(/\D/g, "").length === 15 && !!d.fecha_pago;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Pedimento pagado" ancho="max-w-xl" descripcion="O léelo con Claude desde Documentos."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton type="submit" form="form-ped" disabled={!listo} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="form-ped" className="grid gap-4 grid-cols-2 sm:grid-cols-3" onSubmit={(ev: FormEvent) => { ev.preventDefault(); if (listo) guardar.mutate(undefined); }}>
        <Campo etiqueta="Número" className="col-span-2" ayuda="15 dígitos: 26 16 1943 6004373"><Entrada autoFocus value={d.numero} onChange={poner("numero")} /></Campo>
        <Campo etiqueta="Clave"><Entrada value={d.clave} onChange={poner("clave")} /></Campo>
        <Campo etiqueta="Fecha de pago"><Entrada type="date" value={d.fecha_pago} max={hoyISO()} onChange={poner("fecha_pago")} /></Campo>
        <Campo etiqueta="Tipo de cambio"><Entrada inputMode="decimal" value={d.tipo_cambio} onChange={poner("tipo_cambio")} /></Campo>
        <Campo etiqueta="Valor en aduana"><Entrada inputMode="decimal" value={d.valor_aduana} onChange={poner("valor_aduana")} /></Campo>
        <Campo etiqueta="IGI"><Entrada inputMode="decimal" value={d.igi} onChange={poner("igi")} /></Campo>
        <Campo etiqueta="DTA"><Entrada inputMode="decimal" value={d.dta} onChange={poner("dta")} /></Campo>
        <Campo etiqueta="PRV"><Entrada inputMode="decimal" value={d.prv} onChange={poner("prv")} /></Campo>
        <Campo etiqueta="IVA (acreditable)"><Entrada inputMode="decimal" value={d.iva} onChange={poner("iva")} /></Campo>
        <Campo etiqueta="Otras contribuciones"><Entrada inputMode="decimal" value={d.otros} onChange={poner("otros")} /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoSaldo({ abierto, alCambiar, e, invalidar }: { abierto: boolean; alCambiar: (v: boolean) => void; e: Embarque; invalidar: Invalidar }) {
  const { puede } = useSesion();
  const [d, setD] = useState({ tipo: "garantia_contenedor", deudor: e.naviera ?? "", moneda: "USD", monto: "", tc: "", fecha_origen: hoyISO(), fecha_esperada: "" });
  const poner = (k: keyof typeof d) => (ev: { target: { value: string } }) => setD((x) => ({ ...x, [k]: ev.target.value }));
  const guardar = useAccion(() => q(supabase.from("embarque_saldos").insert({
    embarque_id: e.id, tipo: d.tipo, deudor: d.deudor || null, moneda: d.moneda, monto: num(d.monto), tipo_cambio: d.moneda === "MXN" ? 1 : num(d.tc) ?? 1,
    fecha_origen: d.fecha_origen, fecha_esperada: d.fecha_esperada || null,
  })), { exito: "Anotado por recuperar", invalidar, alTerminar: () => alCambiar(false) });
  if (!puede("importaciones", 2) && !puede("finanzas", 2)) return null;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Dinero por recuperar" ancho="max-w-lg"
      descripcion="Si no dices cuándo, el saldo a favor se espera 15 días después de la cuenta de gastos y la garantía a los 30."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton type="submit" form="form-saldo" disabled={!num(d.monto)} cargando={guardar.isPending}>Guardar</Boton></>}>
      <form id="form-saldo" className="grid gap-4 sm:grid-cols-2" onSubmit={(ev: FormEvent) => { ev.preventDefault(); if (num(d.monto)) guardar.mutate(undefined); }}>
        <Campo etiqueta="Qué es"><Seleccion value={d.tipo} onChange={poner("tipo")}><option value="garantia_contenedor">Garantía de contenedor</option><option value="saldo_agente">Saldo a favor con el agente</option><option value="otro">Otro</option></Seleccion></Campo>
        <Campo etiqueta="Quién lo debe"><Entrada value={d.deudor} onChange={poner("deudor")} /></Campo>
        <Campo etiqueta="Moneda"><Seleccion value={d.moneda} onChange={poner("moneda")}><option value="USD">USD</option><option value="MXN">MXN</option></Seleccion></Campo>
        <Campo etiqueta="Monto"><Entrada inputMode="decimal" autoFocus value={d.monto} onChange={poner("monto")} placeholder="1,000" /></Campo>
        {d.moneda === "USD" && <Campo etiqueta="Tipo de cambio"><Entrada inputMode="decimal" value={d.tc} onChange={poner("tc")} /></Campo>}
        <Campo etiqueta="Desde"><Entrada type="date" value={d.fecha_origen} onChange={poner("fecha_origen")} /></Campo>
        <Campo etiqueta="Se espera"><Entrada type="date" value={d.fecha_esperada} onChange={poner("fecha_esperada")} /></Campo>
      </form>
    </Dialogo>
  );
}

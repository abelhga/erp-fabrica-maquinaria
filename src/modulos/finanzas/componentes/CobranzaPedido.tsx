import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, HandCoins, Receipt } from "lucide-react";
import { Lateral, Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO } from "@/lib/formato";
import { ESTADO_PEDIDO, METODOS, enMoneda, nombreMetodo, tonoRango, type Moneda, type Rango } from "./comun";

export interface FilaCobranza {
  pedido_id: string; folio: string; cliente_id: string; cliente: string; vendedor_id: string | null; vendedor: string | null;
  canal: string; fecha: string; estado: string; moneda: Moneda; total: number; cobrado: number; saldo: number; facturado: boolean;
  primera_factura: string | null; facturas: string | null; facturado_monto: number; ultimo_cobro: string | null; dias_credito: number;
  fecha_base: string; vence: string; dias: number; rango: Rango; saldo_mxn: number; total_mxn: number;
}

const INVALIDAR = [["v_cobranza"], ["cobranza_por_mes"], ["cobros"], ["facturas"], ["indicadores"]];

export function DetalleCobranza({ fila: p, alCerrar }: { fila: FilaCobranza | null; alCerrar: () => void }) {
  const { puede } = useSesion();
  const [cobro, setCobro] = useState(false);
  const [factura, setFactura] = useState(false);
  const cobros = useQuery({
    queryKey: ["cobros", p?.pedido_id],
    enabled: !!p,
    queryFn: () => q<{ id: string; fecha: string; monto: number; metodo: string; referencia: string | null; notas: string | null}[]>(
      supabase.from("cobros").select("id, fecha, monto, metodo, referencia, notas").eq("pedido_id", p!.pedido_id).order("fecha")),
  });
  const facturas = useQuery({
    queryKey: ["facturas", p?.pedido_id],
    enabled: !!p,
    queryFn: () => q<{ id: string; folio: string; uuid_sat: string | null; fecha: string; total: number; notas: string | null }[]>(
      supabase.from("facturas").select("id, folio, uuid_sat, fecha, total, notas").eq("pedido_id", p!.pedido_id).order("fecha")),
  });
  const m = p?.moneda ?? "MXN";
  return (
    <Lateral abierto={!!p} alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={p ? `${p.folio} · ${p.cliente}` : ""}
      subtitulo={p && (
        <span className="flex flex-wrap items-center gap-2">
          {ESTADO_PEDIDO[p.estado] && <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Insignia>}
          <span>Pedido del {fecha(p.fecha)}{p.vendedor ? ` · ${p.vendedor}` : ""}</span>
        </span>
      )}>
      {p && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-borde p-3"><p className="text-xs text-tenue">Total</p><p className="font-semibold cifra">{enMoneda(p.total, m)}</p></div>
            <div className="rounded-xl border border-borde p-3"><p className="text-xs text-tenue">Cobrado</p><p className="font-semibold cifra text-ok">{enMoneda(p.cobrado, m)}</p></div>
            <div className="rounded-xl border border-borde p-3"><p className="text-xs text-tenue">Saldo</p><p className="font-semibold cifra">{enMoneda(p.saldo, m)}</p></div>
          </div>
          <div className="text-sm space-y-1">
            {p.saldo > 0 && <p>Antigüedad: <Insignia tono={tonoRango(p.rango)}>{p.dias} días</Insignia> <span className="text-tenue">desde {p.primera_factura ? `la factura del ${fecha(p.primera_factura)}` : `el pedido (aún sin factura)`}</span></p>}
            <p className="text-tenue">Crédito del cliente: {p.dias_credito ? `${p.dias_credito} días · vence el ${fecha(p.vence)}` : "de contado"}{m !== "MXN" && ` · saldo ≈ ${dinero(p.saldo_mxn)} al tipo de cambio de hoy`}</p>
            {puede("ventas") && <Link to={`/ventas/pedidos/${p.pedido_id}`} className="inline-flex items-center gap-1 text-marca-texto"><ExternalLink className="h-3.5 w-3.5" /> Ver el pedido completo</Link>}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Cobros</h4>
              {puede("finanzas", 2) && p.estado !== "cancelado" && <Boton tamano="sm" onClick={() => setCobro(true)}><HandCoins className="h-4 w-4" /> Registrar cobro</Boton>}
            </div>
            {cobros.isLoading ? <Cargando filas={2} /> : (cobros.data ?? []).length === 0 ? <p className="text-sm text-tenue">Sin cobros todavía.</p> : (
              <table className="tabla rounded-xl border border-borde overflow-hidden">
                <thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th className="!text-right">Monto</th></tr></thead>
                <tbody>
                  {cobros.data!.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap">{fecha(c.fecha)}</td>
                      <td>{nombreMetodo(c.metodo)}</td>
                      <td className="text-tenue"><span>{c.referencia ?? "—"}</span>{c.notas && <span className="block text-xs">{c.notas}</span>}</td>
                      <td className="text-right cifra">{enMoneda(c.monto, m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Facturas</h4>
              {puede("finanzas", 2) && p.estado !== "cancelado" && <Boton tamano="sm" variante="secundario" onClick={() => setFactura(true)}><Receipt className="h-4 w-4" /> Registrar factura</Boton>}
            </div>
            {facturas.isLoading ? <Cargando filas={2} /> : (facturas.data ?? []).length === 0 ? <p className="text-sm text-tenue">Sin facturar.</p> : (
              <ul className="divide-y divide-borde rounded-xl border border-borde">
                {facturas.data!.map((f) => (
                  <li key={f.id} className="px-3 py-2.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <FileText className="h-4 w-4 text-tenue" />
                    <b>{f.folio}</b>
                    <span className="text-tenue">{fecha(f.fecha)}</span>
                    <span className="ml-auto cifra">{enMoneda(f.total, m)}</span>
                    <span className="w-full text-xs text-tenue font-mono pl-7 break-all">{f.uuid_sat ?? "Sin UUID del SAT"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <RegistrarCobro pedido={p} abierto={cobro} alCambiar={setCobro} />
          <RegistrarFactura pedido={p} abierto={factura} alCambiar={setFactura} />
        </div>
      )}
    </Lateral>
  );
}

export function RegistrarCobro({ pedido: p, abierto, alCambiar }: { pedido: FilaCobranza; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const inicial = () => ({ fecha: hoyISO(), monto: p.saldo > 0 ? String(p.saldo) : "", metodo: "transferencia", referencia: "", notas: "" });
  const [f, setF] = useState(inicial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (abierto) setF(inicial()); }, [abierto, p.pedido_id]);
  const guardar = useAccion(() => q(supabase.from("cobros").insert({
    pedido_id: p.pedido_id, fecha: f.fecha, monto: Number(f.monto), metodo: f.metodo, referencia: f.referencia.trim() || null, notas: f.notas.trim() || null,
  })), { exito: `Cobro registrado en ${p.folio}`, invalidar: INVALIDAR, alTerminar: () => alCambiar(false) });
  const monto = Number(f.monto) || 0;
  function enviar(e: FormEvent) { e.preventDefault(); if (monto !== 0) guardar.mutate(undefined); }
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Registrar cobro · ${p.folio}`}
      descripcion={`${p.cliente} · saldo ${enMoneda(p.saldo, p.moneda)}`}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="registrar-cobro" cargando={guardar.isPending} disabled={!monto}>Registrar cobro</Boton>
      </>}>
      <form id="registrar-cobro" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta={`Monto (${p.moneda})`} ayuda={monto > 0 && monto < p.saldo ? `Queda un saldo de ${enMoneda(p.saldo - monto, p.moneda)}` : monto < 0 ? "Negativo = devolución al cliente" : "Liquida el pedido"}>
          <Entrada autoFocus type="number" step="0.01" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className="cifra" required />
        </Campo>
        <Campo etiqueta="Fecha en que entró">
          <Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
        </Campo>
        <Campo etiqueta="Método">
          <Seleccion value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
            {METODOS.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Referencia">
          <Entrada value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="SPEI, número de cheque…" />
        </Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2">
          <Entrada value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Cuenta donde entró (Santander fiscal, Banorte…), anticipo, liquidación" />
        </Campo>
      </form>
    </Dialogo>
  );
}

export function RegistrarFactura({ pedido: p, abierto, alCambiar }: { pedido: FilaCobranza; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const porFacturar = Math.max(0, Number(p.total) - Number(p.facturado_monto));
  const inicial = () => ({ folio: "", uuid: "", fecha: hoyISO(), total: porFacturar ? String(porFacturar) : "", notas: "" });
  const [f, setF] = useState(inicial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (abierto) setF(inicial()); }, [abierto, p.pedido_id]);
  const guardar = useAccion(() => q(supabase.from("facturas").insert({
    pedido_id: p.pedido_id, folio: f.folio, uuid_sat: f.uuid.trim() || null, fecha: f.fecha, total: Number(f.total), notas: f.notas.trim() || null,
  })), { exito: `Factura ${f.folio} registrada`, invalidar: INVALIDAR, alTerminar: () => alCambiar(false) });
  const uuidMal = f.uuid.trim() !== "" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.uuid.trim());
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Registrar factura · ${p.folio}`}
      descripcion={`${p.cliente} · total del pedido ${enMoneda(p.total, p.moneda)}${p.facturado_monto ? `, ya facturado ${enMoneda(p.facturado_monto, p.moneda)}` : ""}`}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="registrar-factura" cargando={guardar.isPending} disabled={!f.folio.trim() || !Number(f.total)}>Registrar factura</Boton>
      </>}>
      <form id="registrar-factura" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Folio">
          <Entrada autoFocus value={f.folio} onChange={(e) => setF({ ...f, folio: e.target.value })} placeholder="A 3350" required />
        </Campo>
        <Campo etiqueta="Fecha">
          <Entrada type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
        </Campo>
        <Campo etiqueta={`Total con IVA (${p.moneda})`} ayuda="Para un anticipo, solo el importe facturado.">
          <Entrada type="number" step="0.01" min="0" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} className="cifra" required />
        </Campo>
        <Campo etiqueta="Notas">
          <Entrada value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Anticipo, complemento…" />
        </Campo>
        <Campo etiqueta="UUID del SAT (opcional)" className="sm:col-span-2"
          error={uuidMal ? "Son 36 caracteres: 8-4-4-4-12, números y letras A–F" : undefined}
          ayuda="El folio fiscal del XML. Se puede poner después.">
          <Entrada value={f.uuid} onChange={(e) => setF({ ...f, uuid: e.target.value.toUpperCase() })} className="font-mono" maxLength={36}
            placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" />
        </Campo>
      </form>
    </Dialogo>
  );
}

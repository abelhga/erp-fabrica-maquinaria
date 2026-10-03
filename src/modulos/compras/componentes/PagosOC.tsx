import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO } from "@/lib/formato";
import type { OrdenCompra } from "./comun";

interface Pago { id: string; fecha: string; monto: number; metodo: string; referencia: string | null; registrado_por: string | null }

/** Pagos de la orden. Los ve compras; los captura solo finanzas (la base lo exige). */
export function PagosOC({ oc }: { oc: OrdenCompra }) {
  const { puede } = useSesion();
  const captura = puede("finanzas", 2);
  const m = oc.moneda === "USD" ? "USD" : "MXN";
  const pagos = useQuery({
    queryKey: ["pagos_oc", oc.id],
    queryFn: () => q<Pago[]>(supabase.from("pagos_proveedor").select("id, fecha, monto, metodo, referencia, registrado_por").eq("orden_compra_id", oc.id).order("fecha")),
  });
  const perfiles = useQuery({
    queryKey: ["perfiles", "activos"],
    staleTime: 10 * 60_000,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre")),
  });
  const pagado = (pagos.data ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const saldo = Math.round((Number(oc.total) - pagado) * 100) / 100;
  const [monto, setMonto] = useState("");
  const [f, setF] = useState(hoyISO());
  const [metodo, setMetodo] = useState("transferencia");
  const [ref, setRef] = useState("");

  const registrar = useAccion(() => q(supabase.from("pagos_proveedor").insert({
    orden_compra_id: oc.id, fecha: f, monto: Number(monto.replace(/,/g, "")), metodo, referencia: ref.trim() || null,
  }).select("id").single()), {
    exito: "Pago registrado",
    invalidar: [["pagos_oc", oc.id], ["oc", oc.id], ["v_ordenes_compra"], ["indicadores"]],
    alTerminar: () => { setMonto(""); setRef(""); },
  });
  const n = Number(monto.replace(/,/g, ""));

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo={<span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-tenue" /> Pagos</span>}
        descripcion={oc.vence_pago ? `Vence el ${fecha(oc.vence_pago)}` : "El vencimiento se fija al recibir (días de crédito del proveedor)."}
        acciones={<span className={saldo <= 0 ? "text-ok text-sm font-medium" : "text-sm"}>{saldo <= 0 ? "Pagada" : <>Saldo <b className="cifra">{dinero(saldo, m)}</b></>}</span>} />
      <div className="px-5 pb-4 space-y-3">
        {(pagos.data?.length ?? 0) === 0 ? <p className="text-sm text-tenue">Sin pagos registrados.</p> : (
          <ul className="text-sm divide-y divide-borde">
            {pagos.data!.map((p) => (
              <li key={p.id} className="py-1.5 flex items-baseline gap-2">
                <span className="text-tenue text-xs w-20 shrink-0">{fecha(p.fecha)}</span>
                <span className="flex-1 min-w-0 truncate">{p.metodo}{p.referencia && <span className="text-tenue"> · {p.referencia}</span>}
                  <span className="block text-[11px] text-tenue">{perfiles.data?.find((x) => x.id === p.registrado_por)?.nombre}</span></span>
                <span className="cifra font-medium">{dinero(p.monto, m)}</span>
              </li>
            ))}
          </ul>
        )}
        {captura && saldo > 0 && (
          <form className="grid grid-cols-2 gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); if (n > 0) registrar.mutate(undefined); }}>
            <input type="date" className="campo" value={f} onChange={(e) => setF(e.target.value)} aria-label="Fecha del pago" />
            <input inputMode="decimal" className="campo text-right cifra" placeholder={String(saldo)} value={monto} aria-label="Monto"
              onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))} />
            <Seleccion className="pr-6" value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Método">
              <option value="transferencia">Transferencia</option><option value="cheque">Cheque</option>
              <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
            </Seleccion>
            <input className="campo" placeholder="Referencia (SPEI…)" value={ref} onChange={(e) => setRef(e.target.value)} />
            {n > saldo + 0.005 && <p className="col-span-2 text-xs text-aviso">Es más que el saldo de la orden.</p>}
            <Boton type="submit" className="col-span-2" disabled={!(n > 0)} cargando={registrar.isPending}>Registrar pago</Boton>
          </form>
        )}
        {!captura && <p className="text-xs text-tenue">Los pagos los registra finanzas.</p>}
      </div>
    </Tarjeta>
  );
}

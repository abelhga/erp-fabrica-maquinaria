import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Pencil } from "lucide-react";
import * as P from "@radix-ui/react-popover";
import { Boton } from "@/components/ui/boton";
import { Entrada, Campo } from "@/components/ui/campo";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hoyISO } from "@/lib/formato";
import type { Tono } from "@/components/ui/insignia";

export type Moneda = "MXN" | "USD" | "EUR";

const eur = new Intl.NumberFormat("es-MX", { style: "currency", currency: "EUR" });
/** dinero() de lib/formato solo conoce pesos y dólares; las órdenes de importación pueden venir en euros. */
export const enMoneda = (n: number | null | undefined, m: Moneda = "MXN") =>
  m === "EUR" ? (n == null ? "—" : eur.format(n)) : dinero(n, m);

export const METODOS = [
  { valor: "transferencia", texto: "Transferencia" },
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "tarjeta", texto: "Tarjeta" },
  { valor: "cheque", texto: "Cheque" },
  { valor: "mercadopago", texto: "Mercado Pago" },
  { valor: "otro", texto: "Otro" },
] as const;
export const nombreMetodo = (m: string) => METODOS.find((x) => x.valor === m)?.texto ?? m;

export type Rango = "0-30" | "31-60" | "61-90" | "90+";
export const RANGOS: { valor: Rango; texto: string; tono: Tono }[] = [
  { valor: "0-30", texto: "0 a 30 días", tono: "ok" },
  { valor: "31-60", texto: "31 a 60 días", tono: "info" },
  { valor: "61-90", texto: "61 a 90 días", tono: "aviso" },
  { valor: "90+", texto: "Más de 90 días", tono: "peligro" },
];
export const tonoRango = (r: Rango) => RANGOS.find((x) => x.valor === r)?.tono ?? "neutro";

export const ESTADO_PEDIDO: Record<string, { texto: string; tono: Tono }> = {
  confirmado: { texto: "Confirmado", tono: "info" },
  en_produccion: { texto: "En taller", tono: "marca" },
  listo: { texto: "Listo para entregar", tono: "aviso" },
  entregado: { texto: "Entregado", tono: "ok" },
  cancelado: { texto: "Cancelado", tono: "neutro" },
};

/** Lunes de la semana de una fecha, en ISO. */
export function lunesDe(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export const iso = (d: Date) => d.toLocaleDateString("en-CA");

/** Tipo de cambio vigente con captura rápida para quien puede (compras o finanzas). */
export function TipoCambioDia() {
  const { puede } = useSesion();
  const editable = puede("finanzas", 2) || puede("compras", 2);
  const tc = useQuery({
    queryKey: ["tipos_cambio", "vigente"],
    queryFn: () => q<{ fecha: string; moneda: Moneda; valor: number; fuente: string | null }[]>(
      supabase.from("tipos_cambio").select("fecha, moneda, valor, fuente").eq("moneda", "USD").order("fecha", { ascending: false }).limit(1)),
  });
  const v = tc.data?.[0];
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");
  const guardar = useAccion(() => q(supabase.from("tipos_cambio").upsert({ fecha: hoyISO(), moneda: "USD", valor: Number(valor), fuente: "manual" })), {
    exito: "Tipo de cambio del día guardado", invalidar: [["tipos_cambio"], ["v_por_pagar"], ["v_cobranza"]], alTerminar: () => setAbierto(false),
  });
  const viejo = v && v.fecha < hoyISO();
  const contenido = (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <DollarSign className="h-4 w-4 text-tenue" />
      <span className="text-tenue">Dólar:</span>
      <b className="cifra">{v ? dinero(Number(v.valor)) : "—"}</b>
      {v && <span className={viejo ? "text-aviso text-xs" : "text-tenue text-xs"}>{viejo ? `del ${fecha(v.fecha)}` : "hoy"}</span>}
      {editable && <Pencil className="h-3.5 w-3.5 text-tenue" />}
    </span>
  );
  if (!editable) return <div className="h-9 px-3 rounded-lg border border-borde bg-superficie flex items-center">{contenido}</div>;
  return (
    <P.Root open={abierto} onOpenChange={(o) => { setAbierto(o); if (o) setValor(v ? String(v.valor) : ""); }}>
      <P.Trigger asChild>
        <button className="h-9 px-3 rounded-lg border border-borde bg-superficie hover:bg-fondo flex items-center" title="Capturar el tipo de cambio de hoy">{contenido}</button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={6} className="z-50 tarjeta shadow-xl p-4 w-72">
          <form onSubmit={(e) => { e.preventDefault(); if (Number(valor) > 0) guardar.mutate(undefined); }} className="space-y-3">
            <Campo etiqueta={`Dólar del ${fecha(hoyISO())}`} ayuda="El del DOF o el de tu banco. Mueve los saldos en dólares y los costos importados.">
              <Entrada autoFocus type="number" step="0.0001" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className="cifra" />
            </Campo>
            <Boton type="submit" className="w-full" cargando={guardar.isPending}>Guardar</Boton>
          </form>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { fecha, hoyISO } from "@/lib/formato";

// Lo que comparten Pagos, Cobranza y Caja chica desde que Finanzas captura aquí y no en la hoja.

export type TipoAcreedor = "proveedor" | "socio" | "financiamiento" | "nomina" | "impuestos";
export const TIPO_ACREEDOR: Record<TipoAcreedor, string> = {
  proveedor: "Proveedor", socio: "Préstamo de socio", financiamiento: "Crédito bancario", nomina: "Nómina", impuestos: "Impuestos",
};
/** Préstamos de socios y créditos: se deben, pero no van en la agenda de pagos. */
export const esPrestamo = (t: TipoAcreedor | null | undefined) => t === "socio" || t === "financiamiento";
/** Nómina e impuestos: sí se pagan en la agenda, pero no son compras a un proveedor. */
export const esNominaImpuestos = (t: TipoAcreedor | null | undefined) => t === "nomina" || t === "impuestos";

/** Un renglón de la cuenta de un proveedor: lo de la hoja más lo del ERP. */
export interface CuentaProveedor {
  proveedor_llave: string; proveedor_id: string | null; nombre: string; categoria: string | null; tipo_acreedor: TipoAcreedor;
  adeudo_2021: number | null; comprado: number | null; pagado: number | null; saldo_hoja: number;
  comprado_erp: number; pagado_erp: number; saldo: number;
  ultima_compra: string | null; ultimo_pago: string | null; movimientos: number; vencido: number; proximo_vence: string | null;
}

/** Una factura (de la hoja o del ERP) con lo que falta pagarle. */
export interface FacturaPendiente {
  id: string; proveedor_llave: string; proveedor_id: string | null; fecha: string; factura: string | null; descripcion: string | null;
  categoria: string | null; monto: number; vence_el: string; origen: "hoja" | "erp"; restante: number;
  /** Renglón del libro de la hoja y si parece capturado dos veces (otro igual a una semana). */
  hoja_id: number | null; posible_repetida: boolean;
}

/** Lo que invalida cualquier movimiento a la cuenta de un proveedor. */
export const INVALIDAR_PROVEEDORES = [
  ["v_saldo_arranque_proveedores"], ["v_compras_proveedor_pendientes"], ["v_movimientos_proveedor"], ["tablero_direccion"], ["hallazgos"], ["v_compras_hoja_ignoradas"],
];

export function useCuentasProveedor(habilitado = true) {
  return useQuery({
    queryKey: ["v_saldo_arranque_proveedores"], enabled: habilitado,
    // Más de 600 proveedores (y creciendo): por páginas, que la API corta en 1,000.
    queryFn: () => todasLasFilas<CuentaProveedor>((d, h) => supabase.from("v_saldo_arranque_proveedores").select("*").order("proveedor_llave").range(d, h)),
  });
}
export function useFacturasPendientes(habilitado = true) {
  return useQuery({
    queryKey: ["v_compras_proveedor_pendientes"], enabled: habilitado,
    queryFn: () => q<FacturaPendiente[]>(supabase.from("v_compras_proveedor_pendientes").select("*").gt("restante", 0.005).order("vence_el")),
  });
}

/** Las cuentas de donde sale o entra el dinero (Santander fiscal, no fiscal, caja chica…). */
export function useCuentasDinero() {
  return useQuery({
    queryKey: ["cuentas_dinero"], staleTime: 30 * 60_000,
    queryFn: () => q<{ clave: string; nombre: string }[]>(supabase.from("cuentas_dinero").select("clave, nombre").eq("activa", true).order("orden")),
  });
}
export function SelectorCuenta({ valor, alCambiar, sinCaja, requerido = true }: { valor: string; alCambiar: (v: string) => void; sinCaja?: boolean; requerido?: boolean }) {
  const cuentas = useCuentasDinero();
  return (
    <Seleccion value={valor} onChange={(e) => alCambiar(e.target.value)} required={requerido}>
      <option value="">Elegir cuenta…</option>
      {(cuentas.data ?? []).filter((c) => !sinCaja || c.clave !== "caja_chica").map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
    </Seleccion>
  );
}

/** Días de hoy a esa fecha (negativo = ya pasó). En días de calendario, sin husos horarios. */
export function diasPara(f: string | null | undefined) {
  if (!f) return null;
  const [a, b] = [hoyISO(), f.slice(0, 10)].map((x) => Date.UTC(Number(x.slice(0, 4)), Number(x.slice(5, 7)) - 1, Number(x.slice(8, 10))));
  return Math.round((b - a) / 86_400_000);
}
export function sumarDias(f: string, n: number) {
  const d = new Date(Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)) + n));
  return d.toISOString().slice(0, 10);
}

/** Cuándo vence, con el mismo código de colores en toda la pantalla de pagos. */
export function Vencimiento({ vence }: { vence: string | null }) {
  const d = diasPara(vence);
  if (d == null) return <Insignia tono="neutro">Sin fecha</Insignia>;
  if (d < 0) return <Insignia tono="peligro" punto>Vencida hace {-d} {d === -1 ? "día" : "días"}</Insignia>;
  if (d === 0) return <Insignia tono="aviso" punto>Vence hoy</Insignia>;
  if (d <= 7) return <Insignia tono="aviso">En {d} {d === 1 ? "día" : "días"}</Insignia>;
  return <span className="text-tenue text-sm whitespace-nowrap">{fecha(vence)}</span>;
}

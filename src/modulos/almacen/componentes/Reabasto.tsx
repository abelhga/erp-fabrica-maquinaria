import * as P from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";
import { numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

export interface FilaReabasto {
  articulo_id: string; clave: string; nombre: string; unidad: string; es_importado: boolean; proveedor: string | null;
  consumo_meses: number[]; meses_con_consumo: number; demanda_mensual: number; dias_entrega: number; meses_cobertura: number;
  stock_seguridad: number | null; punto_reorden: number; lote: number; en_planta: number; reservado: number; en_transito: number;
  disponible: number; sugerido: number; estado: "ordenar" | "ok" | "excedente" | "negativo";
  proveedor_id: string | null; empaque: number; cobertura_propia: number | null; entrega_propia: number | null;
  en_borrador: number; borradores: string | null; en_requisicion: number; costo_mxn: number | null;
}

export interface ReglaReabasto {
  meses_historia: number; meses_con_consumo: number; promedio: "meses_con_consumo" | "todos"; dias_habiles_mes: number;
  dias_entrega_default: number; meses_cobertura_nacional: number; meses_cobertura_importado: number;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta del mes i (0 = hace 12 meses … 11 = el mes pasado), como los entrega reabasto(). */
export function mesDe(i: number) {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - (12 - i), 1);
  return `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/**
 * Doce barras de consumo mensual; las últimas seis (las que cuenta la regla)
 * van en color, las anteriores en gris. Sin ejes: es para ver la forma de un vistazo.
 */
export function Sparkline({ valores }: { valores: number[] }) {
  const max = Math.max(...valores, 0);
  const ancho = 5, sep = 2, alto = 24;
  return (
    <svg width={valores.length * (ancho + sep)} height={alto} role="img" aria-label={`Consumo mensual: ${valores.map(numero).join(", ")}`} className="block">
      {valores.map((v, i) => {
        const h = max > 0 ? Math.max((v / max) * alto, v > 0 ? 2 : 0) : 0;
        return (
          <g key={i}>
            <title>{`${mesDe(i)}: ${numero(v)}`}</title>
            <rect x={i * (ancho + sep)} y={0} width={ancho} height={alto} fill="transparent" />
            {h === 0 ? <rect x={i * (ancho + sep)} y={alto - 1} width={ancho} height={1} fill="var(--rejilla)" />
              : <rect x={i * (ancho + sep)} y={alto - h} width={ancho} height={h} rx={1} fill={i >= 6 ? "var(--serie-1)" : "var(--eje)"} opacity={i >= 6 ? 1 : 0.35} />}
          </g>
        );
      })}
    </svg>
  );
}

const f = (n: number) => numero(Math.round(n * 100) / 100);

/** Los mismos pasos que hace reabasto() en la base, con los números de este artículo. */
export function pasosReabasto(r: FilaReabasto, regla: ReglaReabasto) {
  const ult6 = r.consumo_meses.slice(6).map(Number);
  const suma6 = ult6.reduce((s, v) => s + v, 0);
  const suma12 = r.consumo_meses.map(Number).reduce((s, v) => s + v, 0);
  const dm = Number(r.demanda_mensual);
  const pasos: { texto: string; fuerte?: boolean }[] = [];

  pasos.push({ texto: `Consumo de los últimos 6 meses (${mesDe(6)} a ${mesDe(11)}): ${ult6.map(f).join(", ")} → ${r.meses_con_consumo} ${r.meses_con_consumo === 1 ? "mes" : "meses"} con consumo (la regla pide ${regla.meses_con_consumo}).` });
  if (r.meses_con_consumo >= regla.meses_con_consumo) {
    pasos.push(regla.promedio === "todos"
      ? { texto: `Genera demanda: promedio de los 6 meses = ${f(suma6)} ÷ 6 = ${f(dm)} al mes.` }
      : { texto: `Genera demanda: promedio de los meses con consumo = ${f(suma6)} ÷ ${r.meses_con_consumo} = ${f(dm)} al mes.` });
  } else if (r.es_importado && suma12 > 0) {
    pasos.push({ texto: `Importado con consumo esporádico: se promedia el año, ${f(suma12)} ÷ 12 = ${f(dm)} al mes (la hoja lo dejaba en cero y sin alerta).` });
  } else {
    pasos.push({ texto: `No llega a ${regla.meses_con_consumo} meses con consumo: no genera demanda (0 al mes).` });
  }

  const seg = Number(r.stock_seguridad ?? 0);
  const entregaTxt = r.entrega_propia != null ? `${r.dias_entrega} días hábiles` : `${r.dias_entrega} días hábiles${r.proveedor ? " (los del proveedor o el estándar)" : " (estándar)"}`;
  pasos.push({ texto: `Entrega ${entregaTxt} → punto de reorden = ⌈${f(dm)} ÷ ${regla.dias_habiles_mes} × ${r.dias_entrega}${seg ? ` + ${f(seg)} de seguridad` : ""}⌉ = ${f(r.punto_reorden)}.` });
  const cob = Number(r.meses_cobertura);
  pasos.push({ texto: `Lote = ${f(cob)} ${cob === 1 ? "mes" : "meses"} de cobertura${r.cobertura_propia == null ? (r.es_importado ? " (importado)" : " (nacional)") : ""} × ${f(dm)} = ${f(r.lote)}.` });
  pasos.push({ texto: `Disponible = ${f(r.en_planta)} en planta − ${f(r.reservado)} apartado + ${f(r.en_transito)} en tránsito = ${f(r.disponible)}.` });

  if (r.estado === "negativo") {
    pasos.push({ texto: "Hay existencia negativa en planta: algo salió sin registrarse su entrada. Revisa el kardex o pide un ajuste.", fuerte: true });
  } else if (r.estado === "ordenar" || Number(r.sugerido) > 0) {
    pasos.push({ texto: `${f(r.disponible)} < ${f(r.punto_reorden)} → pedir ⌈(${f(r.lote)} + ${f(r.punto_reorden)} − ${f(r.disponible)}) ÷ ${f(r.empaque)}⌉ × ${f(r.empaque)} = ${f(r.sugerido)} ${r.unidad}.`, fuerte: true });
  } else if (r.estado === "excedente") {
    pasos.push({ texto: "Sin consumo en 12 meses, con existencia y sin stock de seguridad → excedente (dinero parado).", fuerte: true });
  } else {
    pasos.push({ texto: `${f(r.disponible)} ≥ ${f(r.punto_reorden)} → no hace falta pedir.`, fuerte: true });
  }
  if (Number(r.en_borrador) > 0) pasos.push({ texto: `Ya hay ${f(r.en_borrador)} en orden de compra en borrador (${r.borradores}).` });
  if (Number(r.en_requisicion) > 0) pasos.push({ texto: `Ya hay ${f(r.en_requisicion)} pedidos a compras en una requisición pendiente.` });
  return pasos;
}

export function PorQue({ r, regla }: { r: FilaReabasto; regla: ReglaReabasto | undefined }) {
  return (
    <P.Root>
      <P.Trigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-marca-texto hover:underline whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <HelpCircle className="h-3.5 w-3.5" /> ¿por qué?
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content side="left" align="start" sideOffset={6} collisionPadding={12}
          className="z-50 w-[min(440px,calc(100vw-24px))] tarjeta shadow-xl p-4 text-sm">
          <p className="font-medium mb-1">{r.nombre}</p>
          <div className="mb-3"><Sparkline valores={r.consumo_meses.map(Number)} /></div>
          {regla ? (
            <ol className="space-y-1.5 list-decimal pl-4 marker:text-tenue">
              {pasosReabasto(r, regla).map((p, i) => <li key={i} className={cn(p.fuerte && "font-medium")}>{p.texto}</li>)}
            </ol>
          ) : <p className="text-tenue">Cargando la regla…</p>}
          <P.Arrow className="fill-[hsl(var(--superficie))]" />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

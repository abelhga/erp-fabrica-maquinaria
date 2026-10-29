import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { porcentaje } from "@/lib/formato";

/**
 * Diagrama de flujo (sankey) del ERP: el grueso de cada franja es la cantidad. Lo usan Resultados
 * (de dónde viene y a dónde se va el dinero) y Lo cotizado (qué pasó con cada cotización).
 * La pantalla arma nodos y ligas con lo que da la base; aquí solo se dibuja.
 */
export interface NodoSankey {
  name: string;
  color: string;
  /** Antes del número: «≈ » si es estimado. */
  marca?: string;
  /** Color de las franjas que salen de él (la pérdida pinta de rojo lo que tapa); si no, el del destino. */
  colorSalida?: string;
  /** Para saber qué nodo se tocó. */
  clave?: string;
}
export interface DatosSankey { nodes: NodoSankey[]; links: { source: number; target: number; value: number }[] }

/** Arma el diagrama con nodos y ligas en crudo: quita ligas en cero y los nodos que quedan sueltos
 * (recharts no dibuja un nodo sin franjas) y renumera. */
export function armarSankey(nodes: NodoSankey[], links: DatosSankey["links"]): DatosSankey {
  const ligas = links.filter((l) => l.value > 0.5);
  const usados = [...new Set(ligas.flatMap((l) => [l.source, l.target]))].sort((a, b) => a - b);
  const nuevo = new Map(usados.map((v, i) => [v, i]));
  return { nodes: usados.map((i) => nodes[i]), links: ligas.map((l) => ({ ...l, source: nuevo.get(l.source)!, target: nuevo.get(l.target)! })) };
}

export function DiagramaSankey({ datos, total, formato, formatoLargo, alClicNodo, alto = 520, margen = { izq: 200, der: 270 }, minimo = 820 }: {
  datos: DatosSankey;
  /** Contra qué se saca el % de cada nodo (las ventas, lo cotizado). */
  total: number;
  /** Número corto en la etiqueta ($12.7 M, 34). */
  formato: (v: number) => string;
  /** Número completo en el tooltip. */
  formatoLargo: (v: number) => string;
  alClicNodo?: (n: NodoSankey) => void;
  alto?: number;
  margen?: { izq: number; der: number };
  /** Ancho mínimo: abajo de esto la tarjeta se desliza de lado (en celular) en vez de encimar etiquetas. */
  minimo?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="px-2 pb-2" style={{ minWidth: minimo, height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <Sankey data={datos} nodePadding={26} nodeWidth={12} iterations={64} sort={false}
            margin={{ top: 16, bottom: 16, left: margen.izq, right: margen.der }}
            node={<Nodo total={total} formato={formato} alClic={alClicNodo} />} link={<Liga />}>
            <Tooltip content={<TooltipSankey total={total} formato={formatoLargo} />} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** La misma información en tabla: de dónde, a dónde, cuánto y qué parte del total. */
export function TablaSankey({ datos, total, formato, encabezado = "Importe" }: {
  datos: DatosSankey; total: number; formato: (v: number) => string; encabezado?: string;
}) {
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="tabla">
        <thead><tr><th>De</th><th>A</th><th className="!text-right">{encabezado}</th><th className="!text-right">Del total</th></tr></thead>
        <tbody>
          {datos.links.map((l) => {
            const a = datos.nodes[l.target];
            return (
              <tr key={`${l.source}-${l.target}`}>
                <td>{datos.nodes[l.source].name}</td><td className="font-medium">{a.name}</td>
                <td className="text-right cifra">{a.marca ?? ""}{formato(l.value)}</td>
                <td className="text-right cifra">{porcentaje(l.value / total, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- recharts pasa a node/link props sin tipo */
function Nodo(props: any) {
  const { x, y, width, height, payload, total, formato, alClic } = props;
  const n = payload as NodoSankey & { depth: number; value: number; targetNodes?: number[] };
  const izquierda = n.depth === 0;
  // Las columnas de en medio tienen otra columna enfrente: en un renglón la etiqueta se encimaba
  // con la de la derecha, así que van en dos.
  const enMedio = !izquierda && (n.targetNodes?.length ?? 0) > 0;
  const tx = izquierda ? x - 8 : x + width + 8;
  const numero = `${n.marca ?? ""}${formato(n.value)} · ${porcentaje(n.value / total, 0)}`;
  return (
    <g onClick={alClic ? () => alClic(n) : undefined} style={alClic ? { cursor: "pointer" } : undefined}>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} rx={2} fill={n.color} />
      <text x={tx} y={y + height / 2} textAnchor={izquierda ? "end" : "start"} dominantBaseline="middle" fontSize={12}
        fill="hsl(var(--texto))" stroke="hsl(var(--superficie))" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
        {enMedio ? (
          <>
            <tspan x={tx} dy="-0.6em" fontWeight={600}>{n.name}</tspan>
            <tspan x={tx} dy="1.25em" fill="hsl(var(--tenue))">{numero}</tspan>
          </>
        ) : (
          <>
            <tspan fontWeight={600}>{n.name}</tspan>
            <tspan dx={6} fill="hsl(var(--tenue))">{numero}</tspan>
          </>
        )}
      </text>
    </g>
  );
}

function Liga(props: any) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
  return (
    <path className="liga-sankey" fill="none" stroke={payload.source.colorSalida ?? payload.target.color} strokeWidth={Math.max(1, linkWidth)}
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`} />
  );
}

function TooltipSankey({ active, payload, total, formato }: { active?: boolean; payload?: any[]; total: number; formato: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload?.payload ?? payload[0].payload;
  const esLiga = p?.source && p?.target;
  const nombre = esLiga ? `${p.source.name} → ${p.target.name}` : p?.name;
  const valor = Number(payload[0].value ?? p?.value ?? 0);
  const estimado = Boolean(esLiga ? p.target.marca || p.source.marca : p?.marca);
  return (
    <div className="tarjeta px-3 py-2 text-xs shadow-lg min-w-[180px]">
      <p className="font-medium mb-1">{nombre}</p>
      <p className="flex justify-between gap-4"><span className="text-tenue">{estimado ? "Estimado" : "Cantidad"}</span><span className="cifra font-medium">{formato(valor)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-tenue">Del total</span><span className="cifra">{porcentaje(valor / total, 1)}</span></p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

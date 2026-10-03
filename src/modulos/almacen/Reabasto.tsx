import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Gauge, PackageX, ShoppingCart, TrendingDown, Wallet } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, dineroCompacto, numero, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { SinPermiso, todasLasFilas } from "./componentes/comun";
import { PorQue, Sparkline, type FilaReabasto, type ReglaReabasto } from "./componentes/Reabasto";

type Vista = "ordenar" | "importados" | "excedente" | "negativo" | "todos";
const ESTADO = {
  ordenar: { texto: "Ordenar", tono: "peligro" },
  ok: { texto: "OK", tono: "ok" },
  excedente: { texto: "Excedente", tono: "neutro" },
  negativo: { texto: "Negativo", tono: "aviso" },
} as const;

interface Resultado {
  ordenes: { id: string; folio: string; proveedor: string; moneda: string; total: number; partidas: number }[];
  sin_proveedor: { id: string; clave: string; nombre: string }[];
  omitidos?: { id: string; clave: string; nombre: string; razon: string }[];
}

/**
 * Reabasto: la hoja Demanda con sus mismas reglas (3 de 6 meses con consumo,
 * punto de reorden por días hábiles de entrega) más cobertura por artículo
 * (1 mes nacional, 6 importado) y el stock de seguridad que la hoja ignoraba.
 * Cada cifra trae su "¿por qué?" con los números del artículo.
 */
export default function Reabasto() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const verMovimientos = puede("inventario", 2) || puede("costos", 1);
  const compra = puede("compras", 2);
  const pide = !compra && puede("inventario", 2);
  const editaParametros = puede("inventario", 2) || puede("compras", 2) || puede("costeo", 2);
  const verCostos = puede("costos", 1);
  const [vista, setVista] = useState<Vista | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const regla = useQuery({
    queryKey: ["configuracion", "reabasto"],
    queryFn: async () => (await q<{ valor: ReglaReabasto }>(supabase.from("configuracion").select("valor").eq("clave", "reabasto").single())).valor,
  });
  const datos = useQuery({
    queryKey: ["reabasto_detalle"],
    enabled: verMovimientos,
    queryFn: () => todasLasFilas<FilaReabasto>((d, h) => supabase.rpc("reabasto_detalle").order("articulo_id").range(d, h)),
  });
  const filas = useMemo(() => (datos.data ?? []).map((r) => ({
    ...r, demanda_mensual: Number(r.demanda_mensual), punto_reorden: Number(r.punto_reorden), lote: Number(r.lote), disponible: Number(r.disponible),
    sugerido: Number(r.sugerido), en_planta: Number(r.en_planta), consumo_meses: r.consumo_meses.map(Number),
  })), [datos.data]);

  const cuenta = (v: Vista) => filas.filter((r) => coincideVista(r, v)).length;
  // Si hay qué ordenar, se abre ahí: es lo que compras viene a ver.
  useEffect(() => { if (vista == null && datos.data) setVista(cuenta("ordenar") > 0 ? "ordenar" : "todos"); }, [datos.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = vista ?? "ordenar";
  const visibles = filas.filter((r) => coincideVista(r, v));

  const conMinimo = filas.filter((r) => r.punto_reorden > 0).length;
  const aOrdenar = filas.filter((r) => r.estado === "ordenar");
  const desabasto = conMinimo ? aOrdenar.length / conMinimo : 0;
  const inversion = aOrdenar.reduce((s, r) => s + r.sugerido * Number(r.costo_mxn ?? 0), 0);
  const excedentes = filas.filter((r) => r.estado === "excedente");
  const elegidos = filas.filter((r) => sel.has(r.articulo_id));

  const parametro = useAccion(async ({ id, campo, valor }: { id: string; campo: "meses_cobertura" | "stock_minimo_fijo"; valor: number | null }) =>
    q(supabase.from("articulos").update({ [campo]: valor }).eq("id", id).select("id").single()), {
    exito: "Guardado: el cálculo ya lo toma en cuenta",
    invalidar: [["reabasto_detalle"]],
  });

  const generar = useAccion(() => q<Resultado>(supabase.rpc("ordenes_desde_reabasto", { p_articulos: [...sel] })), {
    invalidar: [["reabasto_detalle"], ["v_ordenes_compra"]],
    alTerminar: (r) => {
      setSel(new Set());
      const avisos = (r.sin_proveedor?.length ?? 0) + (r.omitidos?.length ?? 0);
      if (!avisos && r.ordenes.length === 1) { toast.success(`Se creó ${r.ordenes[0].folio} en borrador`); ir(`/compras/ordenes/${r.ordenes[0].id}`); return; }
      if (!avisos && r.ordenes.length > 1) { toast.success(`Se crearon ${r.ordenes.length} órdenes en borrador`); ir(`/compras/ordenes?creadas=${r.ordenes.map((o) => o.id).join(",")}`); return; }
      setResultado(r);
    },
  });
  const pedir = useAccion(() => q<{ id: string; folio: string; partidas: number }>(supabase.rpc("requisicion_desde_reabasto", { p_articulos: [...sel] })), {
    exito: (r) => `Requisición ${r.folio} enviada a compras con ${r.partidas} partida(s)`,
    invalidar: [["reabasto_detalle"]],
    alTerminar: () => setSel(new Set()),
  });

  if (!verMovimientos) {
    return (
      <Pagina titulo="Reabasto">
        <div className="tarjeta">
          <SinPermiso titulo="El reabasto se calcula con los movimientos de almacén"
            texto="Tu rol ve existencias pero no movimientos, así que aquí verías todo en cero. Consulta la disponibilidad en Existencias." />
        </div>
      </Pagina>
    );
  }

  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const seleccionables = visibles.filter((r) => r.sugerido > 0);

  const columnas: Columna<(typeof filas)[number]>[] = [
    {
      clave: "sel", sinBusqueda: true, clase: "w-8 pr-1",
      titulo: (compra || pide) ? (
        <input type="checkbox" aria-label="Elegir todos los que hay que pedir" className="accent-[hsl(var(--marca))]"
          checked={seleccionables.length > 0 && seleccionables.every((r) => sel.has(r.articulo_id))}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setSel(e.target.checked ? new Set(seleccionables.map((r) => r.articulo_id)) : new Set())} />
      ) : "",
      valor: () => "",
      celda: (r) => (compra || pide) && r.sugerido > 0
        ? <input type="checkbox" aria-label={`Elegir ${r.nombre}`} className="accent-[hsl(var(--marca))]" checked={sel.has(r.articulo_id)} onChange={() => alternar(r.articulo_id)} />
        : null,
    },
    {
      clave: "nombre", titulo: "Artículo", clase: "min-w-[180px] max-w-[230px] pl-1", valor: (r) => `${r.clave} ${r.nombre} ${r.proveedor ?? ""}`,
      celda: (r) => (
        <div className="min-w-0">
          <p className="truncate" title={r.nombre}>{r.nombre}</p>
          <p className="text-xs text-tenue truncate">{r.clave}{r.proveedor ? ` · ${r.proveedor}` : " · sin proveedor"}{r.es_importado && <span className="text-info"> · importado</span>}</p>
        </div>
      ),
    },
    { clave: "consumo", titulo: "12 meses", sinBusqueda: true, clase: "px-2", valor: (r) => r.consumo_meses.reduce((s, x) => s + x, 0), celda: (r) => <Sparkline valores={r.consumo_meses} /> },
    { clave: "demanda_mensual", titulo: "Dem./mes", alinear: "der", sinBusqueda: true, clase: "px-2", celda: (r) => r.demanda_mensual ? numero(r.demanda_mensual) : <span className="text-tenue">0</span> },
    {
      clave: "meses_cobertura", titulo: "Cobertura", alinear: "der", sinBusqueda: true, clase: "px-1", valor: (r) => Number(r.meses_cobertura),
      celda: (r) => editaParametros
        ? <CeldaNumero valor={r.cobertura_propia} defecto={Number(r.meses_cobertura)} sufijo="m" min={0.01}
            alGuardar={(valor) => parametro.mutate({ id: r.articulo_id, campo: "meses_cobertura", valor })} titulo="Meses de cobertura (vacío = 1 nacional, 6 importado)" />
        : <span>{numero(r.meses_cobertura)} m</span>,
    },
    {
      clave: "stock_seguridad", titulo: "Seguridad", alinear: "der", sinBusqueda: true, clase: "px-1", valor: (r) => Number(r.stock_seguridad ?? 0),
      celda: (r) => editaParametros
        ? <CeldaNumero valor={r.stock_seguridad} defecto={null} min={0}
            alGuardar={(valor) => parametro.mutate({ id: r.articulo_id, campo: "stock_minimo_fijo", valor })} titulo="Stock de seguridad (se suma al punto de reorden)" />
        : <span>{r.stock_seguridad ? numero(r.stock_seguridad) : "—"}</span>,
    },
    {
      clave: "punto_reorden", titulo: "Reorden", alinear: "der", sinBusqueda: true, clase: "px-2",
      celda: (r) => <div><p>{numero(r.punto_reorden)}</p><p className="text-[11px] text-tenue whitespace-nowrap">{r.dias_entrega} d entrega</p></div>,
    },
    { clave: "lote", titulo: "Lote", alinear: "der", sinBusqueda: true, clase: "px-2", celda: (r) => numero(r.lote) },
    {
      clave: "disponible", titulo: "Disponible", alinear: "der", sinBusqueda: true, clase: "px-2",
      celda: (r) => (
        <span title={`${numero(r.en_planta)} en planta − ${numero(r.reservado)} apartado + ${numero(r.en_transito)} en tránsito`}
          className={cn("font-medium", r.disponible < r.punto_reorden && "text-peligro")}>{numero(r.disponible)}</span>
      ),
    },
    {
      clave: "sugerido", titulo: "Sugerido", alinear: "der", sinBusqueda: true, clase: "px-2",
      celda: (r) => r.sugerido > 0 ? (
        <div>
          <span className="font-semibold">{numero(r.sugerido)}</span> <span className="text-xs text-tenue">{r.unidad}</span>
          {(Number(r.en_borrador) > 0 || Number(r.en_requisicion) > 0) && (
            <p className="text-[11px] text-info whitespace-nowrap" title={Number(r.en_borrador) > 0 ? `En orden de compra en borrador: ${r.borradores}` : "Ya pedido a compras en una requisición pendiente"}>
              {Number(r.en_borrador) > 0 ? `${numero(r.en_borrador)} en OC` : `${numero(r.en_requisicion)} en REQ`}
            </p>
          )}
          {verCostos && r.costo_mxn != null && <p className="text-[11px] text-tenue">{dinero(r.sugerido * Number(r.costo_mxn))}</p>}
        </div>
      ) : <span className="text-tenue/50">·</span>,
    },
    {
      clave: "estado", titulo: "Estado", clase: "px-2", valor: (r) => ESTADO[r.estado].texto,
      celda: (r) => <div className="space-y-0.5"><Insignia tono={ESTADO[r.estado].tono}>{ESTADO[r.estado].texto}</Insignia><div><PorQue r={r} regla={regla.data} /></div></div>,
    },
  ];

  return (
    <Pagina
      titulo="Reabasto"
      descripcion="Qué pedir, cuánto y por qué. La regla es la de la hoja Demanda, con cobertura por artículo y el stock de seguridad que la hoja no leía."
      ancho="max-w-[1500px]"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="A ordenar" valor={numero(aOrdenar.length)} icono={ShoppingCart} tono={aOrdenar.length ? "peligro" : "ok"}
          detalle="por debajo de su punto de reorden" alClic={() => setVista("ordenar")} />
        <Kpi titulo="Desabasto" valor={porcentaje(desabasto)} icono={Gauge}
          tono={desabasto < 0.08 ? "ok" : desabasto <= 0.17 ? "aviso" : "peligro"}
          detalle={`${aOrdenar.length} de ${conMinimo} con mínimo · ${desabasto < 0.08 ? "óptimo (<8 %)" : desabasto <= 0.17 ? "aceptable (8–17 %)" : "deficiente (>17 %)"}`} />
        {verCostos ? (
          <Kpi titulo="Inversión sugerida" valor={dineroCompacto(inversion)} icono={Wallet} tono="info" detalle="lo sugerido a costo vigente, sin IVA" />
        ) : (
          <Kpi titulo="Importados" valor={numero(cuenta("importados"))} icono={TrendingDown} tono="info" detalle="con 6 meses de cobertura" alClic={() => setVista("importados")} />
        )}
        <Kpi titulo="Excedentes" valor={numero(excedentes.length)} icono={PackageX} tono="neutro"
          detalle={verCostos ? `${dineroCompacto(excedentes.reduce((s, r) => s + r.en_planta * Number(r.costo_mxn ?? 0), 0))} parados sin consumo en 12 meses` : "sin consumo en 12 meses"}
          alClic={() => setVista("excedente")} />
      </div>

      {sel.size > 0 && (
        <div className="sticky top-2 z-20 tarjeta shadow-lg px-4 py-3 flex flex-wrap items-center gap-3 border-marca/40">
          <p className="text-sm">
            <b className="cifra">{sel.size}</b> artículo(s) elegidos
            {verCostos && <> · <span className="cifra">{dinero(elegidos.reduce((s, r) => s + r.sugerido * Number(r.costo_mxn ?? 0), 0))}</span></>}
            {" · "}{new Set(elegidos.map((r) => r.proveedor ?? "—")).size} proveedor(es)
          </p>
          <div className="ml-auto flex gap-2">
            <Boton variante="fantasma" tamano="sm" onClick={() => setSel(new Set())}>Quitar selección</Boton>
            {compra && <Boton tamano="sm" onClick={() => generar.mutate(undefined)} cargando={generar.isPending}><ShoppingCart className="h-4 w-4" /> Generar órdenes de compra</Boton>}
            {pide && <Boton tamano="sm" onClick={() => pedir.mutate(undefined)} cargando={pedir.isPending}><ClipboardList className="h-4 w-4" /> Pedir a compras</Boton>}
          </div>
        </div>
      )}

      <TablaDatos
        filas={visibles}
        columnas={columnas}
        cargando={datos.isLoading}
        error={datos.error}
        claveFila={(r) => r.articulo_id}
        exportarComo="reabasto"
        placeholder="Buscar artículo, clave o proveedor…"
        compacta
        claseFila={(r) => (sel.has(r.articulo_id) ? "bg-marca-suave/60" : undefined)}
        filtros={
          <Filtro<Vista> valor={v} alCambiar={(x) => { setVista(x); }} opciones={[
            { valor: "ordenar", texto: "A ordenar", cuenta: cuenta("ordenar") },
            { valor: "importados", texto: "Importados", cuenta: cuenta("importados") },
            { valor: "excedente", texto: "Excedentes", cuenta: cuenta("excedente") },
            { valor: "negativo", texto: "Negativos", cuenta: cuenta("negativo") },
            { valor: "todos", texto: "Todos", cuenta: filas.length },
          ]} />
        }
        vacio={{
          icono: v === "ordenar" ? ShoppingCart : AlertTriangle,
          titulo: v === "ordenar" ? "Nada por debajo de su punto de reorden" : "Nada con este filtro",
          texto: v === "ordenar" ? "Todo lo que genera demanda tiene existencia suficiente. Revisa los importados o los excedentes." : "Prueba con otro filtro.",
        }}
        pie={<p className="text-xs text-tenue">
          Cobertura y seguridad se editan aquí mismo (Enter guarda; vacío = valor por omisión).{" "}
          {regla.data && <>Regla vigente: {regla.data.meses_con_consumo} de {regla.data.meses_historia} meses con consumo, {regla.data.dias_habiles_mes} días hábiles por mes, {regla.data.dias_entrega_default} días de entrega si no hay dato.</>}
        </p>}
      />

      <Dialogo abierto={!!resultado} alCambiar={(x) => !x && setResultado(null)} titulo="Órdenes de compra generadas"
        pie={<>
          <Boton variante="secundario" onClick={() => setResultado(null)}>Seguir en reabasto</Boton>
          {(resultado?.ordenes.length ?? 0) > 0 && <Boton onClick={() => {
            const r = resultado!; setResultado(null);
            ir(r.ordenes.length === 1 ? `/compras/ordenes/${r.ordenes[0].id}` : `/compras/ordenes?creadas=${r.ordenes.map((o) => o.id).join(",")}`);
          }}>Ver {resultado!.ordenes.length === 1 ? "la orden" : "las órdenes"}</Boton>}
        </>}>
        {resultado && (
          <div className="space-y-4 text-sm">
            {resultado.ordenes.length > 0 ? (
              <ul className="space-y-1">
                {resultado.ordenes.map((o) => <li key={o.id}><b>{o.folio}</b> · {o.proveedor} · {o.partidas} partida(s){verCostos && ` · ${dinero(o.total, o.moneda as "MXN" | "USD")}`}</li>)}
              </ul>
            ) : <p className="text-tenue">No se creó ninguna orden.</p>}
            {resultado.sin_proveedor.length > 0 && (
              <div className="rounded-lg bg-aviso-suave px-3 py-2">
                <p className="font-medium text-aviso">Sin proveedor ({resultado.sin_proveedor.length}): no se pidieron</p>
                <p className="text-xs text-tenue mb-1">Asígnales proveedor en su costo o en el catálogo y vuelve a generar.</p>
                <ul className="text-xs list-disc pl-4">{resultado.sin_proveedor.map((a) => <li key={a.id}>{a.clave} · {a.nombre}</li>)}</ul>
              </div>
            )}
            {(resultado.omitidos?.length ?? 0) > 0 && (
              <div className="rounded-lg bg-fondo px-3 py-2">
                <p className="font-medium">No se pidieron otra vez ({resultado.omitidos!.length})</p>
                <ul className="text-xs list-disc pl-4 text-tenue">{resultado.omitidos!.map((a) => <li key={a.id}>{a.clave} · {a.nombre}: {a.razon}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Dialogo>
    </Pagina>
  );

  function coincideVista(r: FilaReabasto, x: Vista) {
    if (x === "ordenar") return r.estado === "ordenar";
    if (x === "importados") return r.es_importado;
    if (x === "excedente") return r.estado === "excedente";
    if (x === "negativo") return r.estado === "negativo";
    return true;
  }
}

/** Celda numérica editable en línea: Enter o salir guarda; vacío regresa al valor por omisión. */
function CeldaNumero({ valor, defecto, alGuardar, sufijo, min, titulo }: {
  valor: number | null; defecto: number | null; alGuardar: (v: number | null) => void; sufijo?: string; min: number; titulo: string;
}) {
  const inicial = valor == null ? "" : String(Number(valor));
  const [texto, setTexto] = useState(inicial);
  useEffect(() => setTexto(inicial), [inicial]);
  const guardar = () => {
    if (texto === inicial) return;
    if (texto.trim() === "") { alGuardar(null); return; }
    const n = Number(texto.replace(",", "."));
    if (Number.isNaN(n) || n < min) { toast.error(min > 0 ? "Debe ser mayor a cero" : "No puede ser negativo"); setTexto(inicial); return; }
    alGuardar(n);
  };
  return (
    <span className="inline-flex items-center gap-0.5" title={titulo}>
      <input inputMode="decimal" value={texto} placeholder={defecto == null ? "—" : numero(defecto)} aria-label={titulo}
        onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setTexto(inicial); }}
        onBlur={guardar}
        className={cn("w-14 h-7 rounded-md border bg-transparent px-1.5 text-right text-sm cifra focus:outline-none focus:ring-2 focus:ring-marca/40",
          valor == null ? "border-transparent hover:border-borde placeholder:text-tenue" : "border-borde font-medium")} />
      {sufijo && <span className="text-xs text-tenue">{sufijo}</span>}
    </span>
  );
}

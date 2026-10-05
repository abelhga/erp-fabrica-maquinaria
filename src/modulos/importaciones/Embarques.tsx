// Tablero de importaciones: lo que hoy son 29 casillas en una hoja que va 1–3
// semanas atrasada y cientos de correos con el agente. Arriba lo urgente (las
// alertas salen de la base), luego cada embarque en su fase con el siguiente paso
// y quién lo debe, y lo que estamos esperando de otros.
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock, AlertTriangle, ArrowRight, CalendarClock, Clock, DollarSign, FileWarning, Inbox, Info, Plus, Ship, Siren, Undo2,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Pestanas, ContenidoPestana, ListaPestanas } from "@/components/ui/pestanas";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { dinero, fecha, hace, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import {
  DiasLibres, FASES, InsigniaDebe, InsigniaFase, MODALIDAD_CORTA, NOMBRE_DEBE, useAlertas, useEmbarques, useVeDinero,
  type Alerta, type Debe, type Dinero, type Embarque, type Fase,
} from "./componentes/comun";
import { DialogoEmbarque } from "./componentes/DialogoEmbarque";

const COLUMNAS: { clave: string; fases: Fase[]; titulo: string; ayuda: string }[] = [
  { clave: "proveedor", fases: ["cotizando", "produccion", "listo"], titulo: "Con el proveedor", ayuda: "PI, anticipo, producción y saldo" },
  { clave: "transito", fases: ["transito"], titulo: "En el mar", ayuda: "Documentos al agente antes del arribo" },
  { clave: "puerto", fases: ["puerto"], titulo: "En puerto", ayuda: "Los días libres corren" },
  { clave: "planta", fases: ["planta"], titulo: "En planta", ayuda: "Cuenta de gastos, saldo y garantía" },
];

const TONO_ALERTA = {
  riesgo: { icono: Siren, clase: "bg-peligro-suave text-peligro" },
  atencion: { icono: AlertTriangle, clase: "bg-aviso-suave text-aviso" },
  info: { icono: Info, clase: "bg-info-suave text-info" },
} as const;

export default function Embarques() {
  const ir = useNavigate();
  const { pathname } = useLocation();
  const { puede } = useSesion();
  const veDinero = useVeDinero();
  const [nuevo, setNuevo] = useState(false);
  const pestanaInicial = pathname.endsWith("/dinero") && veDinero ? "dinero" : "embarques";
  const [pestana, setPestana] = useState(pestanaInicial);
  const embarques = useEmbarques();
  const alertas = useAlertas();
  const dineroQ = useQuery({
    queryKey: ["v_embarque_dinero"], enabled: veDinero,
    queryFn: () => q<Dinero[]>(supabase.from("v_embarque_dinero").select("*")),
  });

  const lista = embarques.data ?? [];
  const activos = lista.filter((e) => e.fase !== "cerrado" && e.fase !== "cancelado");
  const riesgos = (alertas.data ?? []).filter((a) => a.tono === "riesgo").length;
  const totales = useMemo(() => {
    const vivos = new Set(lista.filter((e) => e.fase !== "cancelado").map((e) => e.id));
    return (dineroQ.data ?? []).filter((d) => vivos.has(d.embarque_id)).reduce((s, d) => ({
      porPagarUsd: s.porPagarUsd + Number(d.por_pagar_usd), porPagarMxn: s.porPagarMxn + Number(d.por_pagar_mxn),
      recuperar: s.recuperar + Number(d.por_recuperar_mxn),
    }), { porPagarUsd: 0, porPagarMxn: 0, recuperar: 0 });
  }, [dineroQ.data, lista]);
  const llegan = activos.filter((e) => e.llegada_planta_estimada && !e.en_planta
    && (new Date(e.llegada_planta_estimada + "T12:00:00").getTime() - Date.now()) / 86_400_000 <= 14);

  return (
    <Pagina
      titulo="Importaciones"
      descripcion="Cada embarque con su fecha real por etapa, qué falta y quién lo debe."
      acciones={puede("importaciones", 2) && <Boton onClick={() => setNuevo(true)}><Plus className="h-4 w-4" /> Nuevo embarque</Boton>}
    >
      <Pestanas value={pestana} onValueChange={(v) => { setPestana(v); ir(v === "dinero" ? "/importaciones/dinero" : "/importaciones", { replace: true }); }}>
        <ListaPestanas opciones={[
          { valor: "embarques", texto: "Embarques", cuenta: activos.length },
          ...(veDinero ? [{ valor: "dinero", texto: "Dinero" }] : []),
          { valor: "tiempos", texto: "Tiempos por proveedor" },
        ]} />

        <ContenidoPestana value="embarques" className="space-y-5 pt-5">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi titulo="En curso" valor={numero(activos.length)} icono={Ship}
              detalle={`${activos.filter((e) => e.fase === "transito").length} en el mar · ${activos.filter((e) => e.fase === "puerto").length} en puerto`} />
            <Kpi titulo="Riesgos hoy" valor={numero(riesgos)} icono={Siren} tono={riesgos ? "peligro" : "ok"}
              detalle={`${(alertas.data ?? []).length} alertas en total`} />
            {veDinero ? (
              <>
                <Kpi titulo="Por pagar a proveedores" valor={dinero(totales.porPagarUsd, "USD")} icono={DollarSign} tono="info"
                  detalle={`≈ ${dinero(totales.porPagarMxn)} al tipo de cambio de hoy`} alClic={() => setPestana("dinero")} />
                <Kpi titulo="Por recuperar" valor={dinero(totales.recuperar)} icono={Undo2} tono={totales.recuperar ? "aviso" : "ok"}
                  detalle="Saldos a favor y garantías de contenedor" alClic={() => setPestana("dinero")} />
              </>
            ) : (
              <Kpi titulo="Llegan a planta en 14 días" valor={numero(llegan.length)} icono={CalendarClock} tono="info"
                detalle={llegan[0] ? `El primero: ${llegan[0].folio} hacia el ${fecha(llegan[0].llegada_planta_estimada)}` : "Nada en camino tan pronto"} />
            )}
          </div>

          <Alertas alertas={alertas.data} cargando={alertas.isLoading} />

          {embarques.error ? <ErrorCarga error={embarques.error} /> : embarques.isLoading ? <Cargando filas={6} /> : (
            <Tubo embarques={lista} alertas={alertas.data ?? []} />
          )}

          <Esperando embarques={lista} />
        </ContenidoPestana>

        {veDinero && (
          <ContenidoPestana value="dinero" className="pt-5">
            <VistaDinero embarques={lista} dinero={dineroQ.data} />
          </ContenidoPestana>
        )}
        <ContenidoPestana value="tiempos" className="pt-5">
          <Tiempos />
        </ContenidoPestana>
      </Pestanas>
      <DialogoEmbarque abierto={nuevo} alCambiar={setNuevo} />
    </Pagina>
  );
}

function Alertas({ alertas, cargando }: { alertas: Alerta[] | undefined; cargando: boolean }) {
  const [todas, setTodas] = useState(false);
  const veDinero = useVeDinero();
  if (cargando) return <Tarjeta><Cargando filas={3} /></Tarjeta>;
  const urgentes = (alertas ?? []).filter((a) => a.tono !== "info");
  const mostrar = todas ? alertas ?? [] : urgentes.slice(0, 6);
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Lo que no puede esperar" descripcion={veDinero ? "Documentos antes del arribo, días libres, pagos, cuentas de gastos y dinero por recuperar" : "Documentos antes del arribo, días libres y cambios de ETA"}
        acciones={(alertas?.length ?? 0) > mostrar.length || todas
          ? <Boton variante="fantasma" tamano="sm" onClick={() => setTodas(!todas)}>{todas ? "Solo lo urgente" : `Ver las ${alertas!.length}`}</Boton> : undefined} />
      {mostrar.length === 0 ? (
        <Vacio icono={AlarmClock} titulo="Nada urgente hoy" texto="Cuando falte un documento a una semana del arribo, se acaben los días libres o un pago no tenga comprobante, aparece aquí." className="py-8" />
      ) : (
        <ul className="divide-y divide-borde border-t border-borde">
          {mostrar.map((a, i) => {
            const T = TONO_ALERTA[a.tono];
            return (
              <li key={`${a.embarque_id}-${a.tipo}-${i}`}>
                <Link to={`/importaciones/${a.embarque_id}`} className="flex gap-3 px-5 py-3 hover:bg-fondo/60">
                  <span className={cn("h-8 w-8 shrink-0 rounded-lg grid place-items-center", T.clase)}><T.icono className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.titulo}</p>
                    <p className="text-xs text-tenue mt-0.5">{a.detalle}</p>
                  </div>
                  <div className="hidden sm:flex items-start"><InsigniaDebe debe={a.debe} /></div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

function Tubo({ embarques, alertas }: { embarques: Embarque[]; alertas: Alerta[] }) {
  const [verCerrados, setVerCerrados] = useState(false);
  const cerrados = embarques.filter((e) => e.fase === "cerrado" || e.fase === "cancelado");
  const riesgo = new Set(alertas.filter((a) => a.tono === "riesgo").map((a) => a.embarque_id));
  if (embarques.length === 0) {
    return <Tarjeta><Vacio icono={Ship} titulo="Todavía no hay embarques" texto="Da de alta el primero cuando el proveedor mande la PI: con eso se arma su lista de documentos y empiezan a contar los tiempos." /></Tarjeta>;
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start">
        {COLUMNAS.map((c) => {
          const aqui = embarques.filter((e) => c.fases.includes(e.fase))
            .sort((a, b) => Number(riesgo.has(b.id)) - Number(riesgo.has(a.id)) || (a.eta ?? "9").localeCompare(b.eta ?? "9"));
          return (
            <section key={c.clave} className="rounded-xl bg-fondo/70 border border-borde p-2.5 space-y-2.5" aria-label={c.titulo}>
              <header className="px-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{c.titulo}</h3>
                  <span className="text-xs text-tenue cifra">{aqui.length}</span>
                </div>
                <p className="text-xs text-tenue">{c.ayuda}</p>
              </header>
              {aqui.map((e) => <TarjetaEmbarque key={e.id} e={e} enRiesgo={riesgo.has(e.id)} />)}
              {aqui.length === 0 && <p className="text-xs text-tenue px-1 pb-2">Ninguno en esta etapa.</p>}
            </section>
          );
        })}
      </div>
      {cerrados.length > 0 && (
        <div>
          <Boton variante="fantasma" tamano="sm" onClick={() => setVerCerrados(!verCerrados)}>
            {verCerrados ? "Ocultar" : "Ver"} cerrados y cancelados ({cerrados.length})
          </Boton>
          {verCerrados && (
            <ul className="mt-2 tarjeta divide-y divide-borde">
              {cerrados.map((e) => (
                <li key={e.id}>
                  <Link to={`/importaciones/${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-fondo/60">
                    <span className="font-medium cifra">{e.folio}</span><span className="flex-1 min-w-0 truncate">{e.descripcion}</span>
                    <span className="text-tenue text-xs">{e.proveedores}</span><InsigniaFase fase={e.fase} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaEmbarque({ e, enRiesgo }: { e: Embarque; enRiesgo: boolean }) {
  const conContenedor = (e.modalidad === "fcl" || e.modalidad === "consolidado") && e.arribo && !e.vacio;
  return (
    <Link to={`/importaciones/${e.id}`}
      className={cn("block tarjeta p-3 space-y-2 hover:border-marca/40 hover:shadow-md transition", enRiesgo && "border-peligro/50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm cifra">{e.folio}</span>
        <span className="text-[11px] text-tenue">{MODALIDAD_CORTA[e.modalidad]}{e.incoterm ? ` · ${e.incoterm}` : ""}</span>
      </div>
      <div>
        <p className="text-sm leading-snug line-clamp-2">{e.descripcion}</p>
        <p className="text-xs text-tenue truncate mt-0.5">{e.proveedores ?? "Sin orden de compra ligada"}</p>
      </div>
      {e.fase === "puerto" && <DiasLibres usados={e.dias_en_puerto} libres={e.dias_libres_almacenaje} etiqueta="Días en puerto" />}
      {conContenedor && <DiasLibres usados={e.dias_contenedor} libres={e.dias_libres_demoras} etiqueta="Contenedor" />}
      <p className="text-xs text-tenue flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5" />
        {e.en_planta ? `En planta desde el ${fecha(e.en_planta)}`
          : e.arribo ? `Llegó el ${fecha(e.arribo)} · a planta hacia el ${fecha(e.llegada_planta_estimada)}`
          : e.eta ? `ETA ${fecha(e.eta)}${e.cambios_eta ? ` (cambió ${e.cambios_eta} ${e.cambios_eta === 1 ? "vez" : "veces"})` : ""}`
          : "Sin ETA todavía"}
      </p>
      {e.siguiente_paso && (
        <div className="rounded-lg bg-fondo px-2.5 py-2 space-y-1">
          <p className="text-xs font-medium flex items-start gap-1.5"><ArrowRight className="h-3.5 w-3.5 mt-px shrink-0 text-marca" />{e.siguiente_paso}</p>
          <InsigniaDebe debe={e.debe} />
        </div>
      )}
      {e.docs_pendientes > 0 && (
        <p className={cn("text-xs flex items-center gap-1.5", e.docs_pendientes_arribo > 0 && (e.fase === "transito" || e.fase === "puerto") ? "text-aviso" : "text-tenue")}>
          <FileWarning className="h-3.5 w-3.5" /> {e.docs_pendientes} {e.docs_pendientes === 1 ? "documento pendiente" : "documentos pendientes"}
        </p>
      )}
    </Link>
  );
}

interface DocPendiente {
  id: string; embarque_id: string; tipo: string; debe: Debe; estado: string; ultimo_seguimiento: string | null; creado_en: string;
  documentos_importacion: { nombre: string; orden: number } | null;
}

/** "Lo que estoy esperando de otros": hoy son sus "¿Alguna novedad?" por correo, sin fecha de cuándo se pidió. */
function Esperando({ embarques }: { embarques: Embarque[] }) {
  const { puede } = useSesion();
  const docs = useQuery({
    queryKey: ["embarque_documentos", "pendientes"],
    queryFn: () => q<DocPendiente[]>(supabase.from("embarque_documentos")
      .select("id, embarque_id, tipo, debe, estado, ultimo_seguimiento, creado_en, documentos_importacion(nombre, orden)")
      .in("estado", ["pendiente", "observado"]).overrideTypes<DocPendiente[], { merge: false }>()),
  });
  const pedi = useAccion(({ id }: { id: string; antes: string | null }) => q(supabase.from("embarque_documentos").update({ ultimo_seguimiento: hoyISO() }).eq("id", id)), {
    exito: "Anotado: lo pediste hoy", invalidar: [["embarque_documentos"]],
    deshacer: (_, { id, antes }) => q(supabase.from("embarque_documentos").update({ ultimo_seguimiento: antes }).eq("id", id)),
  });
  const activos = new Map(embarques.filter((e) => ["produccion", "listo", "transito", "puerto", "planta"].includes(e.fase)).map((e) => [e.id, e]));
  const grupos = useMemo(() => {
    const g = new Map<Debe, (DocPendiente & { emb: Embarque })[]>();
    for (const d of docs.data ?? []) {
      const emb = activos.get(d.embarque_id);
      if (!emb || d.debe === "hegamex") continue;
      // Solo lo que ya toca pedir: el proveedor manda factura, packing list y BL al
      // tener lista la mercancía; la naviera avisa del arribo en el mar; el agente
      // trabaja con la mercancía en puerto; el EIR existe hasta devolver el vacío.
      const toca = d.debe === "proveedor" ? d.tipo === "pi" || ["listo", "transito", "puerto"].includes(emb.fase)
        : d.tipo === "eir" ? !!emb.vacio
        : d.debe === "agente" ? ["puerto", "planta"].includes(emb.fase)
        : ["transito", "puerto", "planta"].includes(emb.fase);
      if (!toca) continue;
      g.set(d.debe, [...(g.get(d.debe) ?? []), { ...d, emb }]);
    }
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.data, embarques]);

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Lo que estamos esperando de otros" descripcion="Documentos pendientes por quién los debe, con la última vez que se pidieron" />
      {docs.isLoading ? <Cargando filas={3} /> : grupos.length === 0 ? (
        <Vacio icono={Inbox} titulo="Nadie nos debe nada" texto="Los documentos que falten del proveedor, el agente o la naviera aparecen aquí con la fecha en que los pediste." className="py-8" />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 pt-0 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map(([debe, items]) => (
            <div key={debe} className="min-w-0 rounded-lg border border-borde">
              <p className="px-3 py-2 text-sm font-medium border-b border-borde flex justify-between">{NOMBRE_DEBE[debe]}<span className="text-tenue cifra">{items.length}</span></p>
              <ul className="divide-y divide-borde">
                {items.sort((a, b) => (a.documentos_importacion?.orden ?? 0) - (b.documentos_importacion?.orden ?? 0)).slice(0, 8).map((d) => (
                  <li key={d.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{d.documentos_importacion?.nombre ?? d.tipo}{d.estado === "observado" && <span className="text-aviso"> · con observaciones</span>}</p>
                      <p className="text-xs text-tenue truncate">
                        <Link to={`/importaciones/${d.embarque_id}`} className="hover:underline">{d.emb.folio}</Link>
                        {" · "}{d.ultimo_seguimiento ? `pedido ${hace(d.ultimo_seguimiento)}` : "sin pedir todavía"}
                      </p>
                    </div>
                    {puede("importaciones", 2) && d.ultimo_seguimiento !== hoyISO() && (
                      <Boton variante="secundario" tamano="sm" className="shrink-0" onClick={() => pedi.mutate({ id: d.id, antes: d.ultimo_seguimiento })} title="Anotar que hoy se pidió">
                        <Clock className="h-3.5 w-3.5" /> Ya lo pedí
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
              {items.length > 8 && <p className="px-3 py-2 text-xs text-tenue">y {items.length - 8} más</p>}
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

interface PorPagar {
  embarque_id: string; embarque: string; descripcion: string; fase: Fase; eta: string | null; llegada_planta_estimada: string | null;
  orden_compra_id: string; folio: string; proveedor: string; factura: string | null; moneda: "MXN" | "USD" | "EUR"; total: number;
  pagado: number; programado: number; saldo: number; saldo_mxn: number; proximo_pago: string | null; proximo_monto: number | null;
}
interface Saldo {
  id: string; embarque_id: string; tipo: string; descripcion: string | null; deudor: string | null; moneda: "MXN" | "USD" | "EUR"; monto: number;
  tipo_cambio: number; fecha_origen: string; fecha_esperada: string | null; embarques: { folio: string; descripcion: string } | null;
}

/** Dinero en dólares que viene por pagar y lo que alguien nos tiene que regresar. Finanzas lo ve aquí. */
function VistaDinero({ embarques, dinero: filas }: { embarques: Embarque[]; dinero: Dinero[] | undefined }) {
  const porPagar = useQuery({
    queryKey: ["v_importacion_por_pagar"],
    queryFn: () => q<PorPagar[]>(supabase.from("v_importacion_por_pagar").select("*").order("proximo_pago", { ascending: true, nullsFirst: false })),
  });
  const saldos = useQuery({
    queryKey: ["embarque_saldos", "pendientes"],
    queryFn: () => q<Saldo[]>(supabase.from("embarque_saldos").select("*, embarques(folio, descripcion)").is("recuperado_en", null).order("fecha_esperada")),
  });
  const porEmbarque = new Map(embarques.map((e) => [e.id, e]));
  const hoy = hoyISO();
  const colPagar: Columna<PorPagar>[] = [
    { clave: "embarque", titulo: "Embarque", celda: (f) => <Link className="font-medium hover:underline whitespace-nowrap" to={`/importaciones/${f.embarque_id}`}>{f.embarque}</Link> },
    { clave: "proveedor", titulo: "Proveedor", celda: (f) => <span className="block max-w-[220px] truncate" title={f.proveedor}>{f.proveedor}</span> },
    { clave: "folio", titulo: "Orden", celda: (f) => <Link className="hover:underline whitespace-nowrap" to={`/compras/ordenes/${f.orden_compra_id}`}>{f.folio}</Link> },
    { clave: "fase", titulo: "Va en", valor: (f) => FASES[f.fase].texto, celda: (f) => <InsigniaFase fase={f.fase} /> },
    { clave: "total", titulo: "Total", alinear: "der", valor: (f) => Number(f.total), celda: (f) => dinero(f.total, f.moneda === "USD" ? "USD" : "MXN"), sinBusqueda: true },
    { clave: "pagado", titulo: "Pagado", alinear: "der", valor: (f) => Number(f.pagado), celda: (f) => dinero(f.pagado, f.moneda === "USD" ? "USD" : "MXN"), sinBusqueda: true },
    { clave: "saldo", titulo: "Falta", alinear: "der", valor: (f) => Number(f.saldo), celda: (f) => <b>{dinero(f.saldo, f.moneda === "USD" ? "USD" : "MXN")}</b>, sinBusqueda: true },
    { clave: "saldo_mxn", titulo: "≈ en pesos hoy", alinear: "der", valor: (f) => Number(f.saldo_mxn), celda: (f) => dinero(f.saldo_mxn), sinBusqueda: true },
    { clave: "proximo_pago", titulo: "Próximo pago", valor: (f) => f.proximo_pago,
      celda: (f) => f.proximo_pago ? <span className={cn(f.proximo_pago < hoy && "text-peligro font-medium")}>{fecha(f.proximo_pago)} · {dinero(f.proximo_monto, f.moneda === "USD" ? "USD" : "MXN")}</span>
        : <span className="text-tenue text-xs">{f.fase === "produccion" || f.fase === "cotizando" ? "cuando avise que está lista" : "sin programar"}</span> },
  ];
  const colSaldos: Columna<Saldo>[] = [
    { clave: "embarque", titulo: "Embarque", valor: (f) => f.embarques?.folio, celda: (f) => <Link className="font-medium hover:underline whitespace-nowrap" to={`/importaciones/${f.embarque_id}`}>{f.embarques?.folio}</Link> },
    { clave: "tipo", titulo: "Qué", valor: (f) => f.tipo === "saldo_agente" ? "Saldo a favor" : f.tipo === "garantia_contenedor" ? "Garantía de contenedor" : f.descripcion ?? "Otro" },
    { clave: "deudor", titulo: "Lo debe", valor: (f) => f.deudor ?? "—" },
    { clave: "monto", titulo: "Monto", alinear: "der", valor: (f) => Number(f.monto) * Number(f.tipo_cambio), celda: (f) => dinero(f.monto, f.moneda === "USD" ? "USD" : "MXN"), sinBusqueda: true },
    { clave: "fecha_esperada", titulo: "Se esperaba", valor: (f) => f.fecha_esperada,
      celda: (f) => f.fecha_esperada && f.fecha_esperada < hoy
        ? <Insignia tono="peligro" punto>{fecha(f.fecha_esperada)} · {Math.round((Date.now() - new Date(f.fecha_esperada + "T12:00:00").getTime()) / 86_400_000)} días tarde</Insignia>
        : fecha(f.fecha_esperada) },
  ];
  const colEmb: Columna<Dinero>[] = [
    { clave: "folio", titulo: "Embarque", celda: (f) => <Link className="font-medium hover:underline whitespace-nowrap" to={`/importaciones/${f.embarque_id}`}>{f.folio}</Link> },
    { clave: "desc", titulo: "Qué", valor: (f) => porEmbarque.get(f.embarque_id)?.descripcion, celda: (f) => <span className="block max-w-[240px] truncate">{porEmbarque.get(f.embarque_id)?.descripcion}</span> },
    { clave: "comprometido_usd", titulo: "Mercancía", alinear: "der", valor: (f) => Number(f.comprometido_usd), celda: (f) => dinero(f.comprometido_usd, "USD"), sinBusqueda: true },
    { clave: "pagado_usd", titulo: "Pagado", alinear: "der", valor: (f) => Number(f.pagado_usd), celda: (f) => dinero(f.pagado_usd, "USD"), sinBusqueda: true },
    { clave: "tc_promedio", titulo: "TC real", alinear: "der", valor: (f) => f.tc_promedio, celda: (f) => f.tc_promedio ? numero(f.tc_promedio) : "—", sinBusqueda: true },
    { clave: "gastos", titulo: "Gastos e impuestos", alinear: "der", valor: (f) => Number(f.gastos_mxn) + Number(f.impuestos_mxn), celda: (f) => dinero(Number(f.gastos_mxn) + Number(f.impuestos_mxn)), sinBusqueda: true },
    { clave: "iva", titulo: "IVA acreditable", alinear: "der", valor: (f) => Number(f.iva_acreditable_mxn), celda: (f) => dinero(f.iva_acreditable_mxn), sinBusqueda: true },
    { clave: "por_recuperar_mxn", titulo: "Por recuperar", alinear: "der", valor: (f) => Number(f.por_recuperar_mxn), celda: (f) => dinero(f.por_recuperar_mxn), sinBusqueda: true },
  ];
  const totalUsd = (porPagar.data ?? []).filter((f) => f.moneda === "USD").reduce((s, f) => s + Number(f.saldo), 0);
  const totalMxn = (porPagar.data ?? []).reduce((s, f) => s + Number(f.saldo_mxn), 0);
  const en30 = (porPagar.data ?? []).filter((f) => f.proximo_pago && (new Date(f.proximo_pago + "T12:00:00").getTime() - Date.now()) / 86_400_000 <= 30)
    .reduce((s, f) => s + Number(f.proximo_monto ?? 0), 0);
  const recuperar = (saldos.data ?? []).reduce((s, f) => s + Number(f.monto) * Number(f.tipo_cambio), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Kpi titulo="Por pagar a proveedores" valor={dinero(totalUsd, "USD")} icono={DollarSign} tono="info" detalle={`≈ ${dinero(totalMxn)} al tipo de cambio de hoy. No hay cuenta en dólares: sale de pesos o por EBANX.`} />
        <Kpi titulo="Programado en 30 días" valor={dinero(en30, "USD")} icono={CalendarClock} tono="marca" detalle="Pagos con fecha ya acordada" />
        <Kpi titulo="Por recuperar" valor={dinero(recuperar)} icono={Undo2} tono={recuperar ? "aviso" : "ok"} detalle={`${saldos.data?.length ?? 0} saldos a favor o garantías`} />
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">Pagos en dólares que vienen</h2>
        <TablaDatos filas={porPagar.data} cargando={porPagar.isLoading} error={porPagar.error} columnas={colPagar} claveFila={(f) => f.orden_compra_id + f.embarque_id}
          exportarComo="importaciones-por-pagar" placeholder="Buscar proveedor, orden o embarque…"
          vacio={{ icono: DollarSign, titulo: "Nada por pagar", texto: "Cuando una orden ligada a un embarque tenga saldo, aparece aquí con su próximo pago." }} />
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Dinero por recuperar</h2>
        <TablaDatos filas={saldos.data} cargando={saldos.isLoading} error={saldos.error} columnas={colSaldos} claveFila={(f) => f.id} buscable={false}
          vacio={{ icono: Undo2, titulo: "Nadie nos debe dinero", texto: "Los saldos a favor de la cuenta de gastos y las garantías de contenedor se anotan en el detalle de cada embarque." }} />
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Por embarque</h2>
        <TablaDatos filas={filas} columnas={colEmb} claveFila={(f) => f.embarque_id} exportarComo="importaciones-dinero"
          vacio={{ icono: Ship, titulo: "Sin embarques todavía" }} />
      </section>
    </div>
  );
}

interface TiempoProveedor {
  proveedor_id: string; proveedor: string; pais: string; embarques: number; dias_naturales: number; dias_habiles: number;
  pedido_a_zarpe: number | null; travesia: number | null; puerto_a_planta: number | null; planta_a_cuenta_gastos: number | null; dias_entrega_capturados: number | null;
}
interface TiempoEmbarque {
  embarque_id: string; folio: string; descripcion: string; proveedor: string; inicio: string | null; zarpe: string | null; arribo: string | null;
  en_planta: string | null; pedido_a_zarpe: number | null; travesia: number | null; puerto_a_planta: number | null; pedido_a_planta: number | null; planta_a_cuenta_gastos: number | null;
}

/** Tiempos reales por proveedor: los que usa el reabasto en lugar de los capturados a mano. */
function Tiempos() {
  const prov = useQuery({ queryKey: ["v_tiempos_proveedor"], queryFn: () => q<TiempoProveedor[]>(supabase.from("v_tiempos_proveedor").select("*").order("embarques", { ascending: false })) });
  const emb = useQuery({ queryKey: ["v_tiempos_importacion"], queryFn: () => q<TiempoEmbarque[]>(supabase.from("v_tiempos_importacion").select("*").order("inicio", { ascending: false })) });
  const d = (n: number | null) => (n == null ? "—" : `${n} d`);
  const colProv: Columna<TiempoProveedor>[] = [
    { clave: "proveedor", titulo: "Proveedor", celda: (f) => <span className="block max-w-[240px] truncate" title={f.proveedor}>{f.proveedor}</span> },
    { clave: "embarques", titulo: "Embarques", alinear: "der" },
    { clave: "pedido_a_zarpe", titulo: "Pedido → zarpe", alinear: "der", celda: (f) => d(f.pedido_a_zarpe) },
    { clave: "travesia", titulo: "Travesía", alinear: "der", celda: (f) => d(f.travesia) },
    { clave: "puerto_a_planta", titulo: "Puerto → planta", alinear: "der", celda: (f) => d(f.puerto_a_planta) },
    { clave: "dias_naturales", titulo: "Pedido → planta", alinear: "der", celda: (f) => <b>{d(f.dias_naturales)}</b> },
    { clave: "dias_habiles", titulo: "Hábiles (reabasto)", alinear: "der", celda: (f) => (
      <span title={f.dias_entrega_capturados ? `Capturado en el proveedor: ${f.dias_entrega_capturados}` : undefined}>{f.dias_habiles}</span>) },
    { clave: "planta_a_cuenta_gastos", titulo: "Planta → CG", alinear: "der", celda: (f) => d(f.planta_a_cuenta_gastos) },
  ];
  const colEmb: Columna<TiempoEmbarque>[] = [
    { clave: "folio", titulo: "Embarque", celda: (f) => <Link className="font-medium hover:underline whitespace-nowrap" to={`/importaciones/${f.embarque_id}`}>{f.folio}</Link> },
    { clave: "proveedor", titulo: "Proveedor", celda: (f) => <span className="block max-w-[200px] truncate">{f.proveedor}</span> },
    { clave: "inicio", titulo: "Pedido", valor: (f) => f.inicio, celda: (f) => fecha(f.inicio) },
    { clave: "zarpe", titulo: "Zarpe", valor: (f) => f.zarpe, celda: (f) => fecha(f.zarpe) },
    { clave: "arribo", titulo: "Arribo", valor: (f) => f.arribo, celda: (f) => fecha(f.arribo) },
    { clave: "en_planta", titulo: "En planta", valor: (f) => f.en_planta, celda: (f) => fecha(f.en_planta) },
    { clave: "pedido_a_planta", titulo: "Total", alinear: "der", celda: (f) => d(f.pedido_a_planta) },
  ];
  return (
    <div className="space-y-5">
      <p className="text-sm text-tenue max-w-3xl">
        La mediana de los últimos embarques de cada proveedor, de la orden (o la PI) a planta. El reabasto usa los días hábiles de aquí en lugar
        del tiempo capturado a mano, así el punto de reorden de los importados deja de usar un número inventado.
      </p>
      <TablaDatos filas={prov.data} cargando={prov.isLoading} error={prov.error} columnas={colProv} claveFila={(f) => f.proveedor_id} exportarComo="tiempos-proveedor"
        vacio={{ icono: Clock, titulo: "Todavía no hay embarques completos", texto: "En cuanto un embarque llegue a planta con sus fechas reales, su proveedor aparece aquí." }} />
      <h2 className="font-semibold">Por embarque</h2>
      <TablaDatos filas={emb.data} cargando={emb.isLoading} error={emb.error} columnas={colEmb} claveFila={(f) => f.embarque_id + f.proveedor} exportarComo="tiempos-embarque"
        vacio={{ icono: Ship, titulo: "Sin embarques" }} />
    </div>
  );
}

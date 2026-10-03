import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, FilePlus, FileText, KanbanSquare, List, Plus, Target } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, dineroCompacto, fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CampoNumero } from "./componentes/campos";
import { Actividades } from "./componentes/Actividades";
import { DialogoCliente, DialogoMotivo, ElegirCliente, MOTIVOS_PERDIDA } from "./componentes/dialogos";
import { ETAPA, ETAPAS, ESTADO_COT, LINEA, dineroEn, hoyMx, todas, useFuentes, type EtapaOportunidad, type Linea, type VOportunidad, type EstadoCotizacion, type Moneda } from "./comun";

const COLOR_COLUMNA: Record<EtapaOportunidad, string> = {
  prospecto: "bg-tenue/60", contactado: "bg-info", cotizado: "bg-marca", negociacion: "bg-aviso", ganada: "bg-ok", perdida: "bg-peligro",
};

/**
 * El embudo que no existía: en los paneles solo se registraban ventas
 * cerradas. Tablero por etapa con arrastrar y soltar, días que lleva cada
 * oportunidad en su etapa y la próxima tarea (en rojo si ya venció).
 * Enviar una cotización la mueve sola a "cotizado"; convertirla en pedido, a "ganada".
 */
export default function Oportunidades() {
  const { puede, perfil } = useSesion();
  const esGerente = puede("ventas", 3);
  const qc = useQueryClient();
  const [vista, setVista] = useState<"tablero" | "lista">(() => {
    try { return (localStorage.getItem("oportunidades.vista") as "tablero" | "lista") ?? "tablero"; } catch { return "tablero"; }
  });
  useEffect(() => { try { localStorage.setItem("oportunidades.vista", vista); } catch { /* sin almacenamiento */ } }, [vista]);
  const [vendedor, setVendedor] = useState("todos");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [alta, setAlta] = useState(false);
  const [perder, setPerder] = useState<VOportunidad | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EtapaOportunidad | null>(null);

  const lista = useQuery({
    queryKey: ["v_oportunidades"],
    queryFn: () => todas<VOportunidad>((a, b) => supabase.from("v_oportunidades").select("*").order("etapa_desde", { ascending: true }).order("id").range(a, b)),
  });
  const filas = useMemo(() => (lista.data ?? []).filter((o) => vendedor === "todos" || o.vendedor_id === vendedor), [lista.data, vendedor]);
  // Las cerradas se ven 60 días en el tablero; después solo en la lista.
  const enTablero = filas.filter((o) => !["ganada", "perdida"].includes(o.etapa) || o.dias_en_etapa <= 60);
  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    (lista.data ?? []).forEach((o) => o.vendedor && m.set(o.vendedor_id, o.vendedor));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [lista.data]);

  const mover = useAccion(
    async (a: { id: string; etapa: EtapaOportunidad; motivo?: string }) => {
      await q(supabase.from("oportunidades").update({ etapa: a.etapa, ...(a.motivo ? { motivo_perdida: a.motivo } : {}) }).eq("id", a.id));
    },
    { invalidar: [["v_oportunidades"]] },
  );
  function soltar(e: DragEvent, etapa: EtapaOportunidad) {
    e.preventDefault();
    setSobre(null);
    const o = filas.find((x) => x.id === arrastrando);
    setArrastrando(null);
    if (!o || o.etapa === etapa) return;
    if (etapa === "perdida") { setPerder(o); return; }
    // Se mueve al instante en pantalla; si la base no lo acepta, regresa solo al recargar.
    qc.setQueryData<VOportunidad[]>(["v_oportunidades"], (v) => v?.map((x) => (x.id === o.id ? { ...x, etapa, dias_en_etapa: 0 } : x)));
    mover.mutate({ id: o.id, etapa });
  }

  const hoy = hoyMx();
  const columnas: Columna<VOportunidad>[] = [
    { clave: "titulo", titulo: "Oportunidad", celda: (o) => <div className="min-w-[200px]"><p className="font-medium">{o.titulo}</p><p className="text-xs text-tenue">{o.cliente}</p></div>, valor: (o) => `${o.titulo} ${o.cliente}` },
    { clave: "etapa", titulo: "Etapa", valor: (o) => ETAPAS.findIndex((e) => e.valor === o.etapa), celda: (o) => <Insignia tono={ETAPA[o.etapa].tono} punto>{ETAPA[o.etapa].texto}</Insignia> },
    { clave: "vendedor", titulo: "Vendedor", oculta: !esGerente, valor: (o) => o.vendedor },
    { clave: "linea", titulo: "Línea", valor: (o) => LINEA[o.linea] },
    { clave: "dias", titulo: "Días en etapa", alinear: "der", valor: (o) => o.dias_en_etapa, sinBusqueda: true },
    { clave: "tarea", titulo: "Próxima tarea", valor: (o) => o.tarea_vence ?? "", celda: (o) => o.tarea ? <span className={cn("text-xs", (o.tarea_vence ?? "") < hoy && "text-peligro font-medium")}>{fecha(o.tarea_vence)} · {o.tarea}</span> : <span className="text-tenue">—</span> },
    { clave: "monto", titulo: "Monto estimado", alinear: "der", sinBusqueda: true, valor: (o) => Number(o.monto_estimado ?? 0), celda: (o) => dinero(o.monto_estimado) },
  ];

  function columna(et: (typeof ETAPAS)[number], cerrada: boolean) {
    const tarjetas = enTablero.filter((o) => o.etapa === et.valor);
    const suma = tarjetas.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0);
    return (
      <section key={et.valor} className={cn("snap-start rounded-xl bg-fondo/70 border border-borde flex flex-col max-h-[calc(100vh-220px)] min-h-[300px]", cerrada && "min-h-0 max-h-none flex-1",
        sobre === et.valor && "ring-2 ring-marca/50 bg-marca-suave/40")}
        onDragOver={(e) => { if (arrastrando) { e.preventDefault(); setSobre(et.valor); } }}
        onDragLeave={() => setSobre((s) => (s === et.valor ? null : s))}
        onDrop={(e) => soltar(e, et.valor)}>
        <header className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", COLOR_COLUMNA[et.valor])} />
            <h2 className="font-semibold text-sm">{et.texto}</h2>
            <span className="ml-auto rounded-full bg-superficie border border-borde px-2 text-xs cifra">{tarjetas.length}</span>
          </div>
          <p className="text-xs text-tenue mt-0.5 cifra">{dineroCompacto(suma)}{["ganada", "perdida"].includes(et.valor) ? " · últimos 60 días" : ""}</p>
        </header>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
          {tarjetas.map((o) => {
            const vencida = !!o.tarea_vence && o.tarea_vence < hoy;
            return (
              <article key={o.id} draggable onDragStart={() => setArrastrando(o.id)} onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                onClick={() => setAbierta(o.id)}
                className={cn("tarjeta p-3 cursor-pointer hover:border-marca/40 hover:shadow-md transition active:cursor-grabbing",
                  arrastrando === o.id && "opacity-40", vencida && "border-peligro/40")}>
                <p className="text-sm font-medium leading-snug">{o.titulo}</p>
                <p className="text-xs text-tenue mt-0.5 truncate">{o.cliente}{esGerente && o.vendedor ? ` · ${o.vendedor.split(" ")[0]}` : ""}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold cifra">{o.monto_estimado ? dinero(o.monto_estimado) : <span className="text-tenue font-normal">Sin monto</span>}</span>
                  <span className={cn("text-[11px] cifra", o.dias_en_etapa > 14 && !["ganada", "perdida"].includes(o.etapa) ? "text-aviso font-medium" : "text-tenue")}
                    title="Días en esta etapa">{o.dias_en_etapa === 0 ? "hoy" : `${o.dias_en_etapa} d`}</span>
                </div>
                {o.tarea && !["ganada", "perdida"].includes(o.etapa) && (
                  <p className={cn("mt-2 flex items-start gap-1.5 rounded-md px-2 py-1 text-xs", vencida ? "bg-peligro-suave text-peligro" : "bg-fondo text-tenue")}>
                    <CalendarClock className="h-3.5 w-3.5 mt-px shrink-0" />
                    <span><b className="font-medium">{vencida ? "Venció" : o.tarea_vence === hoy ? "Hoy" : fecha(o.tarea_vence)}</b> · {o.tarea}</span>
                  </p>
                )}
                {o.etapa === "perdida" && o.motivo_perdida && <p className="mt-2 text-xs text-peligro">{o.motivo_perdida}</p>}
                {o.cotizaciones > 0 && <p className="mt-1.5 text-[11px] text-tenue inline-flex items-center gap-1"><FileText className="h-3 w-3" />{o.cotizaciones} cotización(es)</p>}
              </article>
            );
          })}
          {tarjetas.length === 0 && <p className="text-xs text-tenue text-center py-6 px-3">{et.valor === "prospecto" ? "Agrega prospectos con “Nueva oportunidad”." : "Arrastra aquí una tarjeta."}</p>}
        </div>
      </section>
    );
  }

  const abiertoSel = (lista.data ?? []).find((o) => o.id === abierta) ?? null;
  const embudo = filas.filter((o) => !["ganada", "perdida"].includes(o.etapa));

  return (
    <Pagina titulo="Oportunidades" ancho="max-w-[1600px]"
      descripcion={`${embudo.length} abiertas · ${dinero(embudo.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0))} en el embudo`}
      acciones={<>
        {esGerente && vendedores.length > 1 && (
          <select className="campo h-9 w-auto pr-8" value={vendedor} onChange={(e) => setVendedor(e.target.value)} aria-label="Vendedor">
            <option value="todos">Todos los vendedores</option>
            {vendedores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        )}
        <div className="flex rounded-lg border border-borde p-0.5 bg-fondo">
          {([["tablero", KanbanSquare, "Tablero"], ["lista", List, "Lista"]] as const).map(([v, I, t]) => (
            <button key={v} onClick={() => setVista(v)} className={cn("h-8 px-3 rounded-md text-sm inline-flex items-center gap-1.5", vista === v ? "bg-superficie shadow-sm" : "text-tenue")}>
              <I className="h-4 w-4" />{t}
            </button>
          ))}
        </div>
        <Boton onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Nueva oportunidad</Boton>
      </>}>
      {lista.isLoading ? <div className="tarjeta"><Cargando /></div> : vista === "lista" ? (
        <TablaDatos filas={filas} columnas={columnas} claveFila={(o) => o.id} alClicFila={(o) => setAbierta(o.id)} exportarComo="oportunidades"
          vacio={{ icono: Target, titulo: "Sin oportunidades", texto: "Registra el primer prospecto: quién es, qué busca y cuánto podría ser." }} />
      ) : (
        <div className="-mx-4 lg:mx-0 px-4 lg:px-0 overflow-x-auto pb-2 snap-x">
          {/* Cuatro etapas abiertas y una columna de cierre (ganada arriba, perdida abajo): cabe en una laptop sin desplazarse. */}
          <div className="grid grid-cols-[repeat(5,minmax(240px,1fr))] lg:grid-cols-5 gap-3 min-w-max lg:min-w-0">
            {ETAPAS.slice(0, 4).map((et) => columna(et, false))}
            <div className="flex flex-col gap-3 max-h-[calc(100vh-220px)] min-h-[300px]">
              {ETAPAS.slice(4).map((et) => columna(et, true))}
            </div>
          </div>
        </div>
      )}

      <DialogoAlta abierto={alta} alCambiar={setAlta} alCrear={(id) => setAbierta(id)} />
      <DialogoMotivo abierto={!!perder} alCambiar={(v) => !v && setPerder(null)} titulo={`¿Por qué se perdió “${perder?.titulo ?? ""}”?`}
        descripcion="Sin el motivo no sabemos qué corregir (precio, tiempo de entrega, seguimiento)." sugerencias={MOTIVOS_PERDIDA}
        textoBoton="Marcar perdida" cargando={mover.isPending}
        alConfirmar={(m) => { if (perder) mover.mutate({ id: perder.id, etapa: "perdida", motivo: m }, { onSuccess: () => setPerder(null) }); }} />
      <Lateral abierto={!!abiertoSel} alCambiar={(v) => !v && setAbierta(null)} titulo={abiertoSel?.titulo ?? ""}
        subtitulo={abiertoSel && <span>{abiertoSel.cliente} · <Insignia tono={ETAPA[abiertoSel.etapa].tono}>{ETAPA[abiertoSel.etapa].texto}</Insignia></span>}>
        {abiertoSel && <DetalleOportunidad o={abiertoSel} puedeEditar={esGerente || abiertoSel.vendedor_id === perfil?.id} alPerder={() => setPerder(abiertoSel)} />}
      </Lateral>
    </Pagina>
  );
}

function DetalleOportunidad({ o, puedeEditar, alPerder }: { o: VOportunidad; puedeEditar: boolean; alPerder: () => void }) {
  const ir = useNavigate();
  const fuentes = useFuentes();
  const [f, setF] = useState(o);
  useEffect(() => setF(o), [o]);
  const cotizaciones = useQuery({
    queryKey: ["v_cotizaciones", "oportunidad", o.id],
    queryFn: () => q<{ id: string; folio: string; estado: EstadoCotizacion; total: number; moneda: Moneda; fecha: string }[]>(
      supabase.from("v_cotizaciones").select("id, folio, estado, total, moneda, fecha").eq("oportunidad_id", o.id).order("creado_en", { ascending: false })),
  });
  const guardar = useAccion(
    async () => {
      if (f.etapa === "perdida" && o.etapa !== "perdida") { alPerder(); return; }
      await q(supabase.from("oportunidades").update({
        titulo: f.titulo, etapa: f.etapa, linea: f.linea, monto_estimado: f.monto_estimado, probabilidad: f.probabilidad,
        fecha_cierre_estimada: f.fecha_cierre_estimada || null, fuente_id: f.fuente_id, notas: f.notas || null,
      }).eq("id", o.id));
    },
    { exito: "Oportunidad guardada", invalidar: [["v_oportunidades"]] },
  );
  const cambio = JSON.stringify([f.titulo, f.etapa, f.linea, f.monto_estimado, f.probabilidad, f.fecha_cierre_estimada, f.fuente_id, f.notas])
    !== JSON.stringify([o.titulo, o.etapa, o.linea, o.monto_estimado, o.probabilidad, o.fecha_cierre_estimada, o.fuente_id, o.notas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => ir(`/ventas/cotizaciones/nueva?oportunidad=${o.id}`)} disabled={!puedeEditar}><FilePlus className="h-4 w-4" />Nueva cotización</Boton>
        <Boton asChild variante="secundario"><Link to={`/ventas/clientes/${o.cliente_id}`}>Ver cliente</Link></Boton>
      </div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); guardar.mutate(undefined); }}>
        <Campo etiqueta="Título" className="sm:col-span-2"><Entrada value={f.titulo} disabled={!puedeEditar} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Campo>
        <Campo etiqueta="Etapa">
          <Seleccion value={f.etapa} disabled={!puedeEditar} onChange={(e) => setF({ ...f, etapa: e.target.value as EtapaOportunidad })}>
            {ETAPAS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Línea">
          <Seleccion value={f.linea} disabled={!puedeEditar} onChange={(e) => setF({ ...f, linea: e.target.value as Linea })}>
            {Object.entries(LINEA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Monto estimado (sin IVA)"><CampoNumero valor={f.monto_estimado} prefijo="$" deshabilitado={!puedeEditar} vacioEsCero={false} alCambiar={(n) => setF({ ...f, monto_estimado: n })} /></Campo>
        <Campo etiqueta="Probabilidad"><CampoNumero valor={f.probabilidad} decimales={0} min={0} max={100} sufijo="%" deshabilitado={!puedeEditar} alCambiar={(n) => setF({ ...f, probabilidad: Math.round(n) })} /></Campo>
        <Campo etiqueta="Cierre estimado"><Entrada type="date" value={f.fecha_cierre_estimada ?? ""} disabled={!puedeEditar} onChange={(e) => setF({ ...f, fecha_cierre_estimada: e.target.value })} /></Campo>
        <Campo etiqueta="¿Cómo llegó?">
          <Seleccion value={f.fuente_id ?? ""} disabled={!puedeEditar} onChange={(e) => setF({ ...f, fuente_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {fuentes.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><AreaTexto value={f.notas ?? ""} disabled={!puedeEditar} onChange={(e) => setF({ ...f, notas: e.target.value })} /></Campo>
        {o.motivo_perdida && <p className="sm:col-span-2 rounded-lg bg-peligro-suave text-peligro text-sm px-3 py-2">Perdida: {o.motivo_perdida}</p>}
        {puedeEditar && cambio && <div className="sm:col-span-2 flex justify-end"><Boton type="submit" cargando={guardar.isPending}>Guardar cambios</Boton></div>}
      </form>

      <section>
        <h3 className="font-semibold mb-2">Cotizaciones</h3>
        {(cotizaciones.data?.length ?? 0) === 0 ? <p className="text-sm text-tenue">Todavía no hay cotización para esta oportunidad.</p> : (
          <div className="tarjeta divide-y divide-borde">
            {cotizaciones.data!.map((c) => (
              <Link key={c.id} to={`/ventas/cotizaciones/${c.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-fondo text-sm">
                <span className="font-medium cifra">{c.folio}</span>
                <Insignia tono={ESTADO_COT[c.estado].tono}>{ESTADO_COT[c.estado].texto}</Insignia>
                <span className="text-tenue">{fecha(c.fecha)}</span>
                <span className="ml-auto cifra">{dineroEn(Number(c.total), c.moneda)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-2">Seguimiento</h3>
        <Actividades clienteId={o.cliente_id} oportunidadId={o.id} puedeCapturar={puedeEditar} />
      </section>
    </div>
  );
}

/** Alta rápida: cliente, qué busca y cuánto. Lo demás se llena después. */
function DialogoAlta({ abierto, alCambiar, alCrear }: { abierto: boolean; alCambiar: (v: boolean) => void; alCrear: (id: string) => void }) {
  const { perfil } = useSesion();
  const fuentes = useFuentes();
  const qc = useQueryClient();
  const vacio = { cliente: null as { id: string; nombre: string } | null, titulo: "", monto: null as number | null, linea: "maquinaria" as Linea, fuente: "", cierre: "", etapa: "prospecto" as EtapaOportunidad };
  const [f, setF] = useState(vacio);
  const [nuevoCliente, setNuevoCliente] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierto) setF(vacio); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [abierto]);

  async function guardar() {
    if (!f.cliente || !f.titulo.trim()) return;
    setGuardando(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("oportunidades").insert({
      id, cliente_id: f.cliente.id, titulo: f.titulo.trim(), monto_estimado: f.monto, linea: f.linea, etapa: f.etapa,
      fuente_id: f.fuente ? Number(f.fuente) : null, fecha_cierre_estimada: f.cierre || null, vendedor_id: perfil?.id,
    });
    setGuardando(false);
    if (error) return toast.error(mensajeError(error));
    toast.success("Oportunidad registrada");
    qc.invalidateQueries({ queryKey: ["v_oportunidades"] });
    alCambiar(false);
    alCrear(id);
  }

  return (
    <>
      <Dialogo abierto={abierto && nuevoCliente == null} alCambiar={alCambiar} titulo="Nueva oportunidad" ancho="max-w-xl"
        pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton><Boton onClick={guardar} cargando={guardando} disabled={!f.cliente || !f.titulo.trim()}>Registrar</Boton></>}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
          <div className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Cliente</span>
            <ElegirCliente valor={f.cliente} alCambiar={(c) => setF({ ...f, cliente: c ? { id: c.id, nombre: c.nombre } : null })} alNuevo={() => setNuevoCliente("")} />
          </div>
          <Campo etiqueta="¿Qué busca?" className="sm:col-span-2"><Entrada value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Dosificadora para planta nueva" /></Campo>
          <Campo etiqueta="Monto estimado"><CampoNumero valor={f.monto} prefijo="$" vacioEsCero={false} alCambiar={(n) => setF({ ...f, monto: n })} /></Campo>
          <Campo etiqueta="Etapa">
            <Seleccion value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value as EtapaOportunidad })}>
              {ETAPAS.filter((e) => !["ganada", "perdida"].includes(e.valor)).map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Línea">
            <Seleccion value={f.linea} onChange={(e) => setF({ ...f, linea: e.target.value as Linea })}>
              {Object.entries(LINEA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="¿Cómo llegó?">
            <Seleccion value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })}>
              <option value="">—</option>
              {fuentes.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="Cierre estimado"><Entrada type="date" value={f.cierre} onChange={(e) => setF({ ...f, cierre: e.target.value })} /></Campo>
          <button type="submit" className="hidden" />
        </form>
      </Dialogo>
      <DialogoCliente abierto={nuevoCliente != null} alCambiar={(v) => !v && setNuevoCliente(null)} nombreInicial={nuevoCliente ?? ""}
        alCrear={(c) => { setF((x) => ({ ...x, cliente: { id: c.id, nombre: c.nombre } })); setNuevoCliente(null); }} />
    </>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Hash, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { sugerirCodigosSerie } from "@/lib/asistente";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Lateral } from "@/components/ui/dialogo";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { todasLasFilas } from "@/modulos/almacen/componentes/comun";
import { GLOSARIO } from "@/tutorial/glosario";

type Estado = "espera" | "proceso" | "terminado" | "entregado" | "cancelado";
interface Equipo {
  origen: "erp" | "hoja"; numero_serie: string; familia: string | null; orden_id: string | null; orden_folio: string | null; equipo: string | null;
  cliente_id: string | null; cliente: string | null; pedido_id: string | null; pedido: string | null; fecha: string | null; estado: Estado | null;
  factura: string | null; vendedor: string | null; entrega: string | null; ubicacion: string | null; contacto: string | null;
}
interface Familia { clave: string; nombre: string; prefijo: string | null; ultimo: number; orden: number }
interface EquipoCatalogo {
  id: string; clave: string; nombre: string; familia: string | null; familia_serie: string | null; codigo_serie: string | null;
  codigo_serie_sugerido: string | null; familia_serie_sugerida: string | null; codigo_sugerido_seguro: "alto" | "medio" | "bajo" | null;
  codigo_sugerido_nota: string | null; codigo_sugerido_en: string | null;
}

const ESTADO: Record<Estado, { texto: string; tono: Tono }> = {
  espera: { texto: "En espera", tono: "neutro" }, proceso: { texto: "En proceso", tono: "marca" }, terminado: { texto: "Terminado", tono: "aviso" },
  entregado: { texto: "Entregado", tono: "ok" }, cancelado: { texto: "Cancelado", tono: "peligro" },
};
const CLAVE = ["numeros_serie"];

function useFamilias() {
  return useQuery({
    queryKey: [...CLAVE, "familias"],
    queryFn: () => q<Familia[]>(supabase.from("familias_serie").select("clave, nombre, prefijo, ultimo, orden").order("orden")),
  });
}

/**
 * Todos los equipos con número de serie: los que hizo el ERP y los del libro de la hoja
 * (2015 →). Para encontrar de quién es un equipo, qué tiene un cliente y qué número sigue.
 */
export default function NumerosSerie() {
  const { puede } = useSesion();
  const [params] = useSearchParams();
  const [vista, setVista] = useState<"todos" | "abiertos" | "entregado">("todos");
  const [familia, setFamilia] = useState("");
  const [abierto, setAbierto] = useState<string | null>(params.get("serie"));
  const [pestana, setPestana] = useState<"equipos" | "codigos">("equipos");
  useEffect(() => { if (params.get("serie")) setAbierto(params.get("serie")); }, [params]);
  const familias = useFamilias();
  const nombreFamilia = useMemo(() => new Map((familias.data ?? []).map((f) => [f.clave, f.nombre])), [familias.data]);
  const datos = useQuery({
    queryKey: [...CLAVE, "lista"],
    queryFn: () => todasLasFilas<Equipo>((d, h) => supabase.from("v_numeros_serie").select("*").order("fecha", { ascending: false, nullsFirst: false }).order("numero_serie").range(d, h)),
  });
  const todos = datos.data ?? [];
  const deFamilia = familia ? todos.filter((e) => e.familia === familia) : todos;
  const abiertos = deFamilia.filter((e) => e.estado === "espera" || e.estado === "proceso" || e.estado === "terminado");
  const filas = vista === "abiertos" ? abiertos : vista === "entregado" ? deFamilia.filter((e) => e.estado === "entregado") : deFamilia;
  const editarCodigos = puede("produccion", 3) || puede("costeo", 3);

  const columnas: Columna<Equipo>[] = [
    { clave: "numero_serie", titulo: "Número de serie", explica: GLOSARIO.numeroSerie, celda: (e) => <span className="cifra font-medium">{e.numero_serie}</span> },
    { clave: "equipo", titulo: "Equipo", clase: "min-w-[220px] max-w-[360px]", valor: (e) => `${e.equipo ?? ""} ${e.familia ? nombreFamilia.get(e.familia) ?? "" : ""}`,
      celda: (e) => <div><p className="line-clamp-2 break-words">{e.equipo ?? "—"}</p>{e.familia && <p className="text-xs text-tenue">{nombreFamilia.get(e.familia)}</p>}</div> },
    { clave: "cliente", titulo: "Cliente", clase: "max-w-[260px]", celda: (e) => <span className="block truncate">{e.cliente ?? <span className="text-tenue">—</span>}</span> },
    { clave: "pedido", titulo: "Pedido", valor: (e) => `${e.pedido ?? ""} ${e.factura ?? ""}`,
      celda: (e) => <div className="whitespace-nowrap">{e.pedido ?? "—"}{e.factura && <p className="text-xs text-tenue">Fact. {e.factura}</p>}</div> },
    { clave: "fecha", titulo: "Fecha", sinBusqueda: true, celda: (e) => <span className="whitespace-nowrap text-tenue">{fecha(e.fecha)}</span> },
    { clave: "estado", titulo: "Estado", sinBusqueda: true, explica: GLOSARIO.estadoEquipoSerie, valor: (e) => e.estado ?? "",
      celda: (e) => e.estado ? <Insignia tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Insignia> : <span className="text-tenue">—</span> },
    { clave: "origen", titulo: "Origen", sinBusqueda: true, explica: GLOSARIO.equipoHistorico,
      celda: (e) => e.origen === "erp" ? <Insignia tono="marca">ERP</Insignia> : <span className="text-xs text-tenue">Hoja</span> },
  ];

  return (
    <Pagina titulo="Números de serie" descripcion="Cada equipo que hemos hecho: de quién es, de qué pedido, y qué número sigue en cada familia.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Equipos con serie" valor={numero(todos.length)} icono={Hash} tono="marca" detalle={`${todos.filter((e) => e.origen === "erp").length} hechos en el ERP`} alClic={() => { setVista("todos"); setFamilia(""); }}
          explica={GLOSARIO.numeroSerie} />
        <Kpi titulo="En taller o por entregar" valor={numero(todos.filter((e) => e.estado === "espera" || e.estado === "proceso" || e.estado === "terminado").length)} icono={Wrench} tono="aviso" alClic={() => setVista("abiertos")}
          explica={GLOSARIO.equiposEnTallerSerie} />
      </div>
      <Pestanas value={pestana} onValueChange={(v) => setPestana(v as "equipos" | "codigos")}>
        <ListaPestanas opciones={[
          { valor: "equipos", texto: "Equipos", cuenta: todos.length },
          { valor: "codigos", texto: "Códigos por equipo", explica: GLOSARIO.codigoSerie },
        ]} />
        <ContenidoPestana value="equipos" className="pt-4">
          <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(e) => e.numero_serie}
            alClicFila={(e) => setAbierto(e.numero_serie)} exportarComo="numeros-de-serie" placeholder="Buscar serie, cliente, equipo, pedido o factura…"
            filtros={<div className="flex flex-wrap items-center gap-2">
              <Filtro valor={vista} alCambiar={setVista} opciones={[
                { valor: "todos", texto: "Todos", cuenta: deFamilia.length },
                { valor: "abiertos", texto: "En taller o por entregar", cuenta: abiertos.length, explica: GLOSARIO.equiposEnTallerSerie },
                { valor: "entregado", texto: "Entregados" },
              ]} />
              <Seleccion value={familia} onChange={(e) => setFamilia(e.target.value)} className="h-8 w-auto text-xs" aria-label="Familia"
                data-explain={GLOSARIO.familiaSerie} data-explain-title="Familia">
                <option value="">Todas las familias</option>
                {(familias.data ?? []).map((f) => <option key={f.clave} value={f.clave}>{f.nombre}</option>)}
              </Seleccion>
            </div>}
            vacio={{ icono: Hash, titulo: "Sin equipos", texto: "Aquí aparece cada equipo con número de serie: los del libro de seriales y los que el ERP numera al crear su orden de producción." }} />
        </ContenidoPestana>
        <ContenidoPestana value="codigos" className="pt-4">
          <CodigosPorEquipo familias={familias.data ?? []} editable={editarCodigos} />
        </ContenidoPestana>
      </Pestanas>
      <FichaEquipo equipo={todos.find((e) => e.numero_serie === abierto) ?? null} familia={(f) => nombreFamilia.get(f) ?? f} alCerrar={() => setAbierto(null)} />
    </Pagina>
  );
}

function FichaEquipo({ equipo: e, familia, alCerrar }: { equipo: Equipo | null; familia: (f: string) => string; alCerrar: () => void }) {
  const { puede } = useSesion();
  const servicios = useQuery({
    queryKey: [...CLAVE, "servicios", e?.numero_serie], enabled: !!e && puede("servicio"),
    queryFn: () => q<{ id: string; folio: string; tipo: string; estado: string; creado_en: string }[]>(
      supabase.from("servicios").select("id, folio, tipo, estado, creado_en").eq("numero_serie", e!.numero_serie).order("creado_en", { ascending: false })),
  });
  const dato = (t: string, v: ReactNode) => v ? <div><p className="etiqueta">{t}</p><p className="text-sm break-words">{v}</p></div> : null;
  return (
    <Lateral abierto={!!e} alCambiar={(v) => !v && alCerrar()} titulo={<span className="cifra">{e?.numero_serie}</span>}
      subtitulo={e && <span>{e.equipo}{e.familia ? ` · ${familia(e.familia)}` : ""}</span>}>
      {e && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {e.estado && <span data-explain={GLOSARIO.estadoEquipoSerie} data-explain-title={ESTADO[e.estado].texto}><Insignia tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Insignia></span>}
            {e.origen === "erp"
              ? <span data-explain={GLOSARIO.numeroSerie} data-explain-title="Numerado por el ERP"><Insignia tono="marca">Numerado por el ERP</Insignia></span>
              : <span className="text-xs text-tenue" data-explain={GLOSARIO.equipoHistorico} data-explain-title="Del libro de seriales">Del libro de seriales (hoja)</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {dato("Cliente", e.cliente_id && puede("ventas") ? <Link className="text-marca-texto hover:underline" to={`/ventas/clientes/${e.cliente_id}`}>{e.cliente}</Link> : e.cliente)}
            {dato("Contacto", e.contacto)}
            {dato("Pedido", e.pedido_id && puede("ventas") ? <Link className="text-marca-texto hover:underline" to={`/ventas/pedidos/${e.pedido_id}`}>{e.pedido}</Link> : e.pedido)}
            {dato("Factura", e.factura)}
            {dato("Fecha del pedido", e.fecha && fecha(e.fecha))}
            {dato(e.estado === "entregado" ? "Entregado" : "Entrega acordada", e.entrega && fecha(e.entrega))}
            {dato("Vendedor", e.vendedor)}
            {dato("Dónde está", e.ubicacion)}
            {dato("Orden de producción", e.orden_id && <Link className="text-marca-texto hover:underline" to={`/produccion/ordenes/${e.orden_id}`}>{e.orden_folio}</Link>)}
          </div>
          {(servicios.data ?? []).length > 0 && (
            <div>
              <p className="etiqueta mb-1">Servicios a este equipo</p>
              <ul className="divide-y divide-borde text-sm">
                {servicios.data!.map((s) => (
                  <li key={s.id} className="py-2 flex justify-between gap-3">
                    <Link className="text-marca-texto hover:underline" to={`/servicio/${s.id}`}>{s.folio}</Link>
                    <span className="text-tenue">{s.estado} · {fecha(s.creado_en)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Lateral>
  );
}

/**
 * La parte fija del código de cada equipo (medidas y motor), que se captura una vez:
 * con ella el ERP arma el serial de cada unidad al crear su orden de producción.
 */
function CodigosPorEquipo({ familias, editable }: { familias: Familia[]; editable: boolean }) {
  const [vista, setVista] = useState<"sin" | "sugeridos" | "todos">("sin");
  const datos = useQuery({
    queryKey: [...CLAVE, "codigos"],
    queryFn: () => todasLasFilas<EquipoCatalogo>((d, h) => supabase.from("articulos")
      .select("id, clave, nombre, familia, familia_serie, codigo_serie, codigo_serie_sugerido, familia_serie_sugerida, codigo_sugerido_seguro, codigo_sugerido_nota, codigo_sugerido_en")
      .eq("tipo", "equipo").eq("activo", true).order("clave").range(d, h)),
  });
  const todos = datos.data ?? [];
  const sin = todos.filter((a) => !a.codigo_serie);
  const sugeridos = sin.filter((a) => a.codigo_serie_sugerido);
  const seguros = sugeridos.filter((a) => a.codigo_sugerido_seguro === "alto");
  const porPedir = sin.filter((a) => !a.codigo_sugerido_en).length;
  const filas = vista === "sin" ? sin : vista === "sugeridos" ? sugeridos : todos;
  // La IA propone de 25 en 25 (cada tanda tarda cerca de un minuto); se sigue sola hasta acabar o hasta que la detengas.
  const [pidiendo, setPidiendo] = useState<{ hechos: number; quedan: number } | null>(null);
  const detener = useRef(false);
  async function pedirSugerencias() {
    detener.current = false;
    let hechos = 0;
    setPidiendo({ hechos, quedan: porPedir });
    try {
      for (;;) {
        const r = await sugerirCodigosSerie();
        hechos += r.guardados;
        setPidiendo({ hechos, quedan: r.quedan });
        await datos.refetch();
        if (!r.quedan || !r.guardados || detener.current) break;
      }
      toast.success(`La IA propuso ${hechos} códigos: revísalos en «Por aceptar».`);
      setVista("sugeridos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPidiendo(null);
    }
  }
  const aceptarSeguros = useAccion(() => q<number>(supabase.rpc("aceptar_codigos_sugeridos", { p_ids: null, p_seguro: "alto" })), {
    exito: (n) => `Listo: ${n} equipos ya tienen código. Sus órdenes sin serie lo recibieron.`, invalidar: [CLAVE],
  });
  const columnas: Columna<EquipoCatalogo>[] = [
    { clave: "clave", titulo: "Clave", celda: (a) => <span className="cifra text-tenue">{a.clave}</span> },
    { clave: "nombre", titulo: "Equipo", clase: "min-w-[240px] max-w-[420px]", celda: (a) => <span className="line-clamp-2 break-words">{a.nombre}</span> },
    { clave: "codigo_serie", titulo: "Familia y código", sinBusqueda: true, explica: GLOSARIO.codigoSerie, valor: (a) => a.codigo_serie ?? a.codigo_serie_sugerido ?? "",
      celda: (a) => <EditorCodigo articulo={a} familias={familias} editable={editable} /> },
  ];
  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm">
          <span className="flex-1 min-w-[220px] text-tenue">
            {pidiendo ? `La IA está proponiendo códigos… ${pidiendo.hechos} listos, faltan ${pidiendo.quedan}.`
              : sin.length ? `${sin.length} equipos sin código${sugeridos.length ? ` · ${sugeridos.length} con propuesta por aceptar` : ""}${porPedir ? ` · ${porPedir} sin propuesta` : ""}.`
              : "Todos los equipos tienen código."}
          </span>
          {pidiendo
            ? <Boton tamano="sm" variante="secundario" onClick={() => { detener.current = true; }}>Detener después de esta tanda</Boton>
            : porPedir > 0 && <Boton tamano="sm" variante="secundario" onClick={pedirSugerencias} data-explain={GLOSARIO.codigoSugerido} data-explain-title="Sugerir con IA">
                <Sparkles className="h-4 w-4" />Sugerir con IA</Boton>}
          {seguros.length > 0 && !pidiendo && (
            <Boton tamano="sm" onClick={() => aceptarSeguros.mutate(undefined)} cargando={aceptarSeguros.isPending} data-explain={GLOSARIO.aceptarCodigosSeguros}>
              {seguros.length === 1 ? "Aceptar la segura" : `Aceptar las ${seguros.length} seguras`}</Boton>
          )}
        </div>
      )}
      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(a) => a.id}
        exportarComo="codigos-de-serie" placeholder="Buscar equipo o clave…"
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[
          { valor: "sin", texto: "Sin código", cuenta: sin.length, explica: GLOSARIO.codigoSerie },
          { valor: "sugeridos", texto: "Por aceptar", cuenta: sugeridos.length, explica: GLOSARIO.codigoSugerido },
          { valor: "todos", texto: "Todos", cuenta: todos.length }]} />}
        vacio={{ icono: Hash, titulo: vista === "sin" ? "Todos los equipos tienen código" : vista === "sugeridos" ? "Nada por aceptar" : "Sin equipos",
          texto: vista === "sugeridos" ? "Dale «Sugerir con IA» y aquí aparecen los códigos propuestos para que los aceptes."
            : "Cada equipo del catálogo necesita su código (por ejemplo TB20090275E para una banda de 20\" × 9 m, 2 HP, caja 75) para que su orden de producción saque número de serie sola." }} />
    </div>
  );
}

function EditorCodigo({ articulo: a, familias, editable }: { articulo: EquipoCatalogo; familias: Familia[]; editable: boolean }) {
  // Sin código pero con propuesta de la IA: el formulario ya viene lleno con ella; «Guardar» la acepta (o lo que cambies).
  const inicialFam = a.familia_serie ?? (a.codigo_serie ? "" : a.familia_serie_sugerida ?? "");
  const inicialCod = a.codigo_serie ?? a.codigo_serie_sugerido ?? "";
  const [fam, setFam] = useState(inicialFam);
  const [cod, setCod] = useState(inicialCod);
  useEffect(() => { setFam(inicialFam); setCod(inicialCod); }, [inicialFam, inicialCod]);
  const sugerido = !a.codigo_serie && !!a.codigo_serie_sugerido;
  const noLleva = !a.codigo_serie && !a.codigo_serie_sugerido && !!a.codigo_sugerido_en;
  const guardar = useAccion(() => q(supabase.rpc("fijar_codigo_serie", { p_articulo: a.id, p_familia: fam || null, p_codigo: cod || null })), {
    exito: "Código guardado", invalidar: [CLAVE],
  });
  const f = familias.find((x) => x.clave === fam);
  if (!editable) return a.codigo_serie
    ? <span className="cifra" data-explain={GLOSARIO.codigoSerie} data-explain-title="Código de serie">{a.codigo_serie}<span className="text-tenue">###</span> <span className="text-xs text-tenue">· {f?.nombre}</span></span>
    : <span className="text-xs text-aviso">Sin código{sugerido ? ` (propuesto ${a.codigo_serie_sugerido}, por aceptar)` : ""}</span>;
  const cambio = sugerido ? !!fam && !!cod : fam !== (a.familia_serie ?? "") || cod.toUpperCase() !== (a.codigo_serie ?? "");
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (cambio) guardar.mutate(undefined); }}>
      <Seleccion value={fam} onChange={(e) => setFam(e.target.value)} className="h-8 w-44 text-xs" aria-label="Familia de serie"
        data-explain={GLOSARIO.familiaSerie} data-explain-title="Familia">
        <option value="">Familia…</option>
        {familias.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
      </Seleccion>
      <Entrada value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} className="h-8 w-40 cifra" aria-label="Código de serie"
        placeholder={f?.prefijo ? `${f.prefijo}…` : "Código"} />
      {f && cod && <span className="text-xs text-tenue cifra" data-explain={GLOSARIO.serialSiguiente} data-explain-title="El que sigue">→ {cod.replace(/\s/g, "")}{String(f.ultimo + 1).padStart(3, "0")}</span>}
      {cambio && <Boton type="submit" className="h-8" cargando={guardar.isPending}>{sugerido && fam === a.familia_serie_sugerida && cod === a.codigo_serie_sugerido ? "Aceptar" : "Guardar"}</Boton>}
      {sugerido && (
        <span className="w-full text-xs text-tenue" data-explain={GLOSARIO.codigoSugerido} data-explain-title="Propuesto por la IA">
          <Sparkles className="inline h-3 w-3 mr-1 text-marca-texto" />Propuesto por la IA · {a.codigo_sugerido_seguro === "alto" ? "seguro" : a.codigo_sugerido_seguro === "medio" ? "revisa: supuso un dato" : "poco seguro"}
          {a.codigo_sugerido_nota && <> · {a.codigo_sugerido_nota}</>}
        </span>
      )}
      {noLleva && <span className="w-full text-xs text-tenue"><Sparkles className="inline h-3 w-3 mr-1" />La IA no le puso código{a.codigo_sugerido_nota ? `: ${a.codigo_sugerido_nota}` : "."}</span>}
    </form>
  );
}

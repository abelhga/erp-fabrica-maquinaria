import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Hash, Wrench } from "lucide-react";
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
interface EquipoCatalogo { id: string; clave: string; nombre: string; familia: string | null; familia_serie: string | null; codigo_serie: string | null; dias_fabricacion: number | null }

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
    { clave: "estado", titulo: "Estado", sinBusqueda: true, valor: (e) => e.estado ?? "",
      celda: (e) => e.estado ? <Insignia tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Insignia> : <span className="text-tenue">—</span> },
    { clave: "origen", titulo: "Origen", sinBusqueda: true, explica: GLOSARIO.equipoHistorico,
      celda: (e) => e.origen === "erp" ? <Insignia tono="marca">ERP</Insignia> : <span className="text-xs text-tenue">Hoja</span> },
  ];

  return (
    <Pagina titulo="Números de serie" descripcion="Cada equipo que hemos hecho: de quién es, de qué pedido, y qué número sigue en cada familia.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Equipos con serie" valor={numero(todos.length)} icono={Hash} tono="marca" detalle={`${todos.filter((e) => e.origen === "erp").length} hechos en el ERP`} alClic={() => { setVista("todos"); setFamilia(""); }} />
        <Kpi titulo="En taller o por entregar" valor={numero(todos.filter((e) => e.estado === "espera" || e.estado === "proceso" || e.estado === "terminado").length)} icono={Wrench} tono="aviso" alClic={() => setVista("abiertos")} />
      </div>
      <Pestanas value={pestana} onValueChange={(v) => setPestana(v as "equipos" | "codigos")}>
        <ListaPestanas opciones={[
          { valor: "equipos", texto: "Equipos", cuenta: todos.length },
          { valor: "codigos", texto: "Códigos y tiempos por equipo", explica: GLOSARIO.codigoSerie },
        ]} />
        <ContenidoPestana value="equipos" className="pt-4">
          <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(e) => e.numero_serie}
            alClicFila={(e) => setAbierto(e.numero_serie)} exportarComo="numeros-de-serie" placeholder="Buscar serie, cliente, equipo, pedido o factura…"
            filtros={<div className="flex flex-wrap items-center gap-2">
              <Filtro valor={vista} alCambiar={setVista} opciones={[
                { valor: "todos", texto: "Todos", cuenta: deFamilia.length },
                { valor: "abiertos", texto: "En taller o por entregar", cuenta: abiertos.length },
                { valor: "entregado", texto: "Entregados" },
              ]} />
              <Seleccion value={familia} onChange={(e) => setFamilia(e.target.value)} className="h-8 w-auto text-xs" aria-label="Familia">
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
            {e.estado && <Insignia tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Insignia>}
            {e.origen === "erp" ? <Insignia tono="marca">Numerado por el ERP</Insignia> : <span className="text-xs text-tenue">Del libro de seriales (hoja)</span>}
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
  const [vista, setVista] = useState<"sin" | "todos">("sin");
  const datos = useQuery({
    queryKey: [...CLAVE, "codigos"],
    queryFn: () => todasLasFilas<EquipoCatalogo>((d, h) => supabase.from("articulos").select("id, clave, nombre, familia, familia_serie, codigo_serie, dias_fabricacion")
      .eq("tipo", "equipo").eq("activo", true).order("clave").range(d, h)),
  });
  const todos = datos.data ?? [];
  const sin = todos.filter((a) => !a.codigo_serie);
  const filas = vista === "sin" ? sin : todos;
  const columnas: Columna<EquipoCatalogo>[] = [
    { clave: "clave", titulo: "Clave", celda: (a) => <span className="cifra text-tenue">{a.clave}</span> },
    { clave: "nombre", titulo: "Equipo", clase: "min-w-[240px] max-w-[420px]", celda: (a) => <span className="line-clamp-2 break-words">{a.nombre}</span> },
    { clave: "codigo_serie", titulo: "Familia y código", sinBusqueda: true, explica: GLOSARIO.codigoSerie, valor: (a) => a.codigo_serie ?? "",
      celda: (a) => <EditorCodigo articulo={a} familias={familias} editable={editable} /> },
    { clave: "dias_fabricacion", titulo: "Días de fabricación", alinear: "der", sinBusqueda: true, explica: GLOSARIO.diasFabricacion,
      valor: (a) => a.dias_fabricacion ?? -1, celda: (a) => <EditorDias articulo={a} editable={editable} /> },
  ];
  return (
    <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(a) => a.id}
      exportarComo="codigos-de-serie" placeholder="Buscar equipo o clave…"
      filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[{ valor: "sin", texto: "Sin código", cuenta: sin.length }, { valor: "todos", texto: "Todos", cuenta: todos.length }]} />}
      vacio={{ icono: Hash, titulo: vista === "sin" ? "Todos los equipos tienen código" : "Sin equipos", texto: "Cada equipo del catálogo necesita su código (por ejemplo TB20090275E para una banda de 20\" × 9 m, 2 HP, caja 75) para que su orden de producción saque número de serie sola." }} />
  );
}

function EditorDias({ articulo: a, editable }: { articulo: EquipoCatalogo; editable: boolean }) {
  const [dias, setDias] = useState(a.dias_fabricacion != null ? String(a.dias_fabricacion) : "");
  useEffect(() => { setDias(a.dias_fabricacion != null ? String(a.dias_fabricacion) : ""); }, [a.dias_fabricacion]);
  const guardar = useAccion(() => q(supabase.rpc("fijar_dias_fabricacion", { p_articulo: a.id, p_dias: dias ? Number(dias) : null })), {
    exito: "Días de fabricación guardados", invalidar: [CLAVE, ["estimar_entrega"]],
  });
  if (!editable) return a.dias_fabricacion != null ? <span className="cifra">{a.dias_fabricacion} días</span> : <span className="text-xs text-tenue">Sin dato</span>;
  const cambio = dias !== (a.dias_fabricacion != null ? String(a.dias_fabricacion) : "");
  return (
    <form className="flex items-center justify-end gap-2" onSubmit={(e) => { e.preventDefault(); if (cambio) guardar.mutate(undefined); }}>
      <Entrada type="number" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} className="h-8 w-20 cifra text-right"
        aria-label="Días hábiles de fabricación" placeholder="—" />
      {cambio && <Boton type="submit" className="h-8" cargando={guardar.isPending}>Guardar</Boton>}
    </form>
  );
}

function EditorCodigo({ articulo: a, familias, editable }: { articulo: EquipoCatalogo; familias: Familia[]; editable: boolean }) {
  const [fam, setFam] = useState(a.familia_serie ?? "");
  const [cod, setCod] = useState(a.codigo_serie ?? "");
  useEffect(() => { setFam(a.familia_serie ?? ""); setCod(a.codigo_serie ?? ""); }, [a.familia_serie, a.codigo_serie]);
  const guardar = useAccion(() => q(supabase.rpc("fijar_codigo_serie", { p_articulo: a.id, p_familia: fam || null, p_codigo: cod || null })), {
    exito: "Código guardado", invalidar: [CLAVE],
  });
  const f = familias.find((x) => x.clave === fam);
  if (!editable) return a.codigo_serie
    ? <span className="cifra">{a.codigo_serie}<span className="text-tenue">###</span> <span className="text-xs text-tenue">· {f?.nombre}</span></span>
    : <span className="text-xs text-aviso">Sin código</span>;
  const cambio = fam !== (a.familia_serie ?? "") || cod.toUpperCase() !== (a.codigo_serie ?? "");
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (cambio) guardar.mutate(undefined); }}>
      <Seleccion value={fam} onChange={(e) => setFam(e.target.value)} className="h-8 w-44 text-xs" aria-label="Familia de serie">
        <option value="">Familia…</option>
        {familias.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
      </Seleccion>
      <Entrada value={cod} onChange={(e) => setCod(e.target.value.toUpperCase())} className="h-8 w-40 cifra" aria-label="Código de serie"
        placeholder={f?.prefijo ? `${f.prefijo}…` : "Código"} />
      {f && cod && <span className="text-xs text-tenue cifra">→ {cod.replace(/\s/g, "")}{String(f.ultimo + 1).padStart(3, "0")}</span>}
      {cambio && <Boton type="submit" className="h-8" cargando={guardar.isPending}>Guardar</Boton>}
    </form>
  );
}

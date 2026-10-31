import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { unzip } from "fflate";
import { toast } from "sonner";
import { ExternalLink, FileArchive, FolderOpen, History, Link2, RefreshCw } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { conceptosCfdi, leerCfdi } from "@/lib/cfdi";
import { dinero, fecha, numero, porcentaje } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

const CLAVE = ["cfdi_historico"] as const;
const LOTE = 150;

interface Resumen {
  total: number;
  por_anio: { anio: number; recibidas: number; recibidas_amarradas: number; con_clave_sat: number; con_orden: number; emitidas: number;
    emitidas_amarradas: number; nomina: number; pagos_notas: number; hoja_compras: number; hoja_ventas: number }[];
  sin_amarrar: { proveedor: string | null; rfc: string; n: number; monto: number }[];
}
interface Fila {
  uuid: string; rol: "recibida" | "emitida"; tipo: string; fecha: string; serie: string | null; folio: string | null;
  emisor_nombre: string | null; emisor_rfc: string; receptor_nombre: string | null; receptor_rfc: string; total_mxn: number;
  amarre: "folio" | "monto" | null; categoria: string | null; categoria_origen: "clave_sat" | "proveedor" | null;
  orden_hoja: string | null; factura_hoja: string | null; amarrada: boolean; carpeta: string | null;
}
interface Avance { leidos: number; total: number; nuevas: number; repetidas: number; ajenas: number; invalidas: number; amarradas: number; noLeidos: number }
type Vista = "recibidas" | "emitidas" | "sin_amarrar";

const desZip = (datos: Uint8Array) => new Promise<Record<string, Uint8Array>>((ok, mal) =>
  unzip(datos, { filter: (f) => /\.xml$/i.test(f.name) }, (e, r) => (e ? mal(e) : ok(r))));

/**
 * Los XML de años pasados (la carpeta FACTURAS del despacho) entran a la historia: cada uno se
 * amarra a su renglón del libro de compras o de ventas de la hoja, y lo comprado le da su
 * categoría en Resultados. Se leen aquí, en el navegador; a la base solo sube lo que dicen.
 */
export default function FacturasAnteriores() {
  const { puede } = useSesion();
  const carga = puede("finanzas", 2);
  const qc = useQueryClient();
  const [vista, setVista] = useState<Vista>("sin_amarrar");
  const [anio, setAnio] = useState<number | null>(null);
  const [avance, setAvance] = useState<Avance | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const carpeta = useRef<HTMLInputElement>(null);
  const archivos = useRef<HTMLInputElement>(null);

  const resumen = useQuery({ queryKey: [...CLAVE, "resumen"], queryFn: () => q<Resumen>(supabase.rpc("resumen_cfdi_historico")) });
  const driveOc = useQuery({ queryKey: ["configuracion", "drive_ordenes_compra"], staleTime: Infinity,
    queryFn: () => q<{ valor: { carpeta?: string } } | null>(supabase.from("configuracion").select("valor").eq("clave", "drive_ordenes_compra").maybeSingle()) });
  const anios = (resumen.data?.por_anio ?? []).map((a) => a.anio);
  // Abre en el año más reciente que ya tiene XML cargados.
  const anioVista = anio ?? (resumen.data?.por_anio ?? []).find((a) => a.recibidas + a.emitidas > 0)?.anio ?? anios[0] ?? new Date().getFullYear();
  const lista = useQuery({
    queryKey: [...CLAVE, "lista", vista, anioVista],
    queryFn: () => {
      let c = supabase.from("v_cfdi_historico").select("uuid, rol, tipo, fecha, serie, folio, emisor_nombre, emisor_rfc, receptor_nombre, receptor_rfc, total_mxn, amarre, categoria, categoria_origen, orden_hoja, factura_hoja, amarrada, carpeta")
        .gte("fecha", `${anioVista}-01-01`).lte("fecha", `${anioVista}-12-31`).eq("tipo", "I").order("fecha", { ascending: false }).limit(2000);
      c = vista === "emitidas" ? c.eq("rol", "emitida") : c.eq("rol", "recibida");
      if (vista === "sin_amarrar") c = c.eq("amarrada", false);
      return q<Fila[]>(c);
    },
  });

  // Lee lo elegido (XML sueltos, carpetas o ZIP), lo sube en lotes y amarra cada lote.
  async function cargar(sel: FileList | null) {
    if (!sel?.length) return;
    setTrabajando(true);
    const a: Avance = { leidos: 0, total: 0, nuevas: 0, repetidas: 0, ajenas: 0, invalidas: 0, amarradas: 0, noLeidos: 0 };
    let lote: Record<string, unknown>[] = [];
    const vistos = new Set<string>();
    const subir = async () => {
      if (!lote.length) return;
      const r = await q<{ nuevas: number; repetidas: number; ajenas: number; invalidas: number; amarradas: number }>(supabase.rpc("cargar_cfdi_historico", { p_cfdis: lote }));
      a.nuevas += r.nuevas; a.repetidas += r.repetidas; a.ajenas += r.ajenas; a.invalidas += r.invalidas; a.amarradas += r.amarradas;
      lote = []; setAvance({ ...a });
    };
    const leer = async (texto: string, ruta: string) => {
      a.leidos++;
      try {
        const c = leerCfdi(texto);
        if (!c.uuid || vistos.has(c.uuid)) { if (!c.uuid) a.noLeidos++; return; }
        vistos.add(c.uuid);
        lote.push({
          uuid: c.uuid, tipo: c.tipo, fecha: c.fecha, serie: c.serie, folio: c.folio,
          emisor_rfc: c.emisor.rfc, emisor_nombre: c.emisor.nombre, receptor_rfc: c.receptor.rfc, receptor_nombre: c.receptor.nombre,
          moneda: c.moneda, tipo_cambio: c.tipoCambio, subtotal: c.subtotal, total: c.total, metodo_pago: c.metodoPago, forma_pago: c.formaPago,
          conceptos: conceptosCfdi(texto), claves_sat: c.claves.map((k) => k.clave), carpeta: ruta.split("/").slice(0, -1).join("/"),
        });
      } catch { a.noLeidos++; }
      if (lote.length >= LOTE) await subir();
      if (a.leidos % 50 === 0) setAvance({ ...a });
    };
    try {
      const lista = [...sel];
      a.total = lista.filter((f) => /\.xml$/i.test(f.name)).length;
      for (const f of lista) {
        const ruta = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        if (/\.xml$/i.test(f.name)) await leer(await f.text(), ruta);
        else if (/\.zip$/i.test(f.name)) {
          const dentro = await desZip(new Uint8Array(await f.arrayBuffer()));
          const nombres = Object.keys(dentro);
          a.total += nombres.length; setAvance({ ...a });
          const dec = new TextDecoder("utf-8");
          for (const n of nombres) await leer(dec.decode(dentro[n]), `${f.name}/${n}`);
        }
      }
      await subir();
      setAvance({ ...a });
      toast.success(`Listo: ${numero(a.nuevas)} facturas nuevas, ${numero(a.amarradas)} amarradas a la hoja`);
    } catch (e) {
      toast.error(`Se detuvo: ${mensajeError(e)}. Lo que ya subió se quedó; vuelve a elegir lo mismo y sigue donde se quedó.`);
    } finally {
      setTrabajando(false);
      qc.invalidateQueries({ queryKey: CLAVE });
      if (carpeta.current) carpeta.current.value = "";
      if (archivos.current) archivos.current.value = "";
    }
  }

  // Después de dar de alta el RFC de un proveedor o de corregir la hoja: lo que falta, por lotes.
  async function reamarrar() {
    setTrabajando(true);
    try {
      const pend = await q<{ uuid: string }[]>(supabase.from("v_cfdi_historico").select("uuid").or("amarrada.eq.false,and(rol.eq.recibida,categoria_origen.is.null),and(rol.eq.recibida,categoria_origen.eq.proveedor)").limit(20000));
      let n = 0;
      for (let i = 0; i < pend.length; i += LOTE) {
        n += await q<number>(supabase.rpc("amarrar_cfdi_historico", { p_uuids: pend.slice(i, i + LOTE).map((p) => p.uuid) }));
      }
      toast.success(`Se amarraron ${numero(n)} más`);
    } catch (e) { toast.error(mensajeError(e)); } finally { setTrabajando(false); qc.invalidateQueries({ queryKey: CLAVE }); }
  }

  const ligaOc = (orden: string | null) => orden && driveOc.data?.valor.carpeta
    ? `https://drive.google.com/drive/search?q=${encodeURIComponent(`"${orden.trim()} " parent:${driveOc.data.valor.carpeta}`)}` : null;

  const columnas: Columna<Fila>[] = [
    { clave: "fecha", titulo: "Fecha", celda: (f) => <span className="whitespace-nowrap">{fecha(f.fecha)}</span> },
    { clave: "quien", titulo: vista === "emitidas" ? "Cliente" : "Proveedor", valor: (f) => (f.rol === "emitida" ? `${f.receptor_nombre} ${f.receptor_rfc}` : `${f.emisor_nombre} ${f.emisor_rfc}`),
      celda: (f) => <div className="min-w-[200px]"><p className="leading-tight">{f.rol === "emitida" ? f.receptor_nombre : f.emisor_nombre}</p>
        <p className="text-[11px] text-tenue cifra">{f.rol === "emitida" ? f.receptor_rfc : f.emisor_rfc} · {[f.serie, f.folio].filter(Boolean).join(" ") || f.uuid.slice(0, 8)}</p></div> },
    { clave: "total_mxn", titulo: "Total", alinear: "der", celda: (f) => <span className="cifra">{dinero(f.total_mxn)}</span> },
    { clave: "amarre", titulo: "En la hoja", explica: GLOSARIO.amarreXml, valor: (f) => f.factura_hoja ?? "", celda: (f) => f.amarrada
      ? <span className="text-sm whitespace-nowrap"><Insignia tono={f.amarre === "folio" ? "ok" : "info"}>{f.amarre === "folio" ? "Por folio" : "Por monto"}</Insignia>
          <span className="block text-[11px] text-tenue">factura {f.factura_hoja ?? "—"}</span></span>
      : <span className="text-tenue text-sm">Sin renglón</span> },
    { clave: "orden_hoja", titulo: "OC", oculta: vista === "emitidas", celda: (f) => {
      const liga = ligaOc(f.orden_hoja);
      return f.orden_hoja ? (liga ? <a href={liga} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-marca-texto cifra">{f.orden_hoja}<ExternalLink className="h-3 w-3" /></a>
        : <span className="cifra">{f.orden_hoja}</span>) : <span className="text-tenue">—</span>;
    } },
    { clave: "categoria", titulo: "Categoría", oculta: vista === "emitidas", explica: GLOSARIO.categoriaXml, celda: (f) => f.categoria
      ? <span className="text-sm">{f.categoria}<span className="block text-[11px] text-tenue">{f.categoria_origen === "clave_sat" ? "por lo comprado" : "por el proveedor"}</span></span>
      : <span className="text-tenue">—</span> },
  ];

  const filasAnio = resumen.data?.por_anio ?? [];
  return (
    <Pagina titulo="Facturas anteriores (XML)"
      descripcion="Los XML de años pasados se amarran a los libros de compras y ventas de las hojas, para que la historia diga qué se compró y no solo a quién."
      acciones={carga && <>
        <Boton variante="secundario" cargando={trabajando} onClick={reamarrar}><RefreshCw className="h-4 w-4" />Volver a amarrar</Boton>
        <Boton variante="secundario" disabled={trabajando} onClick={() => archivos.current?.click()}><FileArchive className="h-4 w-4" />XML o ZIP</Boton>
        <Boton disabled={trabajando} onClick={() => carpeta.current?.click()}><FolderOpen className="h-4 w-4" />Elegir carpeta</Boton>
      </>}>
      <input ref={carpeta} type="file" className="sr-only" tabIndex={-1} aria-label="Carpeta de facturas" onChange={(e) => cargar(e.target.files)}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} multiple />
      <input ref={archivos} type="file" className="sr-only" tabIndex={-1} aria-label="XML o ZIP" accept=".xml,.zip" multiple onChange={(e) => cargar(e.target.files)} />

      {avance && (
        <Tarjeta className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium">{trabajando ? "Cargando…" : "Última carga"}</span>
            <span className="cifra">{numero(avance.leidos)} de {numero(avance.total)} XML leídos</span>
            <span className="cifra text-ok">{numero(avance.nuevas)} nuevas</span>
            <span className="cifra">{numero(avance.amarradas)} amarradas</span>
            <span className="cifra text-tenue">{numero(avance.repetidas)} ya estaban</span>
            {avance.ajenas > 0 && <span className="cifra text-tenue">{numero(avance.ajenas)} de otro RFC</span>}
            {avance.noLeidos + avance.invalidas > 0 && <span className="cifra text-aviso">{numero(avance.noLeidos + avance.invalidas)} no se pudieron leer</span>}
          </div>
          {avance.total > 0 && <div className="mt-2 h-1.5 rounded-full bg-borde overflow-hidden"><div className="h-full bg-marca" style={{ width: `${Math.min(100, (avance.leidos / avance.total) * 100)}%` }} /></div>}
        </Tarjeta>
      )}

      <Tarjeta>
        <EncabezadoTarjeta titulo="Qué tanto de la historia tiene su XML" explica={GLOSARIO.coberturaXml}
          descripcion={resumen.data?.total ? `${numero(resumen.data.total)} facturas cargadas` : "Todavía no hay facturas cargadas"} />
        {filasAnio.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-tenue space-y-2">
            <p>Descarga la carpeta FACTURAS de Drive (un año a la vez, o todo) y elige aquí la carpeta, o los ZIP que da Drive al descargar. Se leen en este navegador: puede tardar unos minutos por año.</p>
            <p>Repetir una carga no duplica nada: cada factura se guarda una vez por su folio fiscal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Año</th><th className="text-right">Compras en la hoja</th><th className="text-right">XML recibidos</th><th className="text-right">Amarrados</th>
                <th className="text-right">Con OC</th><th className="text-right">Por lo comprado</th><th className="text-right">Ventas en la hoja</th><th className="text-right">XML emitidos</th>
                <th className="text-right">Amarrados</th><th className="text-right">Nómina</th></tr></thead>
              <tbody>
                {filasAnio.map((a) => (
                  <tr key={a.anio} className={a.anio === anioVista ? "bg-marca-suave/40" : "cursor-pointer"} onClick={() => setAnio(a.anio)}>
                    <td className="font-medium cifra">{a.anio}</td>
                    <td className="text-right cifra">{numero(a.hoja_compras)}</td>
                    <td className="text-right cifra">{numero(a.recibidas)}</td>
                    <td className="text-right cifra">{numero(a.recibidas_amarradas)}{a.hoja_compras > 0 && <span className="block text-[11px] text-tenue">{porcentaje(a.recibidas_amarradas / a.hoja_compras, 0)} de la hoja</span>}</td>
                    <td className="text-right cifra">{numero(a.con_orden)}</td>
                    <td className="text-right cifra">{numero(a.con_clave_sat)}</td>
                    <td className="text-right cifra">{numero(a.hoja_ventas)}</td>
                    <td className="text-right cifra">{numero(a.emitidas)}</td>
                    <td className="text-right cifra">{numero(a.emitidas_amarradas)}</td>
                    <td className="text-right cifra">{numero(a.nomina)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {(resumen.data?.sin_amarrar ?? []).length > 0 && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Proveedores con facturas sin renglón en la hoja" explica={GLOSARIO.amarreXml}
            descripcion="Casi siempre es que el proveedor no tiene su RFC en el ERP o se llama distinto en la hoja. Dale su RFC y «Volver a amarrar»." />
          <ul className="px-5 pb-4 divide-y divide-borde/60 text-sm">
            {resumen.data!.sin_amarrar.map((p) => (
              <li key={p.rfc} className="flex items-center gap-3 py-2"><Link2 className="h-4 w-4 text-tenue shrink-0" />
                <span className="flex-1 min-w-0">{p.proveedor ?? "—"}<span className="text-tenue cifra"> · {p.rfc}</span></span>
                <span className="cifra text-tenue">{numero(p.n)} facturas</span><span className="cifra w-28 text-right">{dinero(p.monto)}</span></li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <TablaDatos filas={lista.data} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(f) => f.uuid}
        exportarComo={`facturas-anteriores-${anioVista}`} placeholder="Proveedor, RFC, folio…"
        filtros={<div className="flex flex-wrap items-center gap-3">
          <Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
            { valor: "sin_amarrar", texto: "Recibidas sin renglón", explica: GLOSARIO.amarreXml },
            { valor: "recibidas", texto: "Recibidas" },
            { valor: "emitidas", texto: "Emitidas" },
          ]} />
          <span className="text-sm text-tenue">{anioVista}{anios.length > 1 && " · elige otro año en la tabla de arriba"}</span>
        </div>}
        vacio={{ icono: History, titulo: resumen.data?.total ? "Nada con este filtro en ese año" : "Sin facturas anteriores",
                 texto: carga ? "Elige la carpeta de facturas (o los ZIP de Drive) con los botones de arriba." : undefined }} />
    </Pagina>
  );
}

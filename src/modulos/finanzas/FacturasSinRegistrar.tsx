import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, FileText, FileX, History, Receipt, Undo2, UserPlus } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha, fechaYHora, numero } from "@/lib/formato";
import type { Cfdi } from "@/lib/cfdi";
import { GLOSARIO } from "@/tutorial/glosario";
import { RegistrarCompra } from "./componentes/RegistrarCompra";

const CLAVE = ["facturas_sin_registrar"] as const;
const MOTIVOS = ["Lo cobra el banco (domiciliado)", "Es de un socio, no de la empresa", "Se pagó con anticipo ya registrado", "No es de nosotros"];

interface Fila {
  uuid: string; fecha: string; serie: string | null; folio: string | null; emisor_rfc: string; emisor_nombre: string | null;
  proveedor_id: string | null; proveedor: string | null; moneda: string; tipo_cambio: number; subtotal: number | null; total: number;
  total_mxn: number; metodo_pago: "PUE" | "PPD" | null; forma_pago: string | null;
  conceptos: { descripcion?: string; clave?: string; importe?: number }[]; claves_sat: string[]; dias: number;
  no_registrar: string | null; no_registrar_por: string | null; no_registrar_en: string | null;
}
type Vista = "todas" | "credito" | "sin_proveedor" | "descartadas";

/** Lo guardado del XML, en la forma que lee «Registrar compra o gasto». */
const aCfdi = (f: Fila): Cfdi => ({
  version: null, uuid: f.uuid, serie: f.serie, folio: f.folio, fecha: f.fecha, tipo: "I", subtotal: f.subtotal, total: f.total,
  moneda: f.moneda, tipoCambio: f.tipo_cambio, metodoPago: f.metodo_pago, formaPago: f.forma_pago,
  emisor: { rfc: f.emisor_rfc, nombre: f.emisor_nombre }, receptor: { rfc: null, nombre: null },
  conceptos: (f.conceptos ?? []).map((c) => c.descripcion ?? "").filter(Boolean),
  claves: (f.conceptos ?? []).filter((c) => c.clave).map((c) => ({ clave: c.clave!, importe: Number(c.importe ?? 0) })),
  pagos: [],
});

/**
 * Lo que el SAT dice que nos facturaron (los XML cargados) y no está ni en la hoja ni en las
 * compras del ERP ni en caja chica. Nació del hueco del cambio de la hoja al ERP; sirve igual
 * cada mes: carga los XML del mes y aquí sale lo que falta registrar.
 */
export default function FacturasSinRegistrar() {
  const { puede } = useSesion();
  const captura = puede("finanzas", 2);
  const qc = useQueryClient();
  const [vista, setVista] = useState<Vista>("todas");
  const [registrar, setRegistrar] = useState<Fila[] | null>(null);
  const [descartar, setDescartar] = useState<Fila | null>(null);
  const [motivo, setMotivo] = useState("");

  const lista = useQuery({ queryKey: [...CLAVE, "pendientes"], queryFn: () => q<Fila[]>(supabase.rpc("facturas_sin_registrar", {})) });
  const descartadas = useQuery({ queryKey: [...CLAVE, "descartadas"], enabled: vista === "descartadas",
    queryFn: () => q<Fila[]>(supabase.rpc("facturas_sin_registrar", { p_descartadas: true })) });
  const accion = useAccion(async (a: { uuid: string; motivo: string | null }) => {
    await q(supabase.rpc("descartar_factura_sin_registrar", { p_uuid: a.uuid, p_motivo: a.motivo }));
    return a.motivo;
  }, {
    invalidar: [CLAVE], exito: (m) => (m ? "Descartada: ya no sale como pendiente" : "Regresó a la lista"),
    alTerminar: () => { setDescartar(null); setMotivo(""); },
  });

  const filas = lista.data ?? [];
  const credito = filas.filter((f) => f.metodo_pago === "PPD");
  const sinProv = filas.filter((f) => !f.proveedor_id);
  const mostradas = vista === "descartadas" ? descartadas.data : vista === "credito" ? credito : vista === "sin_proveedor" ? sinProv : filas;
  const suma = (xs: Fila[]) => xs.reduce((s, f) => s + Number(f.total_mxn), 0);
  const desde = filas.length ? filas[0].fecha : null;

  const columnas: Columna<Fila>[] = [
    { clave: "fecha", titulo: "Fecha", celda: (f) => <span className="whitespace-nowrap">{fecha(f.fecha)}<span className="block text-[11px] text-tenue">hace {numero(f.dias)} días</span></span> },
    { clave: "proveedor", titulo: "Proveedor", valor: (f) => `${f.proveedor ?? f.emisor_nombre} ${f.emisor_rfc}`, celda: (f) => (
      <div className="min-w-[220px]"><p className="leading-tight">{f.proveedor ?? f.emisor_nombre}</p>
        <p className="text-[11px] text-tenue cifra">{f.emisor_rfc}{f.proveedor_id ? "" : " · no está dado de alta"}</p></div>
    ) },
    { clave: "folio", titulo: "Folio", celda: (f) => <span className="cifra whitespace-nowrap">{[f.serie, f.folio].filter(Boolean).join(" ") || f.uuid.slice(0, 8)}</span> },
    { clave: "conceptos", titulo: "Qué es", valor: (f) => (f.conceptos ?? []).map((c) => c.descripcion).join(" "), celda: (f) => (
      <span className="text-sm line-clamp-2 max-w-[300px]">{(f.conceptos ?? []).map((c) => c.descripcion).filter(Boolean).slice(0, 2).join("; ") || "—"}</span>
    ) },
    { clave: "total_mxn", titulo: "Total", alinear: "der", celda: (f) => <span className="cifra whitespace-nowrap">{dinero(f.total_mxn)}{f.moneda !== "MXN" && <span className="block text-[11px] text-tenue">{f.moneda} {numero(f.total)}</span>}</span> },
    { clave: "metodo_pago", titulo: "Pago", explica: GLOSARIO.metodoPagoCfdi, valor: (f) => f.metodo_pago ?? "", celda: (f) => (
      <Insignia tono={f.metodo_pago === "PPD" ? "aviso" : "neutro"}>{f.metodo_pago === "PPD" ? "A crédito" : f.metodo_pago === "PUE" ? "De contado" : "—"}</Insignia>
    ) },
    ...(vista === "descartadas" ? [{ clave: "no_registrar", titulo: "Por qué no", celda: (f: Fila) => (
      <span className="text-sm">{f.no_registrar}<span className="block text-[11px] text-tenue">{f.no_registrar_por} · {fechaYHora(f.no_registrar_en)}</span></span>
    ) } as Columna<Fila>] : []),
    ...(captura ? [{ clave: "acciones", titulo: "", celda: (f: Fila) => vista === "descartadas" ? (
      <Boton tamano="sm" variante="fantasma" onClick={(e) => { e.stopPropagation(); accion.mutate({ uuid: f.uuid, motivo: null }); }}><Undo2 className="h-3.5 w-3.5" />Regresar</Boton>
    ) : (
      <div className="flex gap-1 justify-end">
        <Boton tamano="sm" onClick={(e) => { e.stopPropagation(); setRegistrar([f]); }}><Receipt className="h-3.5 w-3.5" />Registrar</Boton>
        <Boton tamano="sm" variante="fantasma" aria-label="No se registra aquí" title="No se registra aquí" onClick={(e) => { e.stopPropagation(); setDescartar(f); setMotivo(""); }}>
          <CircleSlash className="h-3.5 w-3.5" />
        </Boton>
      </div>
    ) } as Columna<Fila>] : []),
  ];

  return (
    <Pagina titulo="Facturas sin registrar"
      descripcion="Lo que el SAT dice que nos facturaron y no está en la hoja, en las compras del ERP ni en caja chica."
      acciones={<>
        <Boton asChild variante="secundario"><Link to="/finanzas/facturas-anteriores"><History className="h-4 w-4" />Cargar XML</Link></Boton>
        {captura && vista !== "descartadas" && (mostradas ?? []).length > 1 && (
          <Boton onClick={() => setRegistrar(mostradas ?? [])}><Receipt className="h-4 w-4" />Registrar las {numero((mostradas ?? []).length)}</Boton>
        )}
      </>}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi titulo="Sin registrar" valor={numero(filas.length)} icono={FileX} tono={filas.length ? "aviso" : "ok"} explica={GLOSARIO.facturaSinRegistrar}
             detalle={filas.length ? `${dinero(suma(filas))}${desde ? ` desde el ${fecha(desde)}` : ""}` : "Todo lo facturado está registrado"} alClic={() => setVista("todas")} />
        <Kpi titulo="A crédito: por pagar sin saberlo" valor={dinero(suma(credito))} icono={Receipt} tono={credito.length ? "peligro" : "ok"} explica={GLOSARIO.metodoPagoCfdi}
             detalle={credito.length === 1 ? "1 factura que no sale en Pagos a proveedores" : `${numero(credito.length)} facturas que no salen en Pagos a proveedores`} alClic={() => setVista("credito")} />
        <Kpi titulo="Proveedor sin dar de alta" valor={numero(sinProv.length)} icono={UserPlus} tono={sinProv.length ? "aviso" : "ok"}
             detalle="Al registrarla se da de alta con su RFC" alClic={() => setVista("sin_proveedor")} />
      </div>

      <TablaDatos filas={mostradas} columnas={columnas} cargando={vista === "descartadas" ? descartadas.isLoading : lista.isLoading} error={lista.error}
        claveFila={(f) => f.uuid} exportarComo="facturas-sin-registrar" placeholder="Proveedor, RFC, folio, concepto…"
        filtros={<Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
          { valor: "todas", texto: "Todas", cuenta: filas.length },
          { valor: "credito", texto: "A crédito", cuenta: credito.length },
          { valor: "sin_proveedor", texto: "Proveedor nuevo", cuenta: sinProv.length },
          { valor: "descartadas", texto: "No se registran", explica: GLOSARIO.facturaNoSeRegistra },
        ]} />}
        vacio={{ icono: vista === "descartadas" ? FileText : CheckCircle2,
          titulo: vista === "descartadas" ? "No has descartado ninguna" : "Todo lo facturado está registrado",
          texto: vista === "descartadas" ? "Las que no se registran aquí (las domicilia el banco, son de un socio) se marcan con el botón de cada renglón."
            : "Carga los XML del mes en «Facturas anteriores (XML)» y aquí sale lo que falte por registrar." }} />

      {/* Al cerrar se vuelve a cruzar: lo que se registró ya no sale. */}
      {registrar && <RegistrarCompra abierto facturas={registrar.map(aCfdi)} alCerrar={() => { setRegistrar(null); qc.invalidateQueries({ queryKey: CLAVE }); }} />}

      <Dialogo abierto={!!descartar} alCambiar={(v) => !v && setDescartar(null)} titulo="No se registra aquí"
        descripcion={descartar ? `${descartar.proveedor ?? descartar.emisor_nombre} · ${[descartar.serie, descartar.folio].filter(Boolean).join(" ")} · ${dinero(descartar.total_mxn)}` : undefined}
        pie={<>
          <Boton variante="secundario" onClick={() => setDescartar(null)}>Cancelar</Boton>
          <Boton type="submit" form="form-descartar" cargando={accion.isPending} disabled={motivo.trim().length < 3}>Descartar</Boton>
        </>}>
        <form id="form-descartar" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (descartar && motivo.trim().length >= 3) accion.mutate({ uuid: descartar.uuid, motivo }); }}>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => <button key={m} type="button" onClick={() => setMotivo(m)}
              className="rounded-full border border-borde px-2.5 py-0.5 text-xs hover:bg-fondo">{m}</button>)}
          </div>
          <Campo etiqueta="Por qué"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus /></Campo>
          <p className="text-xs text-tenue">Sale de la lista; la encuentras en «No se registran» y la puedes regresar.</p>
        </form>
      </Dialogo>
    </Pagina>
  );
}

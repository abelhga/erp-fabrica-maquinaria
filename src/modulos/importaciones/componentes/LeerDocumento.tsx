// "Leer con Claude": se sube el PDF o la foto, Claude devuelve los campos y
// Alondra los ve junto al archivo, los corrige y confirma. Nada se guarda solo:
// ni el archivo ni los datos llegan a la base hasta que ella da "Confirmar".
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Loader2, Sparkles } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, mensajeError } from "@/lib/consultas";
import { leerDocumento, type TipoDocumento } from "@/lib/asistente";
import { cn } from "@/lib/utilidades";
import { CLAVE_EMBARQUES, CONCEPTOS_GASTO, subirArchivo, type Embarque } from "./comun";

export const TIPOS_CLAUDE: Record<TipoDocumento, { nombre: string; doc: string; efecto: string }> = {
  proforma: { nombre: "Proforma invoice (PI)", doc: "pi", efecto: "Se guarda la PI; si el embarque no tenía incoterm ni puerto de origen, se toman de aquí y queda la fecha de la PI." },
  factura: { nombre: "Commercial invoice", doc: "ci", efecto: "Se guarda la factura y su número queda en la orden de compra que elijas." },
  lista_empaque: { nombre: "Packing list", doc: "pl", efecto: "Se guarda el packing list; bultos, peso y volumen pasan al embarque." },
  bl: { nombre: "BL o aviso de arribo", doc: "bl", efecto: "BL, naviera, buque, viaje y contenedores pasan al embarque; si la ETA cambió se actualiza (y queda en la historia); la fecha de embarque es el zarpe." },
  pedimento: { nombre: "Pedimento", doc: "pedimento", efecto: "Se registra el pedimento con IGI, DTA, IVA y PRV, y la etapa \"pedimento pagado\"." },
  cuenta_gastos: { nombre: "Cuenta de gastos", doc: "cuenta_gastos", efecto: "Los conceptos marcados entran como gastos del costeo (los impuestos y el anticipo no, para no duplicarlos) y el saldo a favor queda por recuperar." },
};
export const DOC_A_CLAUDE: Record<string, TipoDocumento> = Object.fromEntries(Object.entries(TIPOS_CLAUDE).map(([k, v]) => [v.doc, k as TipoDocumento]));

const ETIQUETAS: Record<string, string> = {
  numero: "Número", fecha: "Fecha", proveedor: "Proveedor", comprador: "Comprador", incoterm: "Incoterm", moneda: "Moneda",
  puerto_origen: "Puerto de origen", puerto_destino: "Puerto de destino", condiciones_pago: "Condiciones de pago", subtotal: "Subtotal", total: "Total",
  bultos: "Bultos", peso_bruto_kg: "Peso bruto (kg)", peso_neto_kg: "Peso neto (kg)", volumen_m3: "Volumen (m³)", numero_bl: "BL", tipo: "Tipo",
  naviera: "Naviera", buque: "Buque", viaje: "Viaje", puerto_carga: "Puerto de carga", puerto_descarga: "Puerto de descarga",
  fecha_embarque: "Fecha de embarque", eta: "ETA", consignatario: "Consignatario", peso_kg: "Peso (kg)", clave: "Clave", aduana: "Aduana",
  fecha_pago: "Fecha de pago", tipo_cambio: "Tipo de cambio", valor_aduana: "Valor en aduana", igi: "IGI", dta: "DTA", iva: "IVA", prv: "PRV",
  otros: "Otras contribuciones", folio: "Folio", agente: "Agente aduanal", referencia: "Referencia", anticipos: "Anticipos recibidos",
  saldo: "Saldo a favor (+) o a cargo (−)", partidas: "Partidas", contenedores: "Contenedores", conceptos: "Conceptos",
  descripcion: "Descripción", modelo: "Modelo", cantidad: "Cant.", unidad: "Unidad", precio_unitario: "Precio unit.", importe: "Importe",
  fraccion: "Fracción", concepto: "Va como", monto: "Monto sin IVA", sello: "Sello", mercancia: "Mercancía", modalidad: "Modalidad (fcl o lcl)",
};
const FECHAS = new Set(["fecha", "fecha_embarque", "eta", "fecha_pago"]);
const NUMEROS = new Set(["subtotal", "total", "bultos", "peso_bruto_kg", "peso_neto_kg", "volumen_m3", "peso_kg", "tipo_cambio", "valor_aduana",
  "igi", "dta", "iva", "prv", "otros", "anticipos", "saldo", "cantidad", "precio_unitario", "importe", "monto"]);

type Fila = Record<string, unknown>;

export function LeerDocumento({ abierto, alCambiar, embarque, tipoInicial }: {
  abierto: boolean; alCambiar: (v: boolean) => void; embarque: Embarque; tipoInicial?: TipoDocumento;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoDocumento>(tipoInicial ?? "factura");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ campos: Fila; simulado?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<string>("");
  const entrada = useRef<HTMLInputElement>(null);
  const abortar = useRef<AbortController | null>(null);
  const vista = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);
  useEffect(() => {
    if (!abierto) { abortar.current?.abort(); return; }
    setTipo(tipoInicial ?? "factura"); setArchivo(null); setResultado(null); setError(null);
    setOrden(embarque.ordenes.length === 1 ? embarque.ordenes[0].id : "");
  }, [abierto, tipoInicial, embarque.ordenes]);

  const elegir = (f: File | undefined | null) => {
    setResultado(null); setError(null);
    if (!f) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) { setError("Claude lee PDF, JPG o PNG."); return; }
    if (f.size > 15 * 1024 * 1024) { setError("El archivo pesa más de 15 MB: sube solo las páginas que importan."); return; }
    setArchivo(f);
  };

  const leer = async () => {
    if (!archivo) return;
    setLeyendo(true); setError(null);
    abortar.current = new AbortController();
    try {
      const r = await leerDocumento(tipo, archivo, abortar.current.signal);
      setResultado({ campos: r.campos, simulado: r.simulado });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(mensajeError(e));
    } finally { setLeyendo(false); }
  };

  const confirmar = async () => {
    if (!archivo || !resultado || resultado.simulado) return;
    setGuardando(true);
    try {
      const doc = TIPOS_CLAUDE[tipo].doc;
      const ruta = await subirArchivo(embarque.id, doc, archivo);
      const { advertencias: _a, ...campos } = resultado.campos;
      void _a;
      const r = await q<{ hechos: string[] }>(supabase.rpc("registrar_documento_importacion", {
        p_embarque: embarque.id, p_tipo: doc, p_archivo: ruta, p_nombre: archivo.name, p_campos: campos,
        p_orden_compra: orden || null, p_tamano: archivo.size,
      }));
      toast.success(`Guardado: ${r.hechos.join(", ")}`);
      [CLAVE_EMBARQUES, ["embarque_documentos"], ["embarque_eventos"], ["alertas_importacion"], ["embarque_gastos"], ["pedimentos"],
        ["embarque_saldos"], ["v_embarque_dinero"]].forEach((k) => qc.invalidateQueries({ queryKey: k }));
      alCambiar(false);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally { setGuardando(false); }
  };

  const campos = resultado?.campos;
  const poner = (k: string, v: unknown) => setResultado((r) => (r ? { ...r, campos: { ...r.campos, [k]: v } } : r));
  const advertencias = (campos?.advertencias as string[] | undefined) ?? [];

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho={resultado ? "max-w-6xl" : "max-w-xl"}
      titulo={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-marca" /> Leer documento con Claude</span>}
      descripcion={resultado ? "Revisa lo que leyó junto al archivo. Corrige lo que haga falta: nada se guarda hasta que confirmes." : `${embarque.folio} · ${embarque.descripcion}`}
      pie={resultado ? <>
        <Boton variante="secundario" onClick={() => { setResultado(null); }}>Leer otro</Boton>
        <Boton onClick={confirmar} cargando={guardando} disabled={!!resultado.simulado || (tipo === "factura" && embarque.ordenes.length > 1 && !orden)}>
          Confirmar y guardar
        </Boton>
      </> : <>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={leer} cargando={leyendo} disabled={!archivo}><Sparkles className="h-4 w-4" /> Leer con Claude</Boton>
      </>}>
      {!resultado ? (
        <div className="space-y-4">
          <Campo etiqueta="¿Qué documento es?">
            <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} disabled={leyendo}>
              {Object.entries(TIPOS_CLAUDE).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </Seleccion>
          </Campo>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); elegir(e.dataTransfer.files?.[0]); }}
            onClick={() => entrada.current?.click()}
            role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && entrada.current?.click()}
            className="rounded-xl border-2 border-dashed border-borde hover:border-marca/50 bg-fondo/50 p-6 text-center cursor-pointer"
          >
            <FileUp className="h-8 w-8 mx-auto text-tenue" />
            <p className="mt-2 text-sm font-medium">{archivo ? archivo.name : "Arrastra aquí el PDF o la foto, o haz clic para elegirlo"}</p>
            <p className="text-xs text-tenue mt-1">{archivo ? `${(archivo.size / 1024).toFixed(0)} KB` : "PDF, JPG o PNG de hasta 15 MB. Sirve escaneado o en chino."}</p>
            <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} aria-label="Archivo" />
          </div>
          {leyendo && <p className="text-sm text-tenue flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Claude está leyendo el documento…</p>}
          {error && <p className="text-sm text-peligro flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}</p>}
          <p className="text-xs text-tenue">{TIPOS_CLAUDE[tipo].efecto}</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-borde overflow-hidden bg-fondo h-64 lg:h-[64vh]">
            {vista && archivo?.type === "application/pdf"
              ? <object data={vista} type="application/pdf" className="w-full h-full" aria-label="Vista del documento">
                  <p className="p-4 text-sm text-tenue">Tu navegador no muestra el PDF aquí: {archivo.name}</p>
                </object>
              : vista && <img src={vista} alt="Documento a leer" className="w-full h-full object-contain" />}
          </div>
          <div className="space-y-4 min-w-0">
            {resultado.simulado && (
              <div className="rounded-lg border border-aviso/40 bg-aviso-suave text-aviso px-3 py-2 text-sm">
                <b>Modo demostración.</b> Falta conectar la llave de Claude: estos datos son un ejemplo, no salen de tu archivo, y no se pueden guardar.
              </div>
            )}
            {advertencias.length > 0 && !resultado.simulado && (
              <ul className="rounded-lg border border-aviso/40 bg-aviso-suave px-3 py-2 text-sm text-aviso space-y-1">
                {advertencias.map((a) => <li key={a} className="flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{a}</li>)}
              </ul>
            )}
            {tipo === "factura" && embarque.ordenes.length > 0 && (
              <Campo etiqueta="¿De qué orden de compra es esta factura?">
                <Seleccion value={orden} onChange={(e) => setOrden(e.target.value)}>
                  <option value="">Elegir…</option>
                  {embarque.ordenes.map((o) => <option key={o.id} value={o.id}>{o.folio} · {o.proveedor}</option>)}
                </Seleccion>
              </Campo>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(campos ?? {}).filter(([k, v]) => k !== "advertencias" && !Array.isArray(v)).map(([k, v]) => (
                <Campo key={k} etiqueta={ETIQUETAS[k] ?? k}>
                  <input className={cn("campo", v == null && "border-dashed")} type={FECHAS.has(k) ? "date" : "text"} inputMode={NUMEROS.has(k) ? "decimal" : undefined}
                    value={v == null ? "" : String(v)} placeholder={v == null ? "No viene en el documento" : undefined}
                    onChange={(e) => poner(k, e.target.value === "" ? null : NUMEROS.has(k) ? (Number.isNaN(Number(e.target.value.replace(/,/g, ""))) ? e.target.value : Number(e.target.value.replace(/,/g, ""))) : e.target.value)} />
                </Campo>
              ))}
            </div>
            {Object.entries(campos ?? {}).filter(([, v]) => Array.isArray(v) && (v as unknown[]).every((x) => x && typeof x === "object")).map(([k, v]) => (
              <TablaCampos key={k} nombre={k} filas={v as Fila[]} conIncluir={k === "conceptos"} alCambiar={(filas) => poner(k, filas)} />
            ))}
            <p className="text-xs text-tenue">{TIPOS_CLAUDE[tipo].efecto}</p>
          </div>
        </div>
      )}
    </Dialogo>
  );
}

function TablaCampos({ nombre, filas, conIncluir, alCambiar }: { nombre: string; filas: Fila[]; conIncluir: boolean; alCambiar: (f: Fila[]) => void }) {
  if (!filas.length) return <p className="text-sm text-tenue">{ETIQUETAS[nombre] ?? nombre}: no vienen en el documento.</p>;
  const columnas = Object.keys(filas[0]);
  const cambiar = (i: number, k: string, v: unknown) => alCambiar(filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{ETIQUETAS[nombre] ?? nombre}</p>
      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="tabla">
          <thead><tr>{conIncluir && <th className="w-10">Entra</th>}{columnas.map((c) => <th key={c} className={NUMEROS.has(c) ? "text-right" : ""}>{ETIQUETAS[c] ?? c}</th>)}</tr></thead>
          <tbody>
            {filas.map((f, i) => {
              const excluido = conIncluir && (f.concepto === "impuestos" || f.concepto === "anticipo");
              return (
                <tr key={i} className={cn(conIncluir && f.incluir === false && "opacity-50")}>
                  {conIncluir && (
                    <td><input type="checkbox" aria-label="Incluir como gasto" disabled={excluido}
                      title={excluido ? "Los impuestos ya están en el pedimento y el anticipo no es gasto" : undefined}
                      checked={!excluido && f.incluir !== false} onChange={(e) => cambiar(i, "incluir", e.target.checked)} /></td>
                  )}
                  {columnas.map((c) => (
                    <td key={c} className="min-w-[90px]">
                      {c === "concepto" && conIncluir ? (
                        <select className="campo h-8 text-xs" value={String(f[c] ?? "otro")} onChange={(e) => cambiar(i, c, e.target.value)} aria-label="Clasificación del concepto">
                          {[...Object.keys(CONCEPTOS_GASTO).filter((x) => x !== "cuenta_gastos"), "impuestos", "anticipo"].map((x) =>
                            <option key={x} value={x}>{CONCEPTOS_GASTO[x] ?? (x === "impuestos" ? "Impuestos (pedimento)" : "Anticipo")}</option>)}
                        </select>
                      ) : (
                        <input className={cn("campo h-8 text-xs", NUMEROS.has(c) && "text-right cifra")} value={f[c] == null ? "" : String(f[c])}
                          aria-label={ETIQUETAS[c] ?? c}
                          onChange={(e) => cambiar(i, c, e.target.value === "" ? null : NUMEROS.has(c) && !Number.isNaN(Number(e.target.value)) ? Number(e.target.value) : e.target.value)} />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// "Nuevo embarque" desde un documento: Alondra sube el BL (o la PI, la factura o el
// packing list) y Claude llena el alta. Nada se guarda al leer: los datos caen en el
// formulario marcados para revisarlos, y el archivo se guarda en el expediente hasta
// que ella da "Dar de alta" (con registrar_documento_importacion, igual que "Leer con
// Claude" en un embarque que ya existe).
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { leerDocumento, type TipoDocumento } from "@/lib/asistente";
import { mensajeError } from "@/lib/consultas";
import { INCOTERMS, type Embarque, type Modalidad } from "./comun";

/** Los que sirven para arrancar un embarque (el pedimento y la cuenta de gastos llegan después). */
export const TIPOS_ALTA = {
  bl: "BL o aviso de arribo",
  proforma: "Proforma invoice (PI)",
  factura: "Commercial invoice",
  lista_empaque: "Packing list",
} as const satisfies Partial<Record<TipoDocumento, string>>;
export type TipoAlta = keyof typeof TIPOS_ALTA;
/** Para las frases: "desde el BL", "el BL no se guardó". */
export const EL_DOC: Record<TipoAlta, string> = { bl: "el BL", proforma: "la proforma", factura: "la factura", lista_empaque: "el packing list" };

export type DatosEmbarque = Partial<Pick<Embarque, "descripcion" | "modalidad" | "importador" | "incoterm" | "puerto_origen" | "puerto_destino"
  | "naviera" | "forwarder" | "agente_aduanal" | "referencia_agente" | "bl" | "bl_house" | "contenedores" | "buque" | "viaje" | "etd" | "eta"
  | "dias_libres_almacenaje" | "dias_libres_demoras" | "carpeta_url" | "notas">>;

export interface Leido { tipo: TipoAlta; archivo: File; campos: Record<string, unknown> }

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const fecha = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** "20 Portable bag closer N600A y 2 Sewing head F900A", como la carpeta del expediente. */
function resumenPartidas(partidas: unknown): string | undefined {
  if (!Array.isArray(partidas)) return undefined;
  // "20 Portable bag closer N600A": el modelo es lo que distingue una partida de otra.
  const nombre = (x: Fila) => {
    const d = texto(x.descripcion), m = texto(x.modelo);
    return d && m && !d.toLowerCase().includes(m.toLowerCase()) ? `${d} ${m}` : d ?? m;
  };
  const p = (partidas as Fila[]).map((x) => [x.cantidad, nombre(x)].filter(Boolean).join(" ")).filter(Boolean);
  if (!p.length) return undefined;
  const r = p.length <= 3 ? p : [...p.slice(0, 2), `${p.length - 2} partidas más`];
  return (r.length > 1 ? `${r.slice(0, -1).join(", ")} y ${r.at(-1)}` : r[0]).slice(0, 140);
}

/** Qué campo del alta sale de qué dato del documento. */
export function datosDesdeDocumento(tipo: TipoAlta, c: Fila): DatosEmbarque {
  const d: DatosEmbarque = {};
  const poner = <K extends keyof DatosEmbarque>(k: K, v: DatosEmbarque[K] | undefined) => { if (v !== undefined && v !== null && v !== "") d[k] = v; };
  if (tipo === "bl") {
    poner("bl", texto(c.numero_bl)); poner("naviera", texto(c.naviera)); poner("buque", texto(c.buque)); poner("viaje", texto(c.viaje));
    poner("puerto_origen", texto(c.puerto_carga)); poner("puerto_destino", texto(c.puerto_descarga));
    poner("etd", fecha(c.fecha_embarque)); poner("eta", fecha(c.eta)); poner("descripcion", texto(c.mercancia));
    if (c.modalidad === "fcl" || c.modalidad === "lcl") poner("modalidad", c.modalidad as Modalidad);
    const cont = Array.isArray(c.contenedores)
      ? (c.contenedores as Fila[]).map((x) => [texto(x.numero), texto(x.tipo)].filter(Boolean).join(" ")).filter(Boolean).join(", ")
      : "";
    poner("contenedores", cont || undefined);
  } else {
    poner("descripcion", resumenPartidas(c.partidas));
    poner("puerto_origen", texto(c.puerto_origen));
    if (tipo === "factura") poner("puerto_destino", texto(c.puerto_destino));
    const inc = texto(c.incoterm)?.toUpperCase();
    if (inc && (INCOTERMS as readonly string[]).includes(inc)) poner("incoterm", inc);
    const de = [texto(c.numero) && `${TIPOS_ALTA[tipo]} ${texto(c.numero)}`, texto(c.proveedor)].filter(Boolean).join(" · ");
    poner("notas", de || undefined);
  }
  return d;
}

/**
 * Lo que se manda a registrar_documento_importacion al dar de alta. Lleva lo que
 * quedó en el formulario (con las correcciones de Alondra), no lo que leyó Claude:
 * esa función pisaría BL, naviera o ETA con lo leído. Los contenedores ya van en el
 * alta, así que no se mandan otra vez.
 */
export function camposParaRegistrar(tipo: TipoAlta, c: Fila, d: DatosEmbarque): Fila {
  const { advertencias: _a, ...resto } = c;
  void _a;
  if (tipo !== "bl") return resto;
  return {
    ...resto, numero_bl: d.bl ?? null, naviera: d.naviera ?? null, buque: d.buque ?? null, viaje: d.viaje ?? null,
    puerto_carga: d.puerto_origen ?? null, eta: d.eta ?? null, fecha_embarque: d.etd ?? null, contenedores: [],
  };
}

export const DOC_DE: Record<TipoAlta, string> = { bl: "bl", proforma: "pi", factura: "ci", lista_empaque: "pl" };

/** El recuadro de arriba del alta: elegir, leer, y avisar qué llenó. */
export function LlenarConDocumento({ leido, alLeer, alQuitar, llenados }: {
  leido: Leido | null; alLeer: (l: Leido) => void; alQuitar: () => void; llenados: number;
}) {
  const [tipo, setTipo] = useState<TipoAlta>("bl");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const abortar = useRef<AbortController | null>(null);
  const vista = useMemo(() => (leido ? URL.createObjectURL(leido.archivo) : null), [leido]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);
  useEffect(() => () => abortar.current?.abort(), []);

  const leer = async (f: File) => {
    setError(null);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) { setError("Claude lee PDF, JPG o PNG."); return; }
    if (f.size > 15 * 1024 * 1024) { setError("El archivo pesa más de 15 MB: sube solo las páginas que importan."); return; }
    setArchivo(f); setLeyendo(true);
    abortar.current = new AbortController();
    try {
      const r = await leerDocumento(tipo, f, abortar.current.signal);
      // En modo demostración los datos son un ejemplo: no se meten al alta de algo real.
      if (r.simulado) { setError("Falta conectar la llave de Claude: por ahora llena el alta a mano."); return; }
      alLeer({ tipo, archivo: f, campos: r.campos });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(mensajeError(e));
    } finally { setLeyendo(false); }
  };

  if (leido) {
    const advertencias = (leido.campos.advertencias as string[] | undefined) ?? [];
    return (
      <div className="sm:col-span-2 rounded-xl border border-marca/30 bg-marca-suave/40 px-4 py-3 space-y-2">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-marca shrink-0 mt-0.5" />
          <p className="text-sm flex-1 min-w-0">
            <b>Claude llenó {llenados} {llenados === 1 ? "campo" : "campos"}</b> desde {EL_DOC[leido.tipo]}{" "}
            <span className="text-tenue">({leido.archivo.name})</span>. Revísalos: van marcados. El archivo se guarda en el expediente al dar de alta.
          </p>
          {vista && (
            <a href={vista} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-marca-texto hover:underline">
              Ver archivo <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button type="button" onClick={alQuitar} className="shrink-0 p-1 rounded text-tenue hover:bg-fondo" aria-label="Quitar el documento" title="Quitar el documento (lo llenado se queda)">
            <X className="h-4 w-4" />
          </button>
        </div>
        {advertencias.length > 0 && (
          <ul className="text-sm text-aviso space-y-1">
            {advertencias.map((a) => <li key={a} className="flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{a}</li>)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 rounded-xl border-2 border-dashed border-borde bg-fondo/50 px-4 py-3"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !leyendo) leer(f); }}>
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 text-marca shrink-0" />
        <p className="text-sm flex-1 min-w-[200px]">
          <b>¿Ya tienes el documento?</b> Súbelo y Claude llena el embarque. <span className="text-tenue">PDF o foto, escaneado o en chino.</span>
        </p>
        <Seleccion className="w-auto h-9" value={tipo} onChange={(e) => setTipo(e.target.value as TipoAlta)} disabled={leyendo} aria-label="Qué documento es">
          {Object.entries(TIPOS_ALTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Seleccion>
        <Boton type="button" variante="secundario" onClick={() => entrada.current?.click()} cargando={leyendo}>
          {!leyendo && <FileUp className="h-4 w-4" />}{leyendo ? "Leyendo…" : "Subir y leer"}
        </Boton>
        <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" aria-label="Documento para llenar el embarque"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) leer(f); }} />
      </div>
      {leyendo && <p className="mt-2 text-sm text-tenue flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Claude está leyendo {archivo?.name}… (unos segundos)</p>}
      {error && <p className="mt-2 text-sm text-peligro flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}</p>}
    </div>
  );
}

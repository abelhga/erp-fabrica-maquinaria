// Alta (o actualización) de cliente o proveedor desde la constancia de situación
// fiscal: Claude la lee y los datos caen en el formulario para revisarlos. Nada se
// guarda al leer. Antes de dar de alta avisa si ese RFC ya existe (rfc_registrado):
// el RFC no es único en la base y así se duplicaban clientes entre vendedores.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { leerDocumento } from "@/lib/asistente";
import { mensajeError, q } from "@/lib/consultas";
import { supabase } from "@/lib/supabase";
import { fecha } from "@/lib/formato";

export interface DatosConstancia {
  rfc: string | null; tipo_persona: "moral" | "fisica" | null;
  /** Como la pide el CFDI 4.0: sin régimen de capital, en mayúsculas como viene. */
  razon_social: string | null;
  /** Para "como lo conocen": el nombre comercial, o la razón social en altas y bajas. */
  nombre: string | null;
  regimen_fiscal: string | null; cp_fiscal: string | null;
  /** Domicilio fiscal completo en una línea (calle, colonia, municipio, estado y CP). */
  domicilio: string | null; ciudad: string | null; estado: string | null;
}
interface Registrado {
  clientes: { id: string; nombre: string; vendedor: string | null; mio: boolean; editable: boolean }[];
  proveedores: { id: string; nombre: string }[];
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const MENORES = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en", "a"]);
/** "ATOTONILCO EL ALTO" → "Atotonilco el Alto": la constancia viene en mayúsculas. */
export const aTitulo = (t: string | null) => t && t.replace(/\S+/g, (p, i) => {
  if (/\d/.test(p)) return p;   // "39F", "2000": se quedan como vienen
  const m = p.toLowerCase();
  return i > 0 && MENORES.has(m) ? m : m[0].toUpperCase() + m.slice(1);
});

export function datosDeConstancia(c: Record<string, unknown>): DatosConstancia {
  const regimenes = Array.isArray(c.regimenes) ? (c.regimenes as Record<string, unknown>[]) : [];
  const r = regimenes[0];
  const municipio = texto(c.municipio), estado = texto(c.estado), cp = texto(c.codigo_postal)?.replace(/\D/g, "").slice(0, 5) || null;
  const razon = texto(c.razon_social);
  return {
    rfc: texto(c.rfc)?.toUpperCase().replace(/[\s-]/g, "") ?? null,
    tipo_persona: c.tipo_persona === "moral" || c.tipo_persona === "fisica" ? c.tipo_persona : null,
    razon_social: razon,
    nombre: texto(c.nombre_comercial) ?? aTitulo(razon),
    regimen_fiscal: r ? [texto(r.clave), texto(r.descripcion)].filter(Boolean).join(" ") || null : null,
    cp_fiscal: cp,
    // El domicilio, tal como viene en la constancia (en mayúsculas): es el oficial.
    domicilio: [texto(c.domicilio), municipio, estado, cp && `CP ${cp}`].filter(Boolean).join(", ") || null,
    ciudad: aTitulo(municipio), estado: aTitulo(estado),
  };
}

/**
 * El recuadro para subir la constancia. `excluir` es el registro que se está editando
 * (para no avisar que "ya existe" él mismo).
 */
export function LlenarConConstancia({ para, alLeer, excluir, className }: {
  para: "cliente" | "proveedor"; alLeer: (d: DatosConstancia) => void; excluir?: string; className?: string;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leida, setLeida] = useState<{ campos: Record<string, unknown>; datos: DatosConstancia; registrado: Registrado | null } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const abortar = useRef<AbortController | null>(null);
  useEffect(() => () => abortar.current?.abort(), []);
  const vista = useMemo(() => (leida && archivo ? URL.createObjectURL(archivo) : null), [leida, archivo]);
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  const leer = async (f: File) => {
    setError(null);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) { setError("Claude lee PDF, JPG o PNG."); return; }
    if (f.size > 15 * 1024 * 1024) { setError("El archivo pesa más de 15 MB."); return; }
    setArchivo(f); setLeyendo(true);
    abortar.current = new AbortController();
    try {
      const r = await leerDocumento("constancia_fiscal", f, abortar.current.signal);
      if (r.simulado) { setError("Falta conectar la llave de Claude: por ahora captura los datos a mano."); return; }
      const datos = datosDeConstancia(r.campos);
      const registrado = datos.rfc ? await q<Registrado>(supabase.rpc("rfc_registrado", { p_rfc: datos.rfc })).catch(() => null) : null;
      setLeida({ campos: r.campos, datos, registrado });
      alLeer(datos);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(mensajeError(e));
    } finally { setLeyendo(false); }
  };

  if (leida) {
    const c = leida.campos;
    const advertencias = (c.advertencias as string[] | undefined) ?? [];
    const estatus = texto(c.estatus);
    const emitida = texto(c.fecha_emision);
    const vieja = emitida && Date.now() - new Date(emitida).getTime() > 90 * 86_400_000;
    const ya = para === "cliente"
      ? (leida.registrado?.clientes ?? []).filter((x) => x.id !== excluir).map((x) => ({
          id: x.id, nombre: x.nombre, de: x.mio ? " (tuyo)" : x.vendedor ? ` (de ${x.vendedor})` : " (sin vendedor)", editable: x.editable,
          ruta: `/ventas/clientes/${x.id}` }))
      : (leida.registrado?.proveedores ?? []).filter((x) => x.id !== excluir).map((x) => ({
          id: x.id, nombre: x.nombre, de: "", editable: true, ruta: `/compras/proveedores/${x.id}` }));
    return (
      <div className="sm:col-span-2 rounded-xl border border-marca/30 bg-marca-suave/40 px-4 py-3 space-y-2">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-marca shrink-0 mt-0.5" />
          <p className="text-sm flex-1 min-w-0">
            <b>Datos de la constancia</b>{" "}
            <span className="text-tenue">({[leida.datos.rfc, leida.datos.regimen_fiscal?.slice(0, 3) && `régimen ${leida.datos.regimen_fiscal.slice(0, 3)}`,
              leida.datos.cp_fiscal && `CP ${leida.datos.cp_fiscal}`].filter(Boolean).join(" · ")})</span>. Revísalos antes de guardar.
          </p>
          {vista && (
            <a href={vista} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-marca-texto hover:underline">
              Ver <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button type="button" onClick={() => setLeida(null)} className="shrink-0 p-1 rounded text-tenue hover:bg-fondo" aria-label="Quitar la constancia" title="Quitar (lo llenado se queda)">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {estatus && estatus.toUpperCase() !== "ACTIVO" && (
            <li className="flex gap-2 text-peligro"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />El SAT lo tiene como {estatus}: no se le puede facturar así.</li>
          )}
          {vieja && (
            <li className="flex gap-2 text-aviso"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />La constancia es del {fecha(emitida)}: si cambió de domicilio o régimen, pide una reciente.</li>
          )}
          {ya.map((x) => (
            <li key={x.id} className="flex gap-2 text-aviso">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Ya hay {para === "cliente" ? "un cliente" : "un proveedor"} con este RFC: <b>{x.nombre}</b>{x.de}.{" "}
                {x.editable ? <Link to={x.ruta} className="underline font-medium">Abrirlo</Link> : "Pídele que te lo pase en vez de darlo de alta otra vez."}
              </span>
            </li>
          ))}
          {advertencias.map((a) => <li key={a} className="flex gap-2 text-aviso"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{a}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className={className ?? "sm:col-span-2 rounded-xl border-2 border-dashed border-borde bg-fondo/50 px-4 py-3"}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !leyendo) leer(f); }}>
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 text-marca shrink-0" />
        <p className="text-sm flex-1 min-w-[200px]">
          <b>¿Tienes su constancia de situación fiscal?</b> Súbela y Claude llena los datos fiscales. <span className="text-tenue">PDF o foto.</span>
        </p>
        <Boton type="button" variante="secundario" onClick={() => entrada.current?.click()} cargando={leyendo}>
          {!leyendo && <FileUp className="h-4 w-4" />}{leyendo ? "Leyendo…" : "Subir constancia"}
        </Boton>
        <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" aria-label="Constancia de situación fiscal"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) leer(f); }} />
      </div>
      {leyendo && <p className="mt-2 text-sm text-tenue flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Claude está leyendo {archivo?.name}…</p>}
      {error && <p className="mt-2 text-sm text-peligro flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}</p>}
    </div>
  );
}

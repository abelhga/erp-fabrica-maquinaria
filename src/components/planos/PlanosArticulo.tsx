// Planos de un equipo o componente: el vigente arriba, las revisiones anteriores
// abajo. El archivo vive en Drive; el ERP guarda el folio, la revisión, qué cambió
// y quién la aprobó. Solo ingeniería da de alta, saca revisiones y aprueba.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ExternalLink, FilePlus2, FileStack, GitBranchPlus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

export interface DocTecnico {
  id: string; folio: string; revision: string; tipo: string; titulo: string; drive_url: string;
  estado: "borrador" | "vigente" | "obsoleto"; cambio: string | null; creado_en: string; aprobado_en: string | null;
  creado_por_nombre: string | null; aprobado_por_nombre: string | null; articulo_id: string | null; clave: string | null; articulo: string | null;
}

export const TIPOS_DOC: Record<string, string> = {
  plano: "Plano", carpeta: "Carpeta de diseño en Drive", corte: "Corte (DXF)", programa_cnc: "Programa de plasma", modelo_3d: "Modelo 3D", ficha: "Ficha / medidas generales", foto: "Foto", otro: "Otro",
};

export function PlanosArticulo({ articuloId }: { articuloId: string }) {
  const { puede } = useSesion();
  const ingenieria = puede("costeo", 2);
  const [nuevo, setNuevo] = useState(false);
  const [revisando, setRevisando] = useState<DocTecnico | null>(null);
  const [verHistoria, setVerHistoria] = useState<string | null>(null);
  const docs = useQuery({
    queryKey: ["documentos_tecnicos", articuloId],
    queryFn: () => q<DocTecnico[]>(supabase.from("v_documentos_tecnicos").select("*").eq("articulo_id", articuloId)
      .order("folio").order("revision", { ascending: false })),
  });
  const invalidar = [["documentos_tecnicos", articuloId], ["documentos_tecnicos"]];
  const aprobar = useAccion((id: string) => q(supabase.rpc("aprobar_documento", { p_documento: id })),
    { exito: "Aprobado: ahora es el vigente", invalidar });
  const descartar = useAccion((id: string) => q(supabase.rpc("descartar_borrador", { p_documento: id })),
    { exito: "Borrador descartado", invalidar });

  if (docs.error) return <ErrorCarga error={docs.error} />;
  if (docs.isLoading) return <Cargando filas={3} />;
  const porFolio = new Map<string, DocTecnico[]>();
  for (const d of docs.data ?? []) porFolio.set(d.folio, [...(porFolio.get(d.folio) ?? []), d]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-tenue max-w-2xl">
          El taller ve solo la revisión vigente. Cuando ingeniería revisa una orden, la orden se queda con esa revisión; si después sale otra, se avisa.
        </p>
        {ingenieria && <Boton tamano="sm" onClick={() => setNuevo(true)}><FilePlus2 className="h-4 w-4" />Ligar plano de Drive</Boton>}
      </div>

      {porFolio.size === 0 ? (
        <Vacio icono={FileStack} titulo="Sin planos ligados"
          texto={ingenieria ? "Liga el plano bueno desde Drive: el ERP le da folio y revisión, y el taller sabrá cuál es el vigente." : "Ingeniería todavía no liga los planos de este equipo."} />
      ) : (
        [...porFolio.entries()].map(([folio, revs]) => {
          const vigente = revs.find((r) => r.estado === "vigente");
          const borrador = revs.find((r) => r.estado === "borrador");
          const anteriores = revs.filter((r) => r.estado === "obsoleto");
          const principal = vigente ?? borrador ?? revs[0];
          return (
            <div key={folio} className="tarjeta p-4 animate-entrar">
              <div className="flex flex-wrap items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-marca-suave text-marca-texto grid place-items-center shrink-0 font-semibold text-sm">{principal.revision}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{principal.titulo}</p>
                  <p className="text-xs text-tenue">
                    <span className="cifra">{folio}</span> · {TIPOS_DOC[principal.tipo] ?? principal.tipo} · revisión {principal.revision}
                    {principal.aprobado_en && <> · aprobó {principal.aprobado_por_nombre} el {fecha(principal.aprobado_en)}</>}
                  </p>
                  {vigente?.cambio && <p className="text-sm mt-1">“{vigente.cambio}”</p>}
                </div>
                <div className="flex items-center gap-2">
                  {vigente ? <Insignia tono="ok"><CheckCircle2 className="h-3 w-3" />Vigente</Insignia> : <Insignia tono="aviso">Sin vigente</Insignia>}
                  <Boton tamano="sm" variante="secundario" asChild>
                    <a href={principal.drive_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Abrir en Drive</a>
                  </Boton>
                  {ingenieria && vigente && !borrador && (
                    <Boton tamano="sm" variante="fantasma" onClick={() => setRevisando(vigente)}><GitBranchPlus className="h-3.5 w-3.5" />Nueva revisión</Boton>
                  )}
                </div>
              </div>

              {borrador && ingenieria && (
                <div className="mt-3 rounded-lg border border-aviso/30 bg-aviso-suave/50 p-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <b>Revisión {borrador.revision} en borrador</b>{borrador.cambio && <> · {borrador.cambio}</>}
                    <a href={borrador.drive_url} target="_blank" rel="noreferrer" className="ml-2 text-marca-texto underline">ver</a>
                  </div>
                  <Boton tamano="sm" variante="exito" cargando={aprobar.isPending} onClick={() => aprobar.mutate(borrador.id)}><CheckCircle2 className="h-3.5 w-3.5" />Aprobar como vigente</Boton>
                  <Boton tamano="sm" variante="fantasma" onClick={() => descartar.mutate(borrador.id)}><Trash2 className="h-3.5 w-3.5" />Descartar</Boton>
                </div>
              )}

              {anteriores.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setVerHistoria(verHistoria === folio ? null : folio)} className="text-xs text-tenue inline-flex items-center gap-1 hover:text-texto">
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", verHistoria === folio && "rotate-180")} />
                    {anteriores.length} {anteriores.length === 1 ? "revisión anterior" : "revisiones anteriores"}
                  </button>
                  {verHistoria === folio && (
                    <ul className="mt-2 space-y-1.5 border-l-2 border-borde pl-3">
                      {anteriores.map((r) => (
                        <li key={r.id} className="text-sm">
                          <span className="font-medium">Rev. {r.revision}</span>
                          <span className="text-tenue"> · {r.aprobado_en ? fecha(r.aprobado_en) : "—"}{r.cambio && ` · ${r.cambio}`}</span>
                          <a href={r.drive_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-marca-texto underline">abrir</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      {nuevo && <DialogoNuevo articuloId={articuloId} alCerrar={() => setNuevo(false)} />}
      {revisando && <DialogoRevision doc={revisando} alCerrar={() => setRevisando(null)} />}
    </div>
  );
}

const esLigaDrive = (u: string) => /^https:\/\/(drive|docs)\.google\.com\//.test(u.trim());

function DialogoNuevo({ articuloId, alCerrar }: { articuloId: string; alCerrar: () => void }) {
  const [tipo, setTipo] = useState("plano");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const crear = useAccion(() => q(supabase.rpc("nuevo_documento_tecnico", {
    p_articulo: articuloId, p_pedido: null, p_tipo: tipo, p_titulo: titulo, p_drive_url: url, p_cambio: "Primera revisión ligada al ERP",
  })), { exito: "Ligado en borrador: apruébalo para que el taller lo vea", invalidar: [["documentos_tecnicos", articuloId], ["documentos_tecnicos"]], alTerminar: alCerrar });
  const listo = titulo.trim() && esLigaDrive(url);
  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo="Ligar plano de Drive"
      descripcion="Copia la liga del archivo en Drive (Compartir → Copiar vínculo). El ERP le pone folio y revisión A."
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton disabled={!listo} cargando={crear.isPending} onClick={() => crear.mutate(undefined)}>Ligar</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) crear.mutate(undefined); }}>
        <label className="block"><span className="etiqueta">Qué es</span>
          <select className="campo mt-1" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPOS_DOC).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="block"><span className="etiqueta">Título</span>
          <input autoFocus className="campo mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Plano general banda 18&quot; x 20 m" />
        </label>
        <label className="block"><span className="etiqueta">Liga de Drive</span>
          <input className="campo mt-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" />
          {url && !esLigaDrive(url) && <span className="text-xs text-peligro">Tiene que ser una liga de Google Drive.</span>}
        </label>
      </form>
    </Dialogo>
  );
}

function DialogoRevision({ doc, alCerrar }: { doc: DocTecnico; alCerrar: () => void }) {
  const [url, setUrl] = useState("");
  const [cambio, setCambio] = useState("");
  const crear = useAccion(() => q(supabase.rpc("nueva_revision", { p_documento: doc.id, p_drive_url: url, p_cambio: cambio })),
    { exito: "Revisión en borrador: apruébala para que sea la vigente", invalidar: [["documentos_tecnicos", doc.articulo_id], ["documentos_tecnicos"]], alTerminar: alCerrar });
  const listo = esLigaDrive(url) && cambio.trim();
  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo={`Nueva revisión de ${doc.folio}`}
      descripcion={`${doc.titulo}. La vigente (${doc.revision}) se queda hasta que apruebes esta.`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton disabled={!listo} cargando={crear.isPending} onClick={() => crear.mutate(undefined)}>Crear borrador</Boton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) crear.mutate(undefined); }}>
        <label className="block"><span className="etiqueta">Qué cambió</span>
          <input autoFocus className="campo mt-1" value={cambio} onChange={(e) => setCambio(e.target.value)} placeholder="Ej. Se alargó la cama 20 cm; chumacera de 1 7/16 a 1 11/16" />
          <span className="text-xs text-tenue">Es lo que lee el taller: dilo como se lo dirías al soldador.</span>
        </label>
        <label className="block"><span className="etiqueta">Liga de Drive del archivo nuevo</span>
          <input className="campo mt-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" />
        </label>
      </form>
    </Dialogo>
  );
}

/** En la orden de producción: con qué revisión se fabrica, y si ya cambió. */
export function PlanosOrden({ ordenId }: { ordenId: string }) {
  const planos = useQuery({
    queryKey: ["v_planos_orden", ordenId],
    queryFn: () => q<{ documento_id: string; folio: string; revision: string; revision_vigente: string | null; tipo: string; titulo: string; drive_url: string; registrado_en: string | null }[]>(
      supabase.from("v_planos_orden").select("*").eq("orden_id", ordenId).order("folio")),
  });
  if (planos.isLoading || planos.error) return null;
  const lista = planos.data ?? [];
  return (
    <div className="space-y-2">
      {lista.length === 0 && <p className="text-sm text-tenue">Este equipo no tiene planos ligados en el ERP. Ingeniería los liga desde la ficha del equipo.</p>}
      {lista.map((p) => {
        const cambio = p.registrado_en && p.revision_vigente && p.revision_vigente !== p.revision;
        return (
          <div key={p.documento_id} className={cn("flex items-center gap-3 rounded-lg border p-3", cambio ? "border-peligro/40 bg-peligro-suave/40" : "border-borde")}>
            <div className="h-8 w-8 rounded-md bg-fondo grid place-items-center text-sm font-semibold shrink-0">{p.revision}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.titulo}</p>
              <p className="text-xs text-tenue">{p.folio} · {TIPOS_DOC[p.tipo] ?? p.tipo}{p.registrado_en ? " · revisado por ingeniería" : " · vigente (la orden aún no se revisa)"}</p>
              {cambio && <p className="text-xs text-peligro font-medium mt-0.5">Ya salió la revisión {p.revision_vigente}: confirmar con ingeniería antes de seguir.</p>}
            </div>
            <a href={p.drive_url} target="_blank" rel="noreferrer" className="text-sm text-marca-texto inline-flex items-center gap-1 hover:underline shrink-0"><ExternalLink className="h-3.5 w-3.5" />Abrir</a>
          </div>
        );
      })}
    </div>
  );
}

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, ExternalLink, FileCheck2, FilePlus2, Lock, Sparkles, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { fecha, hace, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import type { TipoImportacion as TipoDocumento } from "@/lib/asistente";
import { abrirArchivo, CLAVE_EMBARQUES, NOMBRE_DEBE, subirArchivo, useVeDinero, type Debe, type Embarque } from "./comun";
import { DOC_A_CLAUDE, LeerDocumento } from "./LeerDocumento";

interface Documento {
  id: string; tipo: string; descripcion: string | null; debe: Debe; estado: string; archivo: string | null; archivo_nombre: string | null;
  recibido_en: string | null; ultimo_seguimiento: string | null; observaciones: string | null;
  documentos_importacion: { nombre: string; orden: number; con_montos: boolean; antes_de_arribo: boolean } | null;
}
interface TipoDoc { tipo: string; nombre: string; debe: Debe; orden: number }

const ESTADOS: Record<string, { texto: string; tono: Tono }> = {
  pendiente: { texto: "Pendiente", tono: "aviso" }, recibido: { texto: "Recibido", tono: "info" }, observado: { texto: "Con observaciones", tono: "peligro" },
  aceptado: { texto: "Aceptado", tono: "ok" }, no_aplica: { texto: "No aplica", tono: "neutro" },
};

/** El checklist del embarque: lo que hoy son casillas y 4 subcarpetas en Drive. */
export function Documentos({ e }: { e: Embarque }) {
  const { puede } = useSesion();
  const qc = useQueryClient();
  const captura = puede("importaciones", 2);
  const veDinero = useVeDinero();
  const [leer, setLeer] = useState<{ tipo?: TipoDocumento } | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [otro, setOtro] = useState("");
  const archivoOtro = useRef<HTMLInputElement>(null);
  const docs = useQuery({
    queryKey: ["embarque_documentos", e.id],
    queryFn: () => q<Documento[]>(supabase.from("embarque_documentos")
      .select("*, documentos_importacion(nombre, orden, con_montos, antes_de_arribo)").eq("embarque_id", e.id)),
  });
  const tipos = useQuery({
    queryKey: ["documentos_importacion"], staleTime: 60 * 60_000,
    queryFn: () => q<TipoDoc[]>(supabase.from("documentos_importacion").select("tipo, nombre, debe, orden").order("orden")),
  });
  const invalidar = [["embarque_documentos"], CLAVE_EMBARQUES, ["alertas_importacion"]];
  const cambiar = useAccion(({ id, cambios }: { id: string; cambios: Record<string, unknown> }) =>
    q(supabase.from("embarque_documentos").update(cambios).eq("id", id)), { invalidar });
  const pedi = useAccion(({ id }: { id: string; antes: string | null }) =>
    q(supabase.from("embarque_documentos").update({ ultimo_seguimiento: hoyISO() }).eq("id", id)), {
    exito: "Anotado: lo pediste hoy", invalidar,
    deshacer: (_, { id, antes }) => q(supabase.from("embarque_documentos").update({ ultimo_seguimiento: antes }).eq("id", id)),
  });

  const subir = async (doc: { id?: string; tipo: string }, f: File | undefined) => {
    if (!f) return;
    setSubiendo(doc.id ?? doc.tipo);
    try {
      const ruta = await subirArchivo(e.id, doc.tipo, f);
      // Sin leer: solo el archivo en su casilla (o una casilla nueva si es "otro documento").
      await q(supabase.rpc("registrar_documento_importacion", { p_embarque: e.id, p_tipo: doc.tipo, p_archivo: ruta, p_nombre: f.name, p_campos: {}, p_tamano: f.size }));
      toast.success(`${f.name} quedó en su casilla`);
      invalidar.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (err) { toast.error(mensajeError(err)); } finally { setSubiendo(null); setOtro(""); }
  };

  if (docs.isLoading) return <Tarjeta><Cargando /></Tarjeta>;
  const lista = [...(docs.data ?? [])].sort((a, b) => (a.documentos_importacion?.orden ?? 999) - (b.documentos_importacion?.orden ?? 999));
  const listos = lista.filter((d) => ["recibido", "aceptado", "no_aplica"].includes(d.estado)).length;

  return (
    <>
      <Tarjeta>
        <EncabezadoTarjeta titulo="Documentos" descripcion={`${listos} de ${lista.length} listos. Los marcados “antes del arribo” los pide el agente aduanal antes de que llegue.`}
          acciones={captura && <Boton tamano="sm" onClick={() => setLeer({})}><Sparkles className="h-4 w-4" /> Leer con Claude</Boton>} />
        {lista.length === 0 ? <Vacio icono={FileCheck2} titulo="Sin documentos" texto="Al dar de alta el embarque se arma su lista según la modalidad." /> : (
          <ul className="divide-y divide-borde border-t border-borde">
            {lista.map((d) => {
              const c = d.documentos_importacion;
              const bloqueado = !!c?.con_montos && !veDinero;
              const tipoClaude = DOC_A_CLAUDE[d.tipo];
              return (
                <li key={d.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {c?.nombre ?? d.tipo}
                      {c?.antes_de_arribo && d.estado === "pendiente" && <Insignia tono="marca">antes del arribo</Insignia>}
                    </p>
                    <p className="text-xs text-tenue">
                      {d.archivo_nombre ? <>{d.archivo_nombre}{d.recibido_en ? ` · ${fecha(d.recibido_en)}` : ""}</>
                        : d.ultimo_seguimiento ? `Pedido ${hace(d.ultimo_seguimiento)}` : "Sin archivo"}
                    </p>
                  </div>
                  {captura ? (
                    <select className="campo h-8 w-40 text-xs" value={d.debe} aria-label={`Quién debe ${c?.nombre}`}
                      onChange={(ev) => cambiar.mutate({ id: d.id, cambios: { debe: ev.target.value } })}>
                      {Object.entries(NOMBRE_DEBE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : <span className="text-xs text-tenue w-40">{NOMBRE_DEBE[d.debe]}</span>}
                  {captura ? (
                    <select className={cn("campo h-8 w-40 text-xs", d.estado === "pendiente" && "text-aviso", d.estado === "observado" && "text-peligro")} value={d.estado}
                      aria-label={`Estado de ${c?.nombre}`} onChange={(ev) => cambiar.mutate({ id: d.id, cambios: { estado: ev.target.value } })}>
                      {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
                    </select>
                  ) : <Insignia tono={ESTADOS[d.estado]?.tono ?? "neutro"}>{ESTADOS[d.estado]?.texto ?? d.estado}</Insignia>}
                  <div className="flex items-center justify-end gap-1 ml-auto md:w-80">
                    {d.archivo && (bloqueado
                      ? <span className="text-xs text-tenue inline-flex items-center gap-1" title="Trae precios: lo abren importaciones, compras y finanzas"><Lock className="h-3.5 w-3.5" /> con precios</span>
                      : <Boton variante="fantasma" tamano="sm" onClick={() => abrirArchivo(d.archivo!).catch((err) => toast.error(mensajeError(err)))}>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </Boton>)}
                    {captura && !d.archivo && tipoClaude && (
                      <Boton variante="fantasma" tamano="sm" onClick={() => setLeer({ tipo: tipoClaude })} title="Leer con Claude y revisar antes de guardar">
                        <Sparkles className="h-3.5 w-3.5" /> Leer
                      </Boton>
                    )}
                    {captura && (
                      <label className={cn("inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium hover:bg-fondo cursor-pointer", subiendo === d.id && "opacity-50 pointer-events-none")}>
                        <Upload className="h-3.5 w-3.5" /> {d.archivo ? "Reemplazar" : "Subir"}
                        <input type="file" className="hidden" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={(ev) => subir({ tipo: d.tipo }, ev.target.files?.[0])} />
                      </label>
                    )}
                    {captura && d.estado === "pendiente" && d.ultimo_seguimiento !== hoyISO() && (
                      <Boton variante="secundario" tamano="sm" title="Anotar que hoy lo pediste" onClick={() => pedi.mutate({ id: d.id, antes: d.ultimo_seguimiento })}>
                        <Clock className="h-3.5 w-3.5" /> Ya lo pedí
                      </Boton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {captura && (
          <div className="border-t border-borde px-5 py-3 flex flex-wrap items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-tenue" />
            <select className="campo h-8 w-60 text-sm" value={otro} onChange={(ev) => setOtro(ev.target.value)} aria-label="Tipo de documento a agregar">
              <option value="">Agregar otro documento…</option>
              {(tipos.data ?? []).map((t) => <option key={t.tipo} value={t.tipo}>{t.nombre}</option>)}
            </select>
            <Boton variante="secundario" tamano="sm" disabled={!otro} cargando={subiendo === otro} onClick={() => archivoOtro.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Elegir archivo
            </Boton>
            <input ref={archivoOtro} type="file" className="hidden" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
              onChange={(ev) => subir({ tipo: otro }, ev.target.files?.[0])} />
          </div>
        )}
      </Tarjeta>
      {leer && <LeerDocumento abierto={!!leer} alCambiar={(v) => !v && setLeer(null)} embarque={e} tipoInicial={leer.tipo} />}
    </>
  );
}

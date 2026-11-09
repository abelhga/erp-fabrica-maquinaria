import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, PhoneCall } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Seleccion } from "@/components/ui/campo";
import { Cargando, ErrorCarga } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";

interface EstadoTelefono {
  tiene_llave: boolean; generada_en: string | null; generada_por: string | null; ultimo_evento_en: string | null;
  ultimo_error: string | null; ultimo_error_en: string | null; llamadas_7d: number; nadie_contesto_7d: number; directorio_sin_persona: number;
}
interface Entrada { id: string; nombre: string; telefono: string | null; perfil_id: string | null; ligado_por: string | null; visto_en: string }

/** A donde el conmutador manda cada llamada: lo que el dueño pega en Railway como ERP_URL. */
export const URL_TELEFONO = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telefono`;

/**
 * El conmutador con IA (hegamex-voz): si está mandando las llamadas, la llave con la que entra y el
 * directorio de quién contesta. La llave se ve una sola vez: la base solo guarda su huella.
 */
export function ConfigTelefono() {
  const { tieneRol } = useSesion();
  const direccion = tieneRol("direccion");
  const estado = useQuery({ queryKey: ["estado_telefono"], queryFn: () => q<EstadoTelefono>(supabase.rpc("estado_telefono")) });
  const directorio = useQuery({
    queryKey: ["telefono_directorio"],
    queryFn: () => q<Entrada[]>(supabase.from("telefono_directorio").select("id, nombre, telefono, perfil_id, ligado_por, visto_en").order("visto_en", { ascending: false })),
  });
  const personas = useQuery({
    queryKey: ["perfiles", "activos"], enabled: direccion,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.from("perfiles").select("id, nombre").eq("activo", true).order("nombre")),
  });
  const [llave, setLlave] = useState<{ texto: string; habia: boolean } | null>(null);
  const generar = useAccion(() => q<string>(supabase.rpc("telefono_generar_llave")), {
    exito: "Llave nueva: cópiala ahora, no se vuelve a mostrar", invalidar: [["estado_telefono"]],
    alTerminar: (texto) => setLlave({ texto, habia: !!estado.data?.tiene_llave }),
  });
  const ligar = useAccion((a: { id: string; perfil: string | null }) => q(supabase.rpc("fijar_directorio_telefono", { p_id: a.id, p_perfil: a.perfil })), {
    exito: "Guardado: sus llamadas quedan a su nombre", invalidar: [["telefono_directorio"], ["estado_telefono"]],
  });
  const copiar = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));

  if (estado.error) return <Tarjeta><div className="p-5"><ErrorCarga error={estado.error} /></div></Tarjeta>;
  if (!estado.data) return <Tarjeta><div className="p-5"><Cargando filas={3} /></div></Tarjeta>;
  const e = estado.data;
  const pedirLlave = () => {
    if (e.tiene_llave && !confirm("¿Generar otra llave? La de ahora deja de servir en este momento: hasta que pongas la nueva en Railway, las llamadas no entran al ERP (el conmutador las guarda y las reintenta).")) return;
    generar.mutate(undefined);
  };

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Teléfono (recepción con IA)" explica={GLOSARIO.conexionTelefono}
        descripcion="Cada llamada del conmutador entra sola: se liga al cliente, deja su lead y lo que nadie contestó sale en «A quién llamar hoy». Y la IA sabe quién llama: se la pasa primero a su vendedor y le dice cómo va su pedido, sin montos."
        acciones={e.ultimo_evento_en ? <Insignia tono="ok"><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</Insignia>
          : <Insignia tono={e.tiene_llave ? "info" : "neutro"}>{e.tiene_llave ? "Esperando la primera llamada" : "Sin conectar"}</Insignia>} />
      <div className="px-5 pb-5 space-y-4 text-sm">
        <div className="rounded-lg border border-borde px-3 py-2 space-y-1" data-explain={GLOSARIO.ultimoAvisoTelefono} data-explain-title="Último aviso del teléfono">
          <p>Último aviso del teléfono: <b>{e.ultimo_evento_en ? hace(e.ultimo_evento_en) : "ninguno todavía"}</b>
            {e.ultimo_evento_en && <span className="text-tenue"> ({fechaYHora(e.ultimo_evento_en)})</span>}</p>
          {e.ultimo_error && (
            <p className="text-peligro text-xs break-words flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{e.ultimo_error}{e.ultimo_error_en ? ` · ${hace(e.ultimo_error_en)}` : ""}</span></p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Dato titulo="Llamadas (7 días)" valor={numero(e.llamadas_7d)} />
          <Dato titulo="Nadie contestó" valor={numero(e.nadie_contesto_7d)} tono={e.nadie_contesto_7d ? "aviso" : undefined} explica={GLOSARIO.nadieContesto} />
          <Dato titulo="Sin persona" valor={numero(e.directorio_sin_persona)} tono={e.directorio_sin_persona ? "aviso" : undefined} explica={GLOSARIO.directorioTelefono} />
        </div>

        <div className="space-y-2" data-explain={GLOSARIO.llaveTelefono} data-explain-title="Llave del teléfono">
          <p className="font-medium">Cómo se conecta</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>En Railway, en el servicio del conmutador, la variable <code>ERP_URL</code>:
              <CopiarTexto texto={URL_TELEFONO} alCopiar={copiar} /></li>
            <li>La variable <code>ERP_LLAVE</code>: la llave que genera dirección aquí.
              {e.tiene_llave && <span className="block text-xs text-tenue">Hay una llave vigente desde el {fecha(e.generada_en)}{e.generada_por ? `, la generó ${e.generada_por}` : ""}.</span>}</li>
          </ol>
          {llave && (
            <div className="rounded-lg border border-aviso/40 bg-aviso-suave px-3 py-2 space-y-2">
              <p className="font-medium">Cópiala ahora: no se vuelve a mostrar.</p>
              <CopiarTexto texto={llave.texto} alCopiar={copiar} />
              <p className="text-xs">Pégala en Railway como <code>ERP_LLAVE</code> y no la mandes por chat ni por correo.{llave.habia ? " La llave anterior ya no sirve." : ""}</p>
            </div>
          )}
          {direccion ? (
            <Boton variante="secundario" onClick={pedirLlave} cargando={generar.isPending} data-explain={GLOSARIO.llaveTelefono} data-explain-title="Generar llave">
              <KeyRound className="h-4 w-4" /> {e.tiene_llave ? "Generar otra llave" : "Generar llave"}</Boton>
          ) : <p className="text-xs text-tenue">La llave la genera dirección.</p>}
        </div>

        <div className="space-y-2" data-explain={GLOSARIO.directorioTelefono} data-explain-title="Directorio del teléfono">
          <p className="font-medium">Quién contesta</p>
          <p className="text-xs text-tenue">Cada nombre que manda el conmutador, ligado a su persona del ERP. Los que traen el mismo teléfono que su perfil se ligan solos. Al ligarlo, sus llamadas y calificaciones anteriores pasan a esa persona.</p>
          {directorio.isLoading ? <Cargando filas={2} /> : (directorio.data ?? []).length === 0 ? (
            <p className="text-xs text-tenue">Todavía nadie. Aparecen solos con la primera llamada que atiende cada quien.</p>
          ) : (
            <ul className="divide-y divide-borde rounded-lg border border-borde">
              {directorio.data!.map((d) => (
                <li key={d.id} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1"><b className="font-medium">{d.nombre}</b>
                    <span className="block text-xs text-tenue">{d.telefono ?? "Sin teléfono"} · {hace(d.visto_en)}{d.perfil_id && !d.ligado_por ? " · se ligó solo" : ""}</span></span>
                  {direccion ? (
                    <Seleccion className="h-8 w-48 text-xs" aria-label={`Persona de ${d.nombre}`} value={d.perfil_id ?? ""} disabled={ligar.isPending}
                      onChange={(x) => ligar.mutate({ id: d.id, perfil: x.target.value || null })}>
                      <option value="">Sin persona</option>
                      {(personas.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </Seleccion>
                  ) : d.perfil_id ? <Insignia tono="ok">Ligado</Insignia> : <Insignia tono="aviso">Sin persona</Insignia>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!e.ultimo_evento_en && (
          <p className="text-xs text-tenue flex items-center gap-1.5"><PhoneCall className="h-3.5 w-3.5" />Sin conectar, el conmutador contesta igual, pero nada de lo que pasa ahí llega al ERP.</p>
        )}
      </div>
    </Tarjeta>
  );
}

function CopiarTexto({ texto, alCopiar }: { texto: string; alCopiar: (t: string) => void }) {
  return (
    <span className="mt-1 flex items-center gap-2 rounded-md bg-fondo border border-borde px-2 py-1">
      <code className="flex-1 min-w-0 break-all text-xs">{texto}</code>
      <button type="button" className="text-tenue hover:text-texto" onClick={() => alCopiar(texto)} aria-label="Copiar"><Copy className="h-3.5 w-3.5" /></button>
    </span>
  );
}

function Dato({ titulo, valor, tono, explica }: { titulo: string; valor: string; tono?: "aviso"; explica?: string }) {
  return (
    <div data-explain={explica} data-explain-title={explica ? titulo : undefined}>
      <p className="text-xs text-tenue">{titulo}</p>
      <p className={`text-xl font-semibold cifra ${tono === "aviso" ? "text-aviso" : ""}`}>{valor}</p>
    </div>
  );
}

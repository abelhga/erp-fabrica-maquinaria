// Lo que comparten la pantalla de Mejoras y la terminal: la consulta, la lista de desperdicios,
// el diálogo para proponer una idea y las fotos de antes y después.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { subirImagen } from "@/components/datos/SubirFoto";
import { GLOSARIO } from "@/tutorial/glosario";
import { CLAVE, useEtapas } from "./datos";

export type EstadoMejora = "propuesta" | "en_marcha" | "hecha" | "descartada";
export interface Mejora {
  id: string; numero: number; folio: string; titulo: string; problema: string | null; propuesta: string | null;
  etapa_id: number | null; etapa: string | null; etapa_color: string | null; desperdicio: string | null;
  tipo: "kaizen" | "a3"; estado: EstadoMejora; objetivo: string | null; causa_raiz: string | null; plan: string | null;
  responsable_id: string | null; responsable: string | null; fecha_compromiso: string | null; resultado: string | null;
  ahorro_horas_mes: number | null; foto_antes: string | null; foto_despues: string | null; motivo_descarte: string | null;
  propuesta_por: string | null; propuso: string | null; propuesta_en: string; en_marcha_en: string | null; hecha_en: string | null;
  descartada_en: string | null; vencida: boolean;
  origen: "piso" | "maquina" | null; origen_tipo: string | null; origen_nota: string | null; origen_en: string | null;
  origen_orden_id: string | null; origen_folio: string | null; origen_maquina_id: string | null; origen_maquina: string | null;
  origen_falla: string | null;
}
/** Un problema del piso que todavía no tiene mejora (lo dice la base). */
export interface ProblemaPiso {
  fuente: "piso" | "maquina"; evento_id: number | null; mantenimiento_id: string | null; en: string; tipo: string; nota: string | null;
  etapa_id: number | null; etapa: string | null; etapa_color: string | null; folio: string | null; equipo: string | null;
  orden_id: string | null; maquina: string | null;
}

// Los ocho desperdicios de lean, con palabras del taller.
export const DESPERDICIOS = [
  { valor: "espera", texto: "Espera" },
  { valor: "transporte", texto: "Transporte" },
  { valor: "movimiento", texto: "Movimiento de más" },
  { valor: "inventario", texto: "Inventario de más" },
  { valor: "sobreproceso", texto: "Sobreproceso" },
  { valor: "sobreproduccion", texto: "Sobreproducción" },
  { valor: "defectos", texto: "Defectos y retrabajo" },
  { valor: "talento", texto: "Talento no aprovechado" },
] as const;
export const textoDesperdicio = (v: string | null) => DESPERDICIOS.find((d) => d.valor === v)?.texto ?? null;

export const CLAVE_MEJORAS = [...CLAVE, "mejoras"] as const;
export function useMejoras() {
  useTiempoReal("mejoras", [CLAVE_MEJORAS]);
  return useQuery({
    queryKey: [...CLAVE_MEJORAS, "lista"],
    queryFn: () => q<Mejora[]>(supabase.from("v_mejoras").select("*").order("propuesta_en", { ascending: false })),
  });
}
export function useProblemasSinMejora() {
  return useQuery({
    queryKey: [...CLAVE_MEJORAS, "problemas"],
    queryFn: () => q<ProblemaPiso[]>(supabase.rpc("problemas_sin_mejora", { p_dias: 30 })),
  });
}
export function usePersonasMejoras() {
  return useQuery({
    queryKey: [...CLAVE_MEJORAS, "personas"], staleTime: 5 * 60_000,
    queryFn: () => q<{ id: string; nombre: string }[]>(supabase.rpc("personas_mejoras")),
  });
}

/** Sube una foto a la carpeta de la mejora (bucket privado); regresa su ruta. */
export const subirFotoMejora = (mejora: string, archivo: File) => subirImagen("mejoras", mejora, archivo);

/** Una foto del bucket privado, con liga firmada por una hora. */
export function FotoMejora({ ruta, alt, className }: { ruta: string | null; alt: string; className?: string }) {
  const url = useQuery({
    queryKey: [...CLAVE_MEJORAS, "foto", ruta], enabled: !!ruta, staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("mejoras").createSignedUrl(ruta!, 3600);
      if (error || !data) throw new Error("No se pudo abrir la foto");
      return data.signedUrl;
    },
  });
  if (!ruta) return null;
  if (url.error) return <div className={className}><ImageOff className="h-6 w-6 text-tenue" aria-label="Sin foto" /></div>;
  return url.data ? <img src={url.data} alt={alt} className={className} loading="lazy" /> : <div className={className} aria-busy="true" />;
}

export interface Semilla { titulo?: string; problema?: string; etapa?: number | null; evento?: number | null; mantenimiento?: string | null }

/**
 * «Tengo una idea»: lo mínimo para proponer una mejora. Desde la terminal trae el área y el
 * nombre de quien está en la tablet; desde un problema del piso, lo que se reportó.
 */
export function DialogoIdea({ abierto, alCambiar, semilla, quien: quienInicial = "", grande = false, alCrear }: {
  abierto: boolean; alCambiar: (v: boolean) => void; semilla?: Semilla; quien?: string; grande?: boolean; alCrear?: (id: string) => void;
}) {
  const etapas = useEtapas();
  const [titulo, setTitulo] = useState(semilla?.titulo ?? "");
  const [problema, setProblema] = useState(semilla?.problema ?? "");
  const [propuesta, setPropuesta] = useState("");
  const [etapa, setEtapa] = useState<string>(semilla?.etapa ? String(semilla.etapa) : "");
  const [desperdicio, setDesperdicio] = useState("");
  const [quien, setQuien] = useState(quienInicial);
  const proponer = useAccion(() => q<string>(supabase.rpc("proponer_mejora", {
    p_titulo: titulo, p_problema: problema || null, p_propuesta: propuesta || null, p_etapa: etapa ? Number(etapa) : null,
    p_evento: semilla?.evento ?? null, p_mantenimiento: semilla?.mantenimiento ?? null, p_quien: quien || null, p_desperdicio: desperdicio || null,
  })), {
    invalidar: [CLAVE_MEJORAS], exito: "Gracias: tu idea ya le llegó a quien decide las mejoras",
    alTerminar: (id) => { alCambiar(false); alCrear?.(id); },
  });
  const texto = grande ? "text-lg" : undefined;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={semilla?.evento || semilla?.mantenimiento ? "Volver este problema una mejora" : "Tengo una idea"}
      descripcion="Una mejora es cualquier cambio que quite trabajo de más, esperas, vueltas o retrabajos. Con una línea basta."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="form-idea" disabled={titulo.trim().length < 3 || proponer.isPending}>{proponer.isPending ? "Enviando…" : "Proponer"}</Boton>
      </>}>
      <form id="form-idea" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (titulo.trim().length >= 3) proponer.mutate(undefined); }}>
        <Campo etiqueta="¿Qué se puede mejorar?">
          <Entrada autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} required className={texto}
            placeholder="Ej.: un carrito para mover las placas" />
        </Campo>
        <Campo etiqueta="¿Qué pasa hoy?" ayuda="Opcional: qué estorba, cuánto tiempo se pierde.">
          <AreaTexto rows={2} value={problema} onChange={(e) => setProblema(e.target.value)} className={texto} />
        </Campo>
        <Campo etiqueta="¿Qué propones?" ayuda="Opcional: si ya tienes la idea de cómo arreglarlo.">
          <AreaTexto rows={2} value={propuesta} onChange={(e) => setPropuesta(e.target.value)} className={texto} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Área">
            <Seleccion value={etapa} onChange={(e) => setEtapa(e.target.value)} className={texto}>
              <option value="">Todo el taller</option>
              {(etapas.data ?? []).map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="¿Qué se desperdicia?">
            <span data-explain={GLOSARIO.desperdicioLean} data-explain-title="Desperdicio" className="block">
              <Seleccion value={desperdicio} onChange={(e) => setDesperdicio(e.target.value)} className={texto}>
                <option value="">No sé / varios</option>
                {DESPERDICIOS.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}
              </Seleccion>
            </span>
          </Campo>
        </div>
        <Campo etiqueta="¿De quién es la idea?" ayuda="Para reconocerle la idea. Vacío: tu nombre.">
          <Entrada value={quien} onChange={(e) => setQuien(e.target.value)} maxLength={80} className={texto} />
        </Campo>
      </form>
    </Dialogo>
  );
}

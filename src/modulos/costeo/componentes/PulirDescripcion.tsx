import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { mensajeError } from "@/lib/consultas";
import { pulirDescripcion } from "@/lib/asistente";
import { GLOSARIO } from "@/tutorial/glosario";

/**
 * «Pulir redacción»: Claude corrige ortografía, acentos y estilo de la descripción que sale
 * en las cotizaciones. No guarda solo: enseña el antes y la propuesta (que se puede retocar)
 * y lo que le pareció un error de dato sin cambiarlo. Quien edita decide si la usa.
 */
export function PulirDescripcion({ leer, nombre, tipo, alUsar }: {
  leer: () => string; nombre: string; tipo: string; alUsar: (texto: string) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [propuesta, setPropuesta] = useState<{ antes: string; texto: string; dudas: string[] } | null>(null);

  async function pulir() {
    const antes = leer().trim();
    if (!antes) { toast.info("Escribe primero la descripción y luego la pules."); return; }
    setCargando(true);
    try {
      const r = await pulirDescripcion(antes, nombre, tipo);
      if (r.texto.trim() === antes && !r.dudas.length) toast.success("La redacción ya estaba bien: no hubo nada que cambiar.");
      else setPropuesta({ antes, texto: r.texto, dudas: r.dudas });
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <span data-explain={GLOSARIO.pulirRedaccion} data-explain-title="Pulir redacción">
        <Boton type="button" variante="fantasma" tamano="sm" onClick={pulir} cargando={cargando}><Sparkles className="h-3.5 w-3.5" /> Pulir redacción</Boton>
      </span>
      {propuesta && (
        <Dialogo abierto alCambiar={(v) => !v && setPropuesta(null)} titulo="Redacción propuesta" ancho="max-w-3xl"
          descripcion="Revísala antes de usarla: puedes retocarla aquí mismo. Los datos técnicos no se cambian."
          pie={<>
            <Boton variante="secundario" onClick={() => setPropuesta(null)}>Dejar como estaba</Boton>
            <Boton onClick={() => { alUsar(propuesta.texto.trim()); setPropuesta(null); }} disabled={!propuesta.texto.trim()}>Usar este texto</Boton>
          </>}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-tenue mb-1">Como está</p>
              <p className="whitespace-pre-wrap text-sm rounded-lg border border-borde bg-fondo p-3 min-h-32">{propuesta.antes}</p>
            </div>
            <div>
              <p className="text-xs text-tenue mb-1">Propuesta</p>
              <textarea className="campo min-h-32 py-2 text-sm w-full" rows={Math.min(14, propuesta.texto.split("\n").length + 2)}
                value={propuesta.texto} onChange={(e) => setPropuesta({ ...propuesta, texto: e.target.value })} />
            </div>
          </div>
          {propuesta.dudas.length > 0 && (
            <div className="mt-3 rounded-lg border border-aviso/30 bg-aviso-suave p-3 text-sm text-aviso flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div><p className="font-medium">Revisa estos datos (no se cambiaron):</p>
                <ul className="list-disc pl-5">{propuesta.dudas.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
            </div>
          )}
        </Dialogo>
      )}
    </>
  );
}

// "Ver como → una persona": dirección y sistemas eligen a alguien y el ERP se abre
// en otra pestaña con la sesión de esa persona, solo para ver (lo que depende de
// quién es: sus pedidos, sus clientes, sus avisos). La función de borde ver-como
// crea la sesión (la base decide si se puede) y la entrega a la pestaña nueva por
// postMessage: nunca pasa por la barra de direcciones ni por el historial.
import { useMemo, useState } from "react";
import { Eye, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRpc } from "@/lib/consultas";
import { NOMBRE_ROL, type Rol } from "@/lib/sesion";
import { RUTA_VISTA_PREVIA, type MensajeVista } from "@/lib/vistaPrevia";
import { coincide } from "@/lib/utilidades";
import { Dialogo } from "@/components/ui/dialogo";
import { Cargando, Vacio } from "@/components/ui/estados";

const URL_VER_COMO = import.meta.env.VITE_VER_COMO_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ver-como`;

interface Persona { id: string; nombre: string; correo: string; roles: Rol[] }

/** Abre la pestaña de inmediato (si espera a la red, el navegador la bloquea) y le pasa la sesión cuando avisa que está lista. */
async function abrirVistaPrevia(usuarioId: string) {
  const ventana = window.open(RUTA_VISTA_PREVIA, "_blank");
  if (!ventana) throw new Error("El navegador bloqueó la pestaña nueva. Permite ventanas emergentes para este sitio y vuelve a intentar.");
  const lista = new Promise<void>((ok, mal) => {
    const tope = setTimeout(() => { window.removeEventListener("message", oir); mal(new Error("La pestaña nueva no respondió. Ciérrala y vuelve a intentar.")); }, 20_000);
    function oir(e: MessageEvent<MensajeVista>) {
      if (e.source !== ventana || e.origin !== window.location.origin || e.data?.tipo !== "vista-previa-lista") return;
      clearTimeout(tope); window.removeEventListener("message", oir); ok();
    }
    window.addEventListener("message", oir);
  });
  try {
    const { data } = await supabase.auth.getSession();
    const r = await fetch(URL_VER_COMO, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: usuarioId }),
    }).catch(() => { throw new Error("No se pudo hablar con el servidor. ¿Está desplegada la función ver-como?"); });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(cuerpo.error ?? `El servidor respondió ${r.status}`);
    await lista;
    const mensaje: MensajeVista = { tipo: "vista-previa-sesion", access_token: cuerpo.access_token, refresh_token: cuerpo.refresh_token };
    ventana.postMessage(mensaje, window.location.origin);
  } catch (e) {
    ventana.close();
    throw e;
  }
}

export function VerComoPersona({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const personas = useRpc<Persona[]>("personas_para_vista_previa", {}, { habilitado: abierto });
  const [filtro, setFiltro] = useState("");
  const [abriendo, setAbriendo] = useState<string | null>(null);

  // Agrupadas por su primer rol, en el orden en que la base las regresa.
  const grupos = useMemo(() => {
    const m = new Map<string, Persona[]>();
    for (const p of personas.data ?? []) {
      if (!coincide(`${p.nombre} ${p.correo} ${p.roles.map((r) => NOMBRE_ROL[r]).join(" ")}`, filtro)) continue;
      const g = NOMBRE_ROL[p.roles[0]] ?? p.roles[0];
      m.set(g, [...(m.get(g) ?? []), p]);
    }
    return [...m.entries()];
  }, [personas.data, filtro]);

  const ver = async (p: Persona) => {
    setAbriendo(p.id);
    try {
      await abrirVistaPrevia(p.id);
      alCambiar(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAbriendo(null);
    }
  };

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Ver el ERP como…" ancho="max-w-xl"
      descripcion="Se abre otra pestaña con la sesión de esa persona: su menú, sus clientes, sus avisos. Solo para ver; la base no deja guardar nada y queda registrado.">
      <div className="space-y-4">
        <label className="flex items-center gap-2 h-9 rounded-lg border border-borde bg-fondo px-3 text-sm">
          <Search className="h-4 w-4 text-tenue" />
          <input autoFocus value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre, correo o rol"
            className="flex-1 bg-transparent outline-none" />
        </label>
        {personas.isLoading && <Cargando filas={4} />}
        {personas.error && <p className="text-sm text-peligro">{(personas.error as Error).message}</p>}
        {personas.data && grupos.length === 0 && (
          <Vacio icono={UserRound} titulo={filtro ? "Nadie coincide con la búsqueda" : "Todavía no hay a quién ver"}
            texto={filtro ? "Prueba con otro nombre o rol." : "Aquí salen las personas activas con algún rol que no sea dirección ni sistemas. Dalas de alta en Sistema → Usuarios."} />
        )}
        {grupos.map(([grupo, gente]) => (
          <div key={grupo}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tenue mb-1">{grupo}</p>
            <ul className="divide-y divide-borde rounded-lg border border-borde">
              {gente.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.nombre}</p>
                    <p className="text-xs text-tenue truncate">{p.correo} · {p.roles.map((r) => NOMBRE_ROL[r] ?? r).join(", ")}</p>
                  </div>
                  <button onClick={() => ver(p)} disabled={!!abriendo}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-borde hover:bg-fondo disabled:opacity-50">
                    <Eye className={abriendo === p.id ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
                    {abriendo === p.id ? "Abriendo…" : "Ver como"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialogo>
  );
}

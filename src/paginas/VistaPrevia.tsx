// La pestaña de "Ver como": espera la sesión que le manda la pestaña que la abrió
// (postMessage, mismo origen) y, mientras dura, una franja que dice de quién es.
import { useEffect, useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSesion, NOMBRE_ROL } from "@/lib/sesion";
import type { MensajeVista } from "@/lib/vistaPrevia";
import { hace } from "@/lib/formato";

/** Sin sesión todavía: avisa a la pestaña que la abrió y espera. */
export function EsperandoVistaPrevia() {
  const [estado, setEstado] = useState<"esperando" | "sin-origen" | "error">(window.opener ? "esperando" : "sin-origen");
  const [error, setError] = useState("");

  useEffect(() => {
    const origen = window.opener as Window | null;
    if (!origen) return;
    const oir = async (e: MessageEvent<MensajeVista>) => {
      if (e.source !== origen || e.origin !== window.location.origin || e.data?.tipo !== "vista-previa-sesion") return;
      clearInterval(aviso);
      const { error: es } = await supabase.auth.setSession({ access_token: e.data.access_token, refresh_token: e.data.refresh_token });
      // Con sesión, la app ya pinta lo de esa persona: la ruta /vista-previa no existe y
      // el comodín de rutas lleva a su Inicio.
      if (es) { setError(es.message); setEstado("error"); }
    };
    window.addEventListener("message", oir);
    // Se repite por si la otra pestaña todavía no escuchaba (la pide antes de que esta cargue).
    const lista: MensajeVista = { tipo: "vista-previa-lista" };
    const decir = () => origen.postMessage(lista, window.location.origin);
    decir();
    const aviso = setInterval(decir, 500);
    const tope = setTimeout(() => { clearInterval(aviso); setEstado((s) => (s === "esperando" ? "sin-origen" : s)); }, 30_000);
    return () => { window.removeEventListener("message", oir); clearInterval(aviso); clearTimeout(tope); };
  }, []);

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="tarjeta max-w-sm w-full p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-marca-suave text-marca flex items-center justify-center mb-3">
          {estado === "esperando" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Eye className="h-6 w-6" />}
        </div>
        {estado === "esperando" && <p className="font-medium">Preparando la vista previa…</p>}
        {estado === "sin-origen" && (
          <>
            <p className="font-medium">Esta vista previa ya terminó</p>
            <p className="text-sm text-tenue mt-1">Ábrela otra vez desde "Ver como…" en tu sesión.</p>
          </>
        )}
        {estado === "error" && (
          <>
            <p className="font-medium">No se pudo abrir la vista previa</p>
            <p className="text-sm text-tenue mt-1">{error}</p>
          </>
        )}
        {estado !== "esperando" && (
          <button onClick={() => window.close()} className="mt-4 h-9 px-4 rounded-lg border border-borde text-sm hover:bg-fondo">Cerrar pestaña</button>
        )}
      </div>
    </div>
  );
}

/** Arriba de todo, mientras dure: de quién es esta sesión y que nada se guarda. */
export function FranjaVistaPrevia() {
  const { perfil, roles, vistaPrevia, salir } = useSesion();
  if (!vistaPrevia) return null;
  return (
    <div className="no-imprimir shrink-0 flex items-center gap-3 px-4 lg:px-8 py-2 bg-aviso-suave text-aviso border-b border-aviso/25 text-sm">
      <Eye className="h-4 w-4 shrink-0" />
      <p className="flex-1 min-w-0">
        <span className="font-semibold">Vista previa:</span> así ve el ERP <span className="font-semibold">{perfil?.nombre}</span>
        {roles.length > 0 && <> ({roles.map((r) => NOMBRE_ROL[r]).join(", ")})</>}. Solo para ver: nada se guarda.
        <span className="hidden md:inline text-aviso/80"> La abrió {vistaPrevia.abierta_por} {hace(vistaPrevia.desde)}.</span>
      </p>
      <button onClick={salir} className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-aviso/30 hover:bg-aviso/10 font-medium">
        <X className="h-3.5 w-3.5" />Terminar
      </button>
    </div>
  );
}

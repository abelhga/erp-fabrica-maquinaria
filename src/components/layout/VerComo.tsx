import { useState, type ReactNode } from "react";
import * as P from "@radix-ui/react-popover";
import { Check, Eye, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useSesion, NOMBRE_ROL, type Rol } from "@/lib/sesion";
import { mensajeError } from "@/lib/consultas";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/utilidades";
import { ROLES } from "@/modulos/sistema/componentes/comun";

// "Ver como": dirección prueba el ERP con los permisos de otro rol. No es un
// disfraz del menú: la base (mis_roles) aplica el rol elegido en toda la RLS,
// así que lo que se ve aquí es lo que vería alguien nuevo con ese rol.

function useCambiarRol() {
  const { verComo } = useSesion();
  const [cambiando, setCambiando] = useState<Rol | "propia" | null>(null);
  async function elegir(r: Rol | null) {
    setCambiando(r ?? "propia");
    try { await verComo(r); return true; }
    catch (e) { toast.error(mensajeError(e)); return false; }
    finally { setCambiando(null); }
  }
  return { cambiando, elegir };
}

function SelectorRol({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  const { viendoComo } = useSesion();
  const { cambiando, elegir } = useCambiarRol();
  const [abierto, setAbierto] = useState(false);
  const ir = async (r: Rol | null) => { if (await elegir(r)) setAbierto(false); };

  return (
    <P.Root open={abierto} onOpenChange={setAbierto}>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        {/* Por encima del aviso flotante y de la pantalla del taller, y con cursor: la TV lo esconde. */}
        <P.Content align={align} sideOffset={8} style={{ cursor: "auto" }}
          className="z-[70] w-[min(380px,calc(100vw-24px))] tarjeta shadow-xl overflow-hidden animate-entrar">
          <div className="px-4 py-3 border-b border-borde">
            <p className="font-semibold text-sm">Ver el ERP como…</p>
            <p className="text-xs text-tenue mt-0.5">
              Menú, pantallas y datos de ese rol, con los permisos que pone la base. Lo que guardes mientras tanto es real y queda a tu nombre.
            </p>
          </div>
          <div className="max-h-[min(420px,55vh)] overflow-y-auto py-1">
            {ROLES.filter((r) => r.rol !== "direccion").map((r) => {
              const actual = viendoComo === r.rol;
              return (
                <button key={r.rol} onClick={() => ir(r.rol)} disabled={!!cambiando || actual}
                  className={cn("w-full text-left flex gap-3 px-4 py-2 transition-colors hover:bg-fondo disabled:cursor-default",
                    actual && "bg-marca-suave/60 hover:bg-marca-suave/60", cambiando && !actual && "opacity-60")}>
                  <span className="w-4 shrink-0 pt-0.5 text-marca-texto">
                    {cambiando === r.rol ? <Loader2 className="h-4 w-4 animate-spin" /> : actual && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{NOMBRE_ROL[r.rol]}</span>
                    <span className="block text-xs text-tenue leading-snug">{r.descripcion}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {viendoComo && (
            <button onClick={() => ir(null)} disabled={!!cambiando}
              className="w-full h-11 border-t border-borde text-sm text-marca-texto font-medium hover:bg-fondo inline-flex items-center justify-center gap-2">
              {cambiando === "propia" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Volver a mi vista
            </button>
          )}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/** Botón de la barra de arriba. Lo ve quien es dirección de verdad, aunque esté viendo como otro rol. */
export function BotonVerComo() {
  const { rolesReales, viendoComo } = useSesion();
  if (!rolesReales.includes("direccion")) return null;
  return (
    <SelectorRol>
      <button aria-label="Ver el ERP como otro rol" title="Ver el ERP como otro rol"
        className={cn("h-9 px-2 rounded-lg hover:bg-fondo inline-flex items-center gap-1.5 text-sm",
          viendoComo ? "text-aviso" : "text-tenue")}>
        <Eye className="h-5 w-5" />
        <span className="hidden md:inline">Ver como</span>
      </button>
    </SelectorRol>
  );
}

/**
 * Aviso mientras dirección ve como otro rol: sin él, un rato después se olvida y
 * parece que el ERP "perdió" los costos. En el marco normal es una franja arriba;
 * en la TV del taller, la terminal y las hojas para imprimir, que ocupan toda la
 * pantalla, flota abajo (y no sale en papel).
 */
export function AvisoVerComo({ flotante = false }: { flotante?: boolean }) {
  const { viendoComo } = useSesion();
  const { cambiando, elegir } = useCambiarRol();
  if (!viendoComo) return null;
  const rol = NOMBRE_ROL[viendoComo];

  if (flotante) {
    return (
      <div role="status" style={{ cursor: "auto" }}
        className="no-imprimir fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-max max-w-[calc(100vw-24px)] flex flex-wrap items-center justify-center gap-2 rounded-xl border border-aviso/40 bg-aviso-suave px-3 py-2 text-sm text-texto shadow-xl">
        <Eye className="h-4 w-4 text-aviso shrink-0" />
        <span>Viendo como <b>{rol}</b></span>
        <SelectorRol align="center"><Boton variante="secundario" tamano="sm">Cambiar</Boton></SelectorRol>
        <Boton tamano="sm" cargando={cambiando === "propia"} onClick={() => elegir(null)}>Volver a mi vista</Boton>
      </div>
    );
  }
  return (
    <div role="status" className="no-imprimir shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 lg:px-8 py-2 bg-aviso-suave border-b border-aviso/30 text-sm text-texto">
      <Eye className="h-4 w-4 text-aviso shrink-0" />
      {/* Con base de 14rem los botones bajan a su renglón en celular en vez de partir el texto palabra por palabra. */}
      <p className="min-w-0 flex-1 basis-56">
        <b>Estás viendo el ERP como {rol}.</b>{" "}
        <span className="hidden sm:inline text-texto/80">Menú y datos son los de ese rol; lo que guardes es real y queda a tu nombre.</span>
      </p>
      <div className="flex items-center gap-2">
        <SelectorRol><Boton variante="secundario" tamano="sm">Cambiar de rol</Boton></SelectorRol>
        <Boton tamano="sm" cargando={cambiando === "propia"} onClick={() => elegir(null)}>
          {cambiando !== "propia" && <Undo2 className="h-3.5 w-3.5" />}Volver a mi vista
        </Boton>
      </div>
    </div>
  );
}

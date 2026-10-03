import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Lock } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/estados";
import { useSesion, NOMBRE_ROL, type Modulo, type Rol } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { MODULOS, NIVELES, ROLES } from "./comun";

interface Permiso { rol: Rol; modulo: Modulo; nivel: number }

const TONO_NIVEL = ["text-tenue", "bg-info-suave text-info", "bg-marca-suave text-marca-texto", "bg-ok-suave text-ok"];

/** Rol × módulo. La edita solo dirección (la RLS de permisos_rol), y dirección no se puede bajar a sí misma. */
export function MatrizPermisos() {
  const { tieneRol, recargar } = useSesion();
  const editable = tieneRol("direccion");
  const [confirmar, setConfirmar] = useState<Permiso | null>(null);
  const permisos = useQuery({
    queryKey: ["permisos_rol"],
    queryFn: () => q<Permiso[]>(supabase.from("permisos_rol").select("rol, modulo, nivel")),
  });
  const nivel = (rol: Rol, modulo: Modulo) => permisos.data?.find((p) => p.rol === rol && p.modulo === modulo)?.nivel ?? 0;

  const guardar = useAccion(async (p: Permiso) => {
    if (p.nivel === 0) await q(supabase.from("permisos_rol").delete().eq("rol", p.rol).eq("modulo", p.modulo));
    else await q(supabase.from("permisos_rol").upsert(p));
  }, {
    exito: "Permiso cambiado. Cada quien lo verá al recargar el ERP.",
    invalidar: [["permisos_rol"]],
    alTerminar: () => { setConfirmar(null); recargar(); },
  });

  function cambiar(p: Permiso) {
    // Dar costos a un rol que no los tenía abre los márgenes a toda esa gente: se confirma.
    if (p.modulo === "costos" && p.nivel > 0 && nivel(p.rol, "costos") === 0) setConfirmar(p);
    else guardar.mutate(p);
  }

  if (permisos.isLoading) return <Cargando filas={8} />;
  return (
    <div className="space-y-4">
      {!editable && (
        <p className="flex items-center gap-2 text-sm rounded-lg border border-borde bg-fondo px-3 py-2 text-tenue">
          <Lock className="h-4 w-4" /> Solo dirección cambia esta tabla. Aquí se puede consultar qué ve cada rol.
        </p>
      )}
      <div className="rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm text-aviso flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span><b>Costos</b> es aparte de Ingeniería: {MODULOS.find((m) => m.modulo === "costos")!.alerta}</span>
      </div>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th className="w-[120px] sticky left-0 z-20">Rol</th>
              {MODULOS.map((m) => (
                <th key={m.modulo} title={m.descripcion} className={cn("!text-center whitespace-nowrap !px-1.5", m.modulo === "costos" && "!bg-aviso-suave !text-aviso")}>
                  {m.modulo === "rrhh" ? "RR. HH." : m.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.rol}>
                <td className="sticky left-0 bg-superficie z-10 font-medium leading-tight w-[120px]" title={r.descripcion}>{NOMBRE_ROL[r.rol]}</td>
                {MODULOS.map((m) => {
                  const n = nivel(r.rol, m.modulo);
                  const fija = r.rol === "direccion";
                  return (
                    <td key={m.modulo} className={cn("text-center !px-1 !py-1.5", m.modulo === "costos" && "bg-aviso-suave/40")}>
                      {editable && !fija ? (
                        <select value={n} aria-label={`${NOMBRE_ROL[r.rol]} en ${m.nombre}`}
                          onChange={(e) => cambiar({ rol: r.rol, modulo: m.modulo, nivel: Number(e.target.value) })}
                          className={cn("h-7 w-[98px] rounded-md border border-borde pl-1.5 pr-0 text-xs font-medium bg-superficie", n > 0 && TONO_NIVEL[n])}>
                          {NIVELES.map((x) => <option key={x.nivel} value={x.nivel}>{x.texto}</option>)}
                        </select>
                      ) : (
                        <span className={cn("inline-block rounded-md px-2 py-1 text-xs font-medium", n > 0 ? TONO_NIVEL[n] : "text-tenue")}
                          title={fija ? "Dirección siempre tiene todo" : undefined}>
                          {NIVELES[n].texto}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {MODULOS.map((m) => (
          <div key={m.modulo} className={cn("rounded-lg border p-3", m.alerta ? "border-aviso/30 bg-aviso-suave/50" : "border-borde")}>
            <p className="font-medium">{m.nombre}</p>
            <p className="text-tenue text-xs mt-0.5">{m.descripcion}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-tenue">
        Niveles: {NIVELES.slice(1).map((n) => `${n.nivel} = ${n.largo}`).join(" · ")}. El menú se arma con esto y la base de datos lo hace cumplir:
        aunque alguien llame a la API directo, solo recibe lo que su rol permite. Cada cambio queda en la bitácora.
      </p>

      <Dialogo abierto={!!confirmar} alCambiar={(v) => !v && setConfirmar(null)} titulo="¿Dar acceso a costos?"
        descripcion={confirmar && `${NOMBRE_ROL[confirmar.rol]} pasará a ver costos y márgenes.`}
        pie={<>
          <Boton variante="secundario" onClick={() => setConfirmar(null)}>Cancelar</Boton>
          <Boton variante="peligro" cargando={guardar.isPending} onClick={() => confirmar && guardar.mutate(confirmar)}>Sí, dar acceso</Boton>
        </>}>
        <p className="text-sm">
          Toda persona con el rol <b>{confirmar && NOMBRE_ROL[confirmar.rol]}</b> verá lo que cuesta fabricar cada equipo, el costo de cada
          componente y la utilidad de cada precio. Es la información que hoy se filtra cuando alguien comparte la hoja de costeo.
        </p>
      </Dialogo>
    </div>
  );
}

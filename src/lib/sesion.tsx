import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Rol =
  | "direccion" | "admin" | "gerente_ventas" | "ventas" | "ingenieria" | "compras" | "almacen"
  | "gerente_produccion" | "produccion" | "rrhh" | "finanzas" | "pantalla"
  | "importaciones";

export const NOMBRE_ROL: Record<Rol, string> = {
  direccion: "Dirección", admin: "Sistemas", gerente_ventas: "Gerencia de ventas", ventas: "Ventas",
  ingenieria: "Ingeniería", compras: "Compras", almacen: "Almacén", gerente_produccion: "Gerencia de producción",
  produccion: "Producción", rrhh: "Recursos humanos", finanzas: "Finanzas", pantalla: "Pantalla de piso",
  importaciones: "Importaciones",
};

export type Modulo = "ventas" | "costeo" | "costos" | "compras" | "inventario" | "produccion" | "rrhh" | "finanzas" | "admin" | "asistente"
  | "importaciones";

export interface Perfil { id: string; nombre: string; correo: string; puesto: string | null; iniciales: string | null; activo: boolean; telefono: string | null }

interface Sesion {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  roles: Rol[];
  permisos: Partial<Record<Modulo, number>>;
  /** ¿Puede el usuario actual hacer esto? 1 = ver, 2 = editar, 3 = administrar. Espejo de public.puede() en la base. */
  puede: (m: Modulo, nivel?: number) => boolean;
  tieneRol: (r: Rol) => boolean;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}

const Ctx = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [datos, setDatos] = useState<{ perfil: Perfil | null; roles: Rol[]; permisos: Sesion["permisos"] }>({ perfil: null, roles: [], permisos: {} });
  const [cargando, setCargando] = useState(true);

  const cargarDatos = useCallback(async (s: Session | null) => {
    if (!s) { setDatos({ perfil: null, roles: [], permisos: {} }); return; }
    const { data, error } = await supabase.rpc("mi_sesion");
    if (error || !data) { setDatos({ perfil: null, roles: [], permisos: {} }); return; }
    setDatos({ perfil: data.perfil, roles: data.roles ?? [], permisos: data.permisos ?? {} });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarDatos(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      // Al refrescar el token no cambian los roles; no hace falta volver a pedirlos.
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
        setTimeout(() => cargarDatos(s), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarDatos]);

  const valor = useMemo<Sesion>(() => ({
    cargando, session, ...datos,
    puede: (m, nivel = 1) => (datos.permisos[m] ?? 0) >= nivel,
    tieneRol: (r) => datos.roles.includes(r),
    recargar: () => cargarDatos(session),
    salir: async () => { await supabase.auth.signOut(); },
  }), [cargando, session, datos, cargarDatos]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSesion fuera de ProveedorSesion");
  return s;
}

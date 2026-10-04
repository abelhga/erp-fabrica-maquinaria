import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { EN_VISTA_PREVIA, supabase } from "./supabase";

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
  // objetivos: calificar (1 = jefe de su gente, 3 = RRHH y dirección); nomina: todo lo que tiene pesos;
  // mi_desempeno no es de rol: lo da mi_sesion() a quien tiene ficha de empleado ligada.
  | "objetivos" | "nomina" | "mi_desempeno"
  | "importaciones"
  | "envios"
  | "servicio"
  // analisis: el BI de dirección (mapa, tendencias, clientes, producto, metas). Sin costos.
  | "analisis";

export interface Perfil { id: string; nombre: string; correo: string; puesto: string | null; iniciales: string | null; activo: boolean; telefono: string | null }
/** "Ver como": esta sesión es de otra persona, abierta por dirección o sistemas, solo para ver. */
export interface VistaPrevia { abierta_por: string; desde: string }

interface Sesion {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  /** Los roles con los que se arma todo. Mientras dirección ve el ERP como otro rol, es solo ese rol. */
  roles: Rol[];
  /** Los de verdad, sin simulación: deciden si se ofrece "Ver como". */
  rolesReales: Rol[];
  /** El rol que dirección está simulando, o null. La base lo aplica en la RLS, no solo en el menú. */
  viendoComo: Rol | null;
  permisos: Partial<Record<Modulo, number>>;
  /** Esta pestaña es la sesión de otra persona abierta con "Ver como → una persona" (solo para ver). */
  vistaPrevia: VistaPrevia | null;
  /** ¿Puede el usuario actual hacer esto? 1 = ver, 2 = editar, 3 = administrar. Espejo de public.puede() en la base. */
  puede: (m: Modulo, nivel?: number) => boolean;
  tieneRol: (r: Rol) => boolean;
  /** Solo dirección. null regresa a la vista propia. */
  verComo: (r: Rol | null) => Promise<void>;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}

type Datos = Pick<Sesion, "perfil" | "roles" | "rolesReales" | "viendoComo" | "permisos" | "vistaPrevia">;
const SIN_DATOS: Datos = { perfil: null, roles: [], rolesReales: [], viendoComo: null, permisos: {}, vistaPrevia: null };

const Ctx = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [datos, setDatos] = useState<Datos>(SIN_DATOS);
  const [cargando, setCargando] = useState(true);
  const qc = useQueryClient();

  const cargarDatos = useCallback(async (s: Session | null) => {
    if (!s) { setDatos(SIN_DATOS); return; }
    const { data, error } = await supabase.rpc("mi_sesion");
    if (error || !data) { setDatos(SIN_DATOS); return; }
    setDatos({
      perfil: data.perfil, roles: data.roles ?? [], rolesReales: data.roles_reales ?? data.roles ?? [],
      viendoComo: data.viendo_como ?? null, permisos: data.permisos ?? {}, vistaPrevia: data.vista_previa ?? null,
    });
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

  // Al cambiar de rol con "ver como", lo que ya estaba en pantalla se leyó con los
  // permisos de antes: en caché, "ventas" vería un rato los costos que bajó
  // dirección. Se vacía en un efecto, ya con la pantalla del rol nuevo armada:
  // hacerlo justo después de pedir la sesión recargaba los tableros de dirección
  // que aún no se desmontaban, y la base los rechazaba (403 en consola).
  const rolVisto = useRef<Rol | null | undefined>(undefined);
  useEffect(() => {
    if (cargando) return;
    if (rolVisto.current !== undefined && rolVisto.current !== datos.viendoComo) qc.resetQueries();
    rolVisto.current = datos.viendoComo;
  }, [cargando, datos.viendoComo, qc]);

  const valor = useMemo<Sesion>(() => ({
    cargando, session, ...datos,
    puede: (m, nivel = 1) => (datos.permisos[m] ?? 0) >= nivel,
    tieneRol: (r) => datos.roles.includes(r),
    verComo: async (r) => {
      // Lo que se está pidiendo con el rol de ahora llegaría a la base ya con el nuevo
      // y la RLS lo rechazaría (el mapa del tablero de dirección daba 403 si se cambiaba
      // de rol mientras cargaba). Se espera a que termine, máximo 4 s.
      const limite = Date.now() + 4000;
      while (qc.isFetching() > 0 && Date.now() < limite) await new Promise((ok) => setTimeout(ok, 100));
      const { error } = await supabase.rpc("ver_como", { p_rol: r });
      if (error) throw new Error(error.message);
      await cargarDatos(session);
    },
    recargar: () => cargarDatos(session),
    // En una vista previa solo se cierra ESTA sesión ("local"): las de la otra persona
    // en sus propios equipos siguen abiertas. Y la pestaña ya no sirve para nada.
    salir: async () => {
      if (EN_VISTA_PREVIA) { await supabase.auth.signOut({ scope: "local" }); window.close(); return; }
      await supabase.auth.signOut();
    },
  }), [cargando, session, datos, cargarDatos, qc]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSesion fuera de ProveedorSesion");
  return s;
}

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Power, ShieldCheck, UserCheck, UserRound } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Insignia } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Lateral } from "@/components/ui/dialogo";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion, NOMBRE_ROL, type Rol } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hace } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { ROLES } from "./componentes/comun";
import { Invitaciones } from "./componentes/Invitaciones";
import { MatrizPermisos } from "./componentes/MatrizPermisos";

export interface UsuarioSistema {
  id: string; nombre: string; correo: string; puesto: string | null; iniciales: string | null; activo: boolean; roles: Rol[];
  ultimo_acceso: string | null; creado_en: string; metodo: string; empleado_id: string | null; empleado: string | null; empleado_activo: boolean | null;
}

type Vista = "todos" | "sin_rol" | "inactivos" | "alerta";

export default function Usuarios() {
  const [params, setParams] = useSearchParams();
  const pestana = params.get("vista") ?? "usuarios";
  const [vista, setVista] = useState<Vista>("todos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const usuarios = useQuery({ queryKey: ["lista_usuarios"], queryFn: () => q<UsuarioSistema[]>(supabase.rpc("lista_usuarios")) });
  const invitaciones = useQuery({
    queryKey: ["invitaciones", "cuenta"],
    queryFn: async () => { const { count } = await supabase.from("invitaciones").select("correo", { count: "exact", head: true }); return count ?? 0; },
  });

  const todos = usuarios.data ?? [];
  const sinRol = todos.filter((u) => u.activo && u.roles.length === 0);
  const inactivos = todos.filter((u) => !u.activo);
  // Alguien que ya no trabaja aquí y sigue pudiendo entrar: lo primero que hay que cerrar.
  const alerta = todos.filter((u) => u.activo && u.empleado_id && u.empleado_activo === false);
  const filas = vista === "sin_rol" ? sinRol : vista === "inactivos" ? inactivos : vista === "alerta" ? alerta : todos;
  const sel = todos.find((u) => u.id === abierto) ?? null;

  const columnas: Columna<UsuarioSistema>[] = [
    {
      clave: "nombre", titulo: "Usuario", valor: (u) => `${u.nombre} ${u.correo}`,
      celda: (u) => (
        <div className="flex items-center gap-3 min-w-[220px]">
          <span className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
            u.activo ? "bg-marca text-white" : "bg-fondo text-tenue border border-borde")}>
            {u.iniciales || u.nombre.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className={cn("font-medium truncate", !u.activo && "text-tenue line-through")}>{u.nombre}</p>
            <p className="text-xs text-tenue truncate">{u.correo}</p>
          </div>
        </div>
      ),
    },
    {
      clave: "roles", titulo: "Roles", valor: (u) => u.roles.map((r) => NOMBRE_ROL[r]).join(", "),
      celda: (u) => u.roles.length ? (
        <div className="flex flex-wrap gap-1 max-w-[320px]">
          {u.roles.map((r) => <Insignia key={r} tono={r === "direccion" ? "peligro" : r === "admin" ? "info" : r === "pantalla" ? "neutro" : "marca"}>{NOMBRE_ROL[r]}</Insignia>)}
        </div>
      ) : <Insignia tono="aviso" punto>Espera rol</Insignia>,
    },
    {
      clave: "activo", titulo: "Estado", valor: (u) => (u.activo ? "Activo" : "Desactivado"),
      celda: (u) => (
        <div className="flex flex-col items-start gap-1">
          {u.activo ? <Insignia tono="ok" punto>Activo</Insignia> : <Insignia>Desactivado</Insignia>}
          {u.activo && u.empleado_activo === false && <Insignia tono="peligro">Empleado dado de baja</Insignia>}
        </div>
      ),
    },
    {
      clave: "ultimo_acceso", titulo: "Último acceso", sinBusqueda: true, valor: (u) => u.ultimo_acceso,
      celda: (u) => u.ultimo_acceso ? <span title={fechaYHora(u.ultimo_acceso)} className="whitespace-nowrap">{hace(u.ultimo_acceso)}</span> : <span className="text-tenue">Nunca</span>,
    },
    { clave: "metodo", titulo: "Entra con", valor: (u) => (u.metodo === "google" ? "Google" : "Contraseña"), celda: (u) => <span className="text-tenue">{u.metodo === "google" ? "Google" : "Contraseña"}</span> },
    { clave: "empleado", titulo: "Empleado", valor: (u) => u.empleado ?? "", celda: (u) => u.empleado ?? <span className="text-tenue">—</span> },
  ];

  return (
    <Pagina titulo="Usuarios y permisos" descripcion="Quién entra al ERP, con qué roles, y qué puede hacer cada rol.">
      <Pestanas value={pestana} onValueChange={(v) => setParams(v === "usuarios" ? {} : { vista: v }, { replace: true })}>
        <ListaPestanas opciones={[
          { valor: "usuarios", texto: "Usuarios", cuenta: todos.length },
          { valor: "invitaciones", texto: "Invitaciones y pantallas", cuenta: invitaciones.data ?? undefined },
          { valor: "permisos", texto: "Permisos por rol" },
        ]} />
        <ContenidoPestana value="usuarios" className="pt-4 space-y-3">
          {alerta.length > 0 && (
            <button onClick={() => setVista("alerta")} className="w-full text-left rounded-lg border border-peligro/30 bg-peligro-suave px-3 py-2 text-sm text-peligro flex items-center gap-2">
              <Power className="h-4 w-4 shrink-0" />
              {alerta.length === 1 ? `${alerta[0].nombre} ya no trabaja aquí y su cuenta sigue activa.` : `${alerta.length} personas dadas de baja en RRHH siguen con su cuenta activa.`} Desactívala.
            </button>
          )}
          <TablaDatos
            filas={filas} columnas={columnas} cargando={usuarios.isLoading} error={usuarios.error}
            claveFila={(u) => u.id} alClicFila={(u) => setAbierto(u.id)} exportarComo="usuarios" placeholder="Buscar nombre, correo o rol…"
            claseFila={(u) => (u.activo ? undefined : "opacity-70")}
            filtros={<Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
              { valor: "todos", texto: "Todos", cuenta: todos.length },
              { valor: "sin_rol", texto: "Esperan rol", cuenta: sinRol.length },
              { valor: "inactivos", texto: "Desactivados", cuenta: inactivos.length },
              ...(alerta.length ? [{ valor: "alerta" as Vista, texto: "Bajas con acceso", cuenta: alerta.length }] : []),
            ]} />}
            vacio={{ icono: UserRound, titulo: vista === "sin_rol" ? "Nadie espera rol" : "Sin usuarios", texto: vista === "sin_rol" ? "Cuando alguien de la empresa entre por primera vez con Google, aparecerá aquí para que le asignes su rol." : undefined }}
          />
        </ContenidoPestana>
        <ContenidoPestana value="invitaciones" className="pt-4">
          <Invitaciones usuarios={todos} />
        </ContenidoPestana>
        <ContenidoPestana value="permisos" className="pt-4">
          <MatrizPermisos />
        </ContenidoPestana>
      </Pestanas>
      <FichaUsuario usuario={sel} alCerrar={() => setAbierto(null)} />
    </Pagina>
  );
}

function FichaUsuario({ usuario: u, alCerrar }: { usuario: UsuarioSistema | null; alCerrar: () => void }) {
  const { perfil, tieneRol, puede } = useSesion();
  const yo = u?.id === perfil?.id;
  const esDireccion = tieneRol("direccion");
  const cambiarRol = useAccion(async ({ rol, dar }: { rol: Rol; dar: boolean }) => {
    if (dar) await q(supabase.from("usuario_roles").insert({ usuario_id: u!.id, rol }));
    else await q(supabase.from("usuario_roles").delete().eq("usuario_id", u!.id).eq("rol", rol));
  }, { invalidar: [["lista_usuarios"]] });
  const activar = useAccion(() => q(supabase.from("perfiles").update({ activo: !u!.activo }).eq("id", u!.id)), {
    exito: u?.activo ? "Cuenta desactivada: ya no puede entrar a nada" : "Cuenta reactivada", invalidar: [["lista_usuarios"]],
  });
  const tocaDireccion = u?.roles.includes("direccion") && !esDireccion;

  return (
    <Lateral abierto={!!u} alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl" titulo={u?.nombre ?? ""}
      subtitulo={u && <span>{u.correo}{u.puesto ? ` · ${u.puesto}` : ""}</span>}>
      {u && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-borde p-3"><p className="text-xs text-tenue">Último acceso</p><p className="font-medium">{u.ultimo_acceso ? fechaYHora(u.ultimo_acceso) : "Nunca ha entrado"}</p></div>
            <div className="rounded-xl border border-borde p-3"><p className="text-xs text-tenue">Cuenta creada</p><p className="font-medium">{fecha(u.creado_en)} · {u.metodo === "google" ? "Google" : "contraseña"}</p></div>
          </div>
          {u.empleado && (
            <p className="text-sm">
              Es <b>{u.empleado}</b> en Personal{u.empleado_activo === false && <span className="text-peligro"> (dado de baja)</span>}.
              {puede("rrhh") && <Link className="text-marca-texto ml-1" to={`/rrhh/empleados?empleado=${u.empleado_id}`}>Ver ficha</Link>}
            </p>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-tenue" /> Roles</h4>
              {cambiarRol.isPending && <span className="text-xs text-tenue">Guardando…</span>}
            </div>
            {yo && <p className="text-sm rounded-lg bg-fondo border border-borde px-3 py-2 text-tenue">Es tu cuenta: tus roles los cambia otra persona de sistemas o dirección.</p>}
            <ul className="rounded-xl border border-borde divide-y divide-borde">
              {ROLES.map((r) => {
                const tiene = u.roles.includes(r.rol);
                const bloqueado = yo || (r.rol === "direccion" && !esDireccion);
                return (
                  <li key={r.rol}>
                    <label className={cn("flex items-start gap-3 px-3 py-2.5", bloqueado ? "opacity-60" : "cursor-pointer hover:bg-fondo")}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--marca))]" checked={tiene} disabled={bloqueado || cambiarRol.isPending}
                        onChange={(e) => cambiarRol.mutate({ rol: r.rol, dar: e.target.checked })} />
                      <span>
                        <span className="text-sm font-medium">{NOMBRE_ROL[r.rol]}</span>
                        {r.rol === "direccion" && !esDireccion && <span className="text-xs text-tenue"> · solo dirección lo da</span>}
                        <span className="block text-xs text-tenue">{r.descripcion}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-tenue">Los cambios valen desde que la persona recarga el ERP. Quedan en la bitácora.</p>
          </section>

          <section className="rounded-xl border border-borde p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium flex items-center gap-2">{u.activo ? <UserCheck className="h-4 w-4 text-ok" /> : <KeyRound className="h-4 w-4 text-tenue" />} {u.activo ? "Cuenta activa" : "Cuenta desactivada"}</p>
              <p className="text-tenue text-xs mt-0.5">{u.activo ? "Al desactivarla pierde todos sus permisos al instante, aunque tenga la sesión abierta." : "No puede ver ni hacer nada. Sus roles se conservan para cuando regrese."}</p>
            </div>
            <Boton variante={u.activo ? "peligro" : "exito"} tamano="sm" disabled={yo || tocaDireccion} cargando={activar.isPending}
              title={yo ? "No puedes desactivar tu propia cuenta" : tocaDireccion ? "Solo dirección desactiva a dirección" : undefined}
              onClick={() => activar.mutate(undefined)}>
              <Power className="h-4 w-4" /> {u.activo ? "Desactivar" : "Reactivar"}
            </Boton>
          </section>
        </div>
      )}
    </Lateral>
  );
}

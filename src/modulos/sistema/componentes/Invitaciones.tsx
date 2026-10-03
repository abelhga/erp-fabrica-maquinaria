import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Copy, Info, MailPlus, Monitor, RefreshCw, Trash2 } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Dialogo } from "@/components/ui/dialogo";
import { Cargando, Vacio } from "@/components/ui/estados";
import { useSesion, NOMBRE_ROL, type Rol } from "@/lib/sesion";
import { supabase, DOMINIO_EMPRESA } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { ROLES, contrasenaNueva } from "./comun";

interface Invitacion { correo: string; nombre: string | null; roles: Rol[]; creado_en: string; invitado_por: string | null }

export function SelectorRoles({ valor, alCambiar, deshabilitados = [] }: { valor: Rol[]; alCambiar: (r: Rol[]) => void; deshabilitados?: Rol[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLES.map((r) => {
        const activo = valor.includes(r.rol);
        const bloqueado = deshabilitados.includes(r.rol);
        return (
          <button type="button" key={r.rol} disabled={bloqueado} title={bloqueado ? "Solo dirección da este rol" : r.descripcion}
            onClick={() => alCambiar(activo ? valor.filter((x) => x !== r.rol) : [...valor, r.rol])}
            className={cn("h-8 rounded-full px-3 text-xs font-medium border transition disabled:opacity-40",
              activo ? "bg-marca text-white border-marca" : "border-borde text-tenue hover:text-texto hover:bg-fondo")}>
            {NOMBRE_ROL[r.rol]}
          </button>
        );
      })}
    </div>
  );
}

export function Invitaciones({ usuarios }: { usuarios: { id: string; nombre: string }[] }) {
  const { tieneRol } = useSesion();
  const [f, setF] = useState<{ correo: string; nombre: string; roles: Rol[] }>({ correo: "", nombre: "", roles: [] });
  const [pantalla, setPantalla] = useState(false);
  const lista = useQuery({
    queryKey: ["invitaciones"],
    queryFn: () => q<Invitacion[]>(supabase.from("invitaciones").select("*").order("creado_en", { ascending: false })),
  });
  const invitar = useAccion(() => q(supabase.from("invitaciones").insert({ correo: f.correo.trim().toLowerCase(), nombre: f.nombre.trim() || null, roles: f.roles })), {
    exito: `Invitación lista para ${f.correo}. Avísale que ya puede entrar.`, invalidar: [["invitaciones"]],
    alTerminar: () => setF({ correo: "", nombre: "", roles: [] }),
  });
  const borrar = useAccion((correo: string) => q(supabase.from("invitaciones").delete().eq("correo", correo)), { exito: "Invitación cancelada", invalidar: [["invitaciones"]] });
  const quien = (id: string | null) => usuarios.find((u) => u.id === id)?.nombre ?? "—";
  const externo = f.correo.includes("@") && !f.correo.trim().toLowerCase().endsWith("@" + DOMINIO_EMPRESA);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!f.correo.trim()) return;
    if (externo && f.roles.length === 0) { toast.error("Un correo de fuera de la empresa necesita al menos un rol para poder entrar."); return; }
    invitar.mutate(undefined);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <div className="space-y-4">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Invitar a alguien" descripcion="Para que entre ya con sus roles, o para un correo de fuera de la empresa." />
          <form onSubmit={enviar} className="px-5 pb-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Correo" ayuda={externo ? "Correo externo: solo podrá entrar con esta invitación." : undefined}>
                <Entrada type="email" required value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} placeholder={`nombre@${DOMINIO_EMPRESA}`} />
              </Campo>
              <Campo etiqueta="Nombre">
                <Entrada value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Como aparecerá en el ERP" />
              </Campo>
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Roles con los que entra</p>
              <SelectorRoles valor={f.roles} alCambiar={(roles) => setF({ ...f, roles })} deshabilitados={tieneRol("direccion") ? [] : ["direccion"]} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-tenue">No se manda ningún correo: avísale tú que entre en {window.location.origin}.</p>
              <Boton type="submit" cargando={invitar.isPending}><MailPlus className="h-4 w-4" /> Invitar</Boton>
            </div>
          </form>
        </Tarjeta>

        <Tarjeta>
          <EncabezadoTarjeta titulo="Invitaciones pendientes" descripcion="Gente que todavía no entra por primera vez." />
          {lista.isLoading ? <Cargando filas={2} /> : (lista.data ?? []).length === 0 ? (
            <Vacio icono={MailPlus} titulo="Nadie pendiente" texto="Cuando invites a alguien aparecerá aquí hasta que entre por primera vez." className="py-8" />
          ) : (
            <ul className="divide-y divide-borde border-t border-borde">
              {lista.data!.map((i) => (
                <li key={i.correo} className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.nombre ?? i.correo}</p>
                    <p className="text-xs text-tenue">{i.correo} · invitó {quien(i.invitado_por)} el {fecha(i.creado_en)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {i.roles.length ? i.roles.map((r) => <Insignia key={r} tono={r === "pantalla" ? "info" : "marca"}>{NOMBRE_ROL[r]}</Insignia>) : <Insignia>Sin rol</Insignia>}
                  </div>
                  <Boton variante="fantasma" tamano="icono" aria-label={`Cancelar invitación de ${i.correo}`} onClick={() => borrar.mutate(i.correo)}>
                    <Trash2 className="h-4 w-4 text-tenue" />
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="space-y-4">
        <Tarjeta className="p-5 space-y-3 text-sm">
          <p className="font-semibold flex items-center gap-2"><Info className="h-4 w-4 text-marca" /> Cómo entra la gente</p>
          <ul className="space-y-2 text-tenue list-disc pl-5">
            <li>Las cuentas <b className="text-texto">@{DOMINIO_EMPRESA}</b> entran solas con “Continuar con Google”, pero <b className="text-texto">sin rol</b>: ven un aviso de “pide acceso” y aparecen en Usuarios como “Espera rol” hasta que les asignes uno.</li>
            <li>Si invitas el correo antes, entra directo con los roles de la invitación y la invitación desaparece.</li>
            <li>Un correo de fuera (contador, distribuidor) solo puede entrar si está invitado.</li>
            <li>El rol de dirección solo lo da dirección, y nadie cambia sus propios roles.</li>
          </ul>
        </Tarjeta>
        <Tarjeta className="p-5 space-y-3 text-sm">
          <p className="font-semibold flex items-center gap-2"><Monitor className="h-4 w-4 text-info" /> Pantalla del taller (TV)</p>
          <p className="text-tenue">
            La TV no tiene cuenta de Google. Se le crea una con contraseña: se invita su correo con el rol <b className="text-texto">Pantalla de piso</b> y
            se le pone una contraseña. En la TV se abre el ERP, “Entrar con correo y contraseña”, y entra directo al tablero de piso sin ver nada más.
          </p>
          <Boton variante="secundario" className="w-full" onClick={() => setPantalla(true)}><Monitor className="h-4 w-4" /> Crear cuenta de pantalla</Boton>
        </Tarjeta>
      </div>
      <CrearPantalla abierto={pantalla} alCambiar={setPantalla} />
    </div>
  );
}

function CrearPantalla({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({ nombre: "Pantalla de pintura", correo: `tv.pintura@${DOMINIO_EMPRESA}`, clave: contrasenaNueva() }));
  const [estado, setEstado] = useState<"captura" | "creando" | { listo: boolean; confirmar: boolean }>("captura");

  async function crear(e: FormEvent) {
    e.preventDefault();
    const correo = f.correo.trim().toLowerCase();
    setEstado("creando");
    try {
      // 1) La invitación le da el rol "pantalla" al crearse la cuenta (al_crear_usuario).
      await q(supabase.from("invitaciones").insert({ correo, nombre: f.nombre.trim(), roles: ["pantalla"] }));
      // 2) La cuenta con contraseña, con un cliente aparte que no guarda sesión:
      //    con el cliente normal, signUp cambiaría tu sesión por la de la TV.
      const aparte = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "hegamex-alta-pantalla" },
      });
      const { data, error } = await aparte.auth.signUp({ email: correo, password: f.clave, options: { data: { full_name: f.nombre.trim() } } });
      if (error) {
        await supabase.from("invitaciones").delete().eq("correo", correo);
        throw error;
      }
      setEstado({ listo: true, confirmar: !data.session });
      qc.invalidateQueries({ queryKey: ["lista_usuarios"] });
      qc.invalidateQueries({ queryKey: ["invitaciones"] });
    } catch (err) {
      const m = mensajeError(err);
      toast.error(/registered|already/i.test(m) ? "Ese correo ya tiene cuenta." : m);
      setEstado("captura");
    }
  }
  function cerrar(v: boolean) {
    alCambiar(v);
    if (!v) { setEstado("captura"); setF({ nombre: "Pantalla de pintura", correo: `tv.pintura@${DOMINIO_EMPRESA}`, clave: contrasenaNueva() }); }
  }
  const copiar = (t: string) => { navigator.clipboard?.writeText(t); toast.success("Copiado"); };

  return (
    <Dialogo abierto={abierto} alCambiar={cerrar} titulo="Crear cuenta de pantalla (TV)"
      descripcion="Una cuenta con contraseña y rol Pantalla de piso: solo ve el tablero del taller."
      pie={typeof estado === "object"
        ? <Boton onClick={() => cerrar(false)}>Listo</Boton>
        : <>
          <Boton variante="secundario" onClick={() => cerrar(false)}>Cancelar</Boton>
          <Boton type="submit" form="crear-pantalla" cargando={estado === "creando"}>Crear cuenta</Boton>
        </>}>
      {typeof estado === "object" ? (
        <div className="space-y-3 text-sm">
          <p>Listo. En la TV abre <b>{window.location.origin}</b>, elige <b>“Entrar con correo y contraseña”</b> y escribe:</p>
          <div className="rounded-lg border border-borde bg-fondo p-3 space-y-2 font-mono">
            <p className="flex items-center justify-between gap-2"><span>{f.correo}</span><button onClick={() => copiar(f.correo)} aria-label="Copiar correo"><Copy className="h-4 w-4 text-tenue" /></button></p>
            <p className="flex items-center justify-between gap-2"><span>{f.clave}</span><button onClick={() => copiar(f.clave)} aria-label="Copiar contraseña"><Copy className="h-4 w-4 text-tenue" /></button></p>
          </div>
          {estado.confirmar && <p className="text-aviso">El servidor pide confirmar el correo: llegará un mensaje a {f.correo}; hasta abrirlo la TV no podrá entrar.</p>}
          <p className="text-tenue">Guarda la contraseña: no se vuelve a mostrar. Si se pierde, crea otra cuenta y desactiva esta.</p>
        </div>
      ) : (
        <form id="crear-pantalla" onSubmit={crear} className="space-y-4">
          <Campo etiqueta="Nombre" ayuda="Para reconocerla en la lista de usuarios.">
            <Entrada autoFocus required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Correo de la cuenta" ayuda="No necesita ser un buzón real si el servidor no pide confirmación.">
            <Entrada type="email" required value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
          </Campo>
          <Campo etiqueta="Contraseña" ayuda="Generada para dictarla fácil en la TV (sin 0/O ni 1/l).">
            <div className="flex gap-2">
              <Entrada required minLength={8} value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} className="font-mono" />
              <Boton type="button" variante="secundario" tamano="icono" aria-label="Otra contraseña" onClick={() => setF({ ...f, clave: contrasenaNueva() })}><RefreshCw className="h-4 w-4" /></Boton>
            </div>
          </Campo>
        </form>
      )}
    </Dialogo>
  );
}

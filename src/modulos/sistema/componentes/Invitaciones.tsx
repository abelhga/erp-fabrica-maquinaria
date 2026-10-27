import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Copy, Info, MailPlus, Monitor, RefreshCw, Tablet, Trash2 } from "lucide-react";
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
import { GLOSARIO } from "@/tutorial/glosario";

/** Un correo no admite acentos ni espacios: el navegador lo rechaza (en inglés) y no deja guardar. Se limpian al escribir. */
const correoLimpio = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
/**
 * Los aparatos del taller no tienen cuenta de Google: la TV (solo ve el tablero de piso) y la
 * tablet de la terminal (solo marca el avance de las etapas). Cada uno con su rol y su correo.
 */
type Aparato = "tv" | "terminal";
const APARATO: Record<Aparato, { rol: Rol; prefijo: string; nombre: string; titulo: string; descripcion: string; dondeAbrir: string }> = {
  tv: { rol: "pantalla", prefijo: "tv", nombre: "Pantalla de pintura", titulo: "Crear cuenta de pantalla (TV)",
        descripcion: "Una cuenta con contraseña y rol Pantalla de piso: solo ve el tablero del taller.", dondeAbrir: "En la TV" },
  terminal: { rol: "terminal", prefijo: "terminal", nombre: "Terminal de pailería", titulo: "Crear cuenta de terminal (tablet)",
        descripcion: "Una cuenta con contraseña y rol Terminal de piso: solo abre la terminal, para marcar el avance de las etapas y reportar fallas.",
        dondeAbrir: "En la tablet, en Safari" },
};
/** "Pantalla de pailería" → tv.paileria@…, "Terminal de pailería" → terminal.paileria@…: sale del nombre mientras nadie lo cambie a mano. */
const correoDeAparato = (nombre: string, tipo: Aparato) => {
  const base = correoLimpio(nombre.replace(/^\s*(pantalla|terminal)\s+(de(l)?\s+)?/i, "").replace(/[^\p{L}\p{N}]+/gu, "."))
    .replace(/[^a-z0-9.]/g, "").replace(/^\.+|\.+$/g, "");
  return `${APARATO[tipo].prefijo}.${base || "taller"}@${DOMINIO_EMPRESA}`;
};

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
  const [aparato, setAparato] = useState<Aparato | null>(null);
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
          <EncabezadoTarjeta titulo="Invitar a alguien" explica={GLOSARIO.invitacion} descripcion="Para que entre ya con sus roles, o para un correo de fuera de la empresa." />
          <form onSubmit={enviar} className="px-5 pb-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Correo" ayuda={externo ? "Correo externo: solo podrá entrar con esta invitación." : undefined}>
                <Entrada type="email" required value={f.correo} onChange={(e) => setF({ ...f, correo: correoLimpio(e.target.value) })} placeholder={`nombre@${DOMINIO_EMPRESA}`} />
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
          <p className="font-semibold flex items-center gap-2" data-explain={GLOSARIO.cuentaPantalla}><Monitor className="h-4 w-4 text-info" /> Pantalla del taller (TV)</p>
          <p className="text-tenue">
            La TV no tiene cuenta de Google. Se le crea una con contraseña: se invita su correo con el rol <b className="text-texto">Pantalla de piso</b> y
            se le pone una contraseña. En la TV se abre el ERP, “Entrar con correo y contraseña”, y entra directo al tablero de piso sin ver nada más.
          </p>
          <Boton variante="secundario" className="w-full" onClick={() => setAparato("tv")}><Monitor className="h-4 w-4" /> Crear cuenta de pantalla</Boton>
        </Tarjeta>
        <Tarjeta className="p-5 space-y-3 text-sm">
          <p className="font-semibold flex items-center gap-2" data-explain={GLOSARIO.cuentaTerminal}><Tablet className="h-4 w-4 text-info" /> Terminal de piso (tablet)</p>
          <p className="text-tenue">
            La tablet del taller tampoco necesita cuenta de Google. Se le crea una con contraseña y el rol <b className="text-texto">Terminal de piso</b>:
            entra directo a la terminal para marcar el avance de las etapas y reportar fallas, y no ve nada más. Cada quien elige su nombre en la terminal.
          </p>
          <Boton variante="secundario" className="w-full" onClick={() => setAparato("terminal")}><Tablet className="h-4 w-4" /> Crear cuenta de terminal</Boton>
        </Tarjeta>
      </div>
      {aparato && <CrearCuentaAparato tipo={aparato} alCerrar={() => setAparato(null)} />}
    </div>
  );
}

function CrearCuentaAparato({ tipo, alCerrar }: { tipo: Aparato; alCerrar: () => void }) {
  const qc = useQueryClient();
  const a = APARATO[tipo];
  const [f, setF] = useState(() => ({ nombre: a.nombre, correo: correoDeAparato(a.nombre, tipo), clave: contrasenaNueva() }));
  const [correoAMano, setCorreoAMano] = useState(false);
  const [estado, setEstado] = useState<"captura" | "creando" | { listo: boolean; confirmar: boolean }>("captura");

  async function crear(e: FormEvent) {
    e.preventDefault();
    const correo = f.correo.trim().toLowerCase();
    setEstado("creando");
    try {
      // 1) La invitación le da su rol (pantalla o terminal) al crearse la cuenta (al_crear_usuario).
      await q(supabase.from("invitaciones").insert({ correo, nombre: f.nombre.trim(), roles: [a.rol] }));
      // 2) La cuenta con contraseña, con un cliente aparte que no guarda sesión:
      //    con el cliente normal, signUp cambiaría tu sesión por la del aparato.
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
    if (!v) alCerrar();
  }
  const copiar = (t: string) => { navigator.clipboard?.writeText(t); toast.success("Copiado"); };

  return (
    <Dialogo abierto alCambiar={cerrar} titulo={a.titulo} descripcion={a.descripcion}
      pie={typeof estado === "object"
        ? <Boton onClick={() => cerrar(false)}>Listo</Boton>
        : <>
          <Boton variante="secundario" onClick={() => cerrar(false)}>Cancelar</Boton>
          <Boton type="submit" form="crear-pantalla" cargando={estado === "creando"}>Crear cuenta</Boton>
        </>}>
      {typeof estado === "object" ? (
        <div className="space-y-3 text-sm">
          <p>Listo. {a.dondeAbrir} abre <b>{window.location.origin}</b>, elige <b>“Entrar con correo y contraseña”</b> y escribe:</p>
          <div className="rounded-lg border border-borde bg-fondo p-3 space-y-2 font-mono">
            <p className="flex items-center justify-between gap-2"><span>{f.correo}</span><button onClick={() => copiar(f.correo)} aria-label="Copiar correo"><Copy className="h-4 w-4 text-tenue" /></button></p>
            <p className="flex items-center justify-between gap-2"><span>{f.clave}</span><button onClick={() => copiar(f.clave)} aria-label="Copiar contraseña"><Copy className="h-4 w-4 text-tenue" /></button></p>
          </div>
          {tipo === "terminal" && (
            <ol className="list-decimal pl-5 space-y-1 text-tenue">
              <li>Ya adentro: botón Compartir → <b className="text-texto">«Agregar a pantalla de inicio»</b>. Queda como app, a pantalla completa.</li>
              <li>Ajustes → Accesibilidad → <b className="text-texto">Acceso guiado</b>, para que la tablet no salga de la terminal.</li>
              <li>Ajustes → Pantalla y brillo → Bloqueo automático: <b className="text-texto">Nunca</b>, y déjala con su cargador.</li>
            </ol>
          )}
          {estado.confirmar && <p className="text-aviso">El servidor pide confirmar el correo: llegará un mensaje a {f.correo}; hasta abrirlo {tipo === "tv" ? "la TV" : "la tablet"} no podrá entrar.</p>}
          <p className="text-tenue">Guarda la contraseña: no se vuelve a mostrar. Si se pierde, crea otra cuenta y desactiva esta.</p>
        </div>
      ) : (
        <form id="crear-pantalla" onSubmit={crear} className="space-y-4">
          <Campo etiqueta="Nombre" ayuda="Para reconocerla en la lista de usuarios.">
            <Entrada autoFocus required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value, correo: correoAMano ? f.correo : correoDeAparato(e.target.value, tipo) })} />
          </Campo>
          <Campo etiqueta="Correo de la cuenta" ayuda="Sale del nombre, sin acentos ni espacios. No necesita ser un buzón real si el servidor no pide confirmación.">
            <Entrada type="email" required value={f.correo} onChange={(e) => { setCorreoAMano(true); setF({ ...f, correo: correoLimpio(e.target.value) }); }} />
          </Campo>
          <Campo etiqueta="Contraseña" ayuda={`Generada para dictarla fácil ${tipo === "tv" ? "en la TV" : "en la tablet"} (sin 0/O ni 1/l).`}>
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

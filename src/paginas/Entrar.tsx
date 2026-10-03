import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase, DOMINIO_EMPRESA } from "@/lib/supabase";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Logo } from "@/components/layout/Logo";

export function Entrar() {
  const [conCorreo, setConCorreo] = useState(false);
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);

  async function google() {
    setCargando(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        // "hd" hace que Google muestre de entrada solo las cuentas de la empresa.
        // La barrera real está en la base (al_crear_usuario), esto es comodidad.
        queryParams: { hd: DOMINIO_EMPRESA, prompt: "select_account" },
      },
    });
    if (error) { toast.error(error.message); setCargando(false); }
  }

  async function entrarConClave(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: clave });
    setCargando(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message);
  }

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0b1220] text-white relative overflow-hidden">
        <Logo className="text-white" grande />
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">Todo Hegamex en un solo lugar.</h1>
          <p className="mt-4 text-white/70 text-lg">
            Cotiza con precios al día, fabrica con el material validado y compra antes de que falte.
          </p>
        </div>
        <p className="text-white/40 text-sm">Bandas transportadoras · Dosificadoras · Cribas · Tolvas · Componentes</p>
        <svg className="absolute -right-24 -bottom-24 h-[28rem] w-[28rem] opacity-[0.07]" viewBox="0 0 24 24" aria-hidden>
          <path fill="#0a74ff" d="M10.6 1.5h2.8c.4 0 .7.3.7.7v1.6c.8.2 1.5.5 2.2.9l1.1-1.1c.3-.3.7-.3 1 0l2 2c.3.3.3.7 0 1l-1.1 1.1c.4.7.7 1.4.9 2.2h1.6c.4 0 .7.3.7.7v2.8c0 .4-.3.7-.7.7h-1.6c-.2.8-.5 1.5-.9 2.2l1.1 1.1c.3.3.3.7 0 1l-2 2c-.3.3-.7.3-1 0l-1.1-1.1c-.7.4-1.4.7-2.2.9v1.6c0 .4-.3.7-.7.7h-2.8c-.4 0-.7-.3-.7-.7v-1.6c-.8-.2-1.5-.5-2.2-.9l-1.1 1.1c-.3.3-.7.3-1 0l-2-2c-.3-.3-.3-.7 0-1l1.1-1.1c-.4-.7-.7-1.4-.9-2.2H2.2c-.4 0-.7-.3-.7-.7v-2.8c0-.4.3-.7.7-.7h1.6c.2-.8.5-1.5.9-2.2L3.6 6.7c-.3-.3-.3-.7 0-1l2-2c.3-.3.7-.3 1 0l1.1 1.1c.7-.4 1.4-.7 2.2-.9V2.2c0-.4.3-.7.7-.7ZM12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
        </svg>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <Logo className="lg:hidden" />
          <div>
            <h2 className="text-2xl font-semibold">Entrar</h2>
            <p className="text-tenue mt-1">Usa tu cuenta de Google de @{DOMINIO_EMPRESA}.</p>
          </div>

          <Boton tamano="lg" variante="secundario" className="w-full" onClick={google} cargando={cargando && !conCorreo}>
            <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continuar con Google
          </Boton>

          {!conCorreo ? (
            <button onClick={() => setConCorreo(true)} className="w-full text-sm text-tenue hover:text-texto flex items-center justify-center gap-2">
              <KeyRound className="h-4 w-4" /> Entrar con correo y contraseña (pantallas de piso)
            </button>
          ) : (
            <form onSubmit={entrarConClave} className="space-y-4">
              <Campo etiqueta="Correo">
                <Entrada type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </Campo>
              <Campo etiqueta="Contraseña">
                <Entrada type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
              </Campo>
              <Boton type="submit" className="w-full" cargando={cargando}>Entrar</Boton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** Quien entró con su cuenta de la empresa pero todavía no tiene rol asignado. */
export function SinAcceso({ correo, salir }: { correo: string; salir: () => void }) {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="tarjeta max-w-md p-8 text-center space-y-4">
        <Logo className="justify-center" />
        <h2 className="text-xl font-semibold">Tu cuenta está lista, falta tu acceso</h2>
        <p className="text-tenue">
          Entraste como <b className="text-texto">{correo}</b>. Pide a dirección o a sistemas que te asignen un rol
          (ventas, compras, almacén…) y vuelve a entrar.
        </p>
        <Boton variante="secundario" onClick={salir}>Salir</Boton>
      </div>
    </div>
  );
}

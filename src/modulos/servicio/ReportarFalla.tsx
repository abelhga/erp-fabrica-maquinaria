import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, HardHat, Loader2, Search, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { coincide, cn } from "@/lib/utilidades";
import { hace } from "@/lib/formato";
import { CLAVE, ESTADO_MAQUINA, comprimirImagen, subirArchivo, useMaquinas, type Maquina } from "./datos";

const RAPIDAS = ["No prende", "Hace chispa", "Se quemó", "Hace ruido", "Se calienta", "Fuga de aire o aceite", "No da amperaje", "Se atora"];
// Mismo nombre de piso que la terminal (la tablet se queda en su estación).
const LS_NOMBRE = "terminal.nombre";
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } };

interface Foto { ruta: string; vista: string }

/**
 * Reportar una falla desde el celular o la terminal de piso: qué máquina, qué le
 * pasa, si está parada y una foto. Botones grandes, nada de tablas (se usa con
 * guantes). Le llega a la gerencia de producción como aviso.
 */
export default function ReportarFalla() {
  const [params] = useSearchParams();
  const volver = params.get("volver") || "/";
  const etapaId = Number(params.get("etapa")) || null;
  const { perfil } = useSesion();
  const qc = useQueryClient();
  const maquinas = useMaquinas();
  const [elegida, setElegida] = useState<string | null>(params.get("maquina"));
  const [buscar, setBuscar] = useState("");
  const [falla, setFalla] = useState("");
  const [detiene, setDetiene] = useState<boolean | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState(0);
  const [nombre, setNombre] = useState(() => leer(LS_NOMBRE) ?? perfil?.nombre ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ folio: string; maquina: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const todas = (maquinas.data ?? []).filter((m) => m.estado !== "baja");
  const m = todas.find((x) => x.id === elegida) ?? null;
  const visibles = useMemo(() => {
    const l = buscar.trim() ? todas.filter((x) => coincide(`${x.numero} ${x.nombre} ${x.categoria} ${x.etapa ?? ""}`, buscar)) : todas;
    return [...l].sort((a, b) => Number(b.etapa_id === etapaId) - Number(a.etapa_id === etapaId) || a.numero.localeCompare(b.numero, "es", { numeric: true }));
  }, [todas, buscar, etapaId]);

  async function agregarFotos(archivos: FileList | null) {
    if (!archivos?.length || !m) return;
    const lista = Array.from(archivos).slice(0, 4);
    setSubiendo(lista.length);
    setError(null);
    try {
      for (const a of lista) {
        const blob = await comprimirImagen(a);
        const ruta = await subirArchivo(`mantenimiento/${m.id}`, blob);
        setFotos((f) => [...f, { ruta, vista: URL.createObjectURL(blob) }]);
        setSubiendo((n) => n - 1);
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendo(0);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function enviar() {
    if (!m) return;
    setEnviando(true);
    setError(null);
    try {
      const id = await q<string>(supabase.rpc("reportar_falla", {
        p_maquina: m.id, p_falla: falla.trim(), p_detiene: !!detiene, p_fotos: fotos.map((f) => f.ruta), p_nombre: nombre.trim() || null,
      }));
      if (nombre.trim()) guardar(LS_NOMBRE, nombre.trim());
      const o = await q<{ folio: string }>(supabase.from("ordenes_mantenimiento").select("folio").eq("id", id).single());
      setListo({ folio: o.folio, maquina: `${m.numero} ${m.nombre}` });
      qc.invalidateQueries({ queryKey: CLAVE });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  function otra() {
    setListo(null); setElegida(null); setFalla(""); setDetiene(null); setFotos([]); setBuscar("");
  }

  const completo = !!m && falla.trim().length >= 5 && detiene != null && subiendo === 0;

  return (
    <div className="fixed inset-0 z-[35] bg-fondo flex flex-col text-lg">
      <header className="h-16 shrink-0 flex items-center gap-2 px-3 sm:px-5 border-b border-borde bg-superficie">
        <Link to={volver} className="p-2 -ml-2 text-tenue" aria-label="Volver"><ArrowLeft className="h-6 w-6" /></Link>
        <Logo className="hidden md:flex" />
        <h1 className="font-semibold text-xl flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-peligro" />Reportar falla</h1>
      </header>

      <main className="flex-1 overflow-y-auto">
        {listo ? (
          <div className="max-w-xl mx-auto p-5 text-center space-y-4 pt-12">
            <CheckCircle2 className="h-20 w-20 text-ok mx-auto" />
            <p className="text-2xl font-bold">Listo, ya quedó reportada</p>
            <p className="text-tenue">{listo.maquina} · <span className="cifra whitespace-nowrap">{listo.folio}</span><br />La gerencia de producción ya tiene el aviso.</p>
            <div className="grid gap-3 pt-4">
              <button onClick={otra} className="min-h-[60px] rounded-xl border-2 border-borde bg-superficie font-semibold">Reportar otra falla</button>
              <Link to={volver} className="min-h-[60px] rounded-xl bg-marca text-white font-semibold flex items-center justify-center">Volver</Link>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-4 sm:p-5 space-y-6 pb-32">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">1. ¿Qué máquina?</h2>
              {m ? (
                <div className="tarjeta p-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold cifra leading-tight">{m.numero}</p>
                    <p className="text-lg leading-tight">{m.nombre}</p>
                    <p className="text-base text-tenue">{m.etapa ?? m.ubicacion ?? m.categoria} · {ESTADO_MAQUINA[m.estado].texto}</p>
                    {m.orden_falla && m.orden_tipo === "correctivo" && (
                      <p className="text-base text-aviso mt-1">Ya reportaron: «{m.orden_falla}» {hace(m.orden_desde)}. Si es otra cosa, sigue.</p>
                    )}
                  </div>
                  <button onClick={() => { setElegida(null); setFotos([]); }} className="h-12 px-4 rounded-xl border-2 border-borde text-base font-medium shrink-0">Cambiar</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="h-6 w-6 text-tenue absolute left-4 top-1/2 -translate-y-1/2" />
                    <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Número o nombre: SOL-03, taladro…"
                           className="w-full h-16 rounded-xl border-2 border-borde bg-superficie pl-14 pr-4 text-xl focus:outline-none focus:border-marca" aria-label="Buscar máquina" />
                  </div>
                  {maquinas.isLoading ? <Loader2 className="h-8 w-8 animate-spin text-tenue mx-auto" /> : visibles.length === 0 ? (
                    <p className="text-tenue">No hay máquinas con ese nombre. Si no está en el catálogo, avísale a la gerencia de producción.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {visibles.slice(0, 40).map((x) => <BotonMaquina key={x.id} m={x} alElegir={() => setElegida(x.id)} />)}
                    </div>
                  )}
                </>
              )}
            </section>

            {m && (
              <>
                <section className="space-y-3">
                  <h2 className="text-xl font-semibold">2. ¿Qué le pasa?</h2>
                  <div className="flex flex-wrap gap-2">
                    {RAPIDAS.map((r) => (
                      <button key={r} type="button" onClick={() => setFalla((f) => (f.trim() ? `${f.trim()}, ${r.toLowerCase()}` : r))}
                              className="min-h-[48px] rounded-full border-2 border-borde bg-superficie px-4 text-base active:scale-[0.98]">{r}</button>
                    ))}
                  </div>
                  <textarea value={falla} onChange={(e) => setFalla(e.target.value)} rows={3}
                            className="w-full rounded-xl border-2 border-borde bg-superficie p-3 text-xl focus:outline-none focus:border-marca"
                            placeholder="Qué hace o qué dejó de hacer" aria-label="Qué le pasa" />
                </section>

                <section className="space-y-3">
                  <h2 className="text-xl font-semibold">3. ¿Se puede seguir usando?</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setDetiene(false)} aria-pressed={detiene === false}
                            className={cn("min-h-[72px] rounded-xl border-2 text-lg font-semibold px-3", detiene === false ? "border-aviso bg-aviso-suave text-aviso" : "border-borde bg-superficie")}>
                      Sí, todavía jala
                    </button>
                    <button type="button" onClick={() => setDetiene(true)} aria-pressed={detiene === true}
                            className={cn("min-h-[72px] rounded-xl border-2 text-lg font-semibold px-3", detiene === true ? "border-peligro bg-peligro-suave text-peligro" : "border-borde bg-superficie")}>
                      No, está parada
                    </button>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xl font-semibold">4. Foto <span className="text-tenue font-normal text-base">(ayuda a saber qué refacción traer)</span></h2>
                  <input ref={entrada} type="file" accept="image/*" capture="environment" multiple className="sr-only" tabIndex={-1}
                         onChange={(e) => agregarFotos(e.target.files)} aria-label="Tomar foto de la falla" />
                  {fotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {fotos.map((f) => (
                        <div key={f.ruta} className="relative aspect-square">
                          <img src={f.vista} alt="Foto de la falla" className="h-full w-full object-cover rounded-lg border border-borde" />
                          <button type="button" onClick={() => setFotos((l) => l.filter((x) => x.ruta !== f.ruta))} aria-label="Quitar foto"
                                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-superficie border border-borde flex items-center justify-center"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo > 0}
                          className="w-full min-h-[64px] rounded-xl border-2 border-dashed border-borde bg-superficie flex items-center justify-center gap-3 text-lg font-semibold disabled:opacity-60">
                    {subiendo > 0 ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
                    {subiendo > 0 ? `Subiendo ${subiendo}…` : fotos.length ? "Otra foto" : "Tomar foto"}
                  </button>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xl font-semibold">5. ¿Quién reporta?</h2>
                  <div className="relative">
                    <HardHat className="h-6 w-6 text-tenue absolute left-4 top-1/2 -translate-y-1/2" />
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off"
                           className="w-full h-16 rounded-xl border-2 border-borde bg-superficie pl-14 pr-4 text-xl focus:outline-none focus:border-marca"
                           placeholder="Nombre y apellido" aria-label="Quién reporta" />
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {m && !listo && (
        <footer className="shrink-0 border-t border-borde bg-superficie p-3 sm:p-4">
          <div className="max-w-2xl mx-auto space-y-2">
            {error && <p className="text-base text-peligro flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</p>}
            <button type="button" onClick={enviar} disabled={!completo || enviando}
                    className="w-full min-h-[64px] rounded-xl bg-peligro text-white text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99]">
              {enviando ? <Loader2 className="h-7 w-7 animate-spin" /> : <AlertTriangle className="h-7 w-7" />}Enviar reporte
            </button>
            {!completo && <p className="text-sm text-tenue text-center">{falla.trim().length < 5 ? "Describe la falla" : detiene == null ? "Di si todavía se puede usar" : "Esperando las fotos…"}</p>}
          </div>
        </footer>
      )}
    </div>
  );
}

function BotonMaquina({ m, alElegir }: { m: Maquina; alElegir: () => void }) {
  const mal = m.estado !== "operando";
  return (
    <button type="button" onClick={alElegir}
            className={cn("min-h-[72px] rounded-xl border-2 bg-superficie px-4 py-2 text-left flex items-center gap-3 active:scale-[0.99]",
              mal ? "border-aviso/50" : "border-borde")}>
      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: m.etapa_color ?? "hsl(var(--tenue))" }} aria-hidden />
      <span className="min-w-0">
        <span className="block text-xl font-bold cifra leading-tight">{m.numero}</span>
        <span className="block text-base leading-tight truncate">{m.nombre}</span>
        {mal && <span className="block text-sm text-aviso">{ESTADO_MAQUINA[m.estado].texto}</span>}
      </span>
    </button>
  );
}

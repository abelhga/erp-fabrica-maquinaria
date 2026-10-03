// "Lo que importa hoy": el resumen de un área. Si Claude está conectado, lo escribe
// él con los datos de la base; si no (o si la función no responde), salen los
// hallazgos calculados por reglas en SQL. Nunca se queda vacío por culpa de la IA.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, RefreshCw, Sparkles, Siren } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { pedirResumen, type Area, type Resumen, type Tono } from "@/lib/asistente";
import { hace } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Insignia } from "@/components/ui/insignia";

const TONOS: Record<Tono, { icono: typeof Info; clase: string; texto: string }> = {
  riesgo: { icono: Siren, clase: "bg-peligro-suave text-peligro", texto: "Riesgo" },
  atencion: { icono: AlertTriangle, clase: "bg-aviso-suave text-aviso", texto: "Atención" },
  bueno: { icono: CheckCircle2, clase: "bg-ok-suave text-ok", texto: "Va bien" },
  info: { icono: Info, clase: "bg-info-suave text-info", texto: "Para saber" },
};

/** Sin función desplegada todavía: los mismos hallazgos, leídos directo de la base. */
async function resumenDeRespaldo(area: Area): Promise<Resumen> {
  const h = await q<{ tono: Tono; titulo: string; detalle: string; ruta: string }[]>(supabase.rpc("hallazgos", { p_area: area }));
  return {
    titular: h.find((x) => x.tono === "bueno")?.titulo ?? h[0]?.titulo ?? "Sin pendientes urgentes hoy",
    resumen: "", puntos: h.slice(0, 6).map((x) => ({ ...x, accion: "" })), generado_en: new Date().toISOString(), simulado: true,
  };
}

export function ResumenIA({ area = "direccion" }: { area?: Area }) {
  const qc = useQueryClient();
  const clave = ["resumen_ia", area];
  const r = useQuery({
    queryKey: clave,
    queryFn: () => pedirResumen(area).catch(() => resumenDeRespaldo(area)),
    staleTime: 10 * 60_000,
  });
  const actualizar = async () => {
    qc.setQueryData(clave, undefined);
    await qc.fetchQuery({ queryKey: clave, queryFn: () => pedirResumen(area, true).catch(() => resumenDeRespaldo(area)) });
  };

  return (
    <section className="tarjeta relative overflow-hidden">
      {/* Un brillo suave detrás del encabezado: es lo único "de IA" en lo visual. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-marca/10 blur-3xl" />
      <div className="relative p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-marca to-marca/60 grid place-items-center text-white shadow-sm">
              <Sparkles className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-tenue uppercase tracking-wide">Lo que importa hoy</p>
              {r.isLoading || !r.data
                ? <div className="mt-1.5 h-5 w-80 max-w-full rounded bg-fondo animate-pulse" />
                : <h2 className="text-lg font-semibold leading-snug text-balance">{r.data.titular}</h2>}
              {r.data?.resumen && <p className="mt-1 text-sm text-tenue max-w-3xl">{r.data.resumen}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-tenue">
            {r.data && (r.data.simulado
              ? <Insignia tono="neutro">Reglas de la base · sin IA</Insignia>
              : <Insignia tono="marca"><Sparkles className="h-3 w-3" />Claude · {hace(r.data.generado_en)}</Insignia>)}
            <button onClick={actualizar} disabled={r.isFetching} title="Volver a analizar"
              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo disabled:opacity-50">
              <RefreshCw className={cn("h-4 w-4", r.isFetching && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {r.isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-fondo animate-pulse" />)}
          {r.data?.puntos.map((p, i) => {
            const t = TONOS[p.tono] ?? TONOS.info;
            return (
              <Link key={i} to={p.ruta || "/"}
                className="group rounded-xl border border-borde bg-superficie/60 p-3.5 hover:border-marca/40 hover:shadow-sm transition flex gap-3 animate-entrar"
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className={cn("h-8 w-8 shrink-0 rounded-lg grid place-items-center", t.clase)} title={t.texto}><t.icono className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{p.titulo}</p>
                  <p className="text-xs text-tenue mt-0.5 line-clamp-3">{p.detalle}</p>
                  {p.accion && (
                    <p className="text-xs font-medium text-marca-texto mt-1.5 inline-flex items-center gap-1">
                      {p.accion}<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
          {r.data && r.data.puntos.length === 0 && (
            <p className="text-sm text-tenue">Nada fuera de lo normal en lo que puedes ver. Buen día para vender.</p>
          )}
        </div>
        {r.data?.aviso && <p className="mt-3 text-xs text-aviso">{r.data.aviso}</p>}
      </div>
    </section>
  );
}

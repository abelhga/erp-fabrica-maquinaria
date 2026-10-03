// Tu semana: lo que pasó la semana pasada contra la anterior y lo que viene. Los
// números los arma la base con tus permisos (semana_en_numeros); Claude, si está
// conectado, los narra. Si la función no responde, se ven los números solos.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Factory, FileText, HandCoins, Info, ListTodo, PackageCheck,
  RefreshCw, Ship, Siren, Sparkles, TrendingDown, TrendingUp, Truck, Wrench,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Insignia } from "@/components/ui/insignia";
import { ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { pedirSemana, type NumerosSemana, type Semana, type Tono } from "@/lib/asistente";
import { dinero, dineroCompacto, fecha, hace, hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { TIPOS as TIPOS_SERVICIO } from "@/modulos/servicio/datos";

const TONOS: Record<Tono, { icono: typeof Info; clase: string }> = {
  riesgo: { icono: Siren, clase: "bg-peligro-suave text-peligro" },
  atencion: { icono: AlertTriangle, clase: "bg-aviso-suave text-aviso" },
  bueno: { icono: CheckCircle2, clase: "bg-ok-suave text-ok" },
  info: { icono: Info, clase: "bg-info-suave text-info" },
};

// "martes 29" y no "mar 29": en una agenda, "mar" se lee como marzo.
const dia = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", timeZone: "America/Mexico_City" });
const diaDe = (f: string) => dia.format(new Date(f + "T12:00:00-06:00"));
const ESTADOS: Record<string, string> = {
  confirmado: "confirmado", en_produccion: "en producción", listo: "listo para entregar",
  planeada: "planeada", liberada: "liberada", en_proceso: "en proceso",
};
const estado = (v: string) => ESTADOS[v] ?? v.replace(/_/g, " ");

/** Sin función desplegada todavía: los números, leídos directo de la base. */
async function semanaDeRespaldo(): Promise<Semana> {
  const numeros = await q<NumerosSemana>(supabase.rpc("semana_en_numeros"));
  return { titular: "", resumen: "", puntos: [], numeros, generado_en: new Date().toISOString(), simulado: true };
}

function Cambio({ a, b }: { a: number; b: number }) {
  if (!b) return null;
  const pct = Math.round((a / b - 1) * 100);
  const Icono = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", pct >= 0 ? "text-ok" : "text-peligro")}>
      <Icono className="h-3 w-3" />{pct >= 0 ? "+" : ""}{pct} %
    </span>
  );
}

type Evento = { fecha: string; tipo: string; icono: typeof Truck; titulo: string; detalle: string; ruta: string };

function agenda(n: NumerosSemana): Evento[] {
  const ev: Evento[] = [];
  const t = (v: unknown) => (v == null ? "" : String(v));
  for (const e of n.ventas?.entregas_comprometidas ?? [])
    ev.push({ fecha: t(e.fecha), tipo: "Entrega", icono: Truck, titulo: `${t(e.folio)} · ${t(e.cliente)}`, detalle: estado(t(e.estado)), ruta: "/ventas/pedidos" });
  for (const o of n.produccion?.comprometidas ?? [])
    ev.push({ fecha: t(o.fecha), tipo: "Producción", icono: Factory, titulo: `${t(o.folio)} · ${t(o.equipo)}`, detalle: estado(t(o.estado)), ruta: "/produccion/ordenes" });
  for (const o of n.compras?.por_llegar ?? [])
    ev.push({ fecha: t(o.fecha), tipo: "Llega", icono: PackageCheck, titulo: `${t(o.folio)} · ${t(o.proveedor)}`, detalle: "orden de compra", ruta: "/compras/ordenes" });
  for (const e of n.importaciones?.llegan ?? [])
    ev.push({ fecha: t(e.eta), tipo: "Embarque", icono: Ship, titulo: `${t(e.folio)} · ${t(e.descripcion)}`, detalle: "llega a puerto", ruta: "/importaciones" });
  for (const s of n.servicio?.programados ?? [])
    ev.push({ fecha: t(s.inicio), tipo: TIPOS_SERVICIO[t(s.tipo) as keyof typeof TIPOS_SERVICIO]?.texto ?? "Servicio", icono: Wrench,
      titulo: `${t(s.folio)}${s.equipo ? ` · ${t(s.equipo)}` : ""}`, detalle: t(s.lugar), ruta: "/servicio" });
  return ev.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export default function SemanaPagina() {
  const qc = useQueryClient();
  const r = useQuery({ queryKey: ["semana"], queryFn: () => pedirSemana().catch(semanaDeRespaldo), staleTime: 10 * 60_000 });
  const regenerar = async () => {
    qc.setQueryData(["semana"], undefined);
    await qc.fetchQuery({ queryKey: ["semana"], queryFn: () => pedirSemana(true).catch(semanaDeRespaldo) });
  };
  const n = r.data?.numeros;
  const s = n?.semana;
  const hoy = hoyISO();
  const eventos = n ? agenda(n) : [];

  return (
    <Pagina titulo="Tu semana"
      descripcion={s ? `La semana pasada (${fecha(s.pasada_desde)} al ${fecha(s.pasada_hasta)}) contra la anterior, y lo que viene hasta el ${fecha(s.hasta)}. Con lo que tu rol puede ver.` : "Lo que pasó la semana pasada y lo que viene."}>
      {r.error ? <ErrorCarga error={r.error} /> : (
        <>
          {/* La narración: solo si hay algo que narrar (Claude o las reglas del asistente). */}
          {(r.isLoading || r.data?.titular) && (
            <section className="tarjeta relative overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-marca/10 blur-3xl" />
              <div className="relative p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-marca to-marca/60 grid place-items-center text-white shadow-sm">
                      <Sparkles className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-tenue uppercase tracking-wide">La semana en una frase</p>
                      {r.isLoading
                        ? <div className="mt-1.5 h-5 w-80 max-w-full rounded bg-fondo animate-pulse" />
                        : <h2 className="text-lg font-semibold leading-snug text-balance">{r.data!.titular}</h2>}
                      {r.data?.resumen && <p className="mt-1 text-sm text-tenue max-w-3xl">{r.data.resumen}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-tenue">
                    {r.data && (r.data.simulado
                      ? <Insignia tono="neutro">Reglas de la base · sin IA</Insignia>
                      : <Insignia tono="marca"><Sparkles className="h-3 w-3" />Claude · {hace(r.data.generado_en)}</Insignia>)}
                    <button onClick={regenerar} disabled={r.isFetching} title="Volver a escribirla"
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
                      <Link key={i} to={p.ruta || "/"} style={{ animationDelay: `${i * 60}ms` }}
                        className="group rounded-xl border border-borde bg-superficie/60 p-3.5 hover:border-marca/40 hover:shadow-sm transition flex gap-3 animate-entrar">
                        <div className={cn("h-8 w-8 shrink-0 rounded-lg grid place-items-center", t.clase)}><t.icono className="h-4 w-4" /></div>
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
                </div>
                {r.data?.aviso && <p className="mt-3 text-xs text-aviso">{r.data.aviso}</p>}
              </div>
            </section>
          )}

          {n && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {n.ventas && (
                <Kpi titulo={n.ventas.alcance === "tuyas" ? "Tus ventas" : "Ventas"} icono={HandCoins} tono="marca"
                  valor={dineroCompacto(n.ventas.monto)}
                  detalle={<>{numero(n.ventas.operaciones)} {n.ventas.operaciones === 1 ? "operación" : "operaciones"} · <Cambio a={n.ventas.monto} b={n.ventas.monto_anterior} /> vs {dineroCompacto(n.ventas.monto_anterior)}</>} />
              )}
              {n.ventas && (
                <Kpi titulo="Cotizaciones enviadas" icono={FileText} tono="info" valor={numero(n.ventas.cotizaciones_enviadas.n)}
                  detalle={<>{dineroCompacto(n.ventas.cotizaciones_enviadas.monto)} · {n.ventas.cotizaciones_ganadas.n} ganadas
                    {n.ventas.cotizaciones_sin_respuesta.n > 0 && <> · <span className="text-aviso font-medium">{n.ventas.cotizaciones_sin_respuesta.n} sin respuesta</span></>}</>} />
              )}
              {n.cobranza && (
                <Kpi titulo="Cobrado" icono={HandCoins} tono="ok" valor={dineroCompacto(n.cobranza.cobrado)}
                  detalle={<><Cambio a={n.cobranza.cobrado} b={n.cobranza.cobrado_anterior} /> vs {dineroCompacto(n.cobranza.cobrado_anterior)}</>} />
              )}
              {n.produccion && (
                <Kpi titulo="Equipos terminados" icono={Factory} tono={n.produccion.atrasadas ? "aviso" : "ok"} valor={numero(n.produccion.terminadas)}
                  detalle={<>{n.produccion.terminadas_anterior} la anterior · {n.produccion.en_proceso} en proceso
                    {n.produccion.atrasadas > 0 && <> · <span className="text-peligro font-medium">{n.produccion.atrasadas} atrasadas</span></>}</>} />
              )}
              {n.compras && (
                <Kpi titulo="Compras que llegan" icono={PackageCheck} tono={n.compras.atrasadas ? "aviso" : "info"} valor={numero(n.compras.por_llegar.length)}
                  detalle={<>{n.compras.atrasadas > 0 ? <span className="text-aviso font-medium">{n.compras.atrasadas} atrasadas</span> : "ninguna atrasada"}
                    {n.compras.ajustes_pendientes > 0 && <> · {n.compras.ajustes_pendientes} ajustes por autorizar</>}</>} />
              )}
              <Kpi titulo="Tus pendientes" icono={ListTodo} tono={n.pendientes.vencidos ? "peligro" : "neutro"} valor={numero(n.pendientes.vencidos)}
                detalle={<>vencidos · {n.pendientes.esta_semana} vencen esta semana · {n.pendientes.cerrados} cerrados la pasada</>} />
            </div>
          )}

          {n && (
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="tarjeta lg:col-span-2 min-w-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-borde flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <CalendarDays className="h-4 w-4 text-tenue" />
                  <h2 className="font-semibold">Esta semana</h2>
                  <span className="text-xs text-tenue hidden sm:inline">entregas, producción, lo que llega y servicios</span>
                </div>
                {eventos.length === 0 ? (
                  <Vacio icono={CalendarDays} titulo="Nada con fecha esta semana"
                    texto="Cuando un pedido tenga fecha compromiso, una orden de compra fecha de entrega o un servicio esté programado, aparece aquí." />
                ) : (
                  <ul className="divide-y divide-borde">
                    {eventos.map((e, i) => {
                      const atrasado = e.fecha < hoy; // con fecha de esta semana, ya pasó y sigue abierto
                      return (
                        <li key={i}>
                          <Link to={e.ruta} className="flex items-center gap-3 px-4 py-2.5 hover:bg-fondo">
                            <span className={cn("w-[4.5rem] shrink-0 text-xs font-medium cifra first-letter:uppercase", atrasado ? "text-peligro" : "text-tenue")}>{diaDe(e.fecha)}</span>
                            <e.icono className="h-4 w-4 shrink-0 text-tenue" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm truncate">{e.titulo}</span>
                              <span className="block text-xs text-tenue truncate">{e.tipo}{e.detalle && ` · ${e.detalle}`}</span>
                            </span>
                            {/* En celular basta la fecha en rojo; la insignia le quitaba espacio al nombre. */}
                            {atrasado && <span className="hidden sm:inline-flex"><Insignia tono="peligro">Atrasada</Insignia></span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              {n.ventas && (
                <section className="tarjeta min-w-0">
                  <div className="px-4 py-3 border-b border-borde">
                    <h2 className="font-semibold">Quién compró más</h2>
                    <p className="text-xs text-tenue">La semana pasada{n.ventas.alcance === "tuyas" ? ", de tus clientes" : ""}</p>
                  </div>
                  {n.ventas.mejores_clientes.length === 0 ? (
                    <p className="p-4 text-sm text-tenue">Sin ventas la semana pasada. Revisa a quién llamar hoy.</p>
                  ) : (
                    <ol className="p-2">
                      {n.ventas.mejores_clientes.map((c, i) => (
                        <li key={i} className="flex items-center gap-3 px-2 py-2">
                          <span className="h-6 w-6 rounded-full bg-marca-suave text-marca-texto text-xs font-semibold grid place-items-center">{i + 1}</span>
                          <span className="flex-1 min-w-0 text-sm truncate">{String(c.nombre)}</span>
                          <span className="cifra text-sm font-medium">{dinero(Number(c.monto))}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="px-4 pb-4">
                    <Link to="/ventas/para-llamar" className="text-sm text-marca-texto inline-flex items-center gap-1">A quién llamar hoy<ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </Pagina>
  );
}

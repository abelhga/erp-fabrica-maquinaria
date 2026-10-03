// A quién llamar hoy. La lista la arma la base (oportunidades_sugeridas): sale del
// libro de ventas desde 2018, de las cotizaciones vivas y de las oportunidades
// abiertas, y respeta la cartera (cada vendedor ve sus clientes y los libres).
// Claude solo entra al final, a redactar el mensaje; enviarlo lo decide el vendedor.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Copy, FileText, MessageCircle, PhoneCall, RefreshCcw, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { redactarMensaje } from "@/lib/asistente";
import { dinero, dineroCompacto, fecha, numero } from "@/lib/formato";
import { cn, coincide } from "@/lib/utilidades";

interface Oportunidad {
  cliente_id: string; cliente: string; vendedor: string | null; motivo: Motivo; detalle: string;
  ultima_compra: string | null; compras: number | null; total_historico: number | null; ticket_promedio: number | null;
  dias_sin_comprar: number | null; intervalo_tipico: number | null; valor_estimado: number; puntaje: number;
  cotizacion_id: string | null; contacto: string | null; telefono: string | null; whatsapp: string | null; correo: string | null;
}
type Motivo = "cotizacion" | "le_toca" | "refacciones" | "reactivar";

const MOTIVOS: Record<Motivo, { texto: string; tono: Tono; icono: typeof FileText; ayuda: string }> = {
  cotizacion: { texto: "Cotización por vencer", tono: "peligro", icono: FileText, ayuda: "Tiene una cotización enviada que vence en 7 días o venció hace poco." },
  le_toca: { texto: "Ya le toca", tono: "aviso", icono: CalendarClock, ayuda: "Compra con un ritmo y ya pasó el tiempo de siempre." },
  refacciones: { texto: "Refacciones", tono: "info", icono: Wrench, ayuda: "Compró un equipo hace 6 meses o más: ya pide rodillos, banda, cangilones o servicio." },
  reactivar: { texto: "Reactivar", tono: "neutro", icono: RefreshCcw, ayuda: "Compró 2 o más veces y lleva entre 6 meses y 3 años sin comprar." },
};

/** wa.me necesita el número con lada de país; los de la hoja vienen a 10 dígitos. */
function numeroWhatsApp(t: string | null) {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length === 10) return "52" + d;
  if (d.length === 12 && d.startsWith("52")) return d;
  if (d.length === 13 && d.startsWith("521")) return "52" + d.slice(3);
  return null;
}

export default function ParaLlamar() {
  const [filtro, setFiltro] = useState<Motivo | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [redactando, setRedactando] = useState<Oportunidad | null>(null);
  const lista = useQuery({
    queryKey: ["oportunidades_sugeridas"],
    queryFn: () => q<Oportunidad[]>(supabase.rpc("oportunidades_sugeridas", { p_limite: 150 })),
  });

  const conteo = useMemo(() => {
    const c: Record<string, { n: number; valor: number }> = {};
    for (const o of lista.data ?? []) {
      c[o.motivo] ??= { n: 0, valor: 0 };
      c[o.motivo].n++; c[o.motivo].valor += Number(o.valor_estimado);
    }
    return c;
  }, [lista.data]);
  const visibles = (lista.data ?? []).filter((o) => (filtro === "todas" || o.motivo === filtro) && (!busca || coincide(`${o.cliente} ${o.detalle} ${o.vendedor ?? ""}`, busca)));
  const total = (lista.data ?? []).reduce((s, o) => s + Number(o.valor_estimado), 0);

  return (
    <Pagina titulo="A quién llamar hoy"
      descripcion="Clientes con un motivo concreto para buscarlos, ordenados por lo que hay en juego. Sale del libro de ventas desde 2018 y de las cotizaciones vivas.">
      {lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={8} /> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <button onClick={() => setFiltro("todas")}
              className={cn("tarjeta p-4 text-left transition hover:border-marca/40", filtro === "todas" && "ring-2 ring-marca/50 border-marca/50")}>
              <p className="text-sm text-tenue flex items-center gap-2"><PhoneCall className="h-4 w-4 text-marca" />Todas</p>
              <p className="text-2xl font-semibold cifra mt-1">{numero(lista.data?.length ?? 0)}</p>
              <p className="text-xs text-tenue">{dineroCompacto(total)} en juego</p>
            </button>
            {(Object.keys(MOTIVOS) as Motivo[]).map((m) => {
              const M = MOTIVOS[m];
              return (
                <button key={m} onClick={() => setFiltro(m)} title={M.ayuda}
                  className={cn("tarjeta p-4 text-left transition hover:border-marca/40", filtro === m && "ring-2 ring-marca/50 border-marca/50")}>
                  <p className="text-sm text-tenue flex items-center gap-2"><M.icono className="h-4 w-4" />{M.texto}</p>
                  <p className="text-2xl font-semibold cifra mt-1">{numero(conteo[m]?.n ?? 0)}</p>
                  <p className="text-xs text-tenue">{dineroCompacto(conteo[m]?.valor ?? 0)} en juego</p>
                </button>
              );
            })}
          </div>

          <input className="campo max-w-md" placeholder="Buscar cliente, producto o vendedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />

          {visibles.length === 0 ? (
            <Vacio icono={PhoneCall} titulo="Nadie en esta lista"
              texto="Cuando un cliente deje pasar su ritmo de compra o una cotización esté por vencer, aparecerá aquí." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibles.map((o, i) => {
                const M = MOTIVOS[o.motivo];
                const wa = numeroWhatsApp(o.whatsapp ?? o.telefono);
                return (
                  <article key={o.cliente_id} className="tarjeta p-4 flex flex-col gap-3 animate-entrar" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug truncate">{o.cliente}</h3>
                        <p className="text-xs text-tenue">{o.vendedor ?? "Sin vendedor (libre)"}{o.contacto && ` · ${o.contacto}`}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Insignia tono={M.tono}><M.icono className="h-3 w-3" />{M.texto}</Insignia>
                        <p className="text-sm font-semibold cifra mt-1">{dinero(o.valor_estimado)}</p>
                      </div>
                    </div>
                    <p className="text-sm">{o.detalle}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tenue">
                      {o.ultima_compra && <span>Última compra {fecha(o.ultima_compra)}</span>}
                      {o.compras != null && <span>{numero(o.compras)} {o.compras === 1 ? "compra" : "compras"} · {dineroCompacto(o.total_historico)} desde 2018</span>}
                      {o.intervalo_tipico != null && <span>Ritmo ~{o.intervalo_tipico} días</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <Boton tamano="sm" onClick={() => setRedactando(o)}><Sparkles className="h-3.5 w-3.5" />Redactar mensaje</Boton>
                      {wa && (
                        <Boton tamano="sm" variante="secundario" asChild>
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                        </Boton>
                      )}
                      {o.telefono && (
                        <Boton tamano="sm" variante="fantasma" asChild>
                          <a href={`tel:${o.telefono.replace(/\s/g, "")}`}><PhoneCall className="h-3.5 w-3.5" />{o.telefono}</a>
                        </Boton>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      {redactando && <Redactar o={redactando} alCerrar={() => setRedactando(null)} />}
    </Pagina>
  );
}

function Redactar({ o, alCerrar }: { o: Oportunidad; alCerrar: () => void }) {
  const [canal, setCanal] = useState<"whatsapp" | "correo">(o.whatsapp || o.telefono || !o.correo ? "whatsapp" : "correo");
  const borrador = useQuery({
    queryKey: ["redactar", o.cliente_id, canal],
    queryFn: () => redactarMensaje(o.cliente_id, canal, o.detalle),
    staleTime: Infinity,
    retry: false,
  });
  const [texto, setTexto] = useState<string | null>(null);
  const mensaje = texto ?? borrador.data?.mensaje ?? "";
  const wa = numeroWhatsApp(o.whatsapp ?? o.telefono);

  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo={`Mensaje para ${o.cliente}`} ancho="max-w-xl"
      descripcion={borrador.data?.simulado ? "Plantilla básica: con la llave de Claude conectada, el mensaje se escribe con su historial de compras." : "Lo escribió Claude con el historial del cliente. Revísalo y ajústalo antes de mandarlo."}
      pie={
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="secundario" onClick={() => { navigator.clipboard.writeText(mensaje); toast.success("Mensaje copiado"); }} disabled={!mensaje}>
            <Copy className="h-4 w-4" />Copiar
          </Boton>
          {canal === "whatsapp" && wa && (
            <Boton asChild><a href={`https://wa.me/${wa}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Abrir en WhatsApp</a></Boton>
          )}
          {canal === "correo" && o.correo && (
            <Boton asChild><a href={`mailto:${o.correo}?subject=${encodeURIComponent(borrador.data?.asunto ?? "")}&body=${encodeURIComponent(mensaje)}`}>Abrir correo</a></Boton>
          )}
        </div>
      }>
      <div className="space-y-3">
        <div className="inline-flex rounded-lg border border-borde p-0.5 text-sm">
          {(["whatsapp", "correo"] as const).map((c) => (
            <button key={c} onClick={() => { setCanal(c); setTexto(null); }}
              className={cn("px-3 h-8 rounded-md", canal === c ? "bg-marca text-white" : "text-tenue hover:text-texto")}>
              {c === "whatsapp" ? "WhatsApp" : "Correo"}
            </button>
          ))}
        </div>
        {borrador.isLoading ? (
          <div className="h-40 rounded-lg bg-fondo animate-pulse grid place-items-center text-sm text-tenue">
            <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />Leyendo su historial y escribiendo…</span>
          </div>
        ) : borrador.error ? (
          <p className="text-sm text-peligro">{(borrador.error as Error).message}</p>
        ) : (
          <>
            {canal === "correo" && borrador.data?.asunto && <p className="text-sm"><span className="text-tenue">Asunto:</span> {borrador.data.asunto}</p>}
            <textarea className="campo h-48 py-2 leading-relaxed" value={mensaje} onChange={(e) => setTexto(e.target.value)} />
          </>
        )}
      </div>
    </Dialogo>
  );
}

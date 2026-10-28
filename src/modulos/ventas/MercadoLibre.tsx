import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Link2, MessageCircleQuestion, Send, Settings } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { Ligar, PublicacionesAjenas, PublicacionesLigadas, type SinLigar } from "./componentes/PublicacionesML";
import { DineroMercadoLibre } from "./componentes/DineroML";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fechaYHora, hace, numero } from "@/lib/formato";
import { llamarML, type EstadoML } from "@/lib/mercadolibre";
import { GLOSARIO } from "@/tutorial/glosario";

interface Pregunta {
  id: number; item_id: string; articulo_id: string | null; titulo_publicacion: string | null; texto: string;
  estado: "pendiente" | "contestada" | "borrada" | "sin_publicacion"; recibida_en: string; respuesta: string | null; contestada_en: string | null;
}

const minutos = (p: Pregunta) => p.contestada_en ? (new Date(p.contestada_en).getTime() - new Date(p.recibida_en).getTime()) / 60_000 : null;
const duracion = (m: number) => m < 60 ? `${Math.round(m)} min` : m < 48 * 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m / 1440)} días`;

/** Lo de Mercado Libre que pide a alguien: preguntas por contestar y publicaciones por ligar. */
export default function MercadoLibre() {
  const { puede, tieneRol } = useSesion();
  const [params, setParams] = useSearchParams();
  const seccion = params.get("seccion") ?? "preguntas";
  useTiempoReal("ml_preguntas", [["ml_preguntas"]]);
  const estado = useQuery({ queryKey: ["estado_mercadolibre"], queryFn: () => q<EstadoML>(supabase.rpc("estado_mercadolibre")) });
  const preguntas = useQuery({
    queryKey: ["ml_preguntas"],
    queryFn: () => q<Pregunta[]>(supabase.from("ml_preguntas").select("*").neq("estado", "borrada").order("recibida_en", { ascending: false }).limit(300)),
  });
  const sinLigar = useQuery({
    queryKey: ["ml_publicaciones_sin_ligar"],
    queryFn: () => q<SinLigar[]>(supabase.from("ml_publicaciones_sin_ligar").select("*").order("visto_en", { ascending: false })),
  });

  const todas = preguntas.data ?? [];
  const pendientes = todas.filter((p) => p.estado === "pendiente").sort((a, b) => a.recibida_en.localeCompare(b.recibida_en));
  const hace30 = Date.now() - 30 * 86_400_000;
  const contestadas30 = todas.filter((p) => p.contestada_en && new Date(p.contestada_en).getTime() >= hace30);
  const tiempos = contestadas30.map(minutos).filter((m): m is number => m != null).sort((a, b) => a - b);
  const mediana = tiempos.length ? tiempos[Math.floor(tiempos.length / 2)] : null;
  const enUnaHora = tiempos.length ? tiempos.filter((m) => m <= 60).length / tiempos.length : null;

  return (
    <Pagina titulo="Mercado Libre" descripcion="Preguntas de compradores por contestar, publicaciones que falta ligar a su artículo y el dinero de cada venta. Las ventas entran solas a Pedidos."
      acciones={(tieneRol("direccion") || puede("admin", 3)) && <Boton asChild variante="secundario"><Link to="/sistema/configuracion?seccion=integraciones"><Settings className="h-4 w-4" /> Conexión</Link></Boton>}>
      {estado.data && !estado.data.conectada && (
        <p className="rounded-lg bg-aviso-suave px-3 py-2 text-sm">Mercado Libre todavía no está conectado: aquí aparecerán las preguntas y las publicaciones por ligar en cuanto dirección lo conecte en Configuración → Integraciones.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi titulo="Preguntas sin contestar" valor={numero(pendientes.length)} icono={MessageCircleQuestion} tono={pendientes.length ? "aviso" : "ok"}
          detalle={pendientes[0] ? `La más vieja ${hace(pendientes[0].recibida_en)}` : "Todo contestado"} alClic={() => setParams({ seccion: "preguntas" })} />
        <Kpi titulo="Tiempo de respuesta" valor={mediana == null ? "—" : duracion(mediana)} icono={Clock} tono={mediana != null && mediana > 60 ? "aviso" : "marca"}
          detalle={enUnaHora == null ? "Sin respuestas en 30 días" : `${Math.round(enUnaHora * 100)} % en menos de 1 h (30 días)`} explica={GLOSARIO.tiempoRespuestaML} />
        <Kpi titulo="Publicaciones por ligar" valor={numero(sinLigar.data?.length ?? 0)} icono={Link2} tono={sinLigar.data?.length ? "aviso" : "ok"}
          detalle="Su envío ya está pedido; se ligan antes de cerrar la caja" explica={GLOSARIO.publicacionPorLigar} alClic={() => setParams({ seccion: "ligar" })} />
      </div>

      <Pestanas value={seccion} onValueChange={(v) => setParams(v === "preguntas" ? {} : { seccion: v }, { replace: true })}>
        <ListaPestanas opciones={[
          { valor: "preguntas", texto: "Preguntas", cuenta: pendientes.length },
          { valor: "ligar", texto: "Por ligar", cuenta: sinLigar.data?.length, explica: GLOSARIO.publicacionPorLigar },
          { valor: "ligadas", texto: "Ligadas", explica: GLOSARIO.publicacionLigada },
          { valor: "dinero", texto: "Dinero", explica: GLOSARIO.dineroML },
        ]} />
        <ContenidoPestana value="preguntas" className="pt-4 space-y-3">
          {preguntas.error ? <ErrorCarga error={preguntas.error} /> : preguntas.isLoading ? <Cargando filas={4} /> : todas.length === 0 ? (
            <div className="tarjeta"><Vacio icono={MessageCircleQuestion} titulo="Sin preguntas todavía" texto="Cuando un comprador pregunte en una publicación, aparece aquí y le llega un aviso al responsable de Mercado Libre." /></div>
          ) : <>
            {pendientes.map((p) => <PreguntaPendiente key={p.id} p={p} editable={puede("ventas", 2)} />)}
            {pendientes.length === 0 && <p className="text-sm text-tenue">No hay preguntas sin contestar.</p>}
            {todas.some((p) => p.estado === "sin_publicacion") && (
              <p className="text-xs text-tenue" data-explain={GLOSARIO.preguntaSinPublicacion} data-explain-title="Sin publicación activa">
                {todas.filter((p) => p.estado === "sin_publicacion").length} preguntas de publicaciones pausadas o cerradas no se muestran: Mercado Libre ya no deja contestarlas.
              </p>
            )}
            <h3 className="font-semibold pt-2">Contestadas</h3>
            {!todas.some((p) => p.estado === "contestada") ? <p className="text-sm text-tenue">Todavía ninguna: las que contestes aquí o en Mercado Libre quedan con su tiempo de respuesta.</p> : <Tarjeta>
              <ul className="divide-y divide-borde">
                {todas.filter((p) => p.estado === "contestada").slice(0, 50).map((p) => (
                  <li key={p.id} className="px-5 py-3 text-sm">
                    <p className="text-xs text-tenue">{p.titulo_publicacion ?? p.item_id} · {fechaYHora(p.recibida_en)}{minutos(p) != null && <> · contestada en <b className="text-texto">{duracion(minutos(p)!)}</b></>}</p>
                    <p className="mt-0.5">{p.texto}</p>
                    {p.respuesta && <p className="mt-1 text-tenue">↳ {p.respuesta}</p>}
                  </li>
                ))}
              </ul>
            </Tarjeta>}
          </>}
        </ContenidoPestana>
        <ContenidoPestana value="ligar" className="pt-4 space-y-5">
          {sinLigar.error ? <ErrorCarga error={sinLigar.error} /> : sinLigar.isLoading ? <Cargando filas={3} /> : (sinLigar.data ?? []).length === 0 ? (
            <div className="tarjeta"><Vacio icono={Link2} titulo="Todas las publicaciones vendidas están ligadas" texto="Si se vende una publicación que el ERP no conoce (sin SKU o con uno que no es clave del catálogo), aparece aquí para decir qué artículo es. Su envío ya está pedido: almacén también la puede ligar al empacar." /></div>
          ) : (
            <Tarjeta>
              <ul className="divide-y divide-borde">{sinLigar.data!.map((s) => <Ligar key={s.item_id} s={s} editable={puede("ventas", 2) || puede("compras", 2)} />)}</ul>
            </Tarjeta>
          )}
          <PublicacionesAjenas editable={puede("ventas", 2) || puede("compras", 2)} />
        </ContenidoPestana>
        <ContenidoPestana value="ligadas" className="pt-4">
          <PublicacionesLigadas editable={puede("ventas", 2) || puede("compras", 2)} />
        </ContenidoPestana>
        <ContenidoPestana value="dinero" className="pt-4">
          <DineroMercadoLibre />
        </ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

function PreguntaPendiente({ p, editable }: { p: Pregunta; editable: boolean }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const espera = (Date.now() - new Date(p.recibida_en).getTime()) / 60_000;
  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await llamarML("responder", { pregunta_id: p.id, texto: texto.trim() });
      toast.success("Respuesta publicada en Mercado Libre");
      qc.invalidateQueries({ queryKey: ["ml_preguntas"] });
      qc.invalidateQueries({ queryKey: ["estado_mercadolibre"] });
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Tarjeta className="p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-tenue">
        {p.articulo_id ? <Link to={`/costeo/componentes/${p.articulo_id}`} className="text-marca-texto hover:underline">{p.titulo_publicacion ?? p.item_id}</Link> : <span>{p.titulo_publicacion ?? p.item_id}</span>}
        <span>· {fechaYHora(p.recibida_en)}</span>
        <Insignia tono={espera > 60 ? "peligro" : espera > 30 ? "aviso" : "info"}>esperando {duracion(espera)}</Insignia>
      </div>
      <p className="font-medium">{p.texto}</p>
      {editable && (
        <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
          <textarea className="campo min-h-[60px] flex-1" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000}
            placeholder="Escribe la respuesta: se publica en Mercado Libre tal cual." onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(); }} />
          <Boton type="submit" cargando={enviando} disabled={!texto.trim()}><Send className="h-4 w-4" /> Contestar</Boton>
        </form>
      )}
    </Tarjeta>
  );
}

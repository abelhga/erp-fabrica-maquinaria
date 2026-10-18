import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Search, Wifi } from "lucide-react";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { dinero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { llamarSkydropx, type ConfigSkydropx, type DireccionSkydropx, type PruebaSkydropx } from "@/lib/skydropx";
import { GLOSARIO } from "@/tutorial/glosario";

const textoDireccion = (d: DireccionSkydropx | null | undefined) =>
  d ? [d.street1, d.area_level3 && `Col. ${d.area_level3}`, [d.postal_code, d.area_level2].filter(Boolean).join(" "), d.area_level1].filter(Boolean).join(", ") : "";

/** Skydropx: probar las credenciales, de dónde salen los paquetes y qué se declara en la carta porte. */
export function ConfigSkydropx() {
  const { puede } = useSesion();
  const admin = puede("envios", 3);
  const cfg = useQuery({
    queryKey: ["configuracion", "skydropx"],
    queryFn: async () => (await q<{ valor: ConfigSkydropx } | null>(supabase.from("configuracion").select("valor").eq("clave", "skydropx").maybeSingle()))?.valor ?? null,
  });
  const [prueba, setPrueba] = useState<PruebaSkydropx | null>(null);
  const [probando, setProbando] = useState(false);
  const fijar = useAccion((datos: Partial<ConfigSkydropx>) => q(supabase.rpc("fijar_config_skydropx", { p_datos: datos })), {
    exito: "Guardado", invalidar: [["configuracion", "skydropx"]],
  });

  async function probar() {
    setProbando(true);
    try { setPrueba(await llamarSkydropx<PruebaSkydropx>("probar")); }
    catch (e) { toast.error(mensajeError(e)); setPrueba(null); }
    finally { setProbando(false); }
  }

  const c = cfg.data;
  const listo = !!c?.origen?.postal_code && !!c?.carta_porte;
  return (
    <>
      <Tarjeta>
        <EncabezadoTarjeta titulo="Skydropx" explica={GLOSARIO.cotizarSkydropx}
          descripcion="Cotiza con todas las paqueterías y genera la guía desde el envío; el PDF y el costo quedan solos."
          acciones={prueba?.conectado ? <Insignia tono="ok"><CheckCircle2 className="h-3.5 w-3.5" /> Conectado</Insignia>
            : <Insignia tono={listo ? "info" : "neutro"}>{listo ? "Configurado" : "Falta configurar"}</Insignia>} />
        <div className="px-5 pb-5 space-y-4 text-sm">
          <dl className="grid gap-2">
            <Fila titulo="Sale de">{c?.origen ? textoDireccion(c.origen) : <span className="text-tenue">Sin elegir: prueba la conexión y elige la plantilla de la planta.</span>}</Fila>
            <Fila titulo="Carta porte" explica={GLOSARIO.cartaPorte}>{c?.carta_porte ? <span className="cifra">{c.carta_porte}</span> : <span className="text-tenue">Sin clave: no se puede generar guía.</span>}</Fila>
            <Fila titulo="Empaque"><span className="cifra">{c?.tipo_empaque ?? "4G"}</span></Fila>
          </dl>

          {admin && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Boton variante="secundario" onClick={probar} cargando={probando}><Wifi className="h-4 w-4" /> Probar conexión</Boton>
                {prueba?.conectado && <span>Saldo en Skydropx: <b className="cifra">{dinero(prueba.saldo ?? 0)}</b></span>}
              </div>

              {prueba && (
                <Campo etiqueta="Dirección de origen" ayuda="Las plantillas se dan de alta en el panel de Skydropx; aquí solo se elige cuál es la planta.">
                  {prueba.plantillas.length === 0 ? <p className="text-tenue">No hay plantillas en Skydropx. Da de alta la dirección de la planta en su panel y vuelve a probar.</p> : (
                    <ul className="divide-y divide-borde rounded-lg border border-borde">
                      {prueba.plantillas.map((p) => (
                        <li key={p.id}>
                          <button type="button" disabled={fijar.isPending}
                            onClick={() => fijar.mutate({ origen_plantilla_id: p.id, origen: p.direccion })}
                            className={cn("w-full px-3 py-2 text-left hover:bg-fondo", c?.origen_plantilla_id === p.id && "bg-marca-suave")}>
                            <b className="font-medium">{p.alias ?? p.direccion.company ?? "Plantilla"}</b>
                            {p.predeterminada && <span className="text-xs text-tenue"> · predeterminada</span>}
                            <span className="block text-xs text-tenue">{textoDireccion(p.direccion)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Campo>
              )}

              <BuscarClave tipo="carta_porte" etiqueta="Clave de carta porte" actual={c?.carta_porte ?? null}
                ayuda="La del SAT para lo que más mandan (la misma que se usa hoy en el panel de Skydropx). Busca por número o por palabra."
                alElegir={(clave) => fijar.mutate({ carta_porte: clave })} />
              <BuscarClave tipo="empaque" etiqueta="Tipo de empaque" actual={c?.tipo_empaque ?? "4G"} ayuda="4G es caja de cartón."
                alElegir={(clave) => fijar.mutate({ tipo_empaque: clave })} />
              <Campo etiqueta="Formato de la guía">
                <Seleccion value={c?.formato ?? "standard"} onChange={(e) => fijar.mutate({ formato: e.target.value as "standard" | "thermal" })} disabled={fijar.isPending}>
                  <option value="standard">Hoja carta (impresora normal)</option>
                  <option value="thermal">Etiqueta térmica</option>
                </Seleccion>
              </Campo>
            </>
          )}
        </div>
      </Tarjeta>

      {admin && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Cómo se conecta Skydropx (una sola vez)" descripcion="Las credenciales son de producción: cada guía generada se cobra del saldo." />
          <ol className="px-5 pb-5 space-y-3 text-sm list-decimal pl-9">
            <li>En el panel de Skydropx: Configuración → API, copia el <b>Client ID</b> y el <b>Client Secret</b>.</li>
            <li>Pégalos en Supabase → Edge Functions → Secrets como <code>SKYDROPX_CLIENT_ID</code> y <code>SKYDROPX_CLIENT_SECRET</code>. No los mandes por chat ni correo.</li>
            <li>Regresa aquí, da <b>Probar conexión</b> y elige la dirección de la planta.</li>
            <li>Elige la clave de carta porte y el tipo de empaque.</li>
          </ol>
        </Tarjeta>
      )}
    </>
  );
}

function Fila({ titulo, explica, children }: { titulo: string; explica?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-tenue" data-explain={explica} data-explain-title={explica ? titulo : undefined}>{titulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Buscar una clave del SAT en el catálogo de Skydropx y elegirla. */
function BuscarClave({ tipo, etiqueta, actual, ayuda, alElegir }: {
  tipo: "carta_porte" | "empaque"; etiqueta: string; actual: string | null; ayuda: string; alElegir: (clave: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<{ clave: string; nombre: string }[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  async function buscar() {
    if (!texto.trim()) return;
    setBuscando(true);
    try { setOpciones((await llamarSkydropx<{ opciones: { clave: string; nombre: string }[] }>("catalogo", { tipo, texto: texto.trim() })).opciones); }
    catch (e) { toast.error(mensajeError(e)); }
    finally { setBuscando(false); }
  }
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <div className="flex gap-2">
        <Entrada value={texto} placeholder={actual ? `Actual: ${actual}` : tipo === "carta_porte" ? "Maquinaria, 24112700…" : "Caja, tarima…"}
          onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} />
        <Boton type="button" variante="secundario" onClick={buscar} cargando={buscando} aria-label={`Buscar ${etiqueta.toLowerCase()}`}><Search className="h-4 w-4" /></Boton>
      </div>
      {opciones && (opciones.length === 0 ? <p className="text-xs text-tenue">Nada con eso; prueba otra palabra.</p> : (
        <ul className="max-h-48 overflow-auto divide-y divide-borde rounded-lg border border-borde">
          {opciones.map((o) => (
            <li key={o.clave}>
              <button type="button" className={cn("w-full px-3 py-1.5 text-left text-xs hover:bg-fondo", o.clave === actual && "bg-marca-suave")}
                onClick={() => { alElegir(o.clave); setOpciones(null); setTexto(""); }}>
                <b className="cifra">{o.clave}</b> · {o.nombre}
              </button>
            </li>
          ))}
        </ul>
      ))}
    </Campo>
  );
}

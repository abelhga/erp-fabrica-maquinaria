import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { dinero, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { llamarSkydropx, type TarifaSkydropx } from "@/lib/skydropx";
import { CampoNumero } from "./campos";
import { GLOSARIO } from "@/tutorial/glosario";
import { dineroEn, type Contacto, type Moneda as MonedaCot } from "../comun";

interface Bulto { contenido?: string | null; piezas?: number | null; peso_kg: number | null; largo_cm: number | null; ancho_cm: number | null; alto_cm: number | null }
interface Moneda { moneda: MonedaCot; tipo_cambio: number; precios_con_iva: boolean; tasa_iva: number }

/**
 * Cotizar el flete antes de que el cliente compre: los bultos salen de las partidas (con el
 * empaque de cada artículo) y el destino del contacto. Al elegir una paquetería se agrega
 * la partida de flete con lo que cobra Skydropx más el recargo que fijó envíos. No genera
 * guía ni cobra nada: la guía se hace hasta que haya pedido y envío.
 */
export function DialogoFleteSkydropx({ abierto, alCambiar, cotizacionId, contacto, cliente, moneda, alAgregar }: {
  abierto: boolean; alCambiar: (v: boolean) => void; cotizacionId: string; contacto: Contacto | null;
  cliente: { estado?: string | null; ciudad?: string | null } | null; moneda: Moneda;
  alAgregar: (titulo: string, precio: number) => Promise<unknown>;
}) {
  const bultosBD = useQuery({
    queryKey: ["bultos_cotizacion", cotizacionId], enabled: abierto, staleTime: 0,
    queryFn: () => q<Bulto[]>(supabase.rpc("bultos_cotizacion", { p_cotizacion: cotizacionId })),
  });
  const [d, setD] = useState({ cp: "", estado: "", municipio: "", colonia: "" });
  const [bultos, setBultos] = useState<Bulto[]>([]);
  const [tarifas, setTarifas] = useState<TarifaSkydropx[] | null>(null);
  const [recargo, setRecargo] = useState(0);
  const [elegida, setElegida] = useState<TarifaSkydropx | null>(null);
  const [ocupado, setOcupado] = useState<null | "cotizar" | "agregar">(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setTarifas(null); setElegida(null); setAviso(null);
    setD({ cp: contacto?.domicilio_cp ?? "", estado: contacto?.domicilio_estado ?? cliente?.estado ?? "",
      municipio: contacto?.domicilio_municipio ?? cliente?.ciudad ?? "", colonia: contacto?.domicilio_colonia ?? "" });
  }, [abierto, contacto, cliente]);
  useEffect(() => { if (abierto && bultosBD.data) setBultos(bultosBD.data.map((b) => ({ ...b }))); }, [abierto, bultosBD.data]);

  // Lo que va en la partida, en los términos de la cotización (con o sin IVA, en su moneda),
  // redondeado hacia arriba: a $10 en pesos, a $1 en dólares.
  const alCliente = (t: TarifaSkydropx) => {
    const conIva = t.total * (1 + recargo);
    const enCot = (moneda.precios_con_iva ? conIva : conIva / (1 + Number(moneda.tasa_iva))) / Number(moneda.tipo_cambio || 1);
    return moneda.moneda === "MXN" ? Math.ceil(enCot / 10) * 10 : Math.ceil(enCot);
  };
  const faltaDestino = !/^\d{5}$/.test(d.cp.trim()) || !d.estado.trim() || !d.municipio.trim() || !d.colonia.trim();
  const sinMedidas = bultos.some((b) => !b.peso_kg || !b.largo_cm || !b.ancho_cm || !b.alto_cm);

  async function cotizar() {
    setOcupado("cotizar"); setAviso(null);
    try {
      const r = await llamarSkydropx<{ tarifas: TarifaSkydropx[]; recargo: number }>("cotizar_libre", { destino: d, bultos });
      setTarifas(r.tarifas); setRecargo(Number(r.recargo) || 0); setElegida(r.tarifas[0] ?? null);
    } catch (e) { setAviso(mensajeError(e)); } finally { setOcupado(null); }
  }
  async function agregar() {
    if (!elegida) return;
    setOcupado("agregar");
    try {
      const dias = elegida.dias != null ? ` (${elegida.dias} ${elegida.dias === 1 ? "día" : "días"} hábiles aprox.)` : "";
      await alAgregar(`Flete ${elegida.paqueteria} ${elegida.servicio} a ${d.municipio.trim()}, ${d.estado.trim()}, CP ${d.cp.trim()}${dias}`, alCliente(elegida));
      alCambiar(false);
    } catch (e) { setAviso(mensajeError(e)); } finally { setOcupado(null); }
  }
  const cambiar = (i: number, k: keyof Bulto, n: number) => setBultos((bs) => bs.map((b, j) => (j === i ? { ...b, [k]: n || null } : b)));
  const enCot = (n: number) => (moneda.moneda === "MXN" ? dinero(n) : dineroEn(n, moneda.moneda));

  return (
    <Dialogo abierto={abierto} alCambiar={(v) => { if (!ocupado) alCambiar(v); }} ancho="max-w-2xl"
      titulo={<span data-explain={GLOSARIO.fleteCotizacion} data-explain-title="Cotizar flete">Cotizar flete con Skydropx</span>}
      descripcion="A dónde va y cuánto pesa. No se genera guía ni se cobra nada: solo se agrega la partida de flete."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        {tarifas && tarifas.length > 0
          ? <Boton onClick={agregar} cargando={ocupado === "agregar"} disabled={!elegida}><Plus className="h-4 w-4" />Agregar flete{elegida ? ` · ${enCot(alCliente(elegida))}` : ""}</Boton>
          : <Boton onClick={cotizar} cargando={ocupado === "cotizar"} disabled={faltaDestino || sinMedidas || bultos.length === 0}>
              {ocupado === "cotizar" ? "Cotizando con las paqueterías…" : "Cotizar"}</Boton>}</>}>
      {aviso && <p className="mb-3 flex gap-2 rounded-lg bg-peligro-suave px-3 py-2 text-sm text-peligro" role="alert"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{aviso}</p>}
      {bultosBD.isLoading ? <Cargando filas={3} /> : tarifas ? (
        tarifas.length === 0 ? <p className="rounded-lg bg-aviso-suave px-3 py-3 text-sm">Ninguna paquetería cotizó esta ruta con estas medidas. Revisa el CP y la colonia o ponlo como flete a mano.</p> : (
          <div className="space-y-2">
            <ul className="divide-y divide-borde rounded-xl border border-borde" role="radiogroup" aria-label="Tarifas">
              {tarifas.map((t, i) => (
                <li key={t.id}>
                  <button type="button" role="radio" aria-checked={elegida?.id === t.id} onClick={() => setElegida(t)}
                    className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-fondo", elegida?.id === t.id && "bg-marca-suave")}>
                    <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", elegida?.id === t.id ? "border-marca bg-marca" : "border-borde")} />
                    <span className="min-w-0 flex-1"><b className="font-medium">{t.paqueteria}</b><span className="text-tenue"> · {t.servicio}</span>
                      {i === 0 && <span className="ml-2 text-xs text-ok">la más barata</span>}</span>
                    <span className="text-xs text-tenue whitespace-nowrap">{t.dias != null ? `${t.dias} ${t.dias === 1 ? "día" : "días"}` : "—"}</span>
                    <span className="w-24 text-right text-xs text-tenue cifra" title="Lo que cobra Skydropx, con IVA">{dinero(t.total)}</span>
                    <span className="w-24 text-right font-semibold cifra">{enCot(alCliente(t))}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-tenue" data-explain={GLOSARIO.fleteCotizacion}>
              Columna gris: lo que cobra Skydropx con IVA. En negritas: el precio de la partida ({moneda.precios_con_iva ? "con" : "sin"} IVA
              {moneda.moneda !== "MXN" ? `, en ${moneda.moneda}` : ""}), con {Math.round(recargo * 100)} % de recargo y redondeado hacia arriba. Lo puedes cambiar en la partida.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo etiqueta="Código postal"><Entrada value={d.cp} inputMode="numeric" placeholder="45130" autoFocus onChange={(e) => setD({ ...d, cp: e.target.value })} /></Campo>
            <Campo etiqueta="Estado"><Entrada value={d.estado} onChange={(e) => setD({ ...d, estado: e.target.value })} /></Campo>
            <Campo etiqueta="Municipio"><Entrada value={d.municipio} onChange={(e) => setD({ ...d, municipio: e.target.value })} /></Campo>
            <Campo etiqueta="Colonia"><Entrada value={d.colonia} onChange={(e) => setD({ ...d, colonia: e.target.value })} /></Campo>
          </div>
          {contacto?.domicilio && !contacto.domicilio_cp && <p className="text-xs text-tenue">Domicilio del contacto: {contacto.domicilio}</p>}
          <section className="space-y-2">
            <p className="text-sm font-medium">Bultos <span className="font-normal text-tenue">· salen del empaque de cada artículo; completa los que falten</span></p>
            {bultos.length === 0 ? <p className="text-sm text-tenue">Agrega partidas con artículos para calcular los bultos, o agrega uno a mano.</p> : (
              <div className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_1.5rem] gap-2 text-xs text-tenue">
                  <span>Contenido</span><span>Peso (kg)</span><span>Largo (cm)</span><span>Ancho (cm)</span><span>Alto (cm)</span><span />
                </div>
                {bultos.map((b, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_1.5rem] items-center gap-2 text-sm">
                    <span className="truncate text-tenue" title={b.contenido ?? undefined}>{b.piezas ? `${numero(Number(b.piezas))} × ` : ""}{b.contenido ?? "Bulto"}</span>
                    {(["peso_kg", "largo_cm", "ancho_cm", "alto_cm"] as const).map((k) => (
                      <CampoNumero key={k} valor={b[k]} decimales={k === "peso_kg" ? 2 : 1} vacioEsCero={false}
                        etiqueta={`${{ peso_kg: "Peso", largo_cm: "Largo", ancho_cm: "Ancho", alto_cm: "Alto" }[k]} del bulto ${i + 1}`} alCambiar={(n) => cambiar(i, k, n)} />
                    ))}
                    <button type="button" className="text-tenue hover:text-peligro" aria-label={`Quitar bulto ${i + 1}`} onClick={() => setBultos((bs) => bs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <Boton variante="fantasma" tamano="sm" onClick={() => setBultos((bs) => [...bs, { contenido: "Bulto", peso_kg: null, largo_cm: null, ancho_cm: null, alto_cm: null }])}>
              <Plus className="h-3.5 w-3.5" />Agregar bulto</Boton>
            {sinMedidas && <p className="text-xs text-peligro">Completa peso y medidas de cada bulto: sin ellas la paquetería no cotiza.</p>}
          </section>
        </div>
      )}
    </Dialogo>
  );
}

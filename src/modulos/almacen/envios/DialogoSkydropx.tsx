import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, Clock, RefreshCw } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Cargando } from "@/components/ui/estados";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { dinero, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CampoNumero } from "@/modulos/ventas/componentes/campos";
import { llamarSkydropx, type ResultadoGuia, type TarifaSkydropx } from "@/lib/skydropx";
import { CLAVE, useBultos, type Bulto, type Envio } from "./datos";
import { GLOSARIO } from "@/tutorial/glosario";

interface Destino {
  cp: string; estado: string; municipio: string; colonia: string; calle: string; referencia: string;
  empresa: string; correo: string; destinatario: string; telefono: string;
}
const VACIO: Destino = { cp: "", estado: "", municipio: "", colonia: "", calle: "", referencia: "", empresa: "", correo: "", destinatario: "", telefono: "" };
// Los topes de Skydropx (la base los vuelve a revisar).
const TOPE: Partial<Record<keyof Destino, number>> = { calle: 45, destinatario: 30, empresa: 60, referencia: 40 };

/**
 * Cotizar y generar la guía con Skydropx sin salir del envío. Tres pasos: destino y bultos,
 * tarifas, y confirmar el cobro (la cuenta es de producción: la guía se paga al generarla).
 */
export function DialogoSkydropx({ envio, abierto, alCambiar }: { envio: Envio; abierto: boolean; alCambiar: (v: boolean) => void }) {
  const qc = useQueryClient();
  const bultosBD = useBultos(abierto ? envio.id : null);
  const prellenado = useQuery({
    queryKey: ["destino_envio", envio.id], enabled: abierto, staleTime: 0,
    queryFn: () => q<(Partial<Record<keyof Destino, string | null>> & { texto: string | null; capturado: boolean }) | null>(supabase.rpc("destino_envio", { p_envio: envio.id })),
  });
  // Sin origen ni carta porte no hay guía: mejor decirlo antes de que capturen la dirección.
  const config = useQuery({ queryKey: ["configuracion", "skydropx"], enabled: abierto,
    queryFn: async () => (await q<{ valor: { origen: { postal_code?: string } | null; carta_porte: string | null } } | null>(
      supabase.from("configuracion").select("valor").eq("clave", "skydropx").maybeSingle()))?.valor ?? null });
  const sinConfig = config.data !== undefined && (!config.data?.origen?.postal_code || !config.data?.carta_porte);
  const estados = useQuery({ queryKey: ["geo_estados"], staleTime: Infinity, enabled: abierto,
    queryFn: () => q<{ cve_ent: string; nombre_corto: string }[]>(supabase.from("geo_estados").select("cve_ent, nombre_corto").order("nombre_corto")) });

  const [paso, setPaso] = useState<"destino" | "tarifas" | "confirmar" | "pendiente">("destino");
  const [d, setD] = useState<Destino>(VACIO);
  const [bultos, setBultos] = useState<Bulto[]>([]);
  const [tarifas, setTarifas] = useState<TarifaSkydropx[] | null>(null);
  const [completa, setCompleta] = useState(true);
  const [elegida, setElegida] = useState<TarifaSkydropx | null>(null);
  const [ocupado, setOcupado] = useState<null | "cotizar" | "generar" | "revisar">(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setPaso(envio.skydropx_envio_id ? "pendiente" : "destino"); setTarifas(null); setElegida(null); setAviso(null);
  }, [abierto, envio.skydropx_envio_id]);
  useEffect(() => {
    const p = prellenado.data;
    if (!abierto || !p) return;
    setD(Object.fromEntries(Object.keys(VACIO).map((k) => [k, p[k as keyof Destino] ?? ""])) as unknown as Destino);
  }, [abierto, prellenado.data]);
  useEffect(() => { if (abierto && bultosBD.data) setBultos(bultosBD.data.map((b) => ({ ...b }))); }, [abierto, bultosBD.data]);

  const cveEstado = estados.data?.find((x) => x.nombre_corto.toLowerCase() === d.estado.trim().toLowerCase())?.cve_ent;
  const municipios = useQuery({ queryKey: ["geo_municipios", cveEstado], enabled: abierto && !!cveEstado, staleTime: Infinity,
    queryFn: () => q<{ nombre: string }[]>(supabase.from("geo_municipios").select("nombre").eq("cve_ent", cveEstado!).order("nombre")) });

  const largos = (Object.keys(TOPE) as (keyof Destino)[]).filter((k) => d[k].trim().length > TOPE[k]!);
  const faltan = !/^\d{5}$/.test(d.cp.trim()) || !d.estado.trim() || !d.municipio.trim() || !d.colonia.trim() || !d.calle.trim()
    || !d.destinatario.trim() || d.telefono.replace(/\D/g, "").length < 10;
  const bultosCambiaron = useMemo(() => JSON.stringify(bultos.map(medidasDe)) !== JSON.stringify((bultosBD.data ?? []).map(medidasDe)), [bultos, bultosBD.data]);
  const sinMedidas = bultos.some((b) => !b.peso_kg || !b.largo_cm || !b.ancho_cm || !b.alto_cm);

  const terminar = () => { qc.invalidateQueries({ queryKey: CLAVE }); qc.invalidateQueries({ queryKey: ["destino_envio", envio.id] }); };

  async function cotizar() {
    setOcupado("cotizar"); setAviso(null);
    try {
      await q(supabase.rpc("guardar_destino_envio", { p_envio: envio.id, p_datos: d }));
      if (bultosCambiaron) await q(supabase.rpc("guardar_bultos", { p_envio: envio.id, p_bultos: bultos }));
      const r = await llamarSkydropx<{ tarifas: TarifaSkydropx[]; completa: boolean }>("cotizar", { envio_id: envio.id });
      setTarifas(r.tarifas); setCompleta(r.completa); setElegida(r.tarifas[0] ?? null); setPaso("tarifas");
      terminar();
    } catch (e) {
      setAviso(mensajeError(e));
    } finally { setOcupado(null); }
  }

  async function generar(accion: "generar" | "revisar") {
    setOcupado(accion); setAviso(null);
    try {
      const r = await llamarSkydropx<ResultadoGuia>(accion, { envio_id: envio.id, tarifa_id: elegida?.id });
      terminar();
      if (r.pendiente) { setPaso("pendiente"); setAviso(r.mensaje ?? null); return; }
      toast.success(`Guía ${r.numero} lista${r.costo != null ? ` · ${dinero(r.costo)}` : ""}: almacén ya puede empacar`);
      alCambiar(false);
    } catch (e) {
      setAviso(mensajeError(e));
      terminar();
    } finally { setOcupado(null); }
  }

  const cargando = prellenado.isLoading || bultosBD.isLoading;
  const campo = (k: keyof Destino, etiqueta: string, extra: { className?: string; placeholder?: string; lista?: string; ayuda?: string; inputMode?: "numeric" | "tel" | "email" } = {}) => (
    <Campo etiqueta={etiqueta} className={extra.className} ayuda={extra.ayuda}
      error={TOPE[k] && d[k].trim().length > TOPE[k]! ? `Cabe en ${TOPE[k]} letras (lleva ${d[k].trim().length})` : undefined}>
      <Entrada value={d[k]} placeholder={extra.placeholder} list={extra.lista} inputMode={extra.inputMode}
        onChange={(e) => setD({ ...d, [k]: e.target.value })} />
    </Campo>
  );

  const pie = paso === "destino" ? (
    <><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
      <Boton onClick={cotizar} cargando={ocupado === "cotizar"} disabled={cargando || sinConfig || faltan || largos.length > 0 || sinMedidas || bultos.length === 0}>
        {ocupado === "cotizar" ? "Cotizando con las paqueterías…" : "Cotizar"}</Boton></>
  ) : paso === "tarifas" ? (
    <><Boton variante="secundario" onClick={() => setPaso("destino")}><ArrowLeft className="h-4 w-4" />Destino</Boton>
      <Boton onClick={() => setPaso("confirmar")} disabled={!elegida}>Generar guía{elegida ? ` · ${dinero(elegida.total)}` : ""}</Boton></>
  ) : paso === "confirmar" ? (
    <><Boton variante="secundario" onClick={() => setPaso("tarifas")} disabled={!!ocupado}>Elegir otra</Boton>
      <Boton variante="exito" onClick={() => generar("generar")} cargando={ocupado === "generar"}><Check className="h-4 w-4" />Sí, generar y pagar</Boton></>
  ) : (
    <><Boton variante="secundario" onClick={() => alCambiar(false)}>Cerrar</Boton>
      <Boton onClick={() => generar("revisar")} cargando={ocupado === "revisar"}><RefreshCw className="h-4 w-4" />Revisar guía</Boton></>
  );

  return (
    <Dialogo abierto={abierto} alCambiar={(v) => { if (!ocupado) alCambiar(v); }} ancho="max-w-2xl"
      titulo={<span data-explain={GLOSARIO.cotizarSkydropx} data-explain-title="Cotizar con Skydropx">Skydropx · {envio.folio}</span>}
      descripcion={paso === "destino" ? "Revisa a dónde va y cuánto pesa: con eso cotizan todas las paqueterías a la vez."
        : paso === "tarifas" ? "Elige la que convenga. El precio ya trae IVA y se descuenta del saldo de Skydropx."
        : paso === "confirmar" ? "Al generarla, Skydropx la cobra de inmediato." : "La guía ya se pidió a Skydropx."}
      pie={pie}>
      {aviso && (
        <p className={cn("mb-3 flex gap-2 rounded-lg px-3 py-2 text-sm", paso === "pendiente" ? "bg-aviso-suave" : "bg-peligro-suave text-peligro")} role="alert">
          {paso === "pendiente" ? <Clock className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}{aviso}
        </p>
      )}

      {paso === "destino" && (cargando ? <Cargando filas={4} /> : (
        <div className="space-y-4">
          {sinConfig && (
            <p className="flex gap-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-aviso" />
              Falta configurar Skydropx (dirección de la planta y carta porte) en Configuración → Integraciones. Mientras, registra la guía a mano.</p>
          )}
          {prellenado.data?.texto && !prellenado.data.capturado && (
            <div className="rounded-lg border border-borde bg-fondo px-3 py-2 text-sm">
              <p className="etiqueta mb-0.5">Lo que dice el pedido</p>
              <p className="whitespace-pre-line">{prellenado.data.texto}</p>
            </div>
          )}
          <form className="grid gap-3 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); if (!faltan && !largos.length && !sinMedidas) cotizar(); }}>
            {campo("cp", "Código postal", { className: "sm:col-span-2", placeholder: "45130", inputMode: "numeric" })}
            {campo("estado", "Estado", { className: "sm:col-span-2", lista: "sky-estados" })}
            {campo("municipio", "Municipio", { className: "sm:col-span-2", lista: "sky-municipios" })}
            {campo("colonia", "Colonia", { className: "sm:col-span-3" })}
            {campo("calle", "Calle y número", { className: "sm:col-span-3", placeholder: "Av. Vallarta 1234 int. 5" })}
            {campo("referencia", "Referencia (opcional)", { className: "sm:col-span-6", placeholder: "Entre calles, portón negro…" })}
            {campo("destinatario", "Quién recibe", { className: "sm:col-span-3" })}
            {campo("telefono", "Teléfono", { className: "sm:col-span-3", inputMode: "tel" })}
            {campo("empresa", "Empresa (opcional)", { className: "sm:col-span-3" })}
            {campo("correo", "Correo (opcional)", { className: "sm:col-span-3", inputMode: "email", ayuda: "Sin correo, el aviso de la paquetería llega a planta." })}
            <button type="submit" className="hidden" />
          </form>
          <datalist id="sky-estados">{(estados.data ?? []).map((x) => <option key={x.cve_ent} value={x.nombre_corto} />)}</datalist>
          <datalist id="sky-municipios">{(municipios.data ?? []).map((x) => <option key={x.nombre} value={x.nombre} />)}</datalist>

          <section className="space-y-2">
            <p className="text-sm font-medium">Bultos <span className="font-normal text-tenue">· peso en kg y medidas en cm de la caja ya armada</span></p>
            {bultos.length === 0 ? <p className="text-sm text-peligro">El envío no tiene bultos: pide a almacén que los capture al empacar o regístralo a mano.</p> : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1.5rem_repeat(4,minmax(0,1fr))] gap-2 text-xs text-tenue">
                  <span /><span>Peso (kg)</span><span>Largo (cm)</span><span>Ancho (cm)</span><span>Alto (cm)</span>
                </div>
                {bultos.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1.5rem_repeat(4,minmax(0,1fr))] items-center gap-2 text-sm">
                    <span className="text-tenue cifra">{i + 1}</span>
                    {(["peso_kg", "largo_cm", "ancho_cm", "alto_cm"] as const).map((k) => (
                      <CampoNumero key={k} valor={b[k]} decimales={k === "peso_kg" ? 2 : 1} vacioEsCero={false} deshabilitado={!!envio.empacado_en}
                        etiqueta={`${{ peso_kg: "Peso", largo_cm: "Largo", ancho_cm: "Ancho", alto_cm: "Alto" }[k]} del bulto ${i + 1}`} alCambiar={(n) => cambiar(i, k, n)} />
                    ))}
                  </div>
                ))}
                {envio.empacado_en && <p className="text-xs text-tenue">Ya se empacó: los bultos son los que quedaron en la evidencia.</p>}
              </div>
            )}
            {sinMedidas && <p className="text-xs text-peligro">Completa peso y medidas de cada bulto: sin ellas la paquetería no cotiza.</p>}
          </section>
        </div>
      ))}

      {paso === "tarifas" && tarifas && (tarifas.length === 0 ? (
        <p className="rounded-lg bg-aviso-suave px-3 py-3 text-sm">Ninguna paquetería cotizó esta ruta con estas medidas. Revisa el CP y la colonia, o registra la guía a mano.</p>
      ) : (
        <div className="space-y-2">
          {!completa && <p className="text-xs text-tenue">Algunas paqueterías no alcanzaron a contestar; si no ves la que buscas, vuelve a cotizar.</p>}
          <ul className="divide-y divide-borde rounded-xl border border-borde" role="radiogroup" aria-label="Tarifas">
            {tarifas.map((t, i) => (
              <li key={t.id}>
                <button type="button" role="radio" aria-checked={elegida?.id === t.id} onClick={() => setElegida(t)}
                  onDoubleClick={() => { setElegida(t); setPaso("confirmar"); }}
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-fondo", elegida?.id === t.id && "bg-marca-suave")}>
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", elegida?.id === t.id ? "border-marca bg-marca" : "border-borde")} />
                  <span className="min-w-0 flex-1">
                    <b className="font-medium">{t.paqueteria}</b><span className="text-tenue"> · {t.servicio}</span>
                    {i === 0 && <span className="ml-2 text-xs text-ok">la más barata</span>}
                  </span>
                  <span className="text-xs text-tenue whitespace-nowrap">{t.dias != null ? `${t.dias} ${t.dias === 1 ? "día" : "días"}` : "—"}</span>
                  <span className="w-24 text-right font-semibold cifra">{dinero(t.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {paso === "confirmar" && elegida && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-aviso/30 bg-aviso-suave px-4 py-3">
            <p className="text-base"><b>{elegida.paqueteria}</b> · {elegida.servicio}: <b className="cifra">{dinero(elegida.total)}</b></p>
            <p className="mt-1">Se cobra del saldo de Skydropx en cuanto la generes. Para cancelarla después hay que hacerlo en el panel de Skydropx.</p>
          </div>
          <p className="text-tenue">Va a {d.destinatario}, {d.calle}, Col. {d.colonia}, {d.cp} {d.municipio}, {d.estado} · {numero(bultos.length)} {bultos.length === 1 ? "bulto" : "bultos"}.</p>
        </div>
      )}

      {paso === "pendiente" && !aviso && (
        <p className="flex gap-2 rounded-lg bg-aviso-suave px-3 py-2 text-sm"><Clock className="h-4 w-4 shrink-0 mt-0.5" />
          Skydropx ya tiene la guía de este envío ({envio.servicio ?? "pagada"}). Da «Revisar guía» para traer el PDF; no se vuelve a cobrar.</p>
      )}
    </Dialogo>
  );

  function cambiar(i: number, k: "peso_kg" | "largo_cm" | "ancho_cm" | "alto_cm", n: number) {
    setBultos((bs) => bs.map((b, j) => (j === i ? { ...b, [k]: n || null } : b)));
  }
}

const medidasDe = (b: Bulto) => [b.peso_kg, b.largo_cm, b.ancho_cm, b.alto_cm].map((x) => (x == null ? null : Number(x)));

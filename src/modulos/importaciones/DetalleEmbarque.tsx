// Un embarque: dónde va, qué sigue y quién lo debe, sus documentos (con "Leer con
// Claude"), sus correos (y lo que la IA lee en ellos), las órdenes que trae, su dinero
// y su costo puesto en planta.
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarClock, FolderOpen, Pencil, Ship, Sparkles } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { Pestanas, ContenidoPestana, ListaPestanas } from "@/components/ui/pestanas";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import { CLAVE_EMBARQUES, DiasLibres, InsigniaDebe, InsigniaFase, MODALIDADES, useAlertas, useEmbarques, useVeDinero, type Embarque } from "./componentes/comun";
import { Etapas } from "./componentes/Etapas";
import { Documentos } from "./componentes/Documentos";
import { Ordenes } from "./componentes/Ordenes";
import { DineroEmbarque } from "./componentes/DineroEmbarque";
import { Costeo } from "./componentes/Costeo";
import { CorreosEmbarque } from "./componentes/CorreosEmbarque";
import { DialogoEmbarque } from "./componentes/DialogoEmbarque";
import { LeerDocumento } from "./componentes/LeerDocumento";
import { GLOSARIO } from "@/tutorial/glosario";

export default function DetalleEmbarque() {
  const { id } = useParams();
  const { puede } = useSesion();
  const veDinero = useVeDinero();
  const [params, setParams] = useSearchParams();
  const [editando, setEditando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  useEmbarques(); // tiempo real del tablero también aquí
  const emb = useQuery({ queryKey: [...CLAVE_EMBARQUES, id], queryFn: () => q<Embarque | null>(supabase.from("v_embarques").select("*").eq("id", id!).maybeSingle()) });
  const alertas = useAlertas();

  if (emb.error) return <Pagina titulo="Embarque"><ErrorCarga error={emb.error} /></Pagina>;
  if (emb.isLoading) return <Pagina titulo="Embarque"><Cargando /></Pagina>;
  const e = emb.data;
  if (!e) return <Pagina titulo="Embarque"><Tarjeta><Vacio icono={Ship} titulo="No existe ese embarque" texto="O no tienes permiso para verlo." accion={<Boton asChild variante="secundario"><Link to="/importaciones">Ver embarques</Link></Boton>} /></Tarjeta></Pagina>;
  const vista = params.get("vista") ?? "etapas";
  const suyas = (alertas.data ?? []).filter((a) => a.embarque_id === e.id && a.tono !== "info");
  const conContenedor = e.modalidad === "fcl" || e.modalidad === "consolidado";

  return (
    <Pagina
      titulo={<span className="flex flex-wrap items-center gap-3">{e.folio} <span data-explain={GLOSARIO.faseEmbarque} data-explain-title="Fase"><InsigniaFase fase={e.fase} /></span></span>}
      descripcion={<>{e.descripcion}{e.proveedores ? ` · ${e.proveedores}` : ""}</>}
      acciones={<>
        <Boton asChild variante="fantasma"><Link to="/importaciones"><ArrowLeft className="h-4 w-4" /> Embarques</Link></Boton>
        {e.carpeta_url && <Boton asChild variante="secundario" data-explain={GLOSARIO.botonExpedienteEmbarque}><a href={e.carpeta_url} target="_blank" rel="noreferrer"><FolderOpen className="h-4 w-4" /> Expediente</a></Boton>}
        {puede("importaciones", 2) && <Boton variante="secundario" onClick={() => setEditando(true)} data-explain={GLOSARIO.botonDatosEmbarque}><Pencil className="h-4 w-4" /> Datos</Boton>}
        {puede("importaciones", 2) && <Boton onClick={() => setLeyendo(true)} data-explain={GLOSARIO.botonLeerDocumentoEmbarqueIA}><Sparkles className="h-4 w-4" /> Leer con IA</Boton>}
      </>}
    >
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <div className="tarjeta p-4 sm:col-span-2" data-explain={GLOSARIO.siguientePaso} data-explain-title="Siguiente paso">
          <p className="text-xs text-tenue">Siguiente paso</p>
          {e.siguiente_paso ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-semibold flex items-center gap-1.5"><ArrowRight className="h-4 w-4 text-marca" />{e.siguiente_paso}</p>
              <InsigniaDebe debe={e.debe} />
            </div>
          ) : <p className="mt-1 font-semibold">{e.fase === "cerrado" ? "Embarque cerrado" : "—"}</p>}
          {suyas.length > 0 && (
            <ul className="mt-2 space-y-1">
              {suyas.slice(0, 3).map((a, i) => <li key={i} className={a.tono === "riesgo" ? "text-sm text-peligro" : "text-sm text-aviso"}>• {a.titulo}</li>)}
            </ul>
          )}
        </div>
        <div className="tarjeta p-4 space-y-1" data-explain={GLOSARIO.llegadaPlanta} data-explain-title="Llegada">
          <p className="text-xs text-tenue flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Llegada</p>
          <p className="font-semibold">{e.en_planta ? `En planta el ${fecha(e.en_planta)}` : e.fase === "planta" ? "Ya está en planta" : e.arribo ? `En puerto desde el ${fecha(e.arribo)}` : e.eta ? `ETA ${fecha(e.eta)}` : "Sin ETA"}</p>
          <p className="text-xs text-tenue">
            {e.fase === "planta" && !e.en_planta ? "Falta anotar el día que llegó (el vacío o la cuenta de gastos ya lo prueban)"
              : !e.en_planta && e.llegada_planta_estimada ? `A planta hacia el ${fecha(e.llegada_planta_estimada)}` : ""}
            {e.eta_original && e.eta && e.eta_original !== e.eta ? ` · ETA original ${fecha(e.eta_original)}` : ""}
          </p>
        </div>
        <div className="tarjeta p-4 space-y-2" data-explain={e.arribo ? undefined : GLOSARIO.documentosAntesArribo} data-explain-title={e.arribo ? undefined : "Documentos"}>
          {e.arribo ? (
            <>
              <DiasLibres usados={e.dias_en_puerto} libres={e.dias_libres_almacenaje} etiqueta={e.despacho || e.en_planta ? "Estuvo en puerto" : "Días en puerto"} explica={GLOSARIO.diasLibres} />
              {conContenedor && !e.vacio && <DiasLibres usados={e.dias_contenedor} libres={e.dias_libres_demoras} etiqueta="Contenedor (demoras)" explica={GLOSARIO.demorasContenedor} />}
            </>
          ) : (
            <>
              <p className="text-xs text-tenue">Documentos</p>
              <p className="font-semibold">{e.docs_total - e.docs_pendientes} de {e.docs_total} listos</p>
              <p className="text-xs text-tenue">{e.docs_pendientes_arribo ? `${e.docs_pendientes_arribo} los pide el agente antes del arribo` : "Lo del agente, completo"}</p>
            </>
          )}
        </div>
      </div>

      <dl className="tarjeta p-4 grid gap-x-6 gap-y-2 grid-cols-2 md:grid-cols-4 text-sm">
        <Dato t="Modalidad" v={MODALIDADES[e.modalidad]} explica={GLOSARIO.modalidad} />
        <Dato t="Incoterm" v={e.incoterm} explica={GLOSARIO.incoterm} />
        <Dato t="Ruta" v={`${e.puerto_origen ?? "¿?"} → ${e.puerto_destino}`} />
        <Dato t="Importador" v={e.importador === "empresa" ? "La empresa" : "Persona física"} explica={GLOSARIO.importadorEmbarque} />
        <Dato t="Naviera" v={e.naviera} />
        <Dato t="Forwarder" v={e.forwarder} explica={GLOSARIO.forwarderEmbarque} />
        <Dato t="Agente aduanal" v={[e.agente_aduanal, e.referencia_agente].filter(Boolean).join(" · ") || null} explica={GLOSARIO.agenteAduanalEmbarque} />
        <Dato t="BL" v={e.bl} explica={GLOSARIO.bl} />
        <Dato t="Contenedores" v={e.contenedores} />
        <Dato t="Buque" v={[e.buque, e.viaje].filter(Boolean).join(" / ") || null} />
        <Dato t="Bultos y peso" v={e.bultos || e.peso_kg ? `${e.bultos ?? "—"} bultos · ${e.peso_kg ? numero(e.peso_kg) + " kg" : "—"}${e.volumen_m3 ? ` · ${numero(e.volumen_m3)} m³` : ""}` : null} />
        <Dato t="ETD" v={e.etd ? fecha(e.etd) : null} explica={GLOSARIO.etdEmbarque} />
      </dl>

      <Pestanas value={vista} onValueChange={(v) => setParams(v === "etapas" ? {} : { vista: v }, { replace: true })}>
        <ListaPestanas opciones={[
          { valor: "etapas", texto: "Etapas", explica: GLOSARIO.etapasEmbarque },
          { valor: "documentos", texto: "Documentos", cuenta: e.docs_pendientes || undefined, explica: GLOSARIO.listaDocumentosEmbarque },
          { valor: "ordenes", texto: "Órdenes", cuenta: e.ordenes.length, explica: GLOSARIO.ordenesEmbarque },
          ...(veDinero ? [{ valor: "correos", texto: "Correos", explica: GLOSARIO.correosEmbarque }, { valor: "dinero", texto: "Dinero", explica: GLOSARIO.pestanaDineroEmbarque }] : []),
          ...(puede("costos") ? [{ valor: "costeo", texto: "Costeo", explica: GLOSARIO.costoPuestoEnPlanta }] : []),
        ]} />
        <ContenidoPestana value="etapas" className="pt-5"><Etapas e={e} /></ContenidoPestana>
        <ContenidoPestana value="documentos" className="pt-5"><Documentos e={e} /></ContenidoPestana>
        <ContenidoPestana value="ordenes" className="pt-5"><Ordenes e={e} /></ContenidoPestana>
        {veDinero && <ContenidoPestana value="correos" className="pt-5"><CorreosEmbarque e={e} /></ContenidoPestana>}
        {veDinero && <ContenidoPestana value="dinero" className="pt-5"><DineroEmbarque e={e} /></ContenidoPestana>}
        {puede("costos") && <ContenidoPestana value="costeo" className="pt-5"><Costeo e={e} /></ContenidoPestana>}
      </Pestanas>

      <DialogoEmbarque abierto={editando} alCambiar={setEditando} embarque={e} />
      {leyendo && <LeerDocumento abierto={leyendo} alCambiar={setLeyendo} embarque={e} />}
    </Pagina>
  );
}

function Dato({ t, v, explica }: { t: string; v: string | null | undefined; explica?: string }) {
  return <div className="min-w-0" data-explain={explica} data-explain-title={explica ? t : undefined}><dt className="text-xs text-tenue">{t}</dt><dd className="truncate" title={v ?? undefined}>{v || "—"}</dd></div>;
}

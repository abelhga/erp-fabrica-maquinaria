import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion, AreaTexto } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";
import { SelectorProveedor } from "@/modulos/compras/componentes/comun";
import { CLAVE_EMBARQUES, INCOTERMS, MODALIDADES, subirArchivo, type Embarque, type Modalidad } from "./comun";
import { camposParaRegistrar, datosDesdeDocumento, DOC_DE, EL_DOC, LlenarConDocumento, type DatosEmbarque, type Leido } from "./LlenarConDocumento";

type Datos = DatosEmbarque;

const VACIO: Datos = { descripcion: "", modalidad: "lcl", importador: "empresa", puerto_destino: "Manzanillo", dias_libres_almacenaje: 7 };

/**
 * Alta o cambio de los datos del embarque. Solo lo indispensable es obligatorio
 * (qué es): lo demás se va llenando conforme llega, a mano o leyendo el BL con Claude.
 * En el alta, el BL (o la PI, factura, packing list) puede llenar el formulario de una vez.
 */
export function DialogoEmbarque({ abierto, alCambiar, embarque }: { abierto: boolean; alCambiar: (v: boolean) => void; embarque?: Embarque }) {
  const ir = useNavigate();
  const [d, setD] = useState<Datos>(VACIO);
  const [leido, setLeido] = useState<Leido | null>(null);
  // Lo que llenó Claude va marcado hasta que alguien lo toca: así se ve qué falta revisar.
  const [deClaude, setDeClaude] = useState<Set<keyof Datos>>(new Set());
  const [proveedor, setProveedor] = useState<{ id: string; nombre: string } | null>(null);
  useEffect(() => {
    if (!abierto) return;
    setD(embarque ? { ...embarque } : VACIO);
    setProveedor(embarque?.proveedor_id ? { id: embarque.proveedor_id, nombre: embarque.proveedores ?? "" } : null);
    setLeido(null); setDeClaude(new Set());
  }, [abierto, embarque]);
  const tocar = (k: keyof Datos) => setDeClaude((s) => { if (!s.has(k)) return s; const n = new Set(s); n.delete(k); return n; });
  const poner = (k: keyof Datos) => (e: { target: { value: string } }) => { tocar(k); setD((x) => ({ ...x, [k]: e.target.value })); };
  const marca = (k: keyof Datos) => (deClaude.has(k) ? "ring-2 ring-marca/40 bg-marca-suave/30" : undefined);
  const alLeer = (l: Leido) => {
    const nuevos = datosDesdeDocumento(l.tipo, l.campos);
    setD((x) => ({ ...x, ...nuevos }));
    setDeClaude(new Set(Object.keys(nuevos) as (keyof Datos)[]));
    setLeido(l);
  };

  const guardar = useAccion(async () => {
    const limpio = (v: unknown) => (typeof v === "string" ? v.trim() || null : v ?? null);
    const fila = {
      descripcion: d.descripcion?.trim(), modalidad: d.modalidad, importador: d.importador, incoterm: limpio(d.incoterm),
      puerto_origen: limpio(d.puerto_origen), puerto_destino: limpio(d.puerto_destino) ?? "Manzanillo", naviera: limpio(d.naviera),
      forwarder: limpio(d.forwarder), agente_aduanal: limpio(d.agente_aduanal), referencia_agente: limpio(d.referencia_agente),
      bl: limpio(d.bl), bl_house: limpio(d.bl_house), contenedores: limpio(d.contenedores), buque: limpio(d.buque), viaje: limpio(d.viaje),
      etd: limpio(d.etd), eta: limpio(d.eta), dias_libres_almacenaje: Number(d.dias_libres_almacenaje ?? 7),
      dias_libres_demoras: d.dias_libres_demoras === null || d.dias_libres_demoras === undefined || String(d.dias_libres_demoras) === "" ? null : Number(d.dias_libres_demoras),
      carpeta_url: limpio(d.carpeta_url), notas: limpio(d.notas), proveedor_id: proveedor?.id ?? null,
    };
    if (embarque) return { ...(await q<{ id: string }>(supabase.from("embarques").update(fila).eq("id", embarque.id).select("id").single())), hechos: null };
    const nuevo = await q<{ id: string }>(supabase.from("embarques").insert(fila).select("id").single());
    if (!leido) return { ...nuevo, hechos: null };
    // El embarque ya existe: si el documento falla, no se pierde el alta; se avisa y
    // se puede subir desde el embarque.
    try {
      const doc = DOC_DE[leido.tipo];
      const ruta = await subirArchivo(nuevo.id, doc, leido.archivo);
      const r = await q<{ hechos: string[] }>(supabase.rpc("registrar_documento_importacion", {
        p_embarque: nuevo.id, p_tipo: doc, p_archivo: ruta, p_nombre: leido.archivo.name,
        p_campos: camposParaRegistrar(leido.tipo, leido.campos, d), p_orden_compra: null, p_tamano: leido.archivo.size,
      }));
      return { ...nuevo, hechos: r.hechos };
    } catch (e) {
      toast.error(`El embarque quedó dado de alta, pero ${EL_DOC[leido.tipo]} no se guardó: ${mensajeError(e)} Súbelo desde el embarque.`);
      return { ...nuevo, hechos: null };
    }
  }, {
    exito: (r) => embarque ? "Embarque actualizado"
      : r.hechos?.length ? `Embarque dado de alta. Del documento: ${r.hechos.join(", ")}.` : "Embarque dado de alta: ya tiene su lista de documentos",
    invalidar: [CLAVE_EMBARQUES, ["embarque", embarque?.id], ["alertas_importacion"], ["embarque_documentos"], ["embarque_eventos"]],
    alTerminar: (r) => { alCambiar(false); if (!embarque) ir(`/importaciones/${r.id}`); },
  });

  const enviar = (e: FormEvent) => { e.preventDefault(); if ((d.descripcion ?? "").trim().length >= 3) guardar.mutate(undefined); };
  const conContenedor = d.modalidad === "fcl" || d.modalidad === "consolidado";

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-3xl"
      titulo={embarque ? `Datos de ${embarque.folio}` : "Nuevo embarque"}
      descripcion={embarque ? "Lo que cambie del ETA queda en la historia del embarque." : "Basta con decir qué viene; lo demás se llena conforme llega, o de una vez con el BL."}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="form-embarque" cargando={guardar.isPending} disabled={(d.descripcion ?? "").trim().length < 3}>
          {embarque ? "Guardar" : "Dar de alta"}
        </Boton>
      </>}>
      <form id="form-embarque" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        {!embarque && (
          <LlenarConDocumento leido={leido} alLeer={alLeer} llenados={deClaude.size}
            alQuitar={() => { setLeido(null); setDeClaude(new Set()); }} />
        )}
        <Campo etiqueta="¿Qué viene?" className="sm:col-span-2" ayuda="Como la carpeta del expediente: “71 celdas de carga”, “24 colectores y silo de 60 t”.">
          <Entrada autoFocus value={d.descripcion ?? ""} onChange={poner("descripcion")} placeholder="20 cosedoras N600A y 2 cabezales F900A" className={marca("descripcion")} />
        </Campo>
        <Campo etiqueta="Proveedor" className="sm:col-span-2"
          ayuda={embarque?.ordenes.length ? "Ya tiene orden de compra ligada: en la lista sale el proveedor de la orden." : "Mientras no haya orden de compra ligada, de aquí sale el proveedor del embarque."}>
          <SelectorProveedor valor={proveedor} alCambiar={(p) => setProveedor({ id: p.id, nombre: p.nombre })} placeholder="Elegir proveedor (opcional)…" />
        </Campo>
        <Campo etiqueta="Modalidad">
          <Seleccion value={d.modalidad} className={marca("modalidad")} onChange={(e) => { tocar("modalidad"); setD((x) => ({ ...x, modalidad: e.target.value as Modalidad })); }}>
            {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Incoterm" ayuda="CIF pide póliza de seguro.">
          <Seleccion value={d.incoterm ?? ""} onChange={poner("incoterm")} className={marca("incoterm")}>
            <option value="">Sin definir</option>
            {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Importador">
          <Seleccion value={d.importador} onChange={(e) => setD((x) => ({ ...x, importador: e.target.value as Datos["importador"] }))}>
            <option value="empresa">La empresa</option>
            <option value="persona_fisica">Persona física</option>
          </Seleccion>
        </Campo>
        <Campo etiqueta="Puerto de origen"><Entrada value={d.puerto_origen ?? ""} onChange={poner("puerto_origen")} className={marca("puerto_origen")} placeholder="Ningbo, Qingdao, Shekou…" /></Campo>
        <Campo etiqueta="Puerto de destino"><Entrada value={d.puerto_destino ?? ""} onChange={poner("puerto_destino")} className={marca("puerto_destino")} placeholder="Manzanillo" /></Campo>
        <Campo etiqueta="Naviera"><Entrada value={d.naviera ?? ""} onChange={poner("naviera")} className={marca("naviera")} placeholder="TS Lines, CMA CGM, COSCO…" /></Campo>
        <Campo etiqueta="Forwarder o consolidador"><Entrada value={d.forwarder ?? ""} onChange={poner("forwarder")} placeholder="Sea Bridge, Interteam, XPD…" /></Campo>
        <Campo etiqueta="Agente aduanal"><Entrada value={d.agente_aduanal ?? ""} onChange={poner("agente_aduanal")} placeholder="Careaga, LME…" /></Campo>
        <Campo etiqueta="Referencia del agente"><Entrada value={d.referencia_agente ?? ""} onChange={poner("referencia_agente")} placeholder="LCM2311-2026" /></Campo>
        <Campo etiqueta="BL (master)"><Entrada value={d.bl ?? ""} onChange={poner("bl")} className={marca("bl")} /></Campo>
        <Campo etiqueta="Contenedores"><Entrada value={d.contenedores ?? ""} onChange={poner("contenedores")} className={marca("contenedores")} placeholder="TCLU1234567 40HC" /></Campo>
        <Campo etiqueta="Buque y viaje">
          <div className="flex gap-2"><Entrada value={d.buque ?? ""} onChange={poner("buque")} placeholder="Buque" className={marca("buque")} /><Entrada className={cn("w-28", marca("viaje"))} value={d.viaje ?? ""} onChange={poner("viaje")} placeholder="Viaje" /></div>
        </Campo>
        <Campo etiqueta="ETD (salida estimada)"><Entrada type="date" value={d.etd ?? ""} onChange={poner("etd")} className={marca("etd")} /></Campo>
        <Campo etiqueta="ETA (llegada estimada a puerto)"><Entrada type="date" value={d.eta ?? ""} onChange={poner("eta")} className={marca("eta")} /></Campo>
        <Campo etiqueta="Días libres de almacenaje" ayuda="Aviso al día 4 de 7.">
          <Entrada type="number" min={0} value={d.dias_libres_almacenaje ?? 7} onChange={poner("dias_libres_almacenaje")} />
        </Campo>
        {conContenedor && (
          <Campo etiqueta="Días libres de demoras (contenedor)" ayuda="21 si no se dice otra cosa.">
            <Entrada type="number" min={0} value={d.dias_libres_demoras ?? ""} onChange={poner("dias_libres_demoras")} placeholder="21" />
          </Campo>
        )}
        <Campo etiqueta="Carpeta del expediente" className="sm:col-span-2"><Entrada value={d.carpeta_url ?? ""} onChange={poner("carpeta_url")} placeholder="Enlace a la carpeta en Drive" /></Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><AreaTexto value={d.notas ?? ""} onChange={poner("notas")} className={marca("notas")} /></Campo>
      </form>
    </Dialogo>
  );
}

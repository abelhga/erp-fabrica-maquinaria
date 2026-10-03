import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada, Seleccion, AreaTexto } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { CLAVE_EMBARQUES, INCOTERMS, MODALIDADES, type Embarque, type Modalidad } from "./comun";

type Datos = Partial<Pick<Embarque, "descripcion" | "modalidad" | "importador" | "incoterm" | "puerto_origen" | "puerto_destino" | "naviera" | "forwarder"
  | "agente_aduanal" | "referencia_agente" | "bl" | "bl_house" | "contenedores" | "buque" | "viaje" | "etd" | "eta" | "dias_libres_almacenaje"
  | "dias_libres_demoras" | "carpeta_url" | "notas">>;

const VACIO: Datos = { descripcion: "", modalidad: "lcl", importador: "empresa", puerto_destino: "Manzanillo", dias_libres_almacenaje: 7 };

/**
 * Alta o cambio de los datos del embarque. Solo lo indispensable es obligatorio
 * (qué es): lo demás se va llenando conforme llega, a mano o leyendo el BL con Claude.
 */
export function DialogoEmbarque({ abierto, alCambiar, embarque }: { abierto: boolean; alCambiar: (v: boolean) => void; embarque?: Embarque }) {
  const ir = useNavigate();
  const [d, setD] = useState<Datos>(VACIO);
  useEffect(() => {
    if (!abierto) return;
    setD(embarque ? { ...embarque } : VACIO);
  }, [abierto, embarque]);
  const poner = (k: keyof Datos) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  const guardar = useAccion(async () => {
    const limpio = (v: unknown) => (typeof v === "string" ? v.trim() || null : v ?? null);
    const fila = {
      descripcion: d.descripcion?.trim(), modalidad: d.modalidad, importador: d.importador, incoterm: limpio(d.incoterm),
      puerto_origen: limpio(d.puerto_origen), puerto_destino: limpio(d.puerto_destino) ?? "Manzanillo", naviera: limpio(d.naviera),
      forwarder: limpio(d.forwarder), agente_aduanal: limpio(d.agente_aduanal), referencia_agente: limpio(d.referencia_agente),
      bl: limpio(d.bl), bl_house: limpio(d.bl_house), contenedores: limpio(d.contenedores), buque: limpio(d.buque), viaje: limpio(d.viaje),
      etd: limpio(d.etd), eta: limpio(d.eta), dias_libres_almacenaje: Number(d.dias_libres_almacenaje ?? 7),
      dias_libres_demoras: d.dias_libres_demoras === null || d.dias_libres_demoras === undefined || String(d.dias_libres_demoras) === "" ? null : Number(d.dias_libres_demoras),
      carpeta_url: limpio(d.carpeta_url), notas: limpio(d.notas),
    };
    if (embarque) return q<{ id: string }>(supabase.from("embarques").update(fila).eq("id", embarque.id).select("id").single());
    return q<{ id: string }>(supabase.from("embarques").insert(fila).select("id").single());
  }, {
    exito: embarque ? "Embarque actualizado" : "Embarque dado de alta: ya tiene su lista de documentos",
    invalidar: [CLAVE_EMBARQUES, ["embarque", embarque?.id], ["alertas_importacion"], ["embarque_documentos"]],
    alTerminar: (r) => { alCambiar(false); if (!embarque) ir(`/importaciones/${r.id}`); },
  });

  const enviar = (e: FormEvent) => { e.preventDefault(); if ((d.descripcion ?? "").trim().length >= 3) guardar.mutate(undefined); };
  const conContenedor = d.modalidad === "fcl" || d.modalidad === "consolidado";

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-3xl"
      titulo={embarque ? `Datos de ${embarque.folio}` : "Nuevo embarque"}
      descripcion={embarque ? "Lo que cambie del ETA queda en la historia del embarque." : "Basta con decir qué viene; lo demás se llena conforme llega."}
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="form-embarque" cargando={guardar.isPending} disabled={(d.descripcion ?? "").trim().length < 3}>
          {embarque ? "Guardar" : "Dar de alta"}
        </Boton>
      </>}>
      <form id="form-embarque" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="¿Qué viene?" className="sm:col-span-2" ayuda="Como la carpeta del expediente: “71 celdas de carga”, “24 colectores y silo de 60 t”.">
          <Entrada autoFocus value={d.descripcion ?? ""} onChange={poner("descripcion")} placeholder="20 cosedoras N600A y 2 cabezales F900A" />
        </Campo>
        <Campo etiqueta="Modalidad">
          <Seleccion value={d.modalidad} onChange={(e) => setD((x) => ({ ...x, modalidad: e.target.value as Modalidad }))}>
            {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Incoterm" ayuda="CIF pide póliza de seguro.">
          <Seleccion value={d.incoterm ?? ""} onChange={poner("incoterm")}>
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
        <Campo etiqueta="Puerto de origen"><Entrada value={d.puerto_origen ?? ""} onChange={poner("puerto_origen")} placeholder="Ningbo, Qingdao, Shekou…" /></Campo>
        <Campo etiqueta="Naviera"><Entrada value={d.naviera ?? ""} onChange={poner("naviera")} placeholder="TS Lines, CMA CGM, COSCO…" /></Campo>
        <Campo etiqueta="Forwarder o consolidador"><Entrada value={d.forwarder ?? ""} onChange={poner("forwarder")} placeholder="Sea Bridge, Interteam, XPD…" /></Campo>
        <Campo etiqueta="Agente aduanal"><Entrada value={d.agente_aduanal ?? ""} onChange={poner("agente_aduanal")} placeholder="Careaga, LME…" /></Campo>
        <Campo etiqueta="Referencia del agente"><Entrada value={d.referencia_agente ?? ""} onChange={poner("referencia_agente")} placeholder="LCM2311-2026" /></Campo>
        <Campo etiqueta="BL (master)"><Entrada value={d.bl ?? ""} onChange={poner("bl")} /></Campo>
        <Campo etiqueta="Contenedores"><Entrada value={d.contenedores ?? ""} onChange={poner("contenedores")} placeholder="TCLU1234567 40HC" /></Campo>
        <Campo etiqueta="Buque y viaje">
          <div className="flex gap-2"><Entrada value={d.buque ?? ""} onChange={poner("buque")} placeholder="Buque" /><Entrada className="w-28" value={d.viaje ?? ""} onChange={poner("viaje")} placeholder="Viaje" /></div>
        </Campo>
        <Campo etiqueta="ETD (salida estimada)"><Entrada type="date" value={d.etd ?? ""} onChange={poner("etd")} /></Campo>
        <Campo etiqueta="ETA (llegada estimada a puerto)"><Entrada type="date" value={d.eta ?? ""} onChange={poner("eta")} /></Campo>
        <Campo etiqueta="Días libres de almacenaje" ayuda="Aviso al día 4 de 7.">
          <Entrada type="number" min={0} value={d.dias_libres_almacenaje ?? 7} onChange={poner("dias_libres_almacenaje")} />
        </Campo>
        {conContenedor && (
          <Campo etiqueta="Días libres de demoras (contenedor)" ayuda="21 si no se dice otra cosa.">
            <Entrada type="number" min={0} value={d.dias_libres_demoras ?? ""} onChange={poner("dias_libres_demoras")} placeholder="21" />
          </Campo>
        )}
        <Campo etiqueta="Carpeta del expediente" className="sm:col-span-2"><Entrada value={d.carpeta_url ?? ""} onChange={poner("carpeta_url")} placeholder="Enlace a la carpeta en Drive" /></Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><AreaTexto value={d.notas ?? ""} onChange={poner("notas")} /></Campo>
      </form>
    </Dialogo>
  );
}

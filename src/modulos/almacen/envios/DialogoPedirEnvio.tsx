import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Package } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { hoyISO, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CampoNumero } from "@/modulos/ventas/componentes/campos";
import { CLAVE, TIPOS, TIPOS_PEDIDO, medidas, usePaqueterias, type TipoEnvio } from "./datos";

interface PorEnviar {
  pedido_linea_id: string; orden: number; articulo_id: string; clave: string; titulo: string; articulo_tipo: string; unidad: string;
  cantidad: number; en_envios: number; pendiente: number; paquete_kg: number | null; paquete_largo_cm: number | null;
  paquete_ancho_cm: number | null; paquete_alto_cm: number | null; paquete_piezas: number | null;
}
interface Contacto { id: string; nombre: string; telefono: string | null; domicilio: string | null; principal: boolean }

/**
 * "Pedir envío" desde el pedido: partidas, peso y medidas y destino ya vienen
 * llenos. Nadie teclea el domicilio ni le pregunta al almacén cuánto pesa.
 */
export function DialogoPedirEnvio({ pedido, abierto, alCambiar, alCrear }: {
  pedido: { id: string; folio: string; canal: string; cliente_id: string; direccion_entrega: string | null };
  abierto: boolean; alCambiar: (v: boolean) => void; alCrear?: (id: string) => void;
}) {
  const paq = usePaqueterias();
  const partidas = useQuery({
    queryKey: [...CLAVE, "por_enviar", pedido.id], enabled: abierto,
    queryFn: () => q<PorEnviar[]>(supabase.rpc("partidas_por_enviar", { p_pedido: pedido.id })),
  });
  // Los contactos los ve el dueño de la cuenta (RLS); si no, la base usa el principal.
  const contactos = useQuery({
    queryKey: ["contactos", pedido.cliente_id], enabled: abierto,
    queryFn: () => q<Contacto[]>(supabase.from("contactos").select("id, nombre, telefono, domicilio, principal").eq("cliente_id", pedido.cliente_id).order("principal", { ascending: false })),
  });
  const esML = pedido.canal === "mercadolibre";
  const [tipo, setTipo] = useState<TipoEnvio>("paqueteria");
  const [cant, setCant] = useState<Record<string, number>>({});
  const [paqueteria, setPaqueteria] = useState(0);
  const [contacto, setContacto] = useState("");
  const [destino, setDestino] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setTipo("paqueteria"); setFecha(""); setNotas(""); setDestino(null); setContacto("");
    setPaqueteria(esML ? paq.data?.find((p) => p.nombre.startsWith("Mercado Envíos"))?.id ?? 0 : 0);
  }, [abierto, esML, paq.data]);
  useEffect(() => {
    setCant(Object.fromEntries((partidas.data ?? []).map((p) => [p.pedido_linea_id, Number(p.pendiente)])));
  }, [partidas.data]);

  const elegido = contactos.data?.find((c) => c.id === contacto) ?? contactos.data?.[0];
  const destinoSugerido = pedido.direccion_entrega || elegido?.domicilio || "";
  const conDestino = tipo === "paqueteria" || tipo === "flete" || tipo === "proveedor";
  const lineas = (partidas.data ?? []).filter((p) => (cant[p.pedido_linea_id] ?? 0) > 0);
  const resumen = useMemo(() => {
    let bultos = 0, kg = 0, sin = 0;
    for (const p of lineas) {
      const c = cant[p.pedido_linea_id] ?? 0;
      if (p.paquete_kg != null) { const n = Math.ceil(c / Number(p.paquete_piezas || 1)); bultos += n; kg += n * Number(p.paquete_kg); } else { bultos += 1; sin += 1; }
    }
    return { bultos, kg, sin };
  }, [lineas, cant]);

  const crear = useAccion(() => q<string>(supabase.rpc("pedir_envio", {
    p_pedido: pedido.id, p_tipo: tipo,
    p_lineas: (partidas.data ?? []).map((p) => ({ pedido_linea_id: p.pedido_linea_id, cantidad: cant[p.pedido_linea_id] ?? 0 })),
    p_paqueteria: (tipo === "paqueteria" || tipo === "flete") && paqueteria ? paqueteria : null,
    p_contacto: contacto || null, p_destino: conDestino && destino != null ? destino : null,
    p_fecha_recoleccion: fecha || null, p_notas: notas || null,
  })), { exito: "Envío pedido: almacén ya lo ve", invalidar: [CLAVE], alTerminar: (id) => { alCambiar(false); alCrear?.(id); } });

  const tipos = TIPOS_PEDIDO.filter((t) => t !== "full" || esML);
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo={`Pedir envío de ${pedido.folio}`} ancho="max-w-2xl"
      descripcion="Partidas, peso, medidas y destino salen del pedido. Revisa y listo."
      pie={<><Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => crear.mutate(undefined)} cargando={crear.isPending} disabled={lineas.length === 0}>Pedir envío</Boton></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (lineas.length) crear.mutate(undefined); }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tipos.map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)} title={TIPOS[t].ayuda}
              className={cn("rounded-lg border px-3 py-2 text-left text-sm transition",
                tipo === t ? "border-marca bg-marca-suave text-marca-texto font-medium" : "border-borde hover:bg-fondo")}>
              {TIPOS[t].texto}
            </button>
          ))}
        </div>
        <p className="text-xs text-tenue -mt-2">{TIPOS[tipo].ayuda}</p>

        <section className="space-y-2">
          <p className="etiqueta">Qué va</p>
          {partidas.isLoading ? <p className="text-sm text-tenue">Cargando partidas…</p>
            : (partidas.data ?? []).length === 0 ? <p className="text-sm text-tenue">Este pedido no tiene partidas que se empaquen (solo servicios o partidas libres).</p>
            : (partidas.data ?? []).map((p) => (
              <div key={p.pedido_linea_id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.titulo}</p>
                  <p className="text-xs text-tenue">
                    <span className="cifra">{numero(Number(p.pendiente))}</span> de <span className="cifra">{numero(Number(p.cantidad))}</span> por enviar
                    {" · "}{p.paquete_kg != null ? <>{medidas({ peso_kg: p.paquete_kg, largo_cm: p.paquete_largo_cm, ancho_cm: p.paquete_ancho_cm, alto_cm: p.paquete_alto_cm })}{Number(p.paquete_piezas) > 1 ? ` (${numero(Number(p.paquete_piezas))} por caja)` : ""}</>
                      : <span className="text-aviso">sin peso ni medidas: almacén lo pesa al empacar</span>}
                  </p>
                </div>
                <CampoNumero valor={cant[p.pedido_linea_id] ?? 0} decimales={3} min={0} max={Number(p.pendiente)} etiqueta={`Cantidad de ${p.titulo}`}
                  alCambiar={(n) => setCant((c) => ({ ...c, [p.pedido_linea_id]: n }))} />
              </div>
            ))}
          {lineas.length > 0 && (tipo === "paqueteria" || tipo === "flete") && (
            <p className="flex items-center gap-1.5 text-sm text-tenue"><Package className="h-4 w-4" />
              ≈ <b className="cifra text-texto">{resumen.bultos}</b> {resumen.bultos === 1 ? "bulto" : "bultos"}{resumen.kg > 0 && <> · <b className="cifra text-texto">{numero(resumen.kg)} kg</b></>}
              {resumen.sin > 0 && <span className="text-aviso"> · {resumen.sin} sin medidas</span>}</p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {(tipo === "paqueteria" || tipo === "flete") && (
            <Campo etiqueta={tipo === "flete" ? "Transportista" : "Paquetería"} ayuda="Se puede decidir al cotizar.">
              <Seleccion value={paqueteria} onChange={(e) => setPaqueteria(Number(e.target.value))}>
                <option value={0}>— la que salga mejor —</option>
                {(paq.data ?? []).filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Seleccion>
            </Campo>
          )}
          <Campo etiqueta={tipo === "recoge" ? "¿Cuándo pasan por él?" : "Recolección"} ayuda={tipo === "recoge" ? "Almacén lo ve en “Hoy salen o recogen”." : "Si ya se sabe cuándo pasa la paquetería."}>
            <Entrada type="date" value={fecha} min={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
        </div>

        {conDestino && (
          <section className="space-y-2 rounded-xl border border-borde bg-fondo/60 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><MapPin className="h-4 w-4 text-tenue" />Destino</p>
            {(contactos.data?.length ?? 0) > 1 && (
              <Seleccion value={contacto} onChange={(e) => { setContacto(e.target.value); setDestino(null); }} aria-label="Contacto">
                {contactos.data!.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.principal ? " (principal)" : ""}</option>)}
              </Seleccion>
            )}
            {destino == null ? (
              <div className="flex items-start justify-between gap-3 text-sm">
                <p>{elegido?.nombre && <b>{elegido.nombre}</b>}{elegido?.telefono && <span className="text-tenue"> · {elegido.telefono}</span>}
                  <span className="block">{destinoSugerido || <span className="text-tenue">Sin domicilio en el pedido ni en el contacto.</span>}</span></p>
                <button type="button" className="shrink-0 text-xs text-marca-texto hover:underline" onClick={() => setDestino(destinoSugerido)}>Cambiar</button>
              </div>
            ) : (
              <AreaTexto value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Calle, número, colonia, CP, ciudad" />
            )}
            <p className="text-xs text-tenue">Se copia al envío: lo ven quien ve el pedido y almacén, no un canal de chat.</p>
          </section>
        )}
        <Campo etiqueta="Notas para almacén"><Entrada value={notas} placeholder="Empacar con esquineros, va con factura…" onChange={(e) => setNotas(e.target.value)} /></Campo>
        <button type="submit" className="hidden" />
      </form>
    </Dialogo>
  );
}

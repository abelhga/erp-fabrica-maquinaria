import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { SelectorCliente } from "@/components/datos/SelectorCliente";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE, ORDEN_TIPOS, TIPOS, type TipoServicio } from "../datos";

interface EquipoCliente {
  orden_id: string; folio: string; numero_serie: string | null; equipo: string; pedido_id: string; pedido_folio: string;
  estado: string; entregado: string | null; garantia_vence: string | null;
}

const AYUDA: Record<TipoServicio, string> = {
  instalacion: "Montar el equipo en la planta del cliente.",
  puesta_en_marcha: "Arrancarlo, ajustarlo y enseñarle al operador.",
  garantia: "Falla de un equipo que hicimos: va ligada a su número de serie.",
  reparacion_planta: "El cliente trae el equipo al taller: se recibe con fotos.",
  servicio_campo: "Reparar o ajustar en la planta del cliente (engrapar banda…).",
};

/** Pedir un servicio: lo hace el vendedor (para sus clientes) o producción. Enter guarda. */
export function DialogoSolicitar({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const ir = useNavigate();
  const [tipo, setTipo] = useState<TipoServicio>("servicio_campo");
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [equipo, setEquipo] = useState<string>("");          // orden_id, u "otro"
  const [equipoTexto, setEquipoTexto] = useState("");
  const [serie, setSerie] = useState("");
  const [desc, setDesc] = useState("");
  const [lugar, setLugar] = useState("");
  const [contacto, setContacto] = useState("");
  const [tel, setTel] = useState("");
  const [deseada, setDeseada] = useState("");
  const [prioridad, setPrioridad] = useState(2);
  const [referencia, setReferencia] = useState("");

  const equipos = useQuery({
    queryKey: [...CLAVE, "equipos_cliente", cliente?.id],
    enabled: !!cliente,
    queryFn: () => q<EquipoCliente[]>(supabase.rpc("equipos_del_cliente", { p_cliente: cliente!.id })),
  });
  const eq = equipos.data?.find((e) => e.orden_id === equipo);
  const entregados = (equipos.data ?? []).filter((e) => e.numero_serie);
  const faltaEquipo = tipo === "garantia" && !eq;

  const pedir = useAccion(() => q<string>(supabase.rpc("solicitar_servicio", {
    p_tipo: tipo, p_cliente: cliente!.id, p_descripcion: desc,
    p_orden_produccion: eq?.orden_id ?? null, p_pedido: eq?.pedido_id ?? null,
    p_numero_serie: eq ? null : serie || null, p_equipo: eq ? null : equipoTexto || null,
    p_lugar: lugar || null, p_contacto_nombre: contacto || null, p_contacto_telefono: tel || null,
    p_fecha_deseada: deseada || null, p_prioridad: prioridad, p_referencia: referencia || null,
  })), {
    exito: "Servicio pedido: la gerencia de producción ya tiene el aviso", invalidar: [CLAVE],
    alTerminar: (id) => { alCambiar(false); ir(`/servicio/${id}`); },
  });

  const listo = !!cliente && desc.trim().length >= 5 && !faltaEquipo;
  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Pedir un servicio" ancho="max-w-2xl"
      descripcion="Llega a la gerencia de producción con aviso. Ellos ponen fecha y cuadrilla; tú recibes otro aviso cuando quede programado."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton type="submit" form="form-solicitar" disabled={!listo} cargando={pedir.isPending}>Pedir servicio</Boton>
      </>}>
      <form id="form-solicitar" className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (listo) pedir.mutate(); }}>
        <fieldset>
          <legend className="text-sm font-medium mb-1.5">¿Qué necesita el cliente?</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ORDEN_TIPOS.map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t}
                      className={cn("rounded-lg border p-2.5 text-left text-sm transition", tipo === t ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
                <span className="flex items-center gap-1.5 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPOS[t].color }} />{TIPOS[t].texto}</span>
                <span className="block text-xs text-tenue mt-0.5 leading-snug">{AYUDA[t]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Cliente">
            <SelectorCliente valor={cliente} alCambiar={(c) => { setCliente(c ? { id: c.id, nombre: c.nombre } : null); setEquipo(""); }} />
          </Campo>
          <Campo etiqueta={tipo === "garantia" ? "Equipo (número de serie)" : "Equipo"}
                 error={cliente && tipo === "garantia" && !equipos.isLoading && entregados.length === 0 ? "Ese cliente no tiene equipos con número de serie en el sistema" : undefined}
                 ayuda={eq?.garantia_vence ? `Entregado el ${fecha(eq.entregado)} · garantía hasta el ${fecha(eq.garantia_vence)}` : undefined}>
            <Seleccion value={equipo} onChange={(e) => setEquipo(e.target.value)} disabled={!cliente}>
              <option value="">{cliente ? (tipo === "garantia" ? "Elige el equipo…" : "Otro equipo / sin número Hegamex") : "Primero elige el cliente"}</option>
              {(tipo === "garantia" ? entregados : equipos.data ?? []).map((e) => (
                <option key={e.orden_id} value={e.orden_id}>{e.numero_serie ?? e.folio} · {e.equipo.slice(0, 50)} · {e.pedido_folio}</option>
              ))}
            </Seleccion>
          </Campo>
        </div>
        {!eq && tipo !== "garantia" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="¿Qué equipo es?"><Entrada value={equipoTexto} onChange={(e) => setEquipoTexto(e.target.value)} placeholder="Cosedora de costales, banda de 12 m…" /></Campo>
            <Campo etiqueta="Número de serie (si tiene)"><Entrada value={serie} onChange={(e) => setSerie(e.target.value)} /></Campo>
          </div>
        )}
        <Campo etiqueta="¿Qué pide?">
          <AreaTexto value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} autoFocus
                     placeholder="Lo que dijo el cliente: qué hace o dejó de hacer, desde cuándo…"
                     onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && listo) pedir.mutate(); }} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Dónde"><Entrada value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ciudad o planta" /></Campo>
          <Campo etiqueta="Contacto en sitio"><Entrada value={contacto} onChange={(e) => setContacto(e.target.value)} /></Campo>
          <Campo etiqueta="Teléfono"><Entrada value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" /></Campo>
          <Campo etiqueta="Para cuándo lo quiere"><Entrada type="date" value={deseada} onChange={(e) => setDeseada(e.target.value)} /></Campo>
          <Campo etiqueta="Prioridad">
            <Seleccion value={prioridad} onChange={(e) => setPrioridad(Number(e.target.value))}>
              <option value={1}>Urgente (equipo parado)</option><option value={2}>Normal</option><option value={3}>Puede esperar</option>
            </Seleccion>
          </Campo>
          <Campo etiqueta="Reporte u orden del cliente"><Entrada value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" /></Campo>
        </div>
      </form>
    </Dialogo>
  );
}

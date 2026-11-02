// Juntar dos clientes que son el mismo (el de la hoja con el RFC y la deuda, y el que se dio de
// alta con el nombre del contacto). La base mueve todo y borra el repetido (juntar_clientes);
// aquí solo se elige cuál se queda y se enseña qué va a pasar antes de confirmar.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Merge } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo } from "@/components/ui/campo";
import { SelectorCliente } from "@/components/datos/SelectorCliente";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { cn } from "@/lib/utilidades";

export interface ClienteParaJuntar { id: string; nombre: string; rfc: string | null }

/** Cómo se le dice a la gente a lo que se mueve; lo que no está aquí sale como «otros registros». */
const NOMBRES: Record<string, [string, string]> = {
  pedidos: ["pedido", "pedidos"], cotizaciones: ["cotización", "cotizaciones"], oportunidades: ["oportunidad", "oportunidades"],
  contactos: ["contacto", "contactos"], historial_ventas_hoja: ["movimiento de la hoja", "movimientos de la hoja"],
  cobros_saldo_hoja: ["cobro del saldo de la hoja", "cobros del saldo de la hoja"], cfdi_historico: ["factura XML", "facturas XML"],
  equipos_historicos: ["equipo vendido", "equipos vendidos"], leads: ["lead", "leads"], solicitudes_precio: ["solicitud de precio", "solicitudes de precio"],
  actividades: ["actividad", "actividades"],
};

export function JuntarClientes({ actual, otroInicial, abierto, alCambiar }: {
  actual: ClienteParaJuntar; otroInicial?: { id: string; nombre: string } | null; abierto: boolean; alCambiar: (v: boolean) => void;
}) {
  const ir = useNavigate();
  const [otro, setOtro] = useState<{ id: string; nombre: string } | null>(otroInicial ?? null);
  const [quedaActual, setQuedaActual] = useState(true);
  useEffect(() => { if (abierto) setOtro(otroInicial ?? null); }, [abierto, otroInicial]);

  const datosOtro = useQuery({
    queryKey: ["cliente_juntar", otro?.id], enabled: !!otro,
    queryFn: () => q<ClienteParaJuntar | null>(supabase.from("clientes").select("id, nombre, rfc").eq("id", otro!.id).maybeSingle()),
  });
  // Se propone que se quede el que trae lo de la hoja y las facturas (donde están la deuda y el RFC
  // original); si ninguno o los dos, el que tiene RFC; si no, el que estás viendo.
  const peso = useQuery({
    queryKey: ["juntar_peso", actual.id, otro?.id], enabled: abierto && !!otro && otro.id !== actual.id,
    queryFn: async () => {
      const cuenta = (v: Record<string, number>) => (v.historial_ventas_hoja ?? 0) + (v.cfdi_historico ?? 0) + (v.cobros_saldo_hoja ?? 0);
      const [deActual, deOtro] = await Promise.all([
        q<Record<string, number>>(supabase.rpc("juntar_clientes_vista", { p_repetido: actual.id, p_bueno: otro!.id })),
        q<Record<string, number>>(supabase.rpc("juntar_clientes_vista", { p_repetido: otro!.id, p_bueno: actual.id })),
      ]);
      return { actual: cuenta(deActual), otro: cuenta(deOtro) };
    },
  });
  useEffect(() => {
    if (!datosOtro.data || !peso.data) return;
    const { actual: a, otro: o } = peso.data;
    setQuedaActual(a !== o ? a > o : !!actual.rfc || !datosOtro.data.rfc);
  }, [datosOtro.data, peso.data, actual.rfc]);

  const bueno = quedaActual ? actual : datosOtro.data ?? null;
  const repetido = quedaActual ? datosOtro.data ?? null : actual;
  const otroValido = !!otro && otro.id !== actual.id;

  const vista = useQuery({
    queryKey: ["juntar_vista", repetido?.id, bueno?.id], enabled: abierto && !!repetido && !!bueno && otroValido,
    queryFn: () => q<Record<string, number>>(supabase.rpc("juntar_clientes_vista", { p_repetido: repetido!.id, p_bueno: bueno!.id })),
  });
  const lista = Object.entries(vista.data ?? {}).map(([t, n]) => {
    const nom = NOMBRES[t];
    return { t, texto: nom ? `${n} ${n === 1 ? nom[0] : nom[1]}` : `${n} otros registros` };
  });

  const juntar = useAccion(
    () => q(supabase.rpc("juntar_clientes", { p_repetido: repetido!.id, p_bueno: bueno!.id })),
    {
      exito: () => `Listo: todo quedó en ${bueno?.nombre}`,
      invalidar: [["cliente_detalle"], ["v_clientes"], ["v_cartera"], ["contactos"], ["v_pedidos"], ["v_cotizaciones"], ["v_oportunidades"]],
      alTerminar: () => { alCambiar(false); if (bueno && bueno.id !== actual.id) ir(`/ventas/clientes/${bueno.id}`); },
    },
  );

  const opcion = (c: ClienteParaJuntar | null | undefined, esActual: boolean) => c && (
    <button type="button" onClick={() => setQuedaActual(esActual)}
      className={cn("w-full rounded-xl border-2 px-3 py-2 text-left text-sm", quedaActual === esActual ? "border-marca bg-marca-suave/40" : "border-borde hover:bg-fondo")}>
      <b>{c.nombre}</b>
      <span className="block text-xs text-tenue">{c.rfc ? `RFC ${c.rfc}` : "Sin RFC"}{esActual ? " · el que estás viendo" : ""}</span>
    </button>
  );

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} titulo="Juntar con otro cliente" ancho="max-w-xl"
      descripcion="Para cuando el mismo cliente está dado de alta dos veces (por ejemplo, uno con el nombre del contacto y otro con el de la empresa)."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => juntar.mutate(undefined)} cargando={juntar.isPending} disabled={!otroValido || !bueno || !repetido || vista.isLoading}>
          <Merge className="h-4 w-4" />Juntar
        </Boton>
      </>}>
      <div className="space-y-4">
        <Campo etiqueta="El otro cliente">
          <SelectorCliente valor={otro} alCambiar={(c) => setOtro(c ? { id: c.id, nombre: c.nombre } : null)} />
        </Campo>
        {otro && otro.id === actual.id && <p className="text-sm text-peligro">Elige otro cliente: es el mismo que estás viendo.</p>}
        {otroValido && datosOtro.data && (
          <>
            <div>
              <p className="text-sm font-medium mb-1.5">¿Cuál se queda?</p>
              <div className="grid gap-2 sm:grid-cols-2">{opcion(actual, true)}{opcion(datosOtro.data, false)}</div>
            </div>
            <div className="rounded-xl border border-borde bg-fondo px-4 py-3 text-sm space-y-1.5">
              <p className="flex flex-wrap items-center gap-1.5">
                Todo lo de <b>{repetido?.nombre}</b> <ArrowRight className="h-3.5 w-3.5 text-tenue" /> <b>{bueno?.nombre}</b>
              </p>
              {vista.isError ? <p className="text-peligro">{(vista.error as Error).message}</p>
                : vista.isLoading ? <p className="text-tenue">Contando…</p>
                : <p className="text-tenue">{lista.length ? `Pasan: ${lista.map((x) => x.texto).join(", ")}.` : "No tiene nada ligado."}</p>}
              <p className="text-tenue">
                Los contactos que ya estén (mismo teléfono o nombre) no se repiten. Lo que le falte a {bueno?.nombre} (RFC, régimen,
                ciudad, vendedor…) lo toma del otro, y <b className="text-texto">{repetido?.nombre}</b> se borra. No se puede deshacer desde aquí.
              </p>
            </div>
          </>
        )}
      </div>
    </Dialogo>
  );
}

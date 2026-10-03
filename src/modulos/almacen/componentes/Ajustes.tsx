import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Scale, ShieldAlert, X } from "lucide-react";
import { BuscadorArticulo, type ArticuloEncontrado } from "@/components/datos/BuscadorArticulo";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { dinero, fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CantidadConSigno, nombreCorto, useAlmacenes } from "./comun";

export interface Ajuste {
  id: string; folio: string; articulo_id: string; clave: string; nombre: string; unidad: string; almacen_id: number; almacen: string;
  cantidad_sistema: number; cantidad_fisica: number; diferencia: number; motivo: string; conteo: string | null; estado: "pendiente" | "aprobado" | "rechazado";
  solicitado_por: string; solicitado_por_nombre: string | null; solicitado_en: string; resuelto_por_nombre: string | null; resuelto_en: string | null;
  comentario: string | null; existencia_actual: number | null; aplicado: number | null; valor_diferencia: number | null;
}

/**
 * Ajustes: la única forma de corregir una existencia. Lo pide quien encontró la
 * diferencia y lo autoriza otra persona (la base lo exige); hasta entonces la
 * existencia no se mueve. Así se acaba el "regresar a una fila vieja y cambiarla".
 */
export function Ajustes() {
  const { puede, tieneRol, perfil } = useSesion();
  const verCostos = puede("costos", 1);
  const resuelve = puede("inventario", 3) || tieneRol("direccion") || tieneRol("gerente_produccion");
  const [vista, setVista] = useState<"todos" | "aprobado" | "rechazado">("todos");

  const datos = useQuery({
    queryKey: ["v_ajustes"],
    queryFn: () => q<Ajuste[]>(supabase.from("v_ajustes").select("*").order("solicitado_en", { ascending: false }).limit(1000)),
  });
  const pendientes = (datos.data ?? []).filter((a) => a.estado === "pendiente");
  const resueltos = (datos.data ?? []).filter((a) => a.estado !== "pendiente" && (vista === "todos" || a.estado === vista));
  const netoPendiente = pendientes.reduce((s, a) => s + Number(a.valor_diferencia ?? 0), 0);

  const columnas: Columna<Ajuste>[] = [
    { clave: "folio", titulo: "Folio", clase: "whitespace-nowrap font-medium" },
    { clave: "solicitado_en", titulo: "Pedido", clase: "whitespace-nowrap text-xs text-tenue", celda: (a) => fecha(a.solicitado_en) },
    { clave: "nombre", titulo: "Artículo", clase: "max-w-[260px]", celda: (a) => <><p className="truncate">{a.nombre}</p><p className="text-xs text-tenue">{a.clave}</p></> },
    { clave: "almacen", titulo: "Almacén", clase: "whitespace-nowrap", celda: (a) => nombreCorto(a.almacen) },
    { clave: "diferencia", titulo: "Diferencia", alinear: "der", sinBusqueda: true, valor: (a) => Number(a.aplicado ?? a.diferencia),
      celda: (a) => (
        <div>
          <CantidadConSigno n={Number(a.estado === "aprobado" ? a.aplicado : a.diferencia)} unidad={a.unidad} />
          <p className="text-[11px] text-tenue cifra">{numero(a.cantidad_sistema)} → {numero(a.cantidad_fisica)}</p>
        </div>
      ) },
    { clave: "valor_diferencia", titulo: "Valor", alinear: "der", sinBusqueda: true, oculta: !verCostos,
      celda: (a) => a.valor_diferencia == null ? "—" : <span className={Number(a.valor_diferencia) < 0 ? "text-peligro" : ""}>{dinero(a.valor_diferencia)}</span> },
    { clave: "motivo", titulo: "Motivo", clase: "max-w-[240px] text-tenue", celda: (a) => <span className="line-clamp-2" title={a.motivo}>{a.motivo}</span> },
    { clave: "estado", titulo: "Resultado",
      celda: (a) => <Insignia tono={a.estado === "aprobado" ? "ok" : "peligro"}>{a.estado === "aprobado" ? "Aprobado" : "Rechazado"}</Insignia> },
    { clave: "quien", titulo: "Pidió · autorizó", valor: (a) => `${a.solicitado_por_nombre ?? ""} ${a.resuelto_por_nombre ?? ""}`, clase: "text-xs",
      celda: (a) => <><p>{a.solicitado_por_nombre}</p><p className="text-tenue">{a.resuelto_por_nombre} · {fecha(a.resuelto_en)}</p></> },
    { clave: "comentario", titulo: "Comentario", clase: "max-w-[200px] text-xs text-tenue", celda: (a) => <span className="line-clamp-2">{a.comentario ?? "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        {puede("inventario", 2) ? <SolicitarAjuste /> : (
          <Tarjeta className="p-5 text-sm text-tenue">
            Los ajustes los pide almacén cuando el conteo no cuadra y los autoriza la gerencia. Aquí ves cuáles hay y quién los autorizó.
          </Tarjeta>
        )}

        <Tarjeta>
          <EncabezadoTarjeta
            titulo={<span className="flex items-center gap-2">Por autorizar <span className="rounded-full bg-fondo px-2 text-xs cifra">{pendientes.length}</span></span>}
            descripcion={resuelve ? "Revisa el motivo y, si hace falta, que alguien lo vuelva a contar." : "Los autoriza la gerencia de producción, dirección o el jefe de almacén."}
            acciones={verCostos && pendientes.length > 0 && (
              <span className="text-sm text-tenue">Neto: <b className={cn("cifra", netoPendiente < 0 ? "text-peligro" : "text-texto")}>{dinero(netoPendiente)}</b></span>
            )}
          />
          <div className="px-4 pb-4">
            {datos.isLoading ? <Cargando filas={3} /> : pendientes.length === 0 ? (
              <div className="flex items-center gap-2 py-8 justify-center text-sm text-tenue"><CheckCircle2 className="h-5 w-5 text-ok" /> No hay ajustes esperando autorización.</div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {pendientes.map((a) => <TarjetaPendiente key={a.id} a={a} resuelve={resuelve} esMio={a.solicitado_por === perfil?.id} verCostos={verCostos} />)}
              </div>
            )}
          </div>
        </Tarjeta>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Historial de ajustes</h3>
        <TablaDatos
          filas={resueltos}
          columnas={columnas}
          cargando={datos.isLoading}
          error={datos.error}
          claveFila={(a) => a.id}
          exportarComo="ajustes-inventario"
          placeholder="Buscar por artículo, folio o motivo…"
          compacta
          filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[{ valor: "todos", texto: "Todos" }, { valor: "aprobado", texto: "Aprobados" }, { valor: "rechazado", texto: "Rechazados" }]} />}
          vacio={{ icono: Scale, titulo: "Todavía no hay ajustes resueltos", texto: "Cuando la gerencia apruebe o rechace un ajuste, quedará aquí con quién y cuándo." }}
        />
      </div>
    </div>
  );
}

function TarjetaPendiente({ a, resuelve, esMio, verCostos }: { a: Ajuste; resuelve: boolean; esMio: boolean; verCostos: boolean }) {
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolver = useAccion((aprobar: boolean) => q(supabase.rpc("resolver_ajuste", { p_ajuste: a.id, p_aprobar: aprobar, p_comentario: comentario.trim() || null })), {
    exito: () => `Ajuste ${a.folio} resuelto`,
    invalidar: [["v_ajustes"], ["ajustes_pendientes_cuenta"], ["v_existencias"], ["kardex"], ["indicadores"]],
  });
  // La base es la que decide quién autoriza; aquí solo se muestra su razón junto al ajuste.
  const intentar = (aprobar: boolean) => {
    setError(null);
    resolver.mutate(aprobar, { onError: (e) => setError(mensajeError(e)) });
  };
  const cambio = a.existencia_actual != null && Number(a.existencia_actual) !== Number(a.cantidad_sistema);

  return (
    <div className="rounded-lg border border-borde p-3 space-y-2.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate" title={a.nombre}>{a.nombre}</p>
          <p className="text-xs text-tenue">{a.folio} · {a.clave} · {a.almacen}</p>
        </div>
        <div className="text-right">
          <CantidadConSigno n={Number(a.diferencia)} unidad={a.unidad} className="text-lg" />
          {verCostos && a.valor_diferencia != null && <p className="text-xs text-tenue cifra">{dinero(a.valor_diferencia)}</p>}
        </div>
      </div>
      <p className="text-sm">
        Sistema <b className="cifra">{numero(a.cantidad_sistema)}</b> → contado <b className="cifra">{numero(a.cantidad_fisica)}</b>
        {cambio && <span className="text-aviso text-xs"> · hoy hay {numero(a.existencia_actual)}: se ajustará a lo contado</span>}
      </p>
      <p className="text-sm text-tenue bg-fondo rounded-md px-2.5 py-1.5">“{a.motivo}”</p>
      <p className="text-xs text-tenue">Pidió {a.solicitado_por_nombre ?? "—"} · {hace(a.solicitado_en)} ({fechaYHora(a.solicitado_en)}){a.conteo && ` · ${a.conteo}`}</p>
      {resuelve && (
        <div className="space-y-2 pt-1">
          {esMio && <p className="text-xs text-aviso flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Lo pediste tú: lo debe autorizar otra persona.</p>}
          <input className="campo h-8 text-sm" placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <div className="flex gap-2">
            <Boton variante="exito" tamano="sm" className="flex-1" onClick={() => intentar(true)} cargando={resolver.isPending && resolver.variables === true}>
              <ClipboardCheck className="h-4 w-4" /> Aprobar
            </Boton>
            <Boton variante="secundario" tamano="sm" className="flex-1" onClick={() => intentar(false)} cargando={resolver.isPending && resolver.variables === false}>
              <X className="h-4 w-4" /> Rechazar
            </Boton>
          </div>
          {error && <p className="text-xs text-peligro bg-peligro-suave rounded-md px-2 py-1.5">No se pudo: {error}</p>}
        </div>
      )}
    </div>
  );
}

function SolicitarAjuste() {
  const almacenes = useAlmacenes();
  const [articulo, setArticulo] = useState<ArticuloEncontrado | null>(null);
  const [almacen, setAlmacen] = useState<number | null>(null);
  const [fisica, setFisica] = useState("");
  const [motivo, setMotivo] = useState("");
  const existencias = useQuery({
    queryKey: ["existencias_articulo", articulo?.id],
    enabled: !!articulo,
    queryFn: () => q<{ almacen_id: number; cantidad: number }[]>(supabase.from("existencias").select("almacen_id, cantidad").eq("articulo_id", articulo!.id)),
  });
  const sistema = Number(existencias.data?.find((e) => e.almacen_id === almacen)?.cantidad ?? 0);
  const n = Number(fisica.replace(",", "."));
  const listo = !!articulo && almacen != null && fisica !== "" && n >= 0 && motivo.trim().length >= 5;

  const pedir = useAccion(() => q(supabase.rpc("solicitar_ajuste", { p_articulo: articulo!.id, p_almacen: almacen, p_cantidad_fisica: n, p_motivo: motivo.trim() })), {
    exito: "Ajuste pedido. La existencia no cambia hasta que lo autoricen.",
    invalidar: [["v_ajustes"], ["ajustes_pendientes_cuenta"]],
    alTerminar: () => { setArticulo(null); setAlmacen(null); setFisica(""); setMotivo(""); },
  });

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Pedir un ajuste" descripcion="Cuando lo que hay en el estante no es lo que dice el sistema." />
      <form className="px-5 pb-5 space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) pedir.mutate(undefined); }}>
        {articulo ? (
          <div className="flex items-center gap-2 rounded-lg border border-marca/40 bg-marca-suave/40 px-3 py-2">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{articulo.nombre}</p><p className="text-xs text-tenue">{articulo.clave}</p></div>
            <button type="button" onClick={() => { setArticulo(null); setAlmacen(null); }} className="p-1 rounded text-tenue hover:bg-fondo" aria-label="Cambiar artículo"><X className="h-4 w-4" /></button>
          </div>
        ) : <BuscadorArticulo alElegir={setArticulo} tipos={["componente", "materia_prima"]} mostrarPrecio={false} placeholder="Artículo a ajustar…" />}
        {articulo && (
          <div className="flex flex-wrap gap-1.5">
            {(almacenes.data ?? []).map((al) => {
              const hay = Number(existencias.data?.find((e) => e.almacen_id === al.id)?.cantidad ?? 0);
              return (
                <button key={al.id} type="button" onClick={() => setAlmacen(al.id)}
                  className={cn("rounded-lg border px-2.5 py-1.5 text-left min-w-[78px]", almacen === al.id ? "border-marca bg-marca-suave" : "border-borde hover:bg-fondo")}>
                  <span className="block text-xs text-tenue">{nombreCorto(al.nombre)}</span>
                  <span className="block text-sm font-semibold cifra">{numero(hay)}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-tenue">Sistema</span>
            <p className="h-9 flex items-center justify-end px-3 rounded-lg bg-fondo cifra">{almacen != null ? numero(sistema) : "—"}</p>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-tenue">Lo que hay físicamente</span>
            <input inputMode="decimal" className="campo text-right cifra" value={fisica} onChange={(e) => setFisica(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" />
          </label>
        </div>
        {almacen != null && fisica !== "" && <p className="text-sm">Diferencia: <CantidadConSigno n={n - sistema} unidad={articulo?.unidad} /></p>}
        <label className="block space-y-1">
          <span className="text-xs text-tenue">Motivo (obligatorio, lo lee quien autoriza)</span>
          <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. conteo del lunes, pieza dañada…" />
        </label>
        <Boton type="submit" className="w-full" disabled={!listo} cargando={pedir.isPending}>Pedir autorización</Boton>
      </form>
    </Tarjeta>
  );
}

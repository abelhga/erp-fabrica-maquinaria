import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Ban, CheckCircle2, ClipboardX, MessageSquarePlus, PackageOpen, Pause, Pencil, Play, PlayCircle, Truck,
} from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { PlanosOrden } from "@/components/planos/PlanosArticulo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE, consulta, useEventos, useProduccionEnVivo, type EstadoOP, type EstadoOperacion, type MaterialOP, type OrdenTablero, type PasoValidacion } from "./componentes/datos";
import { BarraAvance, IconoEvento, InsigniaCompromiso } from "./componentes/piezas";
import { PasosValidacion, type AccionPaso } from "./componentes/Validacion";
import { DialogoSurtir, MaterialOrden } from "./componentes/MaterialOrden";
import { DialogoCambioIngenieria, DialogoCancelar, DialogoEditarOrden, type OrdenBasica } from "./componentes/DialogosOrden";
import { ESTADO_OP, ESTADO_OPERACION, PRIORIDAD, horas, textoEvento } from "./componentes/util";

interface Orden {
  id: string; folio: string; numero_serie: string | null; estado: EstadoOP; prioridad: number; cantidad: number;
  fecha_compromiso: string | null; inicio_plan: string | null; notas: string | null; pedido_id: string | null;
  articulo_id: string; motivo_cancelacion: string | null; terminada_en: string | null; entregada_en: string | null; creado_en: string;
  articulo: { clave: string; nombre: string; imagen_url: string | null };
}
interface Operacion {
  id: string; etapa_id: number; horas_estimadas: number; estado: EstadoOperacion; inicio: string | null; fin: string | null;
  responsable: string | null; etapa: { nombre: string; color: string; orden: number };
}
interface Solicitud {
  id: string; descripcion: string; estado: "pendiente" | "aplicada" | "descartada"; solicitado_en: string; resuelto_en: string | null;
  respuesta: string | null; articulo: { nombre: string }; solicitante: { nombre: string } | null; resolvio: { nombre: string } | null;
}

export default function DetalleOrden() {
  const { id = "" } = useParams();
  const { puede } = useSesion();
  // Todo lo de la orden deja evento (incluido lo que hace almacén o ingeniería), así que basta con escucharlos.
  useProduccionEnVivo(["op_eventos", "ordenes_produccion", "existencias"]);

  const orden = useQuery({
    queryKey: [...CLAVE, "orden", id],
    queryFn: () => consulta<Orden | null>(supabase.from("ordenes_produccion").select("*, articulo:articulos(clave, nombre, imagen_url)").eq("id", id).maybeSingle()),
  });
  const tab = useQuery({
    queryKey: [...CLAVE, "orden", id, "tablero"],
    queryFn: () => q<OrdenTablero | null>(supabase.from("v_tablero_produccion").select("*").eq("id", id).maybeSingle()),
  });
  const pedido = useQuery({
    queryKey: [...CLAVE, "orden", id, "pedido", orden.data?.pedido_id],
    enabled: !!orden.data?.pedido_id,
    queryFn: () => q<{ folio: string; cliente: string }[]>(supabase.rpc("pedido_de_orden", { p_pedido: orden.data!.pedido_id })),
  });
  const pasos = useQuery({
    queryKey: [...CLAVE, "orden", id, "validacion"],
    queryFn: () => q<PasoValidacion[]>(supabase.rpc("validacion_orden", { p_op: id })),
  });
  const material = useQuery({
    queryKey: [...CLAVE, "material", id],
    queryFn: () => q<MaterialOP[]>(supabase.from("v_op_material").select("*").eq("orden_id", id).order("nombre")),
  });
  const operaciones = useQuery({
    queryKey: [...CLAVE, "orden", id, "operaciones"],
    queryFn: async () => (await consulta<Operacion[]>(supabase.from("op_operaciones").select("*, etapa:etapas(nombre, color, orden)").eq("orden_id", id)))
      .sort((a, b) => a.etapa.orden - b.etapa.orden),
  });
  const eventos = useEventos(200, id);
  const solicitudes = useQuery({
    queryKey: [...CLAVE, "orden", id, "solicitudes"],
    queryFn: () => consulta<Solicitud[]>(supabase.from("solicitudes_cambio_bom")
      .select("id, descripcion, estado, solicitado_en, resuelto_en, respuesta, articulo:articulos(nombre), solicitante:perfiles!solicitudes_cambio_bom_solicitado_por_fkey(nombre), resolvio:perfiles!solicitudes_cambio_bom_resuelto_por_fkey(nombre)")
      .eq("orden_id", id).order("solicitado_en", { ascending: false })),
  });

  const [dialogo, setDialogo] = useState<null | "editar" | "cancelar" | "surtir" | "cambio">(null);
  const abrir = (d: typeof dialogo) => (v: boolean) => setDialogo(v ? d : null);

  const inv = { invalidar: [CLAVE] };
  const revisar = useAccion((paso: "ingenieria" | "almacen") => q(supabase.rpc("revisar_orden", { p_op: id, p_paso: paso })), { ...inv, exito: "Revisión registrada" });
  const apartar = useAccion(() => q<{ articulo_id: string }[]>(supabase.rpc("apartar_material", { p_op: id })), {
    ...inv, exito: (r) => (r.length === 0 ? "Material apartado: no falta nada" : `Material apartado; ${r.length} partida(s) con faltante`),
  });
  const pedir = useAccion(() => q<string | null>(supabase.rpc("pedir_faltantes", { p_op: id })), {
    ...inv, exito: (r) => (r ? "Faltantes enviados a compras como requisición" : "No había faltantes sin pedir"),
  });
  const liberar = useAccion(() => q(supabase.rpc("liberar_orden", { p_op: id })), { ...inv, exito: "Orden liberada al taller" });
  const entregar = useAccion(() => q(supabase.rpc("entregar_orden", { p_op: id })), { ...inv, exito: "Orden entregada" });
  const avanzar = useAccion((a: { op: string; accion: string }) => q(supabase.rpc("avanzar_operacion", { p_operacion: a.op, p_accion: a.accion })), inv);
  const resolver = useAccion((a: { id: string; estado: string }) => q(supabase.rpc("responder_solicitud_cambio", { p_id: a.id, p_estado: a.estado })),
    { ...inv, exito: "Solicitud resuelta" });

  if (orden.error) return <Pagina titulo="Orden de producción"><ErrorCarga error={orden.error} /></Pagina>;
  if (orden.isLoading) return <Pagina titulo="Orden de producción"><Cargando filas={8} /></Pagina>;
  const o = orden.data;
  if (!o) {
    return (
      <Pagina titulo="Orden de producción">
        <div className="tarjeta"><Vacio icono={ClipboardX} titulo="No existe esa orden o no tienes acceso"
          accion={<Link to="/produccion/ordenes" className="text-marca-texto text-sm">Volver a las órdenes</Link>} /></div>
      </Pagina>
    );
  }

  const abierta = !["terminada", "entregada", "cancelada"].includes(o.estado);
  const enTaller = o.estado === "liberada" || o.estado === "en_proceso";
  const p = { ing: puede("costeo", 2) || puede("produccion", 3), apartar: puede("produccion", 2) || puede("inventario", 2),
              almacen: puede("inventario", 2), gerencia: puede("produccion", 3), taller: puede("produccion", 2),
              solicitar: puede("produccion", 2) || puede("inventario", 2) || puede("costeo", 1) || puede("ventas", 2),
              resolver: puede("costeo", 2) };
  const basica: OrdenBasica = { id: o.id, folio: o.folio, numero_serie: o.numero_serie, prioridad: o.prioridad, fecha_compromiso: o.fecha_compromiso,
                                notas: o.notas, articulo_id: o.articulo_id, equipo: o.articulo.nombre };
  const t = tab.data;
  const ped = pedido.data?.[0];
  const lista = material.data ?? [];
  const pasoDe = (k: PasoValidacion["paso"]) => pasos.data?.find((x) => x.paso === k);
  const faltanSinPedir = lista.some((m) => m.faltante - m.pedido_a_compras > 0);

  const acciones: Partial<Record<PasoValidacion["paso"], AccionPaso | null>> = !abierta ? {} : {
    ingenieria: p.ing && pasoDe("ingenieria")?.estado === "pendiente" ? { texto: "Marcar revisada", alClic: () => revisar.mutate("ingenieria"), cargando: revisar.isPending } : null,
    apartado: p.apartar ? { texto: pasoDe("apartado")?.estado === "pendiente" ? "Apartar material" : "Volver a apartar", secundaria: pasoDe("apartado")?.estado !== "pendiente",
                            alClic: () => apartar.mutate(undefined), cargando: apartar.isPending,
                            deshabilitado: pasoDe("apartado")?.estado === "hecho" && "Ya está todo apartado o surtido" } : null,
    faltantes: p.apartar && faltanSinPedir ? { texto: "Pedir a compras", alClic: () => pedir.mutate(undefined), cargando: pedir.isPending } : null,
    almacen: p.almacen && pasoDe("almacen")?.estado === "pendiente" ? { texto: "Marcar revisado", alClic: () => revisar.mutate("almacen"), cargando: revisar.isPending } : null,
    liberada: p.gerencia && o.estado === "planeada" ? { texto: "Liberar al taller", alClic: () => liberar.mutate(undefined), cargando: liberar.isPending,
                                                       deshabilitado: pasoDe("ingenieria")?.estado !== "hecho" && "Falta que ingeniería revise la lista" } : null,
  };

  return (
    <Pagina
      ancho="max-w-[1500px]"
      titulo={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to="/produccion/ordenes" className="text-tenue hover:text-texto" aria-label="Volver a órdenes"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="cifra">{o.folio}</span>
        <Insignia tono={ESTADO_OP[o.estado].tono} className="text-sm">{ESTADO_OP[o.estado].texto}</Insignia>
        {o.prioridad !== 2 && <Insignia tono={PRIORIDAD[o.prioridad].tono} className="text-sm">{PRIORIDAD[o.prioridad].texto}</Insignia>}
        {t?.pausada && <Insignia tono="aviso" className="text-sm">Pausada</Insignia>}
      </span>}
      descripcion={<>{o.articulo.nombre}{o.cantidad > 1 && ` × ${o.cantidad}`}</>}
      acciones={<>
        {p.solicitar && <Boton variante="secundario" onClick={() => setDialogo("cambio")}><MessageSquarePlus className="h-4 w-4" />Solicitar cambio a ingeniería</Boton>}
        {p.gerencia && o.estado !== "entregada" && o.estado !== "cancelada" && <Boton variante="secundario" onClick={() => setDialogo("editar")}><Pencil className="h-4 w-4" />Editar</Boton>}
        {o.estado === "terminada" && (p.gerencia || p.almacen) && <Boton onClick={() => entregar.mutate(undefined)} cargando={entregar.isPending}><Truck className="h-4 w-4" />Marcar entregada</Boton>}
        {p.gerencia && abierta && <Boton variante="fantasma" className="text-peligro" onClick={() => setDialogo("cancelar")}><Ban className="h-4 w-4" />Cancelar</Boton>}
      </>}
    >
      {o.estado === "cancelada" && (
        <div className="rounded-lg border border-peligro/30 bg-peligro-suave p-3 text-sm text-peligro">Orden cancelada: {o.motivo_cancelacion}</div>
      )}

      <Tarjeta className="grid gap-px bg-borde overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
        <Dato titulo="Número de serie"><span className="cifra">{o.numero_serie ?? <span className="text-tenue">Sin serie</span>}</span></Dato>
        <Dato titulo="Equipo">
          {puede("costeo") ? <Link to={`/costeo/equipos/${o.articulo_id}`} className="hover:text-marca-texto hover:underline">{o.articulo.clave}</Link> : o.articulo.clave}
        </Dato>
        <Dato titulo={o.pedido_id ? "Pedido y cliente" : "Destino"}>
          {o.pedido_id ? (
            <>
              {puede("ventas") ? <Link to={`/ventas/pedidos/${o.pedido_id}`} className="hover:text-marca-texto hover:underline">{ped?.folio ?? "Pedido"}</Link> : ped?.folio}
              <span className="block text-sm text-tenue font-normal truncate">{ped?.cliente}</span>
            </>
          ) : "Para stock"}
        </Dato>
        <Dato titulo="Compromiso">
          <InsigniaCompromiso dias={t?.dias_restantes ?? null} fechaCompromiso={o.fecha_compromiso} cerrada={!abierta} />
          {o.terminada_en && <span className="block text-xs text-tenue mt-1">Terminada {fecha(o.terminada_en)}</span>}
        </Dato>
        <Dato titulo="Avance">
          {t ? (
            <div className="space-y-1">
              <p className="cifra">{t.avance}% <span className="text-xs text-tenue font-normal">· {horas(t.horas_terminadas)} de {horas(t.horas_totales)}</span></p>
              <BarraAvance valor={t.avance} />
            </div>
          ) : <span className="text-tenue">—</span>}
        </Dato>
      </Tarjeta>
      {o.notas && <p className="text-sm rounded-lg bg-aviso-suave border border-aviso/25 px-3 py-2"><b className="font-medium">Notas:</b> {o.notas}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold">Validación de material</h2>
        {pasos.error ? <ErrorCarga error={pasos.error} /> : pasos.isLoading ? <Cargando filas={2} /> : <PasosValidacion pasos={pasos.data ?? []} acciones={acciones} />}
      </section>

      <div className="grid gap-4 2xl:grid-cols-3 items-start">
        <div className="2xl:col-span-2 space-y-4">
          <MaterialOrden ordenId={id} equipo={o.articulo.nombre} material={material.data} cargando={material.isLoading} error={material.error}
            editable={abierta && p.ing}
            acciones={abierta && p.almacen && (
              <Boton tamano="sm" onClick={() => setDialogo("surtir")}><PackageOpen className="h-3.5 w-3.5" />Surtir</Boton>
            )} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-1 items-start">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Planos" descripcion="Con qué revisión se fabrica esta orden" />
            <div className="px-5 pb-5"><PlanosOrden ordenId={id} /></div>
          </Tarjeta>
          <Tarjeta>
            <EncabezadoTarjeta titulo="Etapas" descripcion="Horas estimadas del costeo y quién la trabaja" />
            <ul className="px-3 pb-3 space-y-1">
              {(operaciones.data ?? []).length === 0 && !operaciones.isLoading && <li className="text-sm text-tenue px-2 py-4">Este equipo no tiene horas por etapa en el costeo.</li>}
              {(operaciones.data ?? []).map((x) => (
                <li key={x.id} className="rounded-lg px-2 py-2 hover:bg-fondo">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: x.etapa.color }} />
                    <span className="font-medium text-sm flex-1">{x.etapa.nombre}</span>
                    <span className="text-xs text-tenue cifra">{horas(x.horas_estimadas)}</span>
                    <Insignia tono={ESTADO_OPERACION[x.estado].tono}>{ESTADO_OPERACION[x.estado].texto}</Insignia>
                  </div>
                  <div className="flex items-center gap-2 pl-5 mt-1">
                    <p className="text-xs text-tenue flex-1 min-w-0 truncate">
                      {[x.responsable, x.inicio && `inició ${fechaYHora(x.inicio)}`, x.fin && `terminó ${fechaYHora(x.fin)}`].filter(Boolean).join(" · ") || "Sin empezar"}
                    </p>
                    {p.taller && enTaller && x.estado !== "terminada" && (
                      <div className="flex gap-1">
                        {x.estado === "pendiente" && <MiniAccion icono={Play} texto="Iniciar" alClic={() => avanzar.mutate({ op: x.id, accion: "inicio" })} />}
                        {x.estado === "en_proceso" && <MiniAccion icono={Pause} texto="Pausar" alClic={() => avanzar.mutate({ op: x.id, accion: "pausa" })} />}
                        {x.estado === "pausada" && <MiniAccion icono={PlayCircle} texto="Reanudar" alClic={() => avanzar.mutate({ op: x.id, accion: "reanudar" })} />}
                        <MiniAccion icono={CheckCircle2} texto="Terminar" alClic={() => avanzar.mutate({ op: x.id, accion: "fin" })} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Cambios pedidos a ingeniería" descripcion="Correcciones a la lista del equipo que salieron de esta orden" />
            <div className="px-3 pb-3 space-y-2">
              {(solicitudes.data ?? []).length === 0 ? (
                <p className="text-sm text-tenue px-2 py-3">Ninguno. Si algo de la lista está mal, usa “Solicitar cambio a ingeniería”.</p>
              ) : solicitudes.data!.map((s) => (
                <div key={s.id} className="rounded-lg border border-borde p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{s.articulo?.nombre}</p>
                    <Insignia tono={s.estado === "pendiente" ? "aviso" : s.estado === "aplicada" ? "ok" : "neutro"}>
                      {s.estado === "pendiente" ? "Pendiente" : s.estado === "aplicada" ? "Aplicada" : "Descartada"}
                    </Insignia>
                  </div>
                  <p className="mt-1">{s.descripcion}</p>
                  <p className="text-xs text-tenue mt-1">{s.solicitante?.nombre} · {fechaYHora(s.solicitado_en)}</p>
                  {s.estado !== "pendiente" && <p className="text-xs text-tenue">{s.resolvio?.nombre} · {fechaYHora(s.resuelto_en)}{s.respuesta && ` · ${s.respuesta}`}</p>}
                  {s.estado === "pendiente" && p.resolver && (
                    <div className="flex gap-2 mt-2">
                      <Boton tamano="sm" variante="exito" onClick={() => resolver.mutate({ id: s.id, estado: "aplicada" })}>Ya se corrigió</Boton>
                      <Boton tamano="sm" variante="secundario" onClick={() => resolver.mutate({ id: s.id, estado: "descartada" })}>Descartar</Boton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Línea de tiempo" descripcion="Quién hizo qué y cuándo" />
            <ol className="px-5 pb-4 space-y-0 max-h-[560px] overflow-y-auto">
              {(eventos.data ?? []).map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-3">
                  {i < (eventos.data?.length ?? 0) - 1 && <span className="absolute left-[7px] top-5 bottom-0 w-px bg-borde" />}
                  <IconoEvento tipo={e.tipo} className="mt-0.5 relative bg-superficie" />
                  <div className="min-w-0">
                    <p className={cn("text-sm leading-snug", e.tipo === "problema" && "text-peligro")}>{textoEvento(e, false)}</p>
                    <p className="text-xs text-tenue cifra">{fechaYHora(e.en)}{e.usuario && ` · ${e.usuario}`}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </div>

      {p.gerencia && <>
        <DialogoEditarOrden abierto={dialogo === "editar"} alCambiar={abrir("editar")} o={basica} />
        <DialogoCancelar abierto={dialogo === "cancelar"} alCambiar={abrir("cancelar")} o={basica} />
      </>}
      {p.almacen && <DialogoSurtir abierto={dialogo === "surtir"} alCambiar={abrir("surtir")} ordenId={id} folio={o.folio} material={lista} />}
      {p.solicitar && <DialogoCambioIngenieria abierto={dialogo === "cambio"} alCambiar={abrir("cambio")} o={basica} material={lista} />}
    </Pagina>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-superficie px-4 py-3 min-w-0">
      <p className="etiqueta">{titulo}</p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function MiniAccion({ icono: I, texto, alClic }: { icono: typeof Play; texto: string; alClic: () => void }) {
  return (
    <button type="button" onClick={alClic} title={texto} aria-label={texto}
            className="h-7 w-7 rounded-md border border-borde flex items-center justify-center text-tenue hover:text-texto hover:bg-fondo">
      <I className="h-3.5 w-3.5" />
    </button>
  );
}

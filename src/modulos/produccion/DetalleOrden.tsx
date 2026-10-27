import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowUpRight, Ban, CheckCircle2, Hourglass, ClipboardX, ListPlus, MessageSquarePlus, PackageOpen, Pause, Pencil, Play, PlayCircle, Truck, Undo2 } from "lucide-react";
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
import { CLAVE, consulta, useEventos, useProduccionEnVivo, useTablero, type EstadoOP, type EstadoOperacion, type MaterialOP, type OrdenTablero, type PasoValidacion } from "./componentes/datos";
import { BarraAvance, IconoEvento, InsigniaCompromiso } from "./componentes/piezas";
import { PasosValidacion, type AccionPaso } from "./componentes/Validacion";
import { DialogoSurtir, MaterialOrden } from "./componentes/MaterialOrden";
import { DialogoAgregarEtapa, DialogoCambioIngenieria, DialogoCancelar, DialogoEditarOrden, DialogoEnEspera, DialogoReabrir, DialogoRegresarStock, type OrdenBasica } from "./componentes/DialogosOrden";
import { ESTADO_OP, ESTADO_OPERACION, PRIORIDAD, horas, textoEvento } from "./componentes/util";
import { AvanceEtapa } from "./componentes/AvanceEtapa";
import { GanttCompacto } from "./Gantt";
import { GLOSARIO } from "@/tutorial/glosario";

interface HorasHombre {
  operacion_id: string; horas_estimadas: number; horas_reales: number; horas_sin_nombre: number;
  personas: { tiempo_id: string; nombre: string; horas: number; abierto: boolean }[];
}

interface Orden {
  id: string; folio: string; numero_serie: string | null; estado: EstadoOP; prioridad: number; cantidad: number;
  fecha_compromiso: string | null; inicio_plan: string | null; notas: string | null; pedido_id: string | null;
  articulo_id: string; motivo_cancelacion: string | null; terminada_en: string | null; entregada_en: string | null; creado_en: string;
  en_espera_motivo: string | null; en_espera_desde: string | null;
  articulo: { clave: string; nombre: string; imagen_url: string | null };
}
interface Operacion {
  id: string; etapa_id: number; horas_estimadas: number; estado: EstadoOperacion; inicio: string | null; fin: string | null;
  responsable: string | null; etapa: { nombre: string; color: string; orden: number };
  avance: number | null;
}
interface Solicitud {
  id: string; descripcion: string; estado: "pendiente" | "aplicada" | "descartada"; solicitado_en: string; resuelto_en: string | null;
  respuesta: string | null; articulo: { nombre: string }; solicitante: { nombre: string } | null; resolvio: { nombre: string } | null;
}

export default function DetalleOrden() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const tablero = useTablero();
  const { puede, veFabricacion } = useSesion();
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
  // Si el cliente canceló, la orden sigue ligada a un pedido muerto: el detalle lo avisa.
  const estadoPedido = useQuery({
    queryKey: [...CLAVE, "orden", id, "estado_pedido", orden.data?.pedido_id],
    enabled: !!orden.data?.pedido_id,
    queryFn: () => q<{ estado: string; motivo_cancelacion: string | null }[]>(supabase.rpc("estado_pedido_de_orden", { p_pedido: orden.data!.pedido_id })),
  });
  // La ficha de ventas trae montos y la base solo la deja ver a ventas, finanzas, dirección y al
  // vendedor del pedido; preguntarle a la base (no al rol) evita mandar a alguien a un «no existe».
  const pedidoEnVentas = useQuery({
    queryKey: [...CLAVE, "orden", id, "pedido_en_ventas", orden.data?.pedido_id],
    enabled: !!orden.data?.pedido_id && puede("ventas"),
    queryFn: () => q<{ id: string } | null>(supabase.from("pedidos").select("id").eq("id", orden.data!.pedido_id!).maybeSingle()),
  });
  const pasos = useQuery({
    queryKey: [...CLAVE, "orden", id, "validacion"],
    queryFn: () => q<PasoValidacion[]>(supabase.rpc("validacion_orden", { p_op: id })),
  });
  const material = useQuery({
    queryKey: [...CLAVE, "material", id],
    queryFn: () => q<MaterialOP[]>(supabase.from("v_op_material").select("*").eq("orden_id", id).order("nombre")),
  });
  // Horas hombre reales por etapa (cada persona su tramo; la terminal los anota).
  const horasHombre = useQuery({ queryKey: [...CLAVE, "horas_hombre", id], refetchInterval: 60_000,
    queryFn: () => q<HorasHombre[]>(supabase.rpc("horas_hombre_orden", { p_orden: id })) });
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

  const [dialogo, setDialogo] = useState<null | "editar" | "cancelar" | "surtir" | "cambio" | "espera" | "etapa" | "stock">(null);
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
  // Una orden de equipo que nació sin serie (su equipo no tenía código): se asigna al capturarlo.
  const asignarSerie = useAccion(() => q<string>(supabase.rpc("asignar_numero_serie", { p_orden: id })), { ...inv, invalidar: [CLAVE, ["numeros_serie"]], exito: (s) => `Número de serie ${s}` });
  const entregar = useAccion(() => q(supabase.rpc("entregar_orden", { p_op: id })), { ...inv, exito: "Orden entregada" });
  const reactivar = useAccion(() => q(supabase.rpc("reactivar_orden", { p_op: id })), { ...inv, exito: "Orden reactivada: vuelve a la carga del taller" });
  const avanzar = useAccion((a: { op: string; accion: string }) => q(supabase.rpc("avanzar_operacion", { p_operacion: a.op, p_accion: a.accion })), inv);
  // Terminar es un clic: el aviso trae "Deshacer" (quien la terminó tiene 15 minutos; la gerencia, siempre con "Reabrir").
  const terminar = useAccion((a: { op: string; etapa: string }) => q(supabase.rpc("avanzar_operacion", { p_operacion: a.op, p_accion: "fin" })), {
    ...inv, exito: "Etapa terminada",
    deshacer: (_r, a) => q(supabase.rpc("reabrir_etapa", { p_operacion: a.op })),
  });
  const [reabrir, setReabrir] = useState<{ id: string; etapa: string } | null>(null);
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
  const cancelado = estadoPedido.data?.[0]?.estado === "cancelado" ? estadoPedido.data[0] : null;
  const puedeRegresar = p.gerencia && !!o.pedido_id && o.estado !== "entregada" && o.estado !== "cancelada";
  // Quien no puede ver la ficha de ventas pero es de planta va a la del pedido sin montos.
  const aPedido = !o.pedido_id || pedidoEnVentas.isLoading ? null
    : pedidoEnVentas.data ? `/ventas/pedidos/${o.pedido_id}`
    : puede("produccion", 2) ? `/produccion/pedidos?pedido=${o.pedido_id}` : null;
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
        {t?.pausada && !o.en_espera_motivo && <Insignia tono="aviso" className="text-sm">Pausada</Insignia>}
        {o.en_espera_motivo && <span data-explain={GLOSARIO.ordenEnEspera}><Insignia tono="aviso" className="text-sm"><Hourglass className="h-3.5 w-3.5" />En espera</Insignia></span>}
      </span>}
      descripcion={<>{o.articulo.nombre}{o.cantidad > 1 && ` × ${o.cantidad}`}</>}
      acciones={<>
        {p.solicitar && <Boton variante="secundario" onClick={() => setDialogo("cambio")}><MessageSquarePlus className="h-4 w-4" />Solicitar cambio a ingeniería</Boton>}
        {p.gerencia && o.estado !== "entregada" && o.estado !== "cancelada" && <Boton variante="secundario" onClick={() => setDialogo("editar")}><Pencil className="h-4 w-4" />Editar</Boton>}
        {puedeRegresar && !cancelado && (
          <Boton variante="secundario" onClick={() => setDialogo("stock")} data-explain={GLOSARIO.regresarStock} data-explain-title="Regresar a stock">
            <Undo2 className="h-4 w-4" />Regresar a stock
          </Boton>
        )}
        {o.estado === "terminada" && (p.gerencia || p.almacen) && <Boton onClick={() => entregar.mutate(undefined)} cargando={entregar.isPending}><Truck className="h-4 w-4" />Marcar entregada</Boton>}
        {p.gerencia && abierta && (o.en_espera_motivo
          ? <Boton onClick={() => reactivar.mutate(undefined)} cargando={reactivar.isPending}><Play className="h-4 w-4" />Reactivar</Boton>
          : <Boton variante="secundario" onClick={() => setDialogo("espera")}><Hourglass className="h-4 w-4" />Poner en espera</Boton>)}
        {p.gerencia && abierta && <Boton variante="fantasma" className="text-peligro" onClick={() => setDialogo("cancelar")}><Ban className="h-4 w-4" />Cancelar</Boton>}
      </>}
    >
      {o.en_espera_motivo && abierta && (
        <div className="rounded-lg border border-aviso/40 bg-aviso-suave p-3 text-sm" data-explain={GLOSARIO.ordenEnEspera}>
          <b>En espera desde el {fecha(o.en_espera_desde)}:</b> {o.en_espera_motivo}. No cuenta en la carga del taller ni se trabaja en la terminal hasta que se reactive.
        </div>
      )}
      {cancelado && o.estado !== "entregada" && o.estado !== "cancelada" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-peligro/30 bg-peligro-suave p-3 text-sm" data-explain={GLOSARIO.regresarStock}>
          <p className="min-w-[240px] flex-1">
            <b>El pedido {ped?.folio} se canceló</b>{cancelado.motivo_cancelacion ? `: ${cancelado.motivo_cancelacion}` : ""}. Esta orden sigue siendo de ese pedido.{" "}
            {p.gerencia ? "Regrésala a stock para dársela a otro cliente, o cancélala si ya no se va a terminar." : "La gerencia de producción decide si regresa a stock o se cancela."}
          </p>
          {puedeRegresar && <Boton tamano="sm" onClick={() => setDialogo("stock")}><Undo2 className="h-3.5 w-3.5" />Regresar a stock</Boton>}
        </div>
      )}
      {o.estado === "cancelada" && (
        <div className="rounded-lg border border-peligro/30 bg-peligro-suave p-3 text-sm text-peligro">Orden cancelada: {o.motivo_cancelacion}</div>
      )}

      <Tarjeta className="grid gap-px bg-borde overflow-hidden sm:grid-cols-2 lg:grid-cols-5">
        <Dato titulo="Número de serie" explica={GLOSARIO.numeroSerie}>
          {o.numero_serie ? <span className="cifra">{o.numero_serie}</span> : (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-tenue">Sin serie</span>
              {puede("produccion", 2) && o.cantidad === 1 && o.estado !== "cancelada" && (
                <Boton variante="secundario" className="h-7 text-xs" cargando={asignarSerie.isPending} onClick={() => asignarSerie.mutate(undefined)}>Asignar</Boton>
              )}
            </span>
          )}
        </Dato>
        <Dato titulo="Equipo">
          {puede("costeo") ? <Link to={`/costeo/equipos/${o.articulo_id}`} className="hover:text-marca-texto hover:underline">{o.articulo.clave}</Link> : o.articulo.clave}
        </Dato>
        {/* Todo el recuadro es el enlace: el folio con solo subrayado al pasar el mouse no se veía.
            En el celular va primero, porque abajo de la serie y el equipo quedaba fuera de la pantalla. */}
        {aPedido ? (
          <Link to={aPedido} className="group order-first sm:order-none bg-superficie px-4 py-3 min-w-0 transition-colors hover:bg-marca-suave focus-visible:bg-marca-suave focus-visible:outline-none"
            data-explain={GLOSARIO.abrirPedidoDeOrden} data-explain-title="Pedido y cliente">
            <p className="etiqueta">Pedido y cliente</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 font-medium text-marca-texto">
              <span className="cifra">{ped?.folio ?? "Pedido"}</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-normal group-hover:underline">Abrir pedido<ArrowUpRight className="h-3.5 w-3.5" /></span>
            </p>
            <span className="block text-sm text-tenue truncate">{ped?.cliente}</span>
          </Link>
        ) : (
          <Dato titulo={o.pedido_id ? "Pedido y cliente" : "Destino"}>
            {o.pedido_id ? (
              <>
                {ped?.folio}
                <span className="block text-sm text-tenue font-normal truncate">{ped?.cliente}</span>
              </>
            ) : "Para stock"}
          </Dato>
        )}
        <Dato titulo="Compromiso">
          <InsigniaCompromiso dias={t?.dias_restantes ?? null} fechaCompromiso={o.fecha_compromiso} cerrada={!abierta} />
          {o.terminada_en && <span className="block text-xs text-tenue mt-1">Terminada {fecha(o.terminada_en)}</span>}
        </Dato>
        <Dato titulo="Avance" explica={GLOSARIO.avanceOrden}>
          {t ? (
            <div className="space-y-1">
              <p className="cifra">{t.avance}% {veFabricacion && <span className="text-xs text-tenue font-normal">· {horas(t.horas_terminadas)} de {horas(t.horas_totales)}</span>}</p>
              <BarraAvance valor={t.avance} />
            </div>
          ) : <span className="text-tenue">—</span>}
        </Dato>
      </Tarjeta>
      {o.notas && <p className="text-sm rounded-lg bg-aviso-suave border border-aviso/25 px-3 py-2"><b className="font-medium">Notas:</b> {o.notas}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold" data-explain={GLOSARIO.validacionMaterial} data-explain-title="Validación de material">Validación de material</h2>
        {pasos.error ? <ErrorCarga error={pasos.error} /> : pasos.isLoading ? <Cargando filas={2} /> : <PasosValidacion pasos={pasos.data ?? []} acciones={acciones} />}
      </section>

      <div className="grid gap-4 2xl:grid-cols-3 items-start">
        {/* Material, planos y horas: de quien fabrica; quien sigue el avance (ventas) ve etapas y fechas. */}
        {veFabricacion && <div className="2xl:col-span-2 space-y-4">
          <MaterialOrden ordenId={id} equipo={o.articulo.nombre} material={material.data} cargando={material.isLoading} error={material.error}
            editable={abierta && p.ing}
            acciones={abierta && p.almacen && (
              <Boton tamano="sm" onClick={() => setDialogo("surtir")}><PackageOpen className="h-3.5 w-3.5" />Surtir</Boton>
            )} />
        </div>}

        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-1 items-start">
          {veFabricacion && <Tarjeta>
            <EncabezadoTarjeta titulo="Planos" descripcion="Con qué revisión se fabrica esta orden" />
            <div className="px-5 pb-5"><PlanosOrden ordenId={id} /></div>
          </Tarjeta>}
          <Tarjeta>
            <EncabezadoTarjeta titulo="Etapas" explica={veFabricacion ? GLOSARIO.horasHombre : undefined}
              descripcion={veFabricacion ? "Horas estimadas del costeo contra las horas hombre reales, y quién la trabajó" : "En qué va cada etapa del taller"}
              acciones={p.gerencia && !["entregada", "cancelada"].includes(o.estado) && (
                <span data-explain={GLOSARIO.agregarEtapa} data-explain-title="Agregar etapa">
                  <Boton tamano="sm" variante="secundario" onClick={() => setDialogo("etapa")}><ListPlus className="h-3.5 w-3.5" />Agregar etapa</Boton>
                </span>
              )} />
            <ul className="px-3 pb-3 space-y-1">
              {(operaciones.data ?? []).length === 0 && !operaciones.isLoading && <li className="text-sm text-tenue px-2 py-4">Este equipo no tiene horas por etapa en el costeo.</li>}
              {(operaciones.data ?? []).map((x) => (
                <li key={x.id} className="rounded-lg px-2 py-2 hover:bg-fondo">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: x.etapa.color }} />
                    <span className="font-medium text-sm flex-1">{x.etapa.nombre}</span>
                    {veFabricacion && <span className="text-xs text-tenue cifra">{horas(x.horas_estimadas)}</span>}
                    <Insignia tono={ESTADO_OPERACION[x.estado].tono}>{ESTADO_OPERACION[x.estado].texto}</Insignia>
                  </div>
                  <div className="flex items-center gap-2 pl-5 mt-1">
                    <p className="text-xs text-tenue flex-1 min-w-0 truncate">
                      {[x.estado !== "terminada" && x.avance != null && `lleva ${Math.round(x.avance * 100)} %`, x.responsable, x.inicio && `inició ${fechaYHora(x.inicio)}`, x.fin && `terminó ${fechaYHora(x.fin)}`].filter(Boolean).join(" · ") || "Sin empezar"}
                    </p>
                    {p.taller && enTaller && !o.en_espera_motivo && x.estado !== "terminada" && (
                      <div className="flex gap-1">
                        {x.estado === "pendiente" && <MiniAccion icono={Play} texto="Iniciar" alClic={() => avanzar.mutate({ op: x.id, accion: "inicio" })} />}
                        {x.estado === "en_proceso" && <MiniAccion icono={Pause} texto="Pausar" alClic={() => avanzar.mutate({ op: x.id, accion: "pausa" })} />}
                        {x.estado === "pausada" && <MiniAccion icono={PlayCircle} texto="Reanudar" alClic={() => avanzar.mutate({ op: x.id, accion: "reanudar" })} />}
                        <MiniAccion icono={CheckCircle2} texto="Terminar" alClic={() => terminar.mutate({ op: x.id, etapa: x.etapa.nombre })} />
                      </div>
                    )}
                    {p.gerencia && x.estado === "terminada" && !["entregada", "cancelada"].includes(o.estado) && (
                      <span data-explain={GLOSARIO.reabrirEtapa} data-explain-title="Reabrir">
                        <MiniAccion icono={Undo2} texto="Reabrir" alClic={() => setReabrir({ id: x.id, etapa: x.etapa.nombre })} />
                      </span>
                    )}
                  </div>
                  {p.taller && enTaller && !o.en_espera_motivo && (x.estado === "en_proceso" || x.estado === "pausada") && (
                    <div className="pl-5 mt-1.5"><AvanceEtapa operacion={x.id} avance={x.avance} /></div>
                  )}
                  {veFabricacion && <HorasDeEtapa h={horasHombre.data?.find((y) => y.operacion_id === x.id)} />}
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Cambios pedidos a ingeniería" explica={GLOSARIO.solicitudCambio} descripcion="Correcciones a la lista del equipo que salieron de esta orden" />
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

      {/* El Gantt de esta orden (y de las demás de su pedido): cuándo entra y sale de cada área. */}
      {o.estado !== "cancelada" && o.estado !== "entregada" && (
        <Tarjeta>
          <EncabezadoTarjeta titulo="Plan del taller" explica={GLOSARIO.planTaller}
            descripcion={o.pedido_id ? "Esta orden y las demás de su pedido. Se recalcula solo con lo que pasa en el piso." : "Cuándo entra y sale de cada área. Se recalcula solo con lo que pasa en el piso."} />
          <div className="px-4 pb-4">
            <GanttCompacto ordenes={o.pedido_id ? (tablero.data ?? []).filter((t) => t.pedido_id === o.pedido_id).map((t) => t.id).concat(id) : [id]}
              alAbrir={(op) => op !== id && navegar(`/produccion/ordenes/${op}`)} />
          </div>
        </Tarjeta>
      )}

      {p.gerencia && <>
        <DialogoEditarOrden abierto={dialogo === "editar"} alCambiar={abrir("editar")} o={basica} />
        <DialogoCancelar abierto={dialogo === "cancelar"} alCambiar={abrir("cancelar")} o={basica} />
        <DialogoEnEspera abierto={dialogo === "espera"} alCambiar={abrir("espera")} o={basica} />
        <DialogoReabrir etapa={reabrir} alCerrar={() => setReabrir(null)} o={basica} />
        <DialogoRegresarStock orden={dialogo === "stock" ? { id: o.id, folio: o.folio } : null} pedido={ped?.folio} alCerrar={() => setDialogo(null)} />
        <DialogoAgregarEtapa abierto={dialogo === "etapa"} alCambiar={abrir("etapa")} o={{ ...basica, terminada: o.estado === "terminada", conPedido: !!o.pedido_id }}
          tiene={(operaciones.data ?? []).map((x) => x.etapa_id)} />
      </>}
      {p.almacen && <DialogoSurtir abierto={dialogo === "surtir"} alCambiar={abrir("surtir")} ordenId={id} folio={o.folio} material={lista} creadaEn={o.creado_en} />}
      {p.solicitar && <DialogoCambioIngenieria abierto={dialogo === "cambio"} alCambiar={abrir("cambio")} o={basica} material={lista} />}
    </Pagina>
  );
}

function Dato({ titulo, children, explica }: { titulo: string; children: React.ReactNode; explica?: string }) {
  return (
    <div className="bg-superficie px-4 py-3 min-w-0" data-explain={explica} data-explain-title={explica ? titulo : undefined}>
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

/** "12.5 h hombre de 10 estimadas · Ana 6 h, Beto 4 h, 2 sin nombre 2.5 h" */
function HorasDeEtapa({ h }: { h?: HorasHombre }) {
  if (!h || h.personas.length === 0) return null;
  const reales = Number(h.horas_reales), est = Number(h.horas_estimadas);
  const porNombre = new Map<string, { horas: number; abierto: boolean }>();
  for (const x of h.personas) {
    const a = porNombre.get(x.nombre) ?? { horas: 0, abierto: false };
    porNombre.set(x.nombre, { horas: a.horas + Number(x.horas), abierto: a.abierto || x.abierto });
  }
  return (
    <div className="pl-5 mt-1 text-xs" data-explain={GLOSARIO.horasHombre} data-explain-title="Horas hombre">
      <p className={cn("cifra font-medium", est > 0 && reales > est ? "text-aviso" : "text-texto")}>
        {horas(reales)} hombre{est > 0 && ` de ${horas(est)} estimadas`}
        {Number(h.horas_sin_nombre) > 0 && <span className="text-tenue font-normal"> · {horas(Number(h.horas_sin_nombre))} sin nombre</span>}
      </p>
      <p className="text-tenue">{[...porNombre].map(([n, v]) => `${n} ${horas(v.horas)}${v.abierto ? " (trabajando)" : ""}`).join(" · ")}</p>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronDown, Cloud, CloudOff, Copy, CopyPlus, FileText, Loader2, MessageCircle,
  MoreHorizontal, PackageCheck, Plus, Printer, Send, ShieldCheck, ThumbsDown, Trash2, Truck, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { mensajeError, q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, porcentaje } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, Vacio } from "@/components/ui/estados";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Lateral } from "@/components/ui/dialogo";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import {
  EDITABLES, ESTADO_COT, dineroEn, mensualidad, useAncho, usePlanesMeses, useTextosComerciales, venceEl, hoyMx,
  type Contacto, type Cotizacion, type Partida, type Moneda, haceCuanto,
} from "./comun";
import { CampoNumero, MenuAcciones, OpcionMenu, SelectorTexto, SeparadorMenu } from "./componentes/campos";
import { TablaPartidas, importeLocal } from "./componentes/TablaPartidas";
import { FichaVenta } from "./componentes/FichaVenta";
import { DialogoCliente, DialogoMotivo, ElegirCliente, MOTIVOS_PERDIDA, type ClienteNuevo } from "./componentes/dialogos";
import { DialogoConvertir, DialogoEnviar, DialogoPedirAutorizacion } from "./componentes/DialogosCotizacion";
import { useFichas } from "./componentes/Fichas";
import { DialogoPedirPrecio, type DatosPedido, type InicialPedido } from "./solicitudes/DialogoPedirPrecio";
import { CLAVE as CLAVE_SOLICITUDES, queSePide, useSolicitudes, useSolicitudesEnVivo, type Solicitud } from "@/modulos/compras/solicitudes/datos";
import { EstadoPartida } from "./solicitudes/EstadoPartida";
import { DetalleSolicitud, RespuestaVenta } from "@/modulos/compras/solicitudes/Componentes";

export default function EditorCotizacion() {
  const { id } = useParams();
  if (!id || id === "nueva") return <CrearCotizacion />;
  return <Editor key={id} id={id} />;
}

/** /ventas/cotizaciones/nueva[?cliente=…&oportunidad=…]: la crea con las condiciones por defecto y abre el editor. */
function CrearCotizacion() {
  const [params] = useSearchParams();
  const ir = useNavigate();
  const hecho = useRef(false);
  useEffect(() => {
    // En modo estricto React monta dos veces: sin esto salían dos folios.
    if (hecho.current) return;
    hecho.current = true;
    supabase.rpc("nueva_cotizacion", { p_cliente: params.get("cliente"), p_oportunidad: params.get("oportunidad") }).then(({ data, error }) => {
      if (error) { toast.error(mensajeError(error)); ir("/ventas/cotizaciones", { replace: true }); }
      else ir(`/ventas/cotizaciones/${data}`, { replace: true });
    });
  }, [ir, params]);
  return <div className="p-8"><Cargando filas={6} /></div>;
}

type Guardado = "guardado" | "pendiente" | "guardando" | "error";
const r2 = (n: number) => Math.round(n * 100) / 100;

function Editor({ id }: { id: string }) {
  const { perfil, puede } = useSesion();
  const qc = useQueryClient();
  const ir = useNavigate();
  const esGerente = puede("ventas", 3);
  const dosColumnas = useAncho(1400);
  const tablaAncha = useAncho(768);

  // ---------------------------------------------------------------- datos
  const cot = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => q<Cotizacion | null>(supabase.from("cotizaciones").select("*").eq("id", id).maybeSingle()),
  });
  const lineasQ = useQuery({
    queryKey: ["cotizacion_lineas", id],
    queryFn: () => q<Partida[]>(supabase.from("cotizacion_lineas").select("*").eq("cotizacion_id", id).order("orden")),
  });
  const textos = useTextosComerciales();
  const planes = usePlanesMeses();
  const clienteId = cot.data?.cliente_id;
  const cliente = useQuery({
    queryKey: ["cliente", clienteId], enabled: !!clienteId,
    queryFn: () => q<{ id: string; nombre: string; razon_social: string | null; vendedor_id: string | null; vendedor: { nombre: string } | null }>(
      supabase.from("clientes").select("id, nombre, razon_social, vendedor_id, vendedor:perfiles!clientes_vendedor_id_fkey(nombre)").eq("id", clienteId!).single()),
  });
  const contactos = useQuery({
    queryKey: ["contactos", clienteId], enabled: !!clienteId,
    queryFn: () => q<Contacto[]>(supabase.from("contactos").select("*").eq("cliente_id", clienteId!).order("principal", { ascending: false })),
  });
  const vendedor = useQuery({
    queryKey: ["perfil", cot.data?.vendedor_id], enabled: !!cot.data?.vendedor_id, staleTime: 5 * 60_000,
    queryFn: () => q<{ nombre: string; telefono: string | null; iniciales: string | null }>(
      supabase.from("perfiles").select("nombre, telefono, iniciales").eq("id", cot.data!.vendedor_id).single()),
  });
  const oportunidades = useQuery({
    queryKey: ["v_oportunidades", "cliente", clienteId], enabled: !!clienteId,
    queryFn: () => q<{ id: string; titulo: string; etapa: string }[]>(
      supabase.from("v_oportunidades").select("id, titulo, etapa").eq("cliente_id", clienteId!).order("creado_en", { ascending: false })),
  });
  const pedido = useQuery({
    queryKey: ["pedido_de_cotizacion", id], enabled: cot.data?.estado === "aceptada",
    queryFn: () => q<{ id: string; folio: string }[]>(supabase.from("pedidos").select("id, folio").eq("cotizacion_id", id).neq("estado", "cancelado")),
  });
  // Precios pedidos a compras desde esta cotización (en vivo: el vendedor ve cuando la toman y cuando contestan).
  const solicitudesQ = useSolicitudes({ cotizacionId: id });
  useSolicitudesEnVivo();

  // ---------------------------------------------------------------- guardado automático
  // Lo que el vendedor escribe vive aquí hasta que se guarda (700 ms después de
  // la última tecla). La pantalla muestra servidor + pendiente; al guardar, lo
  // guardado pasa a la caché y lo que se siguió escribiendo sigue pendiente.
  const [pendEnc, setPendEnc] = useState<Partial<Cotizacion>>({});
  const [pendLin, setPendLin] = useState<Record<string, Partial<Partida>>>({});
  const pend = useRef<{ enc: Partial<Cotizacion>; lin: Record<string, Partial<Partida>> }>({ enc: {}, lin: {} });
  const [guardado, setGuardado] = useState<Guardado>("guardado");
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout>>();
  const cola = useRef<Promise<void>>(Promise.resolve());

  const hayPendientes = () => Object.keys(pend.current.enc).length > 0 || Object.keys(pend.current.lin).length > 0;

  const guardar = useCallback(() => {
    clearTimeout(reloj.current);
    cola.current = cola.current.then(async () => {
      const enc = pend.current.enc, lin = pend.current.lin;
      if (!Object.keys(enc).length && !Object.keys(lin).length) return;
      setGuardado("guardando");
      try {
        if (Object.keys(enc).length) {
          const r = await q<{ id: string }[]>(supabase.from("cotizaciones").update(enc).eq("id", id).select("id"));
          if (!r.length) throw new Error("No se guardó: esta cotización ya no se puede cambiar.");
        }
        for (const [lid, cambios] of Object.entries(lin)) {
          await q(supabase.from("cotizacion_lineas").update(cambios).eq("id", lid));
        }
        qc.setQueryData<Cotizacion | null>(["cotizacion", id], (v) => (v ? { ...v, ...enc } : v));
        qc.setQueryData<Partida[]>(["cotizacion_lineas", id], (v) => v?.map((l) => (lin[l.id] ? { ...l, ...lin[l.id] } : l)));
        // Solo se quita lo que no cambió mientras se guardaba.
        const restoEnc = { ...pend.current.enc } as Record<string, unknown>;
        for (const k of Object.keys(enc)) if (restoEnc[k] === (enc as Record<string, unknown>)[k]) delete restoEnc[k];
        const restoLin: Record<string, Partial<Partida>> = {};
        for (const [lid, c] of Object.entries(pend.current.lin)) {
          const r = { ...c } as Record<string, unknown>;
          for (const k of Object.keys(lin[lid] ?? {})) if (r[k] === (lin[lid] as Record<string, unknown>)[k]) delete r[k];
          if (Object.keys(r).length) restoLin[lid] = r as Partial<Partida>;
        }
        pend.current = { enc: restoEnc as Partial<Cotizacion>, lin: restoLin };
        setPendEnc(pend.current.enc); setPendLin(pend.current.lin);
        setGuardado(hayPendientes() ? "pendiente" : "guardado");
        setGuardadoEn(new Date());
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["cotizacion", id] }),
          qc.invalidateQueries({ queryKey: ["cotizacion_lineas", id] }),
        ]);
      } catch (e) {
        setGuardado("error");
        toast.error(mensajeError(e));
      }
    });
    return cola.current;
  }, [id, qc]);

  const programar = useCallback(() => {
    setGuardado("pendiente");
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => { void guardar(); }, 700);
  }, [guardar]);

  const editarEnc = useCallback((cambios: Partial<Cotizacion>) => {
    pend.current.enc = { ...pend.current.enc, ...cambios };
    setPendEnc(pend.current.enc);
    programar();
  }, [programar]);
  const editarLinea = useCallback((lid: string, cambios: Partial<Partida>) => {
    pend.current.lin = { ...pend.current.lin, [lid]: { ...pend.current.lin[lid], ...cambios } };
    setPendLin(pend.current.lin);
    programar();
  }, [programar]);

  // Al salir de la pantalla o cerrar la pestaña no se pierde lo escrito.
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => { if (hayPendientes()) { void guardar(); e.preventDefault(); } };
    window.addEventListener("beforeunload", antes);
    return () => { window.removeEventListener("beforeunload", antes); if (hayPendientes()) void guardar(); };
  }, [guardar]);

  // ---------------------------------------------------------------- lo que se ve
  const c: Cotizacion | null = cot.data ? { ...cot.data, ...pendEnc } : null;
  const lineas = useMemo(() => (lineasQ.data ?? []).map((l) => (pendLin[l.id] ? { ...l, ...pendLin[l.id] } : l)).sort((a, b) => a.orden - b.orden),
    [lineasQ.data, pendLin]);
  const sucias = useMemo(() => new Set(Object.keys(pendLin)), [pendLin]);
  const sucio = Object.keys(pendEnc).length > 0 || sucias.size > 0 || guardado === "guardando";
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [fichaMovil, setFichaMovil] = useState<Partida | null>(null);
  const seleccionada = lineas.find((l) => l.id === seleccion) ?? lineas.find((l) => l.articulo_id) ?? null;
  // La solicitud más reciente de cada partida (la lista viene de la más nueva a la más vieja).
  const porPartida = useMemo(() => {
    const m: Record<string, Solicitud> = {};
    for (const s of solicitudesQ.data ?? []) if (s.partida_id && !m[s.partida_id] && s.estado !== "cancelada") m[s.partida_id] = s;
    return m;
  }, [solicitudesQ.data]);
  // Las que se pidieron para la cotización pero no para una partida (o cuya partida ya se quitó).
  const sueltas = useMemo(() => (solicitudesQ.data ?? []).filter((s) => s.estado !== "cancelada" && !s.aplicada_en
    && (!s.partida_id || !lineas.some((l) => l.id === s.partida_id))), [solicitudesQ.data, lineas]);
  const fichas = useFichas(lineas.map((l) => l.articulo_id));
  const ligasFichas = useMemo(() => {
    const vistas = new Set<string>();
    return lineas.filter((l) => !l.opcional && l.articulo_id).flatMap((l) => (fichas.data?.[l.articulo_id!] ?? []))
      .filter((d) => !vistas.has(d.documento_id) && !!vistas.add(d.documento_id));
  }, [lineas, fichas.data]);

  const propia = !!c && c.vendedor_id === perfil?.id;
  const editable = !!c && EDITABLES.includes(c.estado) && ((propia && puede("ventas", 2)) || esGerente);
  const contactosPrivados = !!cliente.data?.vendedor_id && cliente.data.vendedor_id !== perfil?.id && !esGerente;

  // Mientras hay cambios sin guardar, los totales se calculan aquí con la misma
  // fórmula de recalcular_cotizacion; ya guardados, manda la base.
  const tot = useMemo(() => {
    if (!c) return null;
    if (!sucio) return { subtotal: Number(c.subtotal), descuento: Number(c.descuento), iva: Number(c.iva), total: Number(c.total) };
    const sub = lineas.reduce((s, l) => s + importeLocal(l), 0);
    const desc = r2(sub * Number(c.descuento_pct));
    const iva = Number(c.tasa_iva);
    if (c.precios_con_iva) {
      const total = r2(sub - desc), base = r2(total / (1 + iva));
      return { subtotal: r2(base + desc), descuento: desc, iva: r2(total - base), total };
    }
    return { subtotal: r2(sub), descuento: desc, iva: r2((sub - desc) * iva), total: r2((sub - desc) * (1 + iva)) };
  }, [c, lineas, sucio]);
  const plan = planes.data?.find((p) => p.meses === c?.plan_meses) ?? null;
  // Lo que de verdad cobra la partida (con su descuento y el general): con eso
  // la juzga partida_bajo_minimo() en la base, y la ficha debe decir lo mismo.
  const precioEfectivo = (l: Partida) => Number(l.precio_unitario) * (1 - Number(l.descuento_pct)) * (1 - Number(c?.descuento_pct ?? 0));
  const bajoMinimo = lineas.filter((l) => l.bajo_minimo && !sucias.has(l.id));
  const vence = c ? venceEl(c.fecha, c.vigencia_dias) : null;
  const vencida = !!c && ["borrador", "por_autorizar", "autorizada", "enviada"].includes(c.estado) && !!vence && vence < hoyMx();

  // ---------------------------------------------------------------- acciones
  const [dlg, setDlg] = useState<null | "enviar" | "convertir" | "rechazar" | "autorizacion" | "cliente">(null);
  const [nombreCliente, setNombreCliente] = useState("");

  const agregar = useAccion(
    async (a: { id: string }) => {
      await guardar();
      return q<Partida>(supabase.rpc("agregar_partida", { p_cotizacion: id, p_articulo: a.id, p_cantidad: 1 }));
    },
    { invalidar: [["cotizacion", id], ["cotizacion_lineas", id]], alTerminar: (l) => setSeleccion(l.id) },
  );
  const agregarLibre = useAccion(
    async (titulo: string) => {
      await guardar();
      const nid = crypto.randomUUID();
      await q(supabase.from("cotizacion_lineas").insert({
        id: nid, cotizacion_id: id, orden: Math.max(0, ...lineas.map((l) => l.orden)) + 1, titulo,
        unidad: "servicio", cantidad: 1, precio_unitario: 0,
      }));
      return nid;
    },
    { invalidar: [["cotizacion", id], ["cotizacion_lineas", id]], alTerminar: (nid) => setSeleccion(nid) },
  );
  const eliminarLinea = useAccion(
    async (lid: string) => {
      const { [lid]: _quitada, ...resto } = pend.current.lin;
      pend.current.lin = resto; setPendLin(resto);
      await guardar();
      await q(supabase.from("cotizacion_lineas").delete().eq("id", lid));
    },
    { invalidar: [["cotizacion", id], ["cotizacion_lineas", id]] },
  );
  const duplicarLinea = useAccion(
    async (l: Partida) => {
      await guardar();
      await q(supabase.from("cotizacion_lineas").insert({
        cotizacion_id: id, orden: Math.max(0, ...lineas.map((x) => x.orden)) + 1, articulo_id: l.articulo_id, titulo: l.titulo,
        descripcion: l.descripcion, imagen_url: l.imagen_url, unidad: l.unidad, cantidad: l.cantidad, precio_unitario: l.precio_unitario,
        descuento_pct: l.descuento_pct, opcional: l.opcional,
      }));
    },
    { exito: "Partida duplicada al final", invalidar: [["cotizacion", id], ["cotizacion_lineas", id]] },
  );
  const reordenar = (ids: string[]) => ids.forEach((lid, i) => {
    const l = lineas.find((x) => x.id === lid);
    if (l && l.orden !== i + 1) editarLinea(lid, { orden: i + 1 });
  });
  // Pedir precio a compras sin salir de la cotización: desde la partida, o desde el
  // buscador ("¿No está?"), que primero agrega la partida libre con lo que se escribió.
  const [pedirPara, setPedirPara] = useState<(InicialPedido & { nuevaPartida?: boolean }) | null>(null);
  const pedirPrecio = async (l: Partida) => {
    await guardar();
    setPedirPara({
      descripcion: l.articulo_id ? "" : [l.titulo, l.descripcion].filter(Boolean).join(" · "), cantidad: Number(l.cantidad),
      articulo: l.articulo_id ? { id: l.articulo_id, clave: "", nombre: l.titulo } : null,
      cotizacionId: id, partidaId: l.id, para: `${c?.folio ?? "la cotización"}${cliente.data ? " · " + cliente.data.nombre : ""}`,
    });
  };
  const crearConPartida = async (d: DatosPedido) => {
    await guardar();
    const nid = crypto.randomUUID();
    await q(supabase.from("cotizacion_lineas").insert({
      id: nid, cotizacion_id: id, orden: Math.max(0, ...lineas.map((l) => l.orden)) + 1, titulo: d.descripcion.trim(),
      unidad: "pieza", cantidad: d.cantidad || 1, precio_unitario: 0,
    }));
    setSeleccion(nid);
    qc.invalidateQueries({ queryKey: ["cotizacion_lineas", id] });
    return q<string>(supabase.rpc("pedir_precio", {
      p_descripcion: d.descripcion.trim(), p_cantidad: d.cantidad || 1, p_urgente: d.urgente, p_marca: d.marca.trim() || null,
      p_modelo: d.modelo.trim() || null, p_notas: d.notas.trim() || null, p_cotizacion: id, p_partida: nid,
    }));
  };
  const aplicarPrecio = useAccion(
    async (s: Solicitud) => { await guardar(); return q<string>(supabase.rpc("aplicar_solicitud_precio", { p_solicitud: s.id })); },
    { exito: "Precio de compras aplicado a la partida", invalidar: [["cotizacion", id], ["cotizacion_lineas", id], [...CLAVE_SOLICITUDES]],
      alTerminar: (pid) => setSeleccion(pid) },
  );

  const restaurarPrecio = async (l: Partida) => {
    if (!c || !l.articulo_id) return;
    const { data } = await supabase.from("precios_lista").select("precio").eq("articulo_id", l.articulo_id).maybeSingle();
    if (data?.precio == null) return toast.error("Ese artículo no tiene precio de lista");
    editarLinea(l.id, { precio_unitario: r2((Number(data.precio) / Number(c.tipo_cambio)) * (c.precios_con_iva ? 1 + Number(c.tasa_iva) : 1)) });
  };

  const moneda = useAccion(
    async (a: { moneda: Moneda; tc?: number | null; conIva?: boolean }) => {
      await guardar();
      await q(supabase.rpc("ajustar_moneda_cotizacion", { p_id: id, p_moneda: a.moneda, p_tipo_cambio: a.tc ?? null, p_precios_con_iva: a.conIva ?? null }));
    },
    { exito: "Precios convertidos", invalidar: [["cotizacion", id], ["cotizacion_lineas", id]] },
  );
  const [tcLocal, setTcLocal] = useState<number | null>(null);

  const cambiarEstado = useAccion(
    async (estado: "enviada") => {
      await guardar();
      const r = await q<{ id: string }[]>(supabase.from("cotizaciones").update({ estado }).eq("id", id).select("id"));
      if (!r.length) throw new Error("No se pudo cambiar el estado");
    },
    { exito: "Cotización marcada como enviada", invalidar: [["cotizacion", id], ["v_cotizaciones"], ["v_oportunidades"], ["indicadores"]] },
  );
  const pedirAutorizacion = useAccion(
    async (nota: string) => { await guardar(); await q(supabase.rpc("pedir_autorizacion", { p_id: id, p_nota: nota })); },
    { exito: "Listo: la gerencia ya la ve en su cola", invalidar: [["cotizacion", id], ["v_cotizaciones"]], alTerminar: () => setDlg(null) },
  );
  const autorizar = useAccion(
    async () => { await guardar(); await q(supabase.rpc("autorizar_cotizacion", { p_id: id })); },
    { exito: "Precios autorizados", invalidar: [["cotizacion", id], ["v_cotizaciones"], ["indicadores"]] },
  );
  const nuevaVersion = useAccion(
    async () => { await guardar(); return q<string>(supabase.rpc("nueva_version_cotizacion", { p_id: id })); },
    { exito: "Nueva versión creada", invalidar: [["v_cotizaciones"]], alTerminar: (nid) => ir(`/ventas/cotizaciones/${nid}`) },
  );
  const duplicar = useAccion(
    async () => { await guardar(); return q<string>(supabase.rpc("duplicar_cotizacion", { p_id: id })); },
    { exito: "Cotización duplicada con folio nuevo", invalidar: [["v_cotizaciones"]], alTerminar: (nid) => ir(`/ventas/cotizaciones/${nid}`) },
  );
  const convertir = useAccion(
    async (a: { fecha: string; ids: string[] }) => {
      await guardar();
      return q<string>(supabase.rpc("convertir_a_pedido", { p_cotizacion: id, p_fecha_compromiso: a.fecha || null, p_partidas: a.ids }));
    },
    { exito: "Pedido creado", invalidar: [["cotizacion", id], ["v_cotizaciones"], ["v_pedidos"], ["indicadores"]], alTerminar: (pid) => ir(`/ventas/pedidos/${pid}`) },
  );
  const rechazar = useAccion(
    async (a: { motivo: string; cerrar: boolean }) => {
      await guardar();
      await q(supabase.rpc("rechazar_cotizacion", { p_id: id, p_motivo: a.motivo, p_cerrar_oportunidad: a.cerrar }));
    },
    { exito: "Cotización marcada como rechazada", invalidar: [["cotizacion", id], ["v_cotizaciones"], ["v_oportunidades"]], alTerminar: () => setDlg(null) },
  );
  const [cerrarOp, setCerrarOp] = useState(true);
  const eliminar = useAccion(
    async () => {
      pend.current = { enc: {}, lin: {} };
      await q(supabase.from("cotizaciones").delete().eq("id", id));
    },
    { exito: "Borrador eliminado", invalidar: [["v_cotizaciones"]], alTerminar: () => ir("/ventas/cotizaciones") },
  );
  const abrirPdf = async () => { await guardar(); window.open(`/ventas/cotizaciones/${id}/imprimir`, "_blank"); };

  // El cliente se guarda al momento (no con el resto): con la regla de cartera
  // encendida la base puede negarse ("Este cliente es de X hasta…") y ese
  // mensaje se muestra tal cual en vez de quedarse reintentando.
  async function cambiarCliente(cl: { id: string; nombre: string; razon_social: string | null } | null, contacto?: { id: string; nombre: string } | null) {
    await guardar();
    let cambios: Partial<Cotizacion> = { cliente_id: null, contacto_id: null };
    if (cl) {
      let principal = contacto ?? null;
      if (contacto === undefined) {
        const { data } = await supabase.from("contactos").select("id, nombre").eq("cliente_id", cl.id).order("principal", { ascending: false }).limit(1);
        principal = data?.[0] ?? null;
      }
      cambios = { cliente_id: cl.id, contacto_id: principal?.id ?? null, atencion: principal?.nombre ?? c?.atencion ?? null,
        empresa: cl.razon_social || cl.nombre, oportunidad_id: null };
    }
    const { error } = await supabase.from("cotizaciones").update(cambios).eq("id", id);
    if (error) { toast.error(mensajeError(error)); return; }
    qc.setQueryData<Cotizacion | null>(["cotizacion", id], (v) => (v ? { ...v, ...cambios } : v));
    qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    if (cl) qc.invalidateQueries({ queryKey: ["cliente", cl.id] });
  }

  // ---------------------------------------------------------------- render
  if (cot.isLoading || lineasQ.isLoading) return <div className="p-8"><Cargando filas={8} /></div>;
  if (!c) {
    return (
      <div className="p-8"><div className="tarjeta">
        <Vacio icono={FileText} titulo="No encontramos esta cotización" texto="Puede que la hayan borrado o que sea de otro vendedor."
          accion={<Boton asChild variante="secundario"><Link to="/ventas/cotizaciones">Ir a cotizaciones</Link></Boton>} />
      </div></div>
    );
  }
  const est = ESTADO_COT[c.estado];
  const textosDe = (t: string) => (textos.data ?? []).filter((x) => x.tipo === t).map((x) => x.texto);
  const notasCatalogo = textosDe("nota");
  const contactoSel = contactos.data?.find((x) => x.id === c.contacto_id) ?? null;
  // Una partida autorizada sigue "bajo el mínimo" (eso no cambia): lo que la
  // deja pasar es la autorización vigente, igual que en convertir_a_pedido().
  const preciosEnRegla = bajoMinimo.length === 0 || !!c.autorizada_por;
  const puedeEnviar = editable && (c.estado === "borrador" || c.estado === "autorizada") && preciosEnRegla && lineas.some((l) => !l.opcional);
  const puedeConvertir = ["borrador", "autorizada", "enviada"].includes(c.estado) && preciosEnRegla && (propia || esGerente) && lineas.length > 0;

  const indicador = (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", guardado === "error" ? "text-peligro" : "text-tenue")}>
      {guardado === "guardando" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando…</>
        : guardado === "pendiente" ? <><Cloud className="h-3.5 w-3.5" />Sin guardar</>
        : guardado === "error" ? <button className="inline-flex items-center gap-1.5" onClick={() => guardar()}><CloudOff className="h-3.5 w-3.5" />No se guardó · reintentar</button>
        : <><Check className="h-3.5 w-3.5 text-ok" />{guardadoEn ? `Guardado ${guardadoEn.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Guardado"}</>}
    </span>
  );

  // En la barra de abajo del celular va en tamaño chico: si no, el total no cabe.
  const principal = (tamano?: "sm") => {
    if (c.estado === "por_autorizar" && esGerente) return <Boton tamano={tamano} onClick={() => autorizar.mutate(undefined)} cargando={autorizar.isPending}><ShieldCheck className="h-4 w-4" />Autorizar precios</Boton>;
    if (c.estado === "por_autorizar") return <Boton tamano={tamano} variante={c.autorizacion_pedida_en ? "secundario" : "primario"} onClick={() => setDlg("autorizacion")}><ShieldCheck className="h-4 w-4" />{c.autorizacion_pedida_en ? "Autorización pedida" : "Pedir autorización"}</Boton>;
    if (puedeEnviar) return <Boton tamano={tamano} onClick={() => setDlg("enviar")}><Send className="h-4 w-4" />Enviar</Boton>;
    if (c.estado === "enviada" && puedeConvertir) return <Boton tamano={tamano} variante="exito" onClick={() => setDlg("convertir")}><PackageCheck className="h-4 w-4" />Convertir a pedido</Boton>;
    if (c.estado === "aceptada" && pedido.data?.[0]) return <Boton tamano={tamano} asChild variante="secundario"><Link to={`/ventas/pedidos/${pedido.data[0].id}`}><Truck className="h-4 w-4" />Ver pedido {pedido.data[0].folio}</Link></Boton>;
    if (["rechazada", "cancelada", "vencida"].includes(c.estado)) return <Boton tamano={tamano} onClick={() => nuevaVersion.mutate(undefined)} cargando={nuevaVersion.isPending}><CopyPlus className="h-4 w-4" />Nueva versión</Boton>;
    return null;
  };
  const botonPrincipal = principal();

  const menuMas = (
    <MenuAcciones disparador={<Boton variante="secundario" tamano="icono" aria-label="Más acciones"><MoreHorizontal className="h-4 w-4" /></Boton>}>
      <OpcionMenu icono={Printer} alElegir={abrirPdf}>Imprimir / PDF</OpcionMenu>
      <OpcionMenu icono={MessageCircle} alElegir={() => setDlg("enviar")} deshabilitado={!["enviada", "aceptada"].includes(c.estado) && !puedeEnviar}>Compartir por WhatsApp</OpcionMenu>
      <SeparadorMenu />
      <OpcionMenu icono={CopyPlus} alElegir={() => nuevaVersion.mutate(undefined)}>Nueva versión ({c.folio.replace(/-v\d+$/, "")}-v…)</OpcionMenu>
      <OpcionMenu icono={Copy} alElegir={() => duplicar.mutate(undefined)}>Duplicar con folio nuevo</OpcionMenu>
      <OpcionMenu icono={PackageCheck} alElegir={() => setDlg("convertir")} deshabilitado={!puedeConvertir}>Convertir a pedido</OpcionMenu>
      <OpcionMenu icono={ThumbsDown} alElegir={() => setDlg("rechazar")} deshabilitado={["aceptada", "rechazada", "cancelada"].includes(c.estado) || !(propia || esGerente)}>Marcar rechazada…</OpcionMenu>
      {c.estado === "borrador" && (propia || esGerente) && (
        <>
          <SeparadorMenu />
          <OpcionMenu icono={Trash2} peligro alElegir={() => { if (confirm(`¿Eliminar el borrador ${c.folio}? No se puede deshacer.`)) eliminar.mutate(undefined); }}>Eliminar borrador</OpcionMenu>
        </>
      )}
    </MenuAcciones>
  );

  // ---- bloques
  const totales = tot && (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Totales" descripcion={c.precios_con_iva ? "Precios con IVA incluido" : "Precios más IVA"}
        acciones={sucio ? <Loader2 className="h-4 w-4 animate-spin text-tenue" /> : null} />
      <div className="px-5 pb-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-tenue">Subtotal</span><span className="cifra">{dineroEn(tot.subtotal, c.moneda)}</span></div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-tenue">Descuento general</span>
          <CampoNumero className="w-24" valor={Number(c.descuento_pct)} escala={100} min={0} max={0.99} sufijo="%" deshabilitado={!editable}
            etiqueta="Descuento general" alCambiar={(n) => editarEnc({ descuento_pct: n })} />
        </div>
        {tot.descuento > 0 && <div className="flex justify-between text-peligro"><span>− Descuento</span><span className="cifra">{dineroEn(tot.descuento, c.moneda)}</span></div>}
        <div className="flex justify-between"><span className="text-tenue">IVA {porcentaje(Number(c.tasa_iva), 0)}</span><span className="cifra">{dineroEn(tot.iva, c.moneda)}</span></div>
        <div className="flex justify-between items-baseline border-t border-borde pt-2">
          <span className="font-semibold">Total</span>
          <span className="text-2xl font-semibold cifra">{dineroEn(tot.total, c.moneda)}</span>
        </div>
        {c.moneda !== "MXN" && <p className="text-xs text-tenue text-right cifra">≈ {dineroEn(tot.total * Number(c.tipo_cambio), "MXN")} MXN al TC {Number(c.tipo_cambio)}</p>}
        {(Number(c.descuento_pct) > 0 || c.leyenda_promocion) && (
          <input className="campo text-peligro" value={c.leyenda_promocion ?? ""} disabled={!editable} placeholder="Leyenda de la promoción (sale en rojo)"
            onChange={(e) => editarEnc({ leyenda_promocion: e.target.value || null })} />
        )}
        {Number(c.descuento_pct) === 0 && !c.leyenda_promocion && editable && (
          <button className="text-xs text-marca-texto" onClick={() => editarEnc({ leyenda_promocion: "de descuento ya aplicado por la promoción. Válido hasta el " })}>+ leyenda de promoción</button>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-tenue">Meses con tarjeta</span>
          <select className="campo w-auto pr-8" value={c.plan_meses ?? ""} disabled={!editable} onChange={(e) => editarEnc({ plan_meses: e.target.value ? Number(e.target.value) : null })}>
            <option value="">No aplica</option>
            {planes.data?.map((p) => <option key={p.meses} value={p.meses}>{p.meses} meses</option>)}
          </select>
        </div>
        {plan && (
          <p className="rounded-lg bg-marca-suave text-marca-texto px-3 py-2 text-sm">
            {plan.etiqueta} <b className="cifra">{dineroEn(mensualidad(tot.total, plan), c.moneda)}</b>
          </p>
        )}
        {bajoMinimo.length > 0 && (
          <p className="rounded-lg bg-peligro-suave text-peligro px-3 py-2 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />{bajoMinimo.length} partida(s) abajo del precio mínimo{c.estado === "autorizada" ? " (autorizadas)" : ""}
          </p>
        )}
      </div>
    </Tarjeta>
  );

  const ficha = seleccionada?.articulo_id ? (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Ficha de venta" descripcion={`Partida ${lineas.indexOf(seleccionada) + 1}`} />
      <div className="px-5 pb-5">
        <FichaVenta articuloId={seleccionada.articulo_id} moneda={c.moneda} tipoCambio={Number(c.tipo_cambio)} conIva={c.precios_con_iva}
          tasaIva={Number(c.tasa_iva)} precioActual={precioEfectivo(seleccionada)}
          alAplicarPrecio={editable ? (p) => editarLinea(seleccionada.id, { precio_unitario: p }) : undefined} />
      </div>
    </Tarjeta>
  ) : null;

  return (
    <div className={cn("mx-auto px-4 lg:px-8 py-5 space-y-4", dosColumnas ? "max-w-[1560px]" : "max-w-5xl", !dosColumnas && "pb-28")}>
      {/* Barra de estado */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to="/ventas/cotizaciones" className="p-1.5 -ml-1.5 rounded-lg hover:bg-fondo text-tenue" aria-label="Volver a cotizaciones"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight cifra">{c.folio}</h1>
            {vendedor.data?.iniciales && <span className="rounded bg-texto/80 text-superficie text-[11px] font-bold px-1.5 py-0.5 tracking-wider">{vendedor.data.iniciales}</span>}
            <Insignia tono={est.tono} punto>{est.texto}</Insignia>
            {vencida && <Insignia tono="peligro">Vencida</Insignia>}
            {c.version > 1 && <Insignia>versión {c.version}</Insignia>}
          </div>
          <p className="text-xs text-tenue mt-0.5">
            {vendedor.data?.nombre}{!propia && vendedor.data ? " (vendedor)" : ""} · emitida {fecha(c.fecha)} · vence {fecha(vence)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {indicador}
          <Boton variante="secundario" className="hidden sm:inline-flex" onClick={abrirPdf}><Printer className="h-4 w-4" />PDF</Boton>
          {dosColumnas && botonPrincipal}
          {menuMas}
        </div>
      </div>

      {/* Avisos de estado */}
      {c.estado === "por_autorizar" && (
        <div className="rounded-xl border border-aviso/30 bg-aviso-suave px-4 py-3 text-sm flex flex-wrap items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-aviso shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <p className="font-medium">{bajoMinimo.length || "Hay"} partida(s) abajo del precio mínimo: necesita autorización de la gerencia para enviarse.</p>
            {c.autorizacion_pedida_en ? <p className="text-tenue">Pedida {haceCuanto(c.autorizacion_pedida_en)}{c.nota_autorizacion ? ` · “${c.nota_autorizacion}”` : ""}</p>
              : <p className="text-tenue">Ajusta los precios o pide la autorización cuando termines de capturar.</p>}
          </div>
          {!dosColumnas && botonPrincipal}
        </div>
      )}
      {c.estado === "autorizada" && (
        <div className="rounded-xl border border-info/30 bg-info-suave px-4 py-3 text-sm flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-info" />
          <span>Precios autorizados {c.autorizada_en ? haceCuanto(c.autorizada_en) : ""}. Si cambias un precio o el descuento, la autorización se pierde.</span>
        </div>
      )}
      {!editable && ["enviada", "aceptada", "rechazada", "cancelada", "vencida"].includes(c.estado) && (
        <div className={cn("rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center gap-3",
          c.estado === "aceptada" ? "border-ok/30 bg-ok-suave" : c.estado === "rechazada" ? "border-peligro/30 bg-peligro-suave" : "border-borde bg-fondo")}>
          {c.estado === "aceptada" ? <CheckCircle2 className="h-5 w-5 text-ok" /> : c.estado === "rechazada" ? <X className="h-5 w-5 text-peligro" /> : <Send className="h-5 w-5 text-marca" />}
          <span className="flex-1">
            {c.estado === "enviada" && <>Enviada {c.enviada_en ? haceCuanto(c.enviada_en) : ""}. Para cambiarla, saca una nueva versión: esta queda como se mandó.</>}
            {c.estado === "aceptada" && <>Aceptada{pedido.data?.[0] ? <> · pedido <Link className="font-medium text-marca-texto" to={`/ventas/pedidos/${pedido.data[0].id}`}>{pedido.data[0].folio}</Link></> : null}.</>}
            {c.estado === "rechazada" && <>Rechazada: {c.motivo_rechazo}</>}
            {(c.estado === "cancelada" || c.estado === "vencida") && <>Esta cotización está {est.texto.toLowerCase()}.</>}
          </span>
          {c.estado === "enviada" && <Boton tamano="sm" variante="secundario" onClick={() => nuevaVersion.mutate(undefined)} cargando={nuevaVersion.isPending}><CopyPlus className="h-4 w-4" />Nueva versión</Boton>}
        </div>
      )}
      {!editable && EDITABLES.includes(c.estado) && (
        <p className="rounded-xl border border-borde bg-fondo px-4 py-3 text-sm text-tenue">Esta cotización es de {vendedor.data?.nombre ?? "otro vendedor"}: solo la puedes ver.</p>
      )}

      <div className={cn(dosColumnas ? "grid grid-cols-[minmax(0,1fr)_310px] gap-5 items-start" : "space-y-4")}>
        <div className="space-y-4 min-w-0">
          {/* Encabezado */}
          <Tarjeta className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Cliente</span>
                <ElegirCliente valor={c.cliente_id ? { id: c.cliente_id, nombre: cliente.data?.nombre ?? "…" } : null} deshabilitado={!editable}
                  alCambiar={(cl) => cambiarCliente(cl)} alNuevo={() => { setNombreCliente(""); setDlg("cliente"); }} />
                {cliente.data?.vendedor && cliente.data.vendedor_id !== perfil?.id && (
                  <span className="block text-xs text-aviso">Cliente de {cliente.data.vendedor.nombre}{contactosPrivados ? " — contactos privados" : ""}</span>
                )}
              </div>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Contacto</span>
                {contactosPrivados ? (
                  <p className="campo flex items-center text-tenue">Contactos privados de {cliente.data?.vendedor?.nombre}</p>
                ) : (
                  <select className="campo pr-8" value={c.contacto_id ?? ""} disabled={!editable || !c.cliente_id}
                    onChange={(e) => {
                      const ct = contactos.data?.find((x) => x.id === e.target.value);
                      editarEnc({ contacto_id: ct?.id ?? null, ...(ct ? { atencion: ct.nombre } : {}) });
                    }}>
                    <option value="">{c.cliente_id ? (contactos.data?.length ? "— elegir —" : "Sin contactos registrados") : "Elige primero el cliente"}</option>
                    {contactos.data?.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.puesto ? ` · ${x.puesto}` : ""}{x.whatsapp || x.telefono ? ` · ${x.whatsapp || x.telefono}` : ""}</option>)}
                  </select>
                )}
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">En atención a</span>
                <input className="campo" value={c.atencion ?? ""} disabled={!editable} onChange={(e) => editarEnc({ atencion: e.target.value || null })} placeholder="Ing. Juan Pérez" />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Empresa</span>
                <input className="campo" value={c.empresa ?? ""} disabled={!editable} onChange={(e) => editarEnc({ empresa: e.target.value || null })} placeholder="Razón social o nombre comercial" />
              </label>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Moneda</span>
                <div className="flex rounded-lg border border-borde p-0.5 bg-fondo">
                  {(["MXN", "USD"] as Moneda[]).map((m) => (
                    <button key={m} type="button" disabled={!editable || moneda.isPending}
                      onClick={() => { if (m !== c.moneda) { setTcLocal(null); moneda.mutate({ moneda: m, conIva: c.precios_con_iva }); } }}
                      className={cn("flex-1 h-8 rounded-md text-sm font-medium transition", c.moneda === m ? "bg-superficie shadow-sm text-texto" : "text-tenue hover:text-texto")}>
                      {m === "MXN" ? "Pesos" : "Dólares"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Tipo de cambio</span>
                {c.moneda === "MXN" ? <p className="campo flex items-center text-tenue">No aplica (pesos)</p> : (
                  <CampoNumero valor={tcLocal ?? Number(c.tipo_cambio)} decimales={4} min={0.0001} deshabilitado={!editable} prefijo="$"
                    alCambiar={setTcLocal}
                    alEnter={() => { if (tcLocal && tcLocal !== Number(c.tipo_cambio)) moneda.mutate({ moneda: c.moneda, tc: tcLocal, conIva: c.precios_con_iva }); }} />
                )}
                {c.moneda !== "MXN" && tcLocal != null && tcLocal !== Number(c.tipo_cambio) && (
                  <button className="text-xs text-marca-texto font-medium" onClick={() => moneda.mutate({ moneda: c.moneda, tc: tcLocal, conIva: c.precios_con_iva })}>
                    Aplicar TC y convertir precios
                  </button>
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Emisión</span>
                <input type="date" className="campo" value={c.fecha} disabled={!editable} onChange={(e) => e.target.value && editarEnc({ fecha: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Vigencia</span>
                <select className="campo pr-8" value={c.vigencia_dias} disabled={!editable} onChange={(e) => editarEnc({ vigencia_dias: Number(e.target.value) })}>
                  {[...new Set([7, 15, 30, 45, 60, Number(c.vigencia_dias)])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d} días</option>)}
                </select>
                <span className={cn("block text-xs", vencida ? "text-peligro font-medium" : "text-tenue")}>{vencida ? "Venció" : "Vence"} el {fecha(vence)}</span>
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2 cursor-pointer self-end pb-1">
                <input type="checkbox" className="mt-1" checked={c.precios_con_iva} disabled={!editable || moneda.isPending}
                  onChange={(e) => moneda.mutate({ moneda: c.moneda, tc: Number(c.tipo_cambio), conIva: e.target.checked })} />
                <span>Precios con IVA incluido<span className="block text-xs text-tenue">Convierte las partidas; el total no cambia.</span></span>
              </label>
              {c.cliente_id && (oportunidades.data?.length ?? 0) > 0 && (
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium">Oportunidad</span>
                  <select className="campo pr-8" value={c.oportunidad_id ?? ""} disabled={!editable} onChange={(e) => editarEnc({ oportunidad_id: e.target.value || null })}>
                    <option value="">— se abre sola al enviar —</option>
                    {oportunidades.data!.map((o) => <option key={o.id} value={o.id}>{o.titulo} ({o.etapa})</option>)}
                  </select>
                </label>
              )}
            </div>
          </Tarjeta>

          {/* Partidas */}
          <Tarjeta className="overflow-visible">
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
              {editable ? (
                <>
                  <BuscadorArticulo className="flex-1" autoFocus={lineas.length === 0 && !!c.cliente_id} placeholder="Agregar partida: escribe equipo, componente o clave y Enter…"
                    alElegir={(a) => agregar.mutate(a)}
                    alNoEncontrar={(texto) => setPedirPara({ descripcion: texto, cantidad: 1, cotizacionId: id, nuevaPartida: true,
                      para: `${c.folio}${cliente.data ? " · " + cliente.data.nombre : ""} (se agrega como partida)` })} />
                  <MenuAcciones alinear="end" disparador={<Boton variante="secundario"><Plus className="h-4 w-4" />Partida libre<ChevronDown className="h-3.5 w-3.5" /></Boton>}>
                    <OpcionMenu alElegir={() => agregarLibre.mutate("Flete a ")}>Flete</OpcionMenu>
                    <OpcionMenu alElegir={() => agregarLibre.mutate("Instalación y puesta en marcha")}>Instalación</OpcionMenu>
                    <OpcionMenu alElegir={() => agregarLibre.mutate("Servicio de ")}>Servicio</OpcionMenu>
                    <OpcionMenu alElegir={() => agregarLibre.mutate("Partida")}>Otra (texto libre)</OpcionMenu>
                  </MenuAcciones>
                </>
              ) : <p className="text-sm text-tenue">{lineas.length} partida(s)</p>}
              {(agregar.isPending || agregarLibre.isPending) && <Loader2 className="h-5 w-5 animate-spin text-tenue self-center" />}
            </div>
            {lineas.length === 0 ? (
              <Vacio icono={FileText} titulo="Sin partidas todavía" texto="Escribe arriba parte del nombre o la clave (“banda 20”, “E-315”, “chumacera 1 7/16”) y Enter. Precio, descripción y foto se llenan solos." />
            ) : (
              <TablaPartidas lineas={lineas} moneda={c.moneda} editable={editable} sucias={sucias} seleccion={seleccionada?.id ?? null}
                alSeleccionar={setSeleccion} ancho={tablaAncha} solicitudes={porPartida} fichas={fichas.data}
                aplicando={aplicarPrecio.isPending ? aplicarPrecio.variables?.id ?? null : null}
                acciones={{
                  editar: editarLinea, eliminar: (lid) => eliminarLinea.mutate(lid), duplicar: (l) => duplicarLinea.mutate(l),
                  reordenar, restaurarPrecio, verFicha: (l) => { setSeleccion(l.id); if (!dosColumnas) setFichaMovil(l); },
                  pedirPrecio: editable ? pedirPrecio : undefined, aplicarPrecio: (s) => aplicarPrecio.mutate(s),
                }} />
            )}
            {sueltas.length > 0 && (
              <div className="border-t border-borde px-3 sm:px-4 py-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-tenue">Precios pedidos a compras para esta cotización</p>
                {sueltas.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">{queSePide(s)}</span>
                    <span className="text-xs text-tenue">{Number(s.cantidad)} {s.unidad}</span>
                    <EstadoPartida s={s} editable={editable} alAplicar={(x) => aplicarPrecio.mutate(x)} textoAplicar="Agregar a la cotización"
                      aplicando={aplicarPrecio.isPending && aplicarPrecio.variables?.id === s.id} />
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>

          {/* Condiciones */}
          <Tarjeta>
            <EncabezadoTarjeta titulo="Condiciones" descripcion="Salen al pie de la cotización. Elige del catálogo o escribe otra." />
            <div className="px-5 pb-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Pago</span>
                <SelectorTexto valor={c.condiciones_pago} opciones={textosDe("pago")} deshabilitado={!editable} alCambiar={(v) => editarEnc({ condiciones_pago: v })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Tiempo de entrega</span>
                <SelectorTexto valor={c.tiempo_entrega} opciones={textosDe("entrega")} deshabilitado={!editable} alCambiar={(v) => editarEnc({ tiempo_entrega: v })} />
              </label>
              <div className="md:col-span-2 space-y-2">
                <span className="text-sm font-medium">Notas</span>
                <Notas notas={c.notas ?? []} catalogo={notasCatalogo} editable={editable} alCambiar={(n) => editarEnc({ notas: n })} />
              </div>
              <details className="md:col-span-2">
                <summary className="text-sm text-marca-texto cursor-pointer">Formato co-marca (“Powered by Hegamex”)</summary>
                <label className="mt-2 block space-y-1.5">
                  <span className="text-sm text-tenue">Liga del logo del cliente o distribuidor (si se llena, la cotización sale con su logo y “Powered by HEGAMEX”)</span>
                  <input className="campo" value={c.logo_comarca_url ?? ""} disabled={!editable} placeholder="https://…/logo.png"
                    onChange={(e) => editarEnc({ logo_comarca_url: e.target.value || null })} />
                </label>
              </details>
            </div>
          </Tarjeta>
        </div>

        {/* Columna derecha: totales siempre a la vista y ficha de la partida */}
        {dosColumnas ? (
          <div className="space-y-4 sticky top-4">
            {totales}
            {ficha ?? (seleccionada && porPartida[seleccionada.id] ? (
              // Partida libre con precio pedido: lo que va de la solicitud (sin costo; eso no llega a ventas).
              <Tarjeta>
                <EncabezadoTarjeta titulo="Precio pedido a compras" descripcion={`Partida ${lineas.indexOf(seleccionada) + 1} · ${porPartida[seleccionada.id].folio}`} />
                <div className="px-5 pb-5 space-y-3">
                  <DetalleSolicitud s={porPartida[seleccionada.id]} />
                  <RespuestaVenta s={porPartida[seleccionada.id]} />
                </div>
              </Tarjeta>
            ) : (
              <Tarjeta className="p-5 text-sm text-tenue">Elige una partida del catálogo para ver su precio mínimo, existencia, plazo y precio en Mercado Libre.</Tarjeta>
            ))}
          </div>
        ) : totales}
      </div>

      {/* Celular y pantallas medianas: total y acción principal siempre a la mano */}
      {!dosColumnas && tot && (
        // pr-20: a la derecha flota el botón del asistente y tapaba la acción principal.
        <div className="fixed bottom-0 inset-x-0 lg:left-64 z-30 border-t border-borde bg-superficie/95 backdrop-blur pl-4 pr-20 py-2.5 flex items-center gap-3 no-imprimir">
          <div className="min-w-0">
            <p className="text-[11px] text-tenue leading-none">Total {c.precios_con_iva ? "(IVA incl.)" : "con IVA"}</p>
            <p className="text-base font-semibold cifra leading-tight whitespace-nowrap">{dineroEn(tot.total, c.moneda)}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">{principal("sm")}</div>
        </div>
      )}

      {/* Diálogos */}
      <DialogoCliente abierto={dlg === "cliente"} alCambiar={(v) => setDlg(v ? "cliente" : null)} nombreInicial={nombreCliente}
        alCrear={(n: ClienteNuevo) => cambiarCliente(n, n.contacto ?? null)} />
      <DialogoEnviar abierto={dlg === "enviar"} alCambiar={(v) => setDlg(v ? "enviar" : null)} c={{ ...c, ...(tot ?? {}) }} partidas={lineas}
        contacto={contactoSel} vendedor={vendedor.data} plan={plan} yaEnviada={!["borrador", "autorizada"].includes(c.estado)}
        alMarcarEnviada={() => cambiarEstado.mutateAsync("enviada")} alAbrirPdf={abrirPdf} enviando={cambiarEstado.isPending} fichas={ligasFichas} />
      <DialogoPedirPrecio abierto={!!pedirPara} alCambiar={(v) => !v && setPedirPara(null)} inicial={pedirPara ?? {}}
        crear={pedirPara?.nuevaPartida ? crearConPartida : undefined} />
      <DialogoConvertir abierto={dlg === "convertir"} alCambiar={(v) => setDlg(v ? "convertir" : null)} c={c} partidas={lineas}
        cargando={convertir.isPending} alConfirmar={(f, ids) => convertir.mutate({ fecha: f, ids })} />
      <DialogoPedirAutorizacion abierto={dlg === "autorizacion"} alCambiar={(v) => setDlg(v ? "autorizacion" : null)} partidasBajo={bajoMinimo}
        pedidaEn={c.autorizacion_pedida_en} cargando={pedirAutorizacion.isPending} alConfirmar={(n) => pedirAutorizacion.mutate(n)} />
      <DialogoMotivo abierto={dlg === "rechazar"} alCambiar={(v) => setDlg(v ? "rechazar" : null)} titulo={`Rechazar ${c.folio}`}
        descripcion="Saber por qué se pierden las ventas es lo que hoy no existe en ninguna hoja." sugerencias={MOTIVOS_PERDIDA}
        textoBoton="Marcar rechazada" cargando={rechazar.isPending} alConfirmar={(m) => rechazar.mutate({ motivo: m, cerrar: cerrarOp })}
        extra={c.oportunidad_id ? (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cerrarOp} onChange={(e) => setCerrarOp(e.target.checked)} />
            Cerrar también la oportunidad como perdida (si no tiene otra cotización viva)</label>
        ) : null} />
      <Lateral abierto={!!fichaMovil} alCambiar={(v) => !v && setFichaMovil(null)} titulo="Ficha de venta" subtitulo={fichaMovil?.titulo} ancho="max-w-md">
        {fichaMovil?.articulo_id && (
          <FichaVenta articuloId={fichaMovil.articulo_id} moneda={c.moneda} tipoCambio={Number(c.tipo_cambio)} conIva={c.precios_con_iva} tasaIva={Number(c.tasa_iva)}
            precioActual={precioEfectivo(fichaMovil)}
            alAplicarPrecio={editable ? (p) => { editarLinea(fichaMovil.id, { precio_unitario: p }); setFichaMovil(null); } : undefined} />
        )}
      </Lateral>
    </div>
  );
}

/** Notas del catálogo con palomita (en su orden) + notas propias, como el menú no estricto de la hoja. */
function Notas({ notas, catalogo, editable, alCambiar }: { notas: string[]; catalogo: string[]; editable: boolean; alCambiar: (n: string[]) => void }) {
  const [nueva, setNueva] = useState("");
  const propias = notas.filter((n) => !catalogo.includes(n));
  const armar = (deCatalogo: string[], otras: string[]) => [...catalogo.filter((t) => deCatalogo.includes(t)), ...otras];
  const marcadas = notas.filter((n) => catalogo.includes(n));
  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {catalogo.map((t) => (
          <label key={t} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer",
            marcadas.includes(t) ? "border-marca/30 bg-marca-suave/40" : "border-borde text-tenue")}>
            <input type="checkbox" className="mt-0.5" checked={marcadas.includes(t)} disabled={!editable}
              onChange={(e) => alCambiar(armar(e.target.checked ? [...marcadas, t] : marcadas.filter((x) => x !== t), propias))} />
            {t}
          </label>
        ))}
      </div>
      {propias.map((t, i) => (
        <div key={i} className="flex gap-2">
          <input className="campo" value={t} disabled={!editable}
            onChange={(e) => { const p = [...propias]; p[i] = e.target.value; alCambiar(armar(marcadas, p)); }} />
          {editable && <Boton variante="fantasma" tamano="icono" aria-label="Quitar nota" onClick={() => alCambiar(armar(marcadas, propias.filter((_, j) => j !== i)))}><X className="h-4 w-4" /></Boton>}
        </div>
      ))}
      {editable && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nueva.trim()) { alCambiar(armar(marcadas, [...propias, nueva.trim()])); setNueva(""); } }}>
          <input className="campo" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Otra nota (p. ej. “Incluye envío a Querétaro”) y Enter" />
          <Boton type="submit" variante="secundario" disabled={!nueva.trim()}>Agregar</Boton>
        </form>
      )}
    </div>
  );
}

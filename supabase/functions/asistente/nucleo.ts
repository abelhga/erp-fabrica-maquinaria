// El asistente de Hegamex: Claude con acceso de SOLO LECTURA a los datos del ERP.
//
// Este archivo no sabe en qué servidor corre (Deno en Supabase, Node en local y en
// las pruebas): recibe un Request y devuelve un Response. index.ts lo monta en
// Supabase; scripts/asistente-local.ts, en Node.
//
// La regla que importa: toda consulta sale con la sesión de quien pregunta, así que
// la RLS aplica igual que en la pantalla. Claude no puede contarle un costo a un
// vendedor porque la base no se lo da. Nada aquí usa la llave de servicio.
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Entorno {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Sin llave el asistente responde en modo demostración con los hallazgos de la base. */
  anthropicKey?: string;
  /** Para las pruebas: un cliente de Anthropic falso. */
  crearAnthropic?: () => Pick<Anthropic, "beta">;
}

type Area = "direccion" | "ventas" | "compras" | "almacen" | "produccion" | "finanzas" | "importaciones"
  | "servicio";
const AREAS: Area[] = ["direccion", "ventas", "compras", "almacen", "produccion", "finanzas", "importaciones",
  "servicio"];

export const RUTAS = [
  "/", "/semana", "/pendientes", "/ventas/para-llamar", "/ventas/oportunidades", "/ventas/cotizaciones", "/ventas/pedidos",
  "/ventas/clientes", "/ventas/comisiones", "/costeo/equipos", "/costeo/componentes", "/costeo/planos", "/costeo/margenes",
  "/costeo/precios-ventas",
  "/compras/precios", "/compras/solicitudes", "/compras/ordenes", "/compras/proveedores", "/ventas/solicitudes",
  "/almacen/existencias", "/almacen/movimientos", "/almacen/reabasto", "/almacen/envios", "/ventas/devoluciones",
  "/produccion/gerencia", "/produccion/ordenes", "/finanzas/cobranza", "/finanzas/pagos",
  "/rrhh/empleados", "/rrhh/incidencias", "/rrhh/objetivos", "/rrhh/checklist", "/rrhh/prenomina",
  "/importaciones", "/importaciones/dinero",
  "/servicio", "/servicio/maquinas", "/servicio/resguardos", "/servicio/reportar",
  "/analisis", "/analisis/tendencias", "/analisis/clientes", "/analisis/producto", "/analisis/planeacion", "/analisis/ubicaciones",
] as const;

interface Config { modelo: string; esfuerzo: "low" | "medium" | "high" | "xhigh" | "max" }
interface Perfil { id: string; nombre: string; roles: string[] }

export type Evento =
  | { tipo: "texto"; texto: string }
  | { tipo: "herramienta"; nombre: string; etiqueta: string }
  | { tipo: "fin"; modelo: string; simulado?: boolean }
  | { tipo: "error"; mensaje: string; codigo: string };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Opus 5.5 rechaza los fallbacks en arreglo con este encabezado; "default" deja que
// la API elija a quién pasarle una petición que Claude declina, según el motivo.
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

// -----------------------------------------------------------------------------
// Herramientas. Todas leen; ninguna escribe. strict: true garantiza que los
// argumentos cumplen el esquema (con tool_choice "auto": Opus 5.5 no deja forzar).
// eager_input_streaming se deja apagado a propósito: las entradas son de unas
// cuantas palabras y así la API las sigue validando contra el esquema.
// -----------------------------------------------------------------------------

/** Tablas y vistas que Claude puede consultar, con las columnas que se le dan si no pide otras. */
const TABLAS: Record<string, string> = {
  clientes: "id,nombre,razon_social,giro,ciudad,estado,es_distribuidor,dias_credito,activo,vendedor_id,creado_en",
  v_cartera: "cliente_id,nombre,vendedor,ultima_venta,ultimo_seguimiento,vence_en,estado,dias_restantes",
  contactos: "cliente_id,nombre,puesto,telefono,whatsapp,correo,principal",
  historial_ventas_hoja: "fecha,cliente_id,cliente_nombre,tipo,monto,descripcion,factura",
  cotizaciones: "id,folio,cliente_id,empresa,fecha,vigencia_dias,estado,moneda,total,vendedor_id",
  pedidos: "id,folio,cliente_id,canal,fecha,fecha_compromiso,estado,moneda,total,vendedor_id",
  pedido_lineas: "pedido_id,articulo_id,titulo,cantidad,precio_unitario,importe,linea",
  oportunidades: "id,titulo,cliente_id,etapa,linea,canal,monto_estimado,probabilidad,fecha_cierre_estimada,vendedor_id",
  articulos: "id,clave,tipo,nombre,familia,unidad,es_importado,tiempo_entrega_dias,se_vende,activo",
  precios_lista: "articulo_id,precio,moneda,calculado_en",
  existencias: "articulo_id,almacen_id,cantidad",
  almacenes: "id,nombre,tipo,disponible_para_planta",
  v_tablero_produccion: "folio,numero_serie,estado,prioridad,fecha_compromiso,equipo,cliente,avance,etapa_actual,pausada,materiales_faltantes,dias_restantes,atrasada,horas_pendientes",
  v_saldos_pedido: "folio,cliente_id,fecha,estado,moneda,total,cobrado,saldo",
  v_cuentas_por_pagar: "folio,proveedor,fecha,vence_pago,moneda,total,pagado,saldo",
  proveedores: "id,nombre,categoria,pais,es_importacion,moneda,dias_credito,dias_entrega,activo",
  // La vista y no la tabla: a quien no maneja costos le deja ver qué viene, sin importes.
  v_ordenes_compra: "folio,proveedor,estado,fecha,fecha_entrega,moneda,total,atrasada,dias_atraso,avance_recibido",
  historial_costos: "articulo_id,costo_anterior,costo_nuevo,moneda,origen,en",
  costos_calculados: "articulo_id,costo_material,costo_mano_obra,costo_total,sin_costo,calculado_en",
  historial_costeo: "articulo_id,en,costo_total,precio_lista,utilidad",
  perfiles: "id,nombre,puesto",
  // Sin montos: la RLS deja ver el embarque a almacén y al taller, el dinero no.
  v_embarques: "folio,descripcion,modalidad,proveedores,fase,etapa_nombre,eta,arribo,dias_en_puerto,dias_libres_almacenaje,llegada_planta_estimada,siguiente_paso,debe,docs_pendientes",
  // Servicio y mantenimiento: las vistas no traen dinero (los costos van aparte, con su RLS).
  v_servicios: "folio,tipo_nombre,estado,cliente,equipo,numero_serie,lugar,descripcion,solicitado_en,inicio,fin,horas_por_persona,en_garantia,garantia_vence,dias_esperando",
  v_maquinas: "numero,nombre,categoria,etapa,estado,critica,orden_folio,orden_falla,orden_desde,fallas_12m,horas_paro_12m,preventivo,preventivo_fecha,preventivo_situacion,prestada_a,prestada_desde",
  v_ordenes_mantenimiento: "folio,numero,maquina,tipo,estado,falla,diagnostico,detiene,reportado_en,cerrada_en,horas_paro,vence,vencida",
  v_resguardos: "numero,herramienta,quien,entregado_en,devuelto_en,dias,vencido,servicio_folio",
};
// Aunque la RLS se los diera a alguien, al modelo no le hacen falta.
const COLUMNAS_PROHIBIDAS = /^(datos_bancarios|clabe|cuenta.*|curp|nss|salario.*|sueldo.*|contrasena.*|token.*|password.*)$/;
const OPERADORES = ["igual", "distinto", "mayor", "mayor_o_igual", "menor", "menor_o_igual", "contiene", "es_nulo", "no_es_nulo", "en_lista"] as const;

const sinNada = { type: "object" as const, properties: {}, required: [] as string[], additionalProperties: false };

export const HERRAMIENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: "hallazgos",
    description: "Lo que hoy merece atención en un área, calculado por reglas en la base: riesgos, pendientes y lo que va bien. Úsala primero para cualquier pregunta tipo '¿cómo vamos?' o '¿qué hago hoy?'.",
    strict: true,
    input_schema: { type: "object", properties: { area: { type: "string", enum: AREAS } }, required: ["area"], additionalProperties: false },
  },
  {
    name: "tablero_direccion",
    description: "Panorama completo en una sola llamada: ventas del año contra el anterior y proyección, mejores clientes, embudo, cotizaciones, vendedores contra meta, canales, carga del taller, inventario, costos que subieron, cobranza y por pagar. Solo trae las secciones que la persona tiene permiso de ver.",
    strict: true,
    input_schema: sinNada,
  },
  {
    name: "semana",
    description: "La semana: lo que pasó la semana pasada contra la anterior (ventas, cotizaciones enviadas, ganadas y sin respuesta, cobranza, equipos terminados, compras) y lo que viene esta semana (entregas comprometidas, órdenes de producción, compras y embarques que llegan, servicios programados, pendientes). Para '¿cómo nos fue la semana pasada?' o '¿qué viene esta semana?'. Si ventas dice alcance 'tuyas', son solo las de los clientes de esa persona.",
    strict: true,
    input_schema: { type: "object", properties: { lunes: { type: "string", format: "date", description: "Lunes de la semana que empieza (AAAA-MM-DD); vacío para la de hoy" } }, required: ["lunes"], additionalProperties: false },
  },
  {
    name: "ventas_por_region",
    description: "Dónde se vende: venta, clientes que compraron, ticket y crecimiento contra el periodo anterior por estado (o por municipio si se da un estado), con lo que no se pudo ubicar y la exportación aparte. Para '¿dónde vendemos más?', '¿cómo vamos en Jalisco?'. Solo dirección y gerencia de ventas.",
    strict: true,
    input_schema: { type: "object", properties: {
      desde: { type: "string", format: "date" }, hasta: { type: "string", format: "date" },
      estado: { type: "string", description: "Nombre o clave INEGI de 2 dígitos (14 = Jalisco); vacío para todo el país" },
    }, required: ["desde", "hasta", "estado"], additionalProperties: false },
  },
  {
    name: "zonas_que_se_enfriaron",
    description: "Estados o municipios que compraban y cayeron fuerte contra el periodo anterior (o dejaron de comprar), con el monto perdido y los clientes que dejaron de comprar ahí. Solo dirección y gerencia de ventas.",
    strict: true,
    input_schema: { type: "object", properties: {
      desde: { type: "string", format: "date" }, hasta: { type: "string", format: "date" },
      estado: { type: "string", description: "Nombre o clave de 2 dígitos para ver sus municipios; vacío para el país" },
    }, required: ["desde", "hasta", "estado"], additionalProperties: false },
  },
  {
    name: "analisis_de_clientes",
    description: "Concentración (qué % de clientes hace el 80 % de la venta), nuevos contra recurrentes por año, cohortes por año de primera compra y segmentos (campeones, leales, en riesgo, perdidos…) con cuántos y cuánto. Solo dirección y gerencia de ventas.",
    strict: true,
    input_schema: { type: "object", properties: { desde: { type: "string", format: "date" }, hasta: { type: "string", format: "date" } },
      required: ["desde", "hasta"], additionalProperties: false },
  },
  {
    name: "producto_por_region",
    description: "Qué familias de producto se venden en qué estado (dosificadoras, bandas, helicoidales, tolvas y silos, refacciones…), con su índice contra el país. Solo dirección y gerencia de ventas.",
    strict: true,
    input_schema: { type: "object", properties: {
      desde: { type: "string", format: "date" }, hasta: { type: "string", format: "date" },
      estado: { type: "string", description: "Nombre o clave de 2 dígitos; vacío para todos" },
    }, required: ["desde", "hasta", "estado"], additionalProperties: false },
  },
  {
    name: "metas_y_planeacion",
    description: "Meta anual de ventas contra lo real por mes y acumulado, cuánto falta y a qué ritmo mensual hay que vender para llegar, y un escenario de crecimiento. Solo dirección y gerencia de ventas.",
    strict: true,
    input_schema: { type: "object", properties: {
      anio: { type: "integer" }, crecimiento: { type: "number", description: "Escenario: crecimiento sobre el año anterior en fracción (0.12 = 12 %); 0 para no usarlo" },
    }, required: ["anio", "crecimiento"], additionalProperties: false },
  },
  {
    name: "ventas_por_mes",
    description: "Ventas mensuales (importe con IVA, en pesos) desde una fecha, juntando el libro de ventas de la hoja (2018 en adelante) y los pedidos del ERP. Sirve para tendencias, estacionalidad y comparar años.",
    strict: true,
    input_schema: { type: "object", properties: { desde: { type: "string", format: "date", description: "Primer mes, AAAA-MM-DD" } }, required: ["desde"], additionalProperties: false },
  },
  {
    name: "oportunidades_de_venta",
    description: "A quién llamar y por qué, ordenado por valor: cotizaciones por vencer, clientes a los que ya les toca comprar según su ritmo, equipos vendidos que ya piden refacciones y clientes que dejaron de comprar. Trae el contacto. Un vendedor solo ve sus clientes y los libres.",
    strict: true,
    input_schema: { type: "object", properties: { limite: { type: "integer", description: "Cuántos, de 1 a 100" } }, required: ["limite"], additionalProperties: false },
  },
  {
    name: "historial_cliente",
    description: "Todo lo que un cliente ha comprado (libro de ventas desde 2018 y pedidos del ERP), sus cotizaciones y su saldo. Necesita el id del cliente: búscalo antes con consultar(tabla='clientes', filtro nombre contiene ...).",
    strict: true,
    input_schema: { type: "object", properties: { cliente_id: { type: "string", format: "uuid" } }, required: ["cliente_id"], additionalProperties: false },
  },
  {
    name: "reabasto",
    description: "Stock mínimo y qué pedir: por artículo, demanda mensual, punto de reorden, existencia en planta, en tránsito, disponible, sugerido y estado (ordenar, excedente, ok). Los importados tardan meses en llegar.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: ["ordenar", "excedente", "ok", "todos"] },
        solo_importados: { type: "boolean" },
        limite: { type: "integer", description: "De 1 a 200" },
      },
      required: ["estado", "solo_importados", "limite"],
      additionalProperties: false,
    },
  },
  {
    name: "comisiones_del_mes",
    description: "Comisiones de vendedores de un mes: venta de maquinaria, refacciones y otros, comisión, bonos por escalón, total y cuánto le falta para la siguiente meta. Cada vendedor ve solo lo suyo.",
    strict: true,
    input_schema: { type: "object", properties: { mes: { type: "string", format: "date", description: "Cualquier día del mes, AAAA-MM-DD" } }, required: ["mes"], additionalProperties: false },
  },
  {
    name: "consultar",
    description: `Lee filas de una tabla o vista del ERP con filtros simples. Tablas: ${Object.keys(TABLAS).join(", ")}. Si no pides columnas te da las más útiles. Los montos de pedidos y cotizaciones pueden estar en USD (columna moneda). Para contar sin traer filas usa solo_contar. Máximo 200 filas.`,
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        tabla: { type: "string", enum: Object.keys(TABLAS) },
        columnas: { type: "array", items: { type: "string" }, description: "Vacío = las de siempre" },
        filtros: {
          type: "array",
          items: {
            type: "object",
            properties: {
              columna: { type: "string" },
              operador: { type: "string", enum: [...OPERADORES] },
              valor: { type: "string", description: "Para en_lista, valores separados por coma; para es_nulo/no_es_nulo, vacío" },
            },
            required: ["columna", "operador", "valor"],
            additionalProperties: false,
          },
        },
        ordenar_por: { type: "string", description: "Columna, o vacío" },
        descendente: { type: "boolean" },
        limite: { type: "integer" },
        solo_contar: { type: "boolean" },
      },
      required: ["tabla", "columnas", "filtros", "ordenar_por", "descendente", "limite", "solo_contar"],
      additionalProperties: false,
    },
  },
];

const ETIQUETAS: Record<string, string> = {
  hallazgos: "Revisando qué merece atención",
  tablero_direccion: "Leyendo el tablero",
  semana: "Repasando la semana",
  ventas_por_region: "Revisando el mapa de ventas",
  zonas_que_se_enfriaron: "Buscando zonas que se enfriaron",
  analisis_de_clientes: "Analizando clientes",
  producto_por_region: "Cruzando producto y región",
  metas_y_planeacion: "Revisando la meta",
  ventas_por_mes: "Sumando ventas por mes",
  oportunidades_de_venta: "Buscando a quién llamar",
  historial_cliente: "Leyendo el historial del cliente",
  reabasto: "Revisando stock mínimo",
  comisiones_del_mes: "Calculando comisiones",
  consultar: "Consultando",
};

const MAX_RESULTADO = 40_000; // caracteres por resultado de herramienta

class ErrorHerramienta extends Error {}

const texto = (x: unknown) => (typeof x === "string" ? x : "");
const entero = (x: unknown, min: number, max: number, def: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : def;
const esFecha = (x: unknown) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
const esUuid = (x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);
const esColumna = (x: string) => /^[a-z_][a-z0-9_]*$/.test(x) && !COLUMNAS_PROHIBIDAS.test(x);

function compacto(datos: unknown): string {
  const s = JSON.stringify(datos);
  if (s.length <= MAX_RESULTADO) return s;
  if (Array.isArray(datos)) {
    // Recorta filas, no a media fila: un JSON roto confunde más que uno corto.
    let n = datos.length;
    while (n > 1 && JSON.stringify(datos.slice(0, n)).length > MAX_RESULTADO) n = Math.floor(n * 0.7);
    return JSON.stringify({ filas: datos.slice(0, n), aviso: `Se recortó a ${n} de ${datos.length} filas; filtra más.` });
  }
  return s.slice(0, MAX_RESULTADO) + "…(recortado)";
}

function revisar<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    if (r.error.code === "42501") throw new ErrorHerramienta("Sin permiso: esta persona no puede ver eso. Díselo así; no lo busques por otro lado.");
    throw new ErrorHerramienta(r.error.message);
  }
  return r.data;
}

/** Ejecuta una herramienta con la sesión de quien pregunta. Valida todo: el modelo propone, la base dispone. */
export async function ejecutarHerramienta(db: SupabaseClient, nombre: string, entrada: Record<string, unknown>): Promise<string> {
  switch (nombre) {
    case "hallazgos": {
      const area = AREAS.includes(entrada.area as Area) ? entrada.area : "direccion";
      return compacto(revisar(await db.rpc("hallazgos", { p_area: area })));
    }
    case "tablero_direccion":
      return compacto(revisar(await db.rpc("tablero_direccion")));
    case "semana":
      return compacto(revisar(await db.rpc("semana_en_numeros", esFecha(entrada.lunes) ? { p_lunes: entrada.lunes } : {})));
    case "ventas_por_region":
    case "zonas_que_se_enfriaron":
    case "analisis_de_clientes":
    case "producto_por_region": {
      if (!esFecha(entrada.desde) || !esFecha(entrada.hasta)) throw new ErrorHerramienta("desde y hasta deben ser AAAA-MM-DD");
      const rango = { p_desde: entrada.desde, p_hasta: entrada.hasta };
      if (nombre === "analisis_de_clientes") return compacto(revisar(await db.rpc("analisis_clientes", rango)));
      const estado = await claveEstado(db, entrada.estado);
      if (nombre === "ventas_por_region") return compacto(revisar(await db.rpc("analisis_mapa", { ...rango, p_cve_ent: estado })));
      if (nombre === "zonas_que_se_enfriaron") return compacto(revisar(await db.rpc("analisis_zonas_frias", { ...rango, p_cve_ent: estado })));
      return compacto(revisar(await db.rpc("analisis_producto_region", { ...rango, p_cve_ent: estado, p_familia: null })));
    }
    case "metas_y_planeacion": {
      const crec = typeof entrada.crecimiento === "number" && entrada.crecimiento !== 0 ? entrada.crecimiento : null;
      return compacto(revisar(await db.rpc("analisis_planeacion", { p_anio: entero(entrada.anio, 2018, 2100, new Date().getFullYear()), p_crecimiento: crec })));
    }
    case "ventas_por_mes": {
      if (!esFecha(entrada.desde)) throw new ErrorHerramienta("desde debe ser AAAA-MM-DD");
      return compacto(revisar(await db.rpc("ventas_historicas_mes", { p_desde: entrada.desde })));
    }
    case "oportunidades_de_venta":
      return compacto(revisar(await db.rpc("oportunidades_sugeridas", { p_limite: entero(entrada.limite, 1, 100, 20) })));
    case "historial_cliente": {
      if (!esUuid(entrada.cliente_id)) throw new ErrorHerramienta("cliente_id debe ser un uuid; búscalo con consultar(clientes)");
      const id = entrada.cliente_id as string;
      const [cliente, libro, pedidos, cotizaciones, saldos] = await Promise.all([
        db.from("clientes").select(TABLAS.clientes).eq("id", id).maybeSingle(),
        db.from("historial_ventas_hoja").select("fecha,tipo,monto,descripcion,factura").eq("cliente_id", id).order("fecha", { ascending: false }).limit(150),
        db.from("pedidos").select(TABLAS.pedidos).eq("cliente_id", id).eq("historico", false).order("fecha", { ascending: false }).limit(50),
        db.from("cotizaciones").select(TABLAS.cotizaciones).eq("cliente_id", id).order("fecha", { ascending: false }).limit(30),
        db.from("v_saldos_pedido").select(TABLAS.v_saldos_pedido).eq("cliente_id", id).gt("saldo", 0),
      ]);
      const c = revisar(cliente);
      if (!c) throw new ErrorHerramienta("No existe ese cliente o esta persona no lo puede ver.");
      return compacto({
        cliente: c, libro_de_ventas: revisar(libro), pedidos_erp: revisar(pedidos),
        cotizaciones: cotizaciones.error ? "sin permiso" : cotizaciones.data, saldos: saldos.error ? "sin permiso" : saldos.data,
      });
    }
    case "reabasto": {
      let q = db.rpc("reabasto").select("clave,nombre,unidad,es_importado,proveedor,demanda_mensual,dias_entrega,punto_reorden,en_planta,en_transito,disponible,sugerido,estado");
      if (entrada.estado !== "todos" && ["ordenar", "excedente", "ok"].includes(texto(entrada.estado))) q = q.eq("estado", entrada.estado as string);
      if (entrada.solo_importados === true) q = q.eq("es_importado", true);
      return compacto(revisar(await q.limit(entero(entrada.limite, 1, 200, 50))));
    }
    case "comisiones_del_mes": {
      if (!esFecha(entrada.mes)) throw new ErrorHerramienta("mes debe ser AAAA-MM-DD");
      return compacto(revisar(await db.rpc("comisiones_mes", { p_mes: (entrada.mes as string).slice(0, 8) + "01" })));
    }
    case "consultar":
      return consultar(db, entrada);
    default:
      throw new ErrorHerramienta(`No existe la herramienta ${nombre}`);
  }
}

/** "Jalisco", "edo de mexico" o "14" → clave INEGI; vacío → todo el país. */
async function claveEstado(db: SupabaseClient, v: unknown): Promise<string | null> {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) return t.padStart(2, "0");
  const { data } = await db.rpc("geo_estado_de", { p_texto: t });
  if (!data) throw new ErrorHerramienta(`No reconozco el estado "${t}"`);
  return data as string;
}

async function consultar(db: SupabaseClient, e: Record<string, unknown>): Promise<string> {
  const tabla = texto(e.tabla);
  if (!(tabla in TABLAS)) throw new ErrorHerramienta(`Tabla no permitida: ${tabla}`);
  const pedidas = Array.isArray(e.columnas) ? e.columnas.map(texto).filter(Boolean) : [];
  const malas = pedidas.filter((c) => !esColumna(c));
  if (malas.length) throw new ErrorHerramienta(`Columnas no permitidas: ${malas.join(", ")}`);
  const columnas = pedidas.length ? pedidas.join(",") : TABLAS[tabla];
  const contar = e.solo_contar === true;
  let q = db.from(tabla).select(columnas, contar ? { count: "exact", head: true } : undefined);
  for (const f of Array.isArray(e.filtros) ? e.filtros : []) {
    const { columna, operador, valor } = f as Record<string, string>;
    if (!esColumna(columna)) throw new ErrorHerramienta(`Columna no permitida en filtro: ${columna}`);
    switch (operador) {
      case "igual": q = q.eq(columna, valor); break;
      case "distinto": q = q.neq(columna, valor); break;
      case "mayor": q = q.gt(columna, valor); break;
      case "mayor_o_igual": q = q.gte(columna, valor); break;
      case "menor": q = q.lt(columna, valor); break;
      case "menor_o_igual": q = q.lte(columna, valor); break;
      case "contiene": q = q.ilike(columna, `%${valor.replace(/[%_]/g, "")}%`); break;
      case "es_nulo": q = q.is(columna, null); break;
      case "no_es_nulo": q = q.not(columna, "is", null); break;
      case "en_lista": q = q.in(columna, valor.split(",").map((v) => v.trim()).filter(Boolean)); break;
      default: throw new ErrorHerramienta(`Operador no permitido: ${operador}`);
    }
  }
  if (contar) {
    const r = await q;
    if (r.error) revisar(r);
    return JSON.stringify({ tabla, filas: r.count });
  }
  const orden = texto(e.ordenar_por);
  if (orden) {
    if (!esColumna(orden)) throw new ErrorHerramienta(`No se puede ordenar por ${orden}`);
    q = q.order(orden, { ascending: e.descendente !== true, nullsFirst: false });
  }
  return compacto(revisar(await q.limit(entero(e.limite, 1, 200, 50))));
}

// -----------------------------------------------------------------------------
// Instrucciones. La parte fija va primero y con cache_control para que no se
// cobre completa en cada pregunta; lo de cada persona va en un bloque aparte.
// -----------------------------------------------------------------------------
const INSTRUCCIONES = `Eres el asistente del ERP de Hegamex (Máquinas y Herramientas Gamex S.A. de C.V., Atotonilco el Alto, Jalisco).

Hegamex fabrica bandas transportadoras, dosificadoras, cribadoras, tolvas, silos, elevadores de cangilones y bazucas, y vende componentes (colectores, poleas, cangilones, catarinas, cosedoras de costales) directo, por Mercado Libre y por su sitio web. Sus clientes son agrícolas, mineros, concreteras, constructoras, destilerías de tequila e industria.

Para qué estás: para que cada persona venda más, compre mejor, entregue a tiempo y cobre. Das respuestas concretas con números del ERP y terminas con lo que conviene hacer.

Cómo trabajas:
- Las cifras salen SIEMPRE de las herramientas. Si no las tienes, consulta; nunca las inventes ni las estimes de memoria. Si un dato no existe en el ERP, dilo.
- Empieza por la herramienta más específica (hallazgos, tablero_direccion, oportunidades_de_venta, historial_cliente, reabasto, comisiones_del_mes) y usa consultar para lo demás.
- Si una herramienta dice "Sin permiso", esa persona no puede ver ese dato: díselo con naturalidad y no intentes conseguirlo por otro camino. Nunca menciones costos, márgenes ni utilidades si no te llegaron de una herramienta.
- Solo lees. No puedes crear, cambiar ni borrar nada. Si te piden una acción, explica dónde hacerla en el ERP con un enlace.

Cómo escribes:
- Español de México, claro y directo, de tú. Sin rodeos ni frases de relleno.
- Dinero como $1,234,567 o $1.2 M; fechas como "3 oct 2026". Aclara si algo está en dólares.
- Breve: primero la respuesta, luego el porqué en 2 a 4 viñetas, al final la acción. Tablas en markdown solo si comparas varias cosas.
- Para mandar a la persona a una pantalla usa enlaces markdown con rutas del ERP, por ejemplo [Reabasto](/almacen/reabasto) o [Cotizaciones](/ventas/cotizaciones). Rutas válidas: ${RUTAS.join(", ")}.
- Si te piden un mensaje para un cliente, escríbelo listo para mandar por WhatsApp: corto, cálido, sin presionar, con un motivo concreto para escribirle (lo que compró, cuánto tiempo lleva, una cotización por vencer) y una pregunta que invite a contestar. Fírmalo con el nombre de quien pregunta.

Reglas del negocio útiles:
- Precio de equipo = costo × (1 + recargos sobre costo) ÷ (1 − utilidad/(1 − ISR 25 %) − recargos sobre precio), redondeado hacia arriba a $100 (o $1,000 arriba de $100 mil). Componentes: costo ÷ 0.70.
- Stock mínimo: un artículo genera demanda si tuvo salidas en 3 de los últimos 6 meses; reorden = demanda/22 × días de entrega + seguridad; cobertura de 1 mes nacional y 6 meses importado.
- Comisiones: 2 % sin IVA de todo lo que no es refacción, más bonos por escalón de meta de maquinaria y de refacciones.
- Almacenes: Planta Baja, Mallado, Planta Alta, Contenedor 1 y 2, Revolución y Almacén ML (Full de Mercado Libre, no cuenta para planta).
- Ventas del libro de la hoja: importe con IVA. Pedidos del ERP: total con IVA en su moneda por tipo de cambio.`;

function contextoPersona(p: Perfil, ruta?: string): string {
  const hoy = new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `Hoy es ${hoy}. Hablas con ${p.nombre || "una persona del equipo"} (roles: ${p.roles.join(", ") || "sin rol"}).${ruta ? ` Está en la pantalla ${ruta}.` : ""}`;
}

function sistema(p: Perfil, ruta?: string): Anthropic.Beta.BetaTextBlockParam[] {
  return [
    { type: "text", text: INSTRUCCIONES, cache_control: { type: "ephemeral" } },
    { type: "text", text: contextoPersona(p, ruta) },
  ];
}

// El resumen guardado se escribió con los permisos de los roles de ese momento. Si
// dirección está viendo como otro rol, el de su vista propia trae ventas, cobranza y
// costos que ese rol no ve: se guarda con qué roles se hizo y solo se reusa con los mismos.
export const vista = (p: Pick<Perfil, "roles">) => [...p.roles].sort().join(",");
export const mismaVista = (c: { roles?: unknown } | null | undefined, p: Pick<Perfil, "roles">) => c?.roles === vista(p);

// -----------------------------------------------------------------------------
// Errores de la API en palabras de quien usa el ERP. Tipados, no por texto:
// el 28 sep 2026 un tope de gasto lleno (400 sin reintento) tumbó otro sistema de
// Hegamex horas sin que nadie supiera por qué.
// -----------------------------------------------------------------------------
export function explicarError(e: unknown): { mensaje: string; codigo: string } {
  if (e instanceof Anthropic.AuthenticationError)
    return { codigo: "llave", mensaje: "La llave de Claude no es válida. Sistemas tiene que revisar ANTHROPIC_API_KEY en Supabase." };
  if (e instanceof Anthropic.RateLimitError)
    return { codigo: "saturado", mensaje: "Claude está recibiendo demasiadas consultas. Intenta en un minuto." };
  if (e instanceof Anthropic.APIConnectionError)
    return { codigo: "red", mensaje: "No hubo conexión con Claude. Intenta de nuevo." };
  if (e instanceof Anthropic.APIError) {
    // El mensaje de la API se queda en el log de la función: "tope de gasto" cubre
    // varios rechazos (402, 403, 400 sin reintento) y sin el original no se sabe
    // cuál fue ni qué arreglar en la consola de Anthropic.
    console.error(`[anthropic] ${e.status} ${e.type ?? ""} ${e.requestID ?? ""}: ${e.message}`);
    // Un 400 de tope o saldo y un 400 por una petición mal hecha llegan igual (sin
    // reintento): solo el mensaje los distingue. Confundirlos mandó a revisar la
    // facturación cuando lo que fallaba era el esquema del BL.
    const deCuenta = /usage limit|credit balance|billing|spend/i.test(e.message);
    if (e.type === "billing_error" || e.status === 402 || e.status === 403 || (e.status === 400 && deCuenta))
      return { codigo: "cuenta", mensaje: "La cuenta de Claude no aceptó la consulta (tope de gasto o facturación). Se sube en console.anthropic.com → Settings → Limits." };
    if ((e.status ?? 0) >= 500) return { codigo: "saturado", mensaje: "Claude tuvo un problema de su lado. Intenta en un minuto." };
    return { codigo: "api", mensaje: `Claude no aceptó la consulta (${e.status}).` };
  }
  if (e instanceof ErrorHerramienta) return { codigo: "datos", mensaje: e.message };
  return { codigo: "interno", mensaje: "Algo falló en el asistente. Intenta de nuevo." };
}

// -----------------------------------------------------------------------------
// Conversación con herramientas, en streaming hacia el navegador.
// -----------------------------------------------------------------------------
interface MensajeChat { rol: "usuario" | "asistente"; texto: string }
const MAX_VUELTAS = 10;

export async function conversar(opts: {
  anthropic: Pick<Anthropic, "beta">; db: SupabaseClient; perfil: Perfil; config: Config;
  mensajes: MensajeChat[]; ruta?: string; emitir: (e: Evento) => void;
}): Promise<{ modelo: string; entrada: number; salida: number; cache: number; herramientas: string[] }> {
  const { anthropic, db, perfil, config, emitir } = opts;
  // Solo texto de turnos anteriores: sin bloques de razonamiento no hay historia que
  // el chequeo de razonamiento preservado pueda encontrar alterada.
  const mensajes: Anthropic.Beta.BetaMessageParam[] = opts.mensajes.slice(-20).map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.texto.slice(0, 8000),
  }));
  while (mensajes.length && mensajes[0].role !== "user") mensajes.shift();
  if (!mensajes.length) throw new ErrorHerramienta("No hay pregunta.");

  const uso = { modelo: config.modelo, entrada: 0, salida: 0, cache: 0, herramientas: [] as string[] };
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const flujo = anthropic.beta.messages.stream({
      model: config.modelo,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: config.esfuerzo },
      system: sistema(perfil, opts.ruta),
      tools: HERRAMIENTAS,
      messages: mensajes,
    });
    flujo.on("text", (t) => emitir({ tipo: "texto", texto: t }));
    const r = await flujo.finalMessage();
    uso.modelo = r.model;
    uso.entrada += r.usage.input_tokens;
    uso.salida += r.usage.output_tokens;
    uso.cache += r.usage.cache_read_input_tokens ?? 0;

    if (r.stop_reason === "refusal") {
      emitir({ tipo: "texto", texto: "\n\nNo puedo ayudar con eso. Si crees que es un error, pregúntalo de otra forma." });
      return uso;
    }
    const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (r.stop_reason === "max_tokens") {
      // Una herramienta cortada a medias no se ejecuta: sus argumentos pueden venir truncados.
      emitir({ tipo: "texto", texto: "\n\n_(La respuesta se cortó por larga. Pide la parte que te falta.)_" });
      return uso;
    }
    if (r.stop_reason === "pause_turn") { mensajes.push({ role: "assistant", content: r.content }); continue; }
    if (r.stop_reason !== "tool_use" || usos.length === 0) return uso;

    // La respuesta completa (con su razonamiento) se agrega tal cual, sin editar.
    mensajes.push({ role: "assistant", content: r.content });
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of usos) {
      emitir({ tipo: "herramienta", nombre: u.name, etiqueta: ETIQUETAS[u.name] ?? "Consultando" });
      uso.herramientas.push(u.name);
      try {
        const contenido = await ejecutarHerramienta(db, u.name, (u.input ?? {}) as Record<string, unknown>);
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: contenido });
      } catch (e) {
        const msg = e instanceof ErrorHerramienta ? e.message : "Error al consultar la base.";
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: msg, is_error: true });
      }
    }
    mensajes.push({ role: "user", content: resultados });
  }
  emitir({ tipo: "texto", texto: "\n\n_(Me detuve después de muchas consultas. Haz la pregunta más específica.)_" });
  return uso;
}

// -----------------------------------------------------------------------------
// Resumen de un área: el piso son los hallazgos de la base; Claude los ordena,
// los cruza y propone qué hacer. Sale en JSON con esquema estricto.
// -----------------------------------------------------------------------------
export interface Resumen {
  titular: string;
  resumen: string;
  puntos: { tono: "riesgo" | "atencion" | "bueno" | "info"; titulo: string; detalle: string; accion: string; ruta: string }[];
}

const ESQUEMA_RESUMEN = {
  type: "object",
  properties: {
    titular: { type: "string", description: "Una frase de 6 a 14 palabras con lo más importante de hoy" },
    resumen: { type: "string", description: "2 o 3 oraciones que conectan los puntos" },
    puntos: {
      type: "array",
      description: "De 3 a 6, lo más urgente primero",
      items: {
        type: "object",
        properties: {
          tono: { type: "string", enum: ["riesgo", "atencion", "bueno", "info"] },
          titulo: { type: "string" },
          detalle: { type: "string", description: "Con las cifras que lo sustentan" },
          accion: { type: "string", description: "Qué hacer, empezando con verbo" },
          ruta: { type: "string", enum: [...RUTAS] },
        },
        required: ["tono", "titulo", "detalle", "accion", "ruta"],
        additionalProperties: false,
      },
    },
  },
  required: ["titular", "resumen", "puntos"],
  additionalProperties: false,
};

async function datosDeArea(db: SupabaseClient, area: Area) {
  const hace2 = new Date(); hace2.setMonth(hace2.getMonth() - 24); hace2.setDate(1);
  const [h, t, v, o] = await Promise.all([
    db.rpc("hallazgos", { p_area: area }),
    db.rpc("tablero_direccion"),
    db.rpc("ventas_historicas_mes", { p_desde: hace2.toISOString().slice(0, 10) }),
    area === "direccion" || area === "ventas" ? db.rpc("oportunidades_sugeridas", { p_limite: 8 }) : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    hallazgos: revisar(h) as { area: string; tono: string; titulo: string; detalle: string; ruta: string }[],
    tablero: t.error ? null : t.data,
    ventas_mensuales: v.error ? null : v.data,
    oportunidades: o.error ? null : o.data,
  };
}

export async function resumir(opts: { anthropic: Pick<Anthropic, "beta">; db: SupabaseClient; perfil: Perfil; config: Config; area: Area }) {
  const datos = await datosDeArea(opts.db, opts.area);
  const nombreArea = opts.area === "direccion" ? "toda la empresa (dirección)" : opts.area;
  const flujo = opts.anthropic.beta.messages.stream({
    model: opts.config.modelo,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: opts.config.esfuerzo, format: { type: "json_schema", schema: ESQUEMA_RESUMEN } },
    system: sistema(opts.perfil),
    messages: [{
      role: "user",
      content: `Escribe el resumen de hoy para ${nombreArea}. Usa solo estos datos (vienen de la base con los permisos de esta persona). ` +
        `Los hallazgos ya están calculados por reglas: no los repitas tal cual, ordénalos por lo que más dinero o tiempo mueve, ` +
        `júntalos cuando estén relacionados (por ejemplo, faltantes de material y órdenes atrasadas) y di qué hacer con cada uno.\n\n` +
        "```json\n" + JSON.stringify(datos) + "\n```",
    }],
  });
  const r = await flujo.finalMessage();
  if (r.stop_reason === "refusal") throw new ErrorHerramienta("Claude no quiso escribir este resumen.");
  if (r.stop_reason === "max_tokens") throw new ErrorHerramienta("El resumen salió demasiado largo; intenta de nuevo.");
  const bloque = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!bloque) throw new ErrorHerramienta("Claude no devolvió el resumen.");
  const resumen = JSON.parse(bloque.text) as Resumen;
  return { resumen, modelo: r.model, entrada: r.usage.input_tokens, salida: r.usage.output_tokens, cache: r.usage.cache_read_input_tokens ?? 0 };
}

/** Sin llave de Claude, el resumen se arma con los mismos hallazgos de la base. */
export async function resumenSinIA(db: SupabaseClient, area: Area): Promise<Resumen> {
  const { hallazgos } = await datosDeArea(db, area);
  const bueno = hallazgos.find((h) => h.tono === "bueno");
  const riesgos = hallazgos.filter((h) => h.tono === "riesgo").length;
  return {
    titular: bueno?.titulo ?? (hallazgos[0]?.titulo ?? "Sin pendientes urgentes hoy"),
    resumen: hallazgos.length
      ? `${riesgos ? `${riesgos} ${riesgos === 1 ? "riesgo pide" : "riesgos piden"} atención hoy. ` : ""}Esto sale de las reglas de la base; con la llave de Claude conectada el asistente además los cruza y propone qué hacer.`
      : "No hay nada fuera de lo normal en lo que puedes ver.",
    puntos: hallazgos.slice(0, 6).map((h) => ({
      tono: h.tono as Resumen["puntos"][number]["tono"], titulo: h.titulo, detalle: h.detalle,
      accion: "Revisar", ruta: (RUTAS as readonly string[]).includes(h.ruta) ? h.ruta : "/",
    })),
  };
}

// -----------------------------------------------------------------------------
// La semana: los números los arma la base (semana_en_numeros, con los permisos de
// quien pregunta) y Claude los narra. Se guarda uno por persona y semana.
// -----------------------------------------------------------------------------
type Lista = Record<string, string | number | null>[];
export interface NumerosSemana {
  semana: { lunes: string; pasada_desde: string; pasada_hasta: string; hasta: string };
  ventas?: { alcance: "empresa" | "tuyas"; monto: number; monto_anterior: number; operaciones: number; operaciones_anterior: number;
    cotizaciones_enviadas: { n: number; monto: number }; cotizaciones_ganadas: { n: number; monto: number }; cotizaciones_perdidas: number;
    cotizaciones_sin_respuesta: { n: number; monto: number }; mejores_clientes: Lista; entregas_comprometidas: Lista };
  cobranza?: { cobrado: number; cobrado_anterior: number };
  produccion?: { terminadas: number; terminadas_anterior: number; atrasadas: number; en_proceso: number; comprometidas: Lista };
  compras?: { por_llegar: Lista; atrasadas: number; ajustes_pendientes: number; ajustes_semana: number };
  importaciones?: { llegan: Lista };
  servicio?: { cerrados: number; programados: Lista };
  pendientes: { vencidos: number; esta_semana: number; cerrados: number };
}

export async function resumirSemana(opts: { anthropic: Pick<Anthropic, "beta">; perfil: Perfil; config: Config; numeros: NumerosSemana }) {
  const flujo = opts.anthropic.beta.messages.stream({
    model: opts.config.modelo,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: opts.config.esfuerzo, format: { type: "json_schema", schema: ESQUEMA_RESUMEN } },
    system: sistema(opts.perfil),
    messages: [{
      role: "user",
      content: `Escribe el resumen de la semana para esta persona: qué pasó la semana pasada (${opts.numeros.semana.pasada_desde} a ` +
        `${opts.numeros.semana.pasada_hasta}) contra la anterior y qué viene esta semana. Usa solo estos números (vienen de la base con ` +
        `sus permisos; si ventas dice "tuyas", son las de sus clientes, no las de la empresa). Una semana es poca muestra: no ` +
        `saques tendencias de un solo dato. Lo que tiene fecha de esta semana y ya pasó, dilo como atrasado. En los puntos, primero ` +
        `lo que hay que hacer esta semana.\n\n` + "```json\n" + JSON.stringify(opts.numeros) + "\n```",
    }],
  });
  const r = await flujo.finalMessage();
  if (r.stop_reason === "refusal") throw new ErrorHerramienta("Claude no quiso escribir este resumen.");
  if (r.stop_reason === "max_tokens") throw new ErrorHerramienta("El resumen salió demasiado largo; intenta de nuevo.");
  const bloque = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!bloque) throw new ErrorHerramienta("Claude no devolvió el resumen.");
  const resumen = JSON.parse(bloque.text) as Resumen;
  return { resumen, modelo: r.model, entrada: r.usage.input_tokens, salida: r.usage.output_tokens, cache: r.usage.cache_read_input_tokens ?? 0 };
}

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const cambio = (a: number, b: number) => (b > 0 ? ` (${a >= b ? "+" : "−"}${Math.abs(Math.round((a / b - 1) * 100))} % contra la anterior)` : "");

/** Sin llave de Claude, la semana se cuenta con reglas: los mismos números, sin interpretación. */
export function semanaSinIA(n: NumerosSemana): Resumen {
  const puntos: Resumen["puntos"] = [];
  const v = n.ventas;
  if (v) {
    puntos.push({ tono: v.monto >= v.monto_anterior ? "bueno" : "atencion", titulo: `${v.alcance === "tuyas" ? "Tus ventas" : "Ventas"}: ${pesos(v.monto)}`,
      detalle: `${cuantos(v.operaciones, "operación", "operaciones")}${cambio(v.monto, v.monto_anterior)}. ` +
        `${cuantos(v.cotizaciones_enviadas.n, "cotización enviada", "cotizaciones enviadas")} por ${pesos(v.cotizaciones_enviadas.monto)}; ` +
        `${cuantos(v.cotizaciones_ganadas.n, "ganada", "ganadas")}.`,
      accion: "Revisar los pedidos", ruta: "/ventas/pedidos" });
    if (v.cotizaciones_sin_respuesta.n > 0) puntos.push({ tono: "atencion", titulo: cuantos(v.cotizaciones_sin_respuesta.n, "cotización sin respuesta", "cotizaciones sin respuesta"),
      detalle: `Enviadas hace más de una semana, por ${pesos(v.cotizaciones_sin_respuesta.monto)}.`, accion: "Darles seguimiento", ruta: "/ventas/cotizaciones" });
    if (v.entregas_comprometidas.length) puntos.push({ tono: "info", titulo: `${cuantos(v.entregas_comprometidas.length, "entrega comprometida", "entregas comprometidas")} esta semana`,
      detalle: v.entregas_comprometidas.slice(0, 4).map((e) => `${e.folio} (${e.cliente})`).join(", "), accion: "Confirmar que salen a tiempo", ruta: "/ventas/pedidos" });
  }
  const p = n.produccion;
  if (p && (p.atrasadas || p.comprometidas.length)) puntos.push({ tono: p.atrasadas ? "riesgo" : "info",
    titulo: p.atrasadas ? cuantos(p.atrasadas, "orden de producción atrasada", "órdenes de producción atrasadas")
      : `${cuantos(p.comprometidas.length, "orden comprometida", "órdenes comprometidas")} esta semana`,
    detalle: `${p.terminadas} terminadas la semana pasada; ${p.en_proceso} en proceso.`, accion: "Revisar la carga del taller", ruta: "/produccion/gerencia" });
  const c = n.compras;
  if (c && (c.atrasadas || c.por_llegar.length)) puntos.push({ tono: c.atrasadas ? "atencion" : "info",
    titulo: `${cuantos(c.por_llegar.length, "orden de compra llega", "órdenes de compra llegan")} esta semana`,
    detalle: c.atrasadas ? `${cuantos(c.atrasadas, "ya va atrasada", "ya van atrasadas")}.` : "Ninguna atrasada.",
    accion: "Revisar las órdenes de compra", ruta: "/compras/ordenes" });
  if (n.cobranza) puntos.push({ tono: "info", titulo: `Cobrado: ${pesos(n.cobranza.cobrado)}`, detalle: `La semana pasada${cambio(n.cobranza.cobrado, n.cobranza.cobrado_anterior)}.`,
    accion: "Revisar la cobranza", ruta: "/finanzas/cobranza" });
  if (n.pendientes.vencidos) puntos.push({ tono: "riesgo", titulo: cuantos(n.pendientes.vencidos, "pendiente tuyo vencido", "pendientes tuyos vencidos"),
    detalle: `Y ${n.pendientes.esta_semana} vencen esta semana.`, accion: "Cerrarlos o moverles la fecha", ruta: "/pendientes" });
  const rutas = RUTAS as readonly string[];
  return {
    titular: v ? `La semana pasada: ${pesos(v.monto)} en ventas${cambio(v.monto, v.monto_anterior)}` : "Tu semana en números",
    resumen: "Estos son los números de la base, sin interpretación; con la llave de Claude conectada el asistente además los cruza y propone qué hacer.",
    puntos: puntos.slice(0, 6).map((x) => ({ ...x, ruta: rutas.includes(x.ruta) ? x.ruta : "/" })),
  };
}

// -----------------------------------------------------------------------------
// Mensaje para un cliente (WhatsApp o correo), a partir de una oportunidad.
// -----------------------------------------------------------------------------
const ESQUEMA_MENSAJE = {
  type: "object",
  properties: {
    asunto: { type: "string", description: "Solo para correo; vacío para WhatsApp" },
    mensaje: { type: "string" },
  },
  required: ["asunto", "mensaje"],
  additionalProperties: false,
};

export async function redactar(opts: {
  anthropic: Pick<Anthropic, "beta">; db: SupabaseClient; perfil: Perfil; config: Config;
  clienteId: string; canal: "whatsapp" | "correo"; motivo: string;
}) {
  const historial = JSON.parse(await ejecutarHerramienta(opts.db, "historial_cliente", { cliente_id: opts.clienteId }));
  const contacto = revisar(await opts.db.from("contactos").select("nombre,puesto").eq("cliente_id", opts.clienteId)
    .order("principal", { ascending: false }).limit(1));
  const flujo = opts.anthropic.beta.messages.stream({
    model: opts.config.modelo,
    max_tokens: 4000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_MENSAJE } },
    system: sistema(opts.perfil),
    messages: [{
      role: "user",
      content: `Redacta un ${opts.canal === "whatsapp" ? "WhatsApp (máximo 5 renglones, sin asunto)" : "correo breve con asunto"} ` +
        `de ${opts.perfil.nombre} para este cliente. Motivo para escribirle: ${opts.motivo}\n` +
        `Contacto: ${JSON.stringify(contacto?.[0] ?? null)}\nHistorial:\n` + "```json\n" + JSON.stringify(historial).slice(0, 20000) + "\n```",
    }],
  });
  const r = await flujo.finalMessage();
  if (r.stop_reason === "refusal") throw new ErrorHerramienta("Claude no quiso redactar este mensaje.");
  const bloque = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!bloque || r.stop_reason === "max_tokens") throw new ErrorHerramienta("No salió el mensaje; intenta de nuevo.");
  return { ...(JSON.parse(bloque.text) as { asunto: string; mensaje: string }), modelo: r.model,
    entrada: r.usage.input_tokens, salida: r.usage.output_tokens, cache: r.usage.cache_read_input_tokens ?? 0 };
}

// -----------------------------------------------------------------------------
// Leer un documento de importación (PI, factura, packing list, BL, pedimento o
// cuenta de gastos) y devolver sus campos con un esquema estricto por tipo. No
// guarda nada: la pantalla lo muestra junto al archivo y Alondra lo confirma.
// Hoy esos datos se copian a mano de PDFs (a veces escaneados o en chino) a la
// hoja, a PRORRATEO.xlsx y a los correos con el agente.
// -----------------------------------------------------------------------------
export type TipoDocumento = "proforma" | "factura" | "lista_empaque" | "bl" | "pedimento" | "cuenta_gastos" | "cotizacion_proveedor" | "constancia_fiscal";
type Esquema = Record<string, unknown>;

// Un dato que no aparece en el documento va en null: nunca se inventa.
const nulo = (tipo: "string" | "number", descripcion: string): Esquema =>
  ({ anyOf: [{ type: tipo }, { type: "null" }], description: descripcion });
const fechaONulo = (descripcion: string): Esquema =>
  ({ anyOf: [{ type: "string", format: "date" }, { type: "null" }], description: `${descripcion} (AAAA-MM-DD)` });
const objeto = (propiedades: Record<string, Esquema>): Esquema =>
  ({ type: "object", properties: propiedades, required: Object.keys(propiedades), additionalProperties: false });
const lista = (items: Esquema, descripcion?: string): Esquema => ({ type: "array", items, ...(descripcion ? { description: descripcion } : {}) });
const advertencias = lista({ type: "string" }, "Lo que no se pudo leer, no cuadra (totales, cantidades) o hace dudar; vacío si todo está claro");

const PARTIDA = objeto({
  descripcion: nulo("string", "Descripción tal como viene"),
  modelo: nulo("string", "Modelo, marca o número de parte"),
  cantidad: nulo("number", "Cantidad"),
  unidad: nulo("string", "Unidad (pcs, set, m…)"),
  precio_unitario: nulo("number", "Precio unitario en la moneda del documento"),
  importe: nulo("number", "Importe de la partida"),
});

export const CONCEPTOS_GASTO = ["flete_internacional", "seguro", "cargos_locales", "revalidacion", "desconsolidacion", "maniobras",
  "almacenaje", "demoras", "limpieza", "honorarios", "flete_local", "grua", "impuestos", "anticipo", "otro"] as const;

export const DOCUMENTOS: Record<TipoDocumento, { nombre: string; esquema: Esquema; guia: string }> = {
  proforma: {
    nombre: "proforma invoice (PI)",
    guia: "Es la cotización formal del proveedor antes de pagar el anticipo.",
    esquema: objeto({
      numero: nulo("string", "Número de la PI"), fecha: fechaONulo("Fecha de la PI"), proveedor: nulo("string", "Razón social del vendedor"),
      incoterm: nulo("string", "Incoterm (FOB, CIF, CFR, EXW…)"), moneda: nulo("string", "Moneda (USD, EUR, CNY…)"),
      puerto_origen: nulo("string", "Puerto de carga"), condiciones_pago: nulo("string", "Condiciones de pago (30 % anticipo…)"),
      partidas: lista(PARTIDA), subtotal: nulo("number", "Subtotal"), total: nulo("number", "Total"), advertencias,
    }),
  },
  factura: {
    nombre: "commercial invoice",
    guia: "Es la factura comercial con la que se importa; el agente aduanal la compara con la PI y el packing list.",
    esquema: objeto({
      numero: nulo("string", "Número de factura"), fecha: fechaONulo("Fecha de la factura"), proveedor: nulo("string", "Vendedor"),
      comprador: nulo("string", "Comprador (debe ser la empresa o la persona que importa)"), incoterm: nulo("string", "Incoterm"),
      moneda: nulo("string", "Moneda"), puerto_origen: nulo("string", "Puerto de carga"), puerto_destino: nulo("string", "Puerto de destino"),
      partidas: lista(PARTIDA), total: nulo("number", "Total de la factura"), advertencias,
    }),
  },
  lista_empaque: {
    nombre: "packing list",
    guia: "Lista de empaque: bultos, pesos y volumen.",
    esquema: objeto({
      numero: nulo("string", "Número"), fecha: fechaONulo("Fecha"), bultos: nulo("number", "Total de bultos"),
      peso_bruto_kg: nulo("number", "Peso bruto total en kg"), peso_neto_kg: nulo("number", "Peso neto total en kg"),
      volumen_m3: nulo("number", "Volumen total en m³"),
      partidas: lista(objeto({
        descripcion: nulo("string", "Descripción"), cantidad: nulo("number", "Cantidad"), bultos: nulo("number", "Bultos"),
        peso_bruto_kg: nulo("number", "Peso bruto en kg"), volumen_m3: nulo("number", "Volumen en m³"),
      })), advertencias,
    }),
  },
  bl: {
    nombre: "conocimiento de embarque (BL) o aviso de arribo",
    guia: "BL (original, telex o seaway) o aviso de arribo de la naviera.",
    esquema: objeto({
      numero_bl: nulo("string", "Número de BL (master si hay dos)"),
      tipo: { anyOf: [{ type: "string", enum: ["original", "telex", "seaway", "draft"] }, { type: "null" }], description: "Tipo de BL" },
      naviera: nulo("string", "Naviera o NVOCC"), buque: nulo("string", "Buque"), viaje: nulo("string", "Viaje"),
      puerto_carga: nulo("string", "Puerto de carga"), puerto_descarga: nulo("string", "Puerto de descarga"),
      fecha_embarque: fechaONulo("Fecha de embarque (shipped on board)"), eta: fechaONulo("Fecha estimada de arribo, si viene"),
      consignatario: nulo("string", "Consignatario"),
      // Con estos dos el BL alcanza para dar de alta un embarque nuevo (qué viene y cómo).
      mercancia: nulo("string", "Descripción de la mercancía (description of goods), corta, traducida al español si viene en otro idioma"),
      modalidad: { anyOf: [{ type: "string", enum: ["fcl", "lcl"] }, { type: "null" }],
        description: "fcl si el contenedor completo es del consignatario (FCL/FCL, CY/CY); lcl si es carga consolidada (LCL, CFS/CFS, parte de un contenedor)" },
      // Texto y no null: la API acepta hasta 16 campos que pueden ser null en todo el
      // esquema y el BL ya usa los demás (registrar_documento_importacion ignora "").
      contenedores: lista(objeto({ numero: { type: "string", description: "Número de contenedor" },
        tipo: { type: "string", description: "Tipo (20GP, 40HC…); vacío si no viene" }, sello: { type: "string", description: "Sello; vacío si no viene" } })),
      bultos: nulo("number", "Bultos"), peso_kg: nulo("number", "Peso bruto en kg"), volumen_m3: nulo("number", "Volumen en m³"), advertencias,
    }),
  },
  pedimento: {
    nombre: "pedimento de importación",
    guia: "Pedimento pagado (simplificado o completo). IGI, DTA, IVA y PRV en pesos.",
    esquema: objeto({
      numero: nulo("string", "Número de pedimento (15 dígitos: año, aduana, patente, consecutivo)"), clave: nulo("string", "Clave (A1…)"),
      aduana: nulo("string", "Aduana"), fecha_pago: fechaONulo("Fecha de pago"), tipo_cambio: nulo("number", "Tipo de cambio del pedimento"),
      valor_aduana: nulo("number", "Valor en aduana en pesos"), igi: nulo("number", "IGI en pesos"), dta: nulo("number", "DTA en pesos"),
      iva: nulo("number", "IVA en pesos"), prv: nulo("number", "PRV en pesos"), otros: nulo("number", "Otras contribuciones en pesos"),
      total: nulo("number", "Total de contribuciones pagadas"),
      partidas: lista(objeto({
        fraccion: nulo("string", "Fracción arancelaria"), descripcion: nulo("string", "Descripción"),
        cantidad: nulo("number", "Cantidad"), valor_aduana: nulo("number", "Valor en aduana"),
      })), advertencias,
    }),
  },
  cuenta_gastos: {
    nombre: "cuenta de gastos del agente aduanal",
    guia: "Cuenta de gastos: lo que el agente pagó por cuenta de Hegamex, sus honorarios, los anticipos recibidos y el saldo.",
    esquema: objeto({
      folio: nulo("string", "Folio o número de la cuenta de gastos"), fecha: fechaONulo("Fecha"), agente: nulo("string", "Agencia aduanal"),
      referencia: nulo("string", "Referencia operativa del agente (LCM…, ZMZI…)"),
      conceptos: lista(objeto({
        descripcion: nulo("string", "Concepto tal como viene"),
        concepto: { type: "string", enum: [...CONCEPTOS_GASTO], description: "Clasificación: impuestos = los del pedimento; anticipo = lo que Hegamex le dio al agente" },
        monto: nulo("number", "Importe sin IVA en pesos"), iva: nulo("number", "IVA de ese concepto en pesos"),
      })),
      total: nulo("number", "Total de la cuenta"), anticipos: nulo("number", "Anticipos recibidos de Hegamex"),
      saldo: nulo("number", "Saldo: positivo si es a favor de Hegamex, negativo si Hegamex debe un complemento"), advertencias,
    }),
  },
  cotizacion_proveedor: {
    nombre: "cotización de un proveedor",
    guia: "Es la cotización que un proveedor le manda a Hegamex para venderle material, componentes o servicios: Hegamex compra, el proveedor es quien la emite. " +
      "El precio unitario va sin IVA y ya con descuentos; si la cotización trae precios con IVA, quítaselo y dilo en advertencias. " +
      "Los cargos aparte (flete, maniobras, instalación) van como una partida más.",
    esquema: objeto({
      proveedor: nulo("string", "Nombre o razón social de quien cotiza (no Hegamex)"),
      rfc: nulo("string", "RFC (o tax ID si es del extranjero) de quien cotiza"),
      numero: nulo("string", "Número o folio de la cotización"), fecha: fechaONulo("Fecha de la cotización"),
      vigencia: fechaONulo("Vigente hasta"),
      moneda: { anyOf: [{ type: "string", enum: ["MXN", "USD", "EUR"] }, { type: "null" }], description: "Moneda de los precios" },
      condiciones_pago: nulo("string", "Condiciones de pago tal como vienen (contado, 30 días, 50 % anticipo…)"),
      dias_entrega: nulo("number", "Tiempo de entrega en días hábiles; si viene en semanas, multiplícalo por 5"),
      // La descripción es texto obligatorio y no null: el esquema completo no puede pasar
      // de 16 campos que aceptan null (tope de la API).
      partidas: lista(objeto({
        descripcion: { type: "string", description: "Descripción tal como viene" },
        clave: nulo("string", "Clave, código o número de parte del proveedor"),
        cantidad: nulo("number", "Cantidad cotizada"), unidad: nulo("string", "Unidad (pza, m, kg, juego…)"),
        precio_unitario: nulo("number", "Precio unitario sin IVA y con descuento"),
      })),
      total: nulo("number", "Total de la cotización tal como viene (con o sin IVA, como lo traiga)"), advertencias,
    }),
  },
  constancia_fiscal: {
    nombre: "constancia de situación fiscal del SAT",
    guia: "Es la constancia de situación fiscal (cédula de identificación fiscal) de un cliente o proveedor de Hegamex. " +
      "razon_social va como la pide el CFDI 4.0: en persona moral la denominación SIN el régimen de capital (\"CONCRETOS DEL BAJIO\", no " +
      "\"CONCRETOS DEL BAJIO SA DE CV\"), y el régimen de capital aparte; en persona física, nombre(s) y apellidos en ese orden. " +
      "Mayúsculas y acentos tal como vienen. Cada régimen con su clave de 3 dígitos del catálogo del SAT (601, 612, 626…).",
    esquema: objeto({
      rfc: nulo("string", "RFC"),
      tipo_persona: { anyOf: [{ type: "string", enum: ["moral", "fisica"] }, { type: "null" }], description: "Persona moral o física" },
      razon_social: nulo("string", "Denominación o razón social sin régimen de capital; en persona física, nombre completo"),
      regimen_capital: nulo("string", "Régimen de capital (SA DE CV, S DE RL DE CV…); null en persona física"),
      nombre_comercial: nulo("string", "Nombre comercial, si viene"),
      codigo_postal: nulo("string", "Código postal del domicilio fiscal (5 dígitos)"),
      domicilio: nulo("string", "Calle, número exterior e interior y colonia, en una línea"),
      municipio: nulo("string", "Municipio o demarcación territorial"), estado: nulo("string", "Entidad federativa"),
      estatus: nulo("string", "Estatus en el padrón (ACTIVO, SUSPENDIDO…)"),
      fecha_emision: fechaONulo("Fecha en que se emitió la constancia"),
      regimenes: lista(objeto({
        clave: { type: "string", description: "Clave del régimen en el catálogo del SAT (3 dígitos)" },
        descripcion: { type: "string", description: "Nombre del régimen tal como viene" },
      }), "Regímenes fiscales vigentes; el principal primero"),
      advertencias,
    }),
  },
};

/**
 * Quién puede pedir leer cada documento (nivel 2 en alguno de los módulos): los de importación,
 * importaciones (compras también tiene nivel 2); la cotización, compras; la constancia, quien da
 * de alta clientes o proveedores.
 */
const IMPORTACION = { modulos: ["importaciones"], mensaje: "Leer documentos de importación es de importaciones y compras." };
const PERMISO_DOCUMENTO: Record<TipoDocumento, { modulos: string[]; mensaje: string }> = {
  proforma: IMPORTACION, factura: IMPORTACION, lista_empaque: IMPORTACION, bl: IMPORTACION, pedimento: IMPORTACION, cuenta_gastos: IMPORTACION,
  cotizacion_proveedor: { modulos: ["compras"], mensaje: "Leer cotizaciones de proveedores es de compras." },
  constancia_fiscal: { modulos: ["ventas", "compras"], mensaje: "Leer constancias fiscales es de quien da de alta clientes o proveedores." },
};

/** Revisa que lo que devolvió Claude cumpla el esquema antes de mostrarlo. Devuelve los errores. */
export function validarEsquema(valor: unknown, esquema: Esquema, ruta = "$"): string[] {
  if (Array.isArray(esquema.anyOf)) {
    const opciones = (esquema.anyOf as Esquema[]).map((e) => validarEsquema(valor, e, ruta));
    return opciones.some((e) => e.length === 0) ? [] : opciones[0];
  }
  const tipo = esquema.type;
  if (tipo === "null") return valor === null ? [] : [`${ruta} debe ser null`];
  if (tipo === "string") {
    if (typeof valor !== "string") return [`${ruta} debe ser texto`];
    if (Array.isArray(esquema.enum) && !esquema.enum.includes(valor)) return [`${ruta} no es un valor permitido`];
    if (esquema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return [`${ruta} no es una fecha AAAA-MM-DD`];
    return [];
  }
  if (tipo === "number") return typeof valor === "number" && Number.isFinite(valor) ? [] : [`${ruta} debe ser número`];
  if (tipo === "array") {
    if (!Array.isArray(valor)) return [`${ruta} debe ser lista`];
    return valor.flatMap((v, i) => validarEsquema(v, esquema.items as Esquema, `${ruta}[${i}]`));
  }
  if (tipo === "object") {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [`${ruta} debe ser objeto`];
    const props = esquema.properties as Record<string, Esquema>;
    const v = valor as Record<string, unknown>;
    return [
      ...Object.keys(props).filter((k) => !(k in v)).map((k) => `falta ${ruta}.${k}`),
      ...Object.keys(v).filter((k) => !(k in props)).map((k) => `sobra ${ruta}.${k}`),
      ...Object.keys(props).filter((k) => k in v).flatMap((k) => validarEsquema(v[k], props[k], `${ruta}.${k}`)),
    ];
  }
  return [];
}

export const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png"] as const;
type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];
const MAX_BASE64 = 20_000_000; // ~15 MB de archivo

export async function leerDocumento(opts: {
  anthropic: Pick<Anthropic, "beta">; perfil: Perfil; config: Config; tipo: TipoDocumento; mediaType: TipoArchivo; datos: string;
}) {
  const doc = DOCUMENTOS[opts.tipo];
  const archivo: Anthropic.Beta.BetaContentBlockParam = opts.mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.datos } }
    : { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.datos } };
  const flujo = opts.anthropic.beta.messages.stream({
    model: opts.config.modelo,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: opts.config.esfuerzo, format: { type: "json_schema", schema: doc.esquema } },
    system: sistema(opts.perfil),
    messages: [{
      role: "user",
      content: [archivo, {
        type: "text",
        text: `Este archivo debería ser una ${doc.nombre}. ${doc.guia} Extrae los campos del esquema. ` +
          "Copia solo lo que está escrito en el documento; si un dato no aparece o no se lee, pon null: no lo calcules ni lo supongas. " +
          "Fechas en AAAA-MM-DD; montos como número, sin símbolos ni separadores de miles. Si el documento está en inglés o en chino, " +
          "deja las descripciones como vienen. Si no es el tipo de documento esperado, o los totales no cuadran con las partidas, dilo en advertencias.",
      }],
    }],
  });
  const r = await flujo.finalMessage();
  if (r.stop_reason === "refusal") throw new ErrorHerramienta("Claude no quiso leer este documento. Captúralo a mano.");
  if (r.stop_reason === "max_tokens") throw new ErrorHerramienta("El documento es demasiado largo para leerlo de una vez: sube solo las páginas que importan.");
  const bloque = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!bloque) throw new ErrorHerramienta("Claude no devolvió los datos del documento.");
  let campos: unknown;
  try { campos = JSON.parse(bloque.text); } catch { throw new ErrorHerramienta("Claude devolvió algo que no se puede leer. Intenta de nuevo."); }
  const errores = validarEsquema(campos, doc.esquema);
  if (errores.length) {
    throw new ErrorHerramienta(`Claude devolvió datos que no cumplen el formato (${errores.slice(0, 3).join("; ")}). No se guardó nada: intenta de nuevo o captúralo a mano.`);
  }
  return { campos: campos as Record<string, unknown>, modelo: r.model, entrada: r.usage.input_tokens, salida: r.usage.output_tokens, cache: r.usage.cache_read_input_tokens ?? 0 };
}

/** Sin llave de Claude: un ejemplo con la forma de cada documento, marcado como tal. */
export function ejemploDocumento(tipo: TipoDocumento): Record<string, unknown> {
  const aviso = ["MODO DEMOSTRACIÓN: falta la llave de Claude. Estos datos son un ejemplo, no se leyeron de tu archivo."];
  const partida = (descripcion: string, modelo: string, cantidad: number, precio: number) =>
    ({ descripcion, modelo, cantidad, unidad: "pcs", precio_unitario: precio, importe: cantidad * precio });
  switch (tipo) {
    case "proforma":
      return { numero: "MEHE-20261001001", fecha: "2026-09-18", proveedor: "Yao Han Industries Co., Ltd.", incoterm: "CFR", moneda: "USD",
        puerto_origen: "Taichung", condiciones_pago: "50 % anticipo, 50 % antes del embarque",
        partidas: [partida("Portable bag closer", "N600A", 20, 160), partida("Sewing head", "F900A", 2, 1600)], subtotal: 6400, total: 6400, advertencias: aviso };
    case "factura":
      return { numero: "MEHE-20261001001", fecha: "2026-09-30", proveedor: "Yao Han Industries Co., Ltd.", comprador: "Máquinas y Herramientas Gamex",
        incoterm: "CFR", moneda: "USD", puerto_origen: "Taichung", puerto_destino: "Manzanillo",
        partidas: [partida("Portable bag closer", "N600A", 20, 160), partida("Sewing head", "F900A", 2, 1600)], total: 6400, advertencias: aviso };
    case "lista_empaque":
      return { numero: "PL-20261001001", fecha: "2026-09-30", bultos: 12, peso_bruto_kg: 486, peso_neto_kg: 432, volumen_m3: 2.1,
        partidas: [{ descripcion: "Portable bag closer N600A", cantidad: 20, bultos: 10, peso_bruto_kg: 280, volumen_m3: 1.2 },
                   { descripcion: "Sewing head F900A", cantidad: 2, bultos: 2, peso_bruto_kg: 206, volumen_m3: 0.9 }], advertencias: aviso };
    case "bl":
      return { numero_bl: "800610246498", tipo: "telex", naviera: "TS Lines", buque: "TS Hongkong", viaje: "24019E", puerto_carga: "Kaohsiung",
        puerto_descarga: "Manzanillo", fecha_embarque: "2026-09-16", eta: "2026-10-12", consignatario: "Máquinas y Herramientas Gamex",
        mercancia: "Cosedoras portátiles y cabezales cosedores", modalidad: "fcl",
        contenedores: [{ numero: "TCLU1234567", tipo: "20GP", sello: "TS445566" }], bultos: 12, peso_kg: 486, volumen_m3: 2.1, advertencias: aviso };
    case "pedimento":
      return { numero: "26 16 1943 6004373", clave: "A1", aduana: "Manzanillo", fecha_pago: "2026-09-22", tipo_cambio: 18.92,
        valor_aduana: 127400, igi: 6370, dta: 1100, iva: 21476, prv: 304, otros: 0, total: 29250,
        partidas: [{ fraccion: "84522101", descripcion: "Máquinas de coser costales", cantidad: 22, valor_aduana: 127400 }], advertencias: aviso };
    case "cuenta_gastos":
      return { folio: "LCM2311-CG", fecha: "2026-09-29", agente: "Agencia Aduanal Careaga", referencia: "LCM2311-2026",
        conceptos: [
          { descripcion: "Impuestos pagados (pedimento)", concepto: "impuestos", monto: 29250, iva: 0 },
          { descripcion: "Honorarios", concepto: "honorarios", monto: 6500, iva: 1040 },
          { descripcion: "Maniobras y revalidación", concepto: "maniobras", monto: 3200, iva: 512 },
        ], total: 40502, anticipos: 59127.03, saldo: 18625.03, advertencias: aviso };
    case "cotizacion_proveedor":
      return { proveedor: "Rodamientos y Bandas del Bajío SA de CV", rfc: "RBB980512KZ3", numero: "COT-4471", fecha: "2026-10-08",
        vigencia: "2026-10-23", moneda: "MXN", condiciones_pago: "Crédito a 30 días", dias_entrega: 3,
        partidas: [
          { descripcion: "Rodamiento rígido de bolas 6205 2RS", clave: "6205-2RS", cantidad: 20, unidad: "pza", precio_unitario: 86.5 },
          { descripcion: "Chumacera de piso UCP 205", clave: "UCP205", cantidad: 8, unidad: "pza", precio_unitario: 312 },
          { descripcion: "Flete a planta", clave: null, cantidad: 1, unidad: "servicio", precio_unitario: 450 },
        ], total: 7166.2, advertencias: aviso };
    case "constancia_fiscal":
      return { rfc: "CBA160202AB1", tipo_persona: "moral", razon_social: "CONCRETOS DEL BAJIO", regimen_capital: "SA DE CV",
        nombre_comercial: null, codigo_postal: "47750", domicilio: "AV. INDUSTRIAL 455 INT. 2, COL. EL SALTO", municipio: "ATOTONILCO EL ALTO",
        estado: "JALISCO", estatus: "ACTIVO", fecha_emision: "2026-09-30",
        regimenes: [{ clave: "601", descripcion: "Régimen General de Ley Personas Morales" }], advertencias: aviso };
  }
}

// -----------------------------------------------------------------------------
// La puerta: autentica, revisa cupo, despacha y registra el uso.
// -----------------------------------------------------------------------------
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function atender(req: Request, entorno: Entorno): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesión" }, 401);
  const db = createClient(entorno.supabaseUrl, entorno.supabaseAnonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: eu } = await db.auth.getUser(auth.slice(7));
  if (eu || !u.user) return json({ error: "Sesión no válida" }, 401);

  const [{ data: perfilFila }, { data: roles }, { data: puede }, { data: cfg }] = await Promise.all([
    db.from("perfiles").select("nombre").eq("id", u.user.id).maybeSingle(),
    db.rpc("mis_roles"),
    db.rpc("puede", { p_modulo: "asistente", p_nivel: 1 }),
    db.from("configuracion").select("valor").eq("clave", "asistente").maybeSingle(),
  ]);
  if (!puede) return json({ error: "Tu rol no tiene acceso al asistente." }, 403);
  const perfil: Perfil = { id: u.user.id, nombre: (perfilFila as { nombre?: string } | null)?.nombre ?? "", roles: (roles as string[] | null) ?? [] };
  const valor = ((cfg as { valor?: Record<string, unknown> } | null)?.valor ?? {}) as Record<string, string>;
  const config: Config = { modelo: valor.modelo || "claude-opus-5-5", esfuerzo: (valor.esfuerzo as Config["esfuerzo"]) || "medium" };

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: "Cuerpo inválido" }, 400); }
  const modo = texto(cuerpo.modo);
  const area: Area = AREAS.includes(cuerpo.area as Area) ? (cuerpo.area as Area) : "direccion";

  const anthropic = entorno.crearAnthropic?.() ?? (entorno.anthropicKey ? new Anthropic({ apiKey: entorno.anthropicKey }) : null);
  const registrar = (r: { modelo?: string; entrada?: number; salida?: number; cache?: number; herramientas?: string[]; error?: string }) =>
    db.from("asistente_uso").insert({
      modo, area: modo === "resumen" ? area : null, modelo: r.modelo ?? null, entrada_tokens: r.entrada ?? null,
      salida_tokens: r.salida ?? null, cache_tokens: r.cache ?? null, herramientas: r.herramientas ?? null, error: r.error ?? null,
    }).then(() => undefined);

  // Cupo: solo cuenta lo que cuesta. El modo demostración no gasta nada.
  if (anthropic && !((modo === "resumen" || modo === "semana") && cuerpo.forzar !== true)) {
    const { data: cupo } = await db.rpc("asistente_cupo");
    if (typeof cupo === "number" && cupo <= 0)
      return json({ error: "Ya usaste tus consultas de hoy. Mañana se renuevan; si te hacen falta más, pídelo a sistemas." }, 429);
  }

  try {
    if (modo === "resumen") {
      if (cuerpo.forzar !== true) {
        const { data: guardado } = await db.from("asistente_resumenes").select("contenido,modelo,generado_en")
          .eq("area", area).maybeSingle();
        const g = guardado as { contenido: Resumen; modelo: string | null; generado_en: string } | null;
        // Un resumen de las últimas 6 horas sirve; después, otro.
        if (g && Date.now() - new Date(g.generado_en).getTime() < 6 * 3600_000 && (g.modelo || !anthropic) && mismaVista(g.contenido, perfil))
          return json({ ...g.contenido, generado_en: g.generado_en, simulado: !g.modelo, guardado: true });
      }
      if (!anthropic) {
        const r = await resumenSinIA(db, area);
        return json({ ...r, generado_en: new Date().toISOString(), simulado: true });
      }
      const { data: cupo } = await db.rpc("asistente_cupo");
      if (typeof cupo === "number" && cupo <= 0) {
        const r = await resumenSinIA(db, area);
        return json({ ...r, generado_en: new Date().toISOString(), simulado: true, aviso: "Sin consultas de Claude por hoy: estos son los hallazgos de la base." });
      }
      const r = await resumir({ anthropic, db, perfil, config, area });
      await Promise.all([
        registrar(r),
        db.from("asistente_resumenes").upsert({ usuario_id: perfil.id, area, contenido: { ...r.resumen, roles: vista(perfil) }, modelo: r.modelo,
          generado_en: new Date().toISOString() }),
      ]);
      return json({ ...r.resumen, generado_en: new Date().toISOString(), modelo: r.modelo });
    }

    if (modo === "semana") {
      const numeros = revisar(await db.rpc("semana_en_numeros")) as NumerosSemana;
      const lunes = numeros.semana.lunes;
      if (cuerpo.forzar !== true) {
        const { data: guardado } = await db.from("asistente_resumenes").select("contenido,modelo,generado_en")
          .eq("area", "semana").maybeSingle();
        const g = guardado as { contenido: Resumen & { lunes?: string; roles?: string }; modelo: string | null; generado_en: string } | null;
        // Uno por semana: los números de la semana pasada ya no cambian.
        if (g && g.contenido.lunes === lunes && (g.modelo || !anthropic) && mismaVista(g.contenido, perfil))
          return json({ ...g.contenido, numeros, generado_en: g.generado_en, simulado: !g.modelo, guardado: true });
      }
      const { data: cupo } = anthropic ? await db.rpc("asistente_cupo") : { data: 0 };
      if (!anthropic || (typeof cupo === "number" && cupo <= 0))
        return json({ ...semanaSinIA(numeros), numeros, generado_en: new Date().toISOString(), simulado: true,
          ...(anthropic ? { aviso: "Sin consultas de Claude por hoy: estos son los números de la base." } : {}) });
      const r = await resumirSemana({ anthropic, perfil, config, numeros });
      await Promise.all([
        registrar(r),
        db.from("asistente_resumenes").upsert({ usuario_id: perfil.id, area: "semana", contenido: { ...r.resumen, lunes, roles: vista(perfil) }, modelo: r.modelo,
          generado_en: new Date().toISOString() }),
      ]);
      return json({ ...r.resumen, numeros, generado_en: new Date().toISOString(), modelo: r.modelo });
    }

    if (modo === "redactar") {
      if (!esUuid(cuerpo.cliente_id)) return json({ error: "Falta el cliente" }, 400);
      const canal = cuerpo.canal === "correo" ? "correo" : "whatsapp";
      const motivo = texto(cuerpo.motivo).slice(0, 600) || "darle seguimiento";
      if (!anthropic) {
        return json({
          simulado: true, asunto: canal === "correo" ? "Seguimiento de Hegamex" : "",
          // El motivo es para el vendedor ("compra cada ~120 días…"), no para el cliente: no va en el texto.
          mensaje: `Hola, ¿cómo está? Le saluda ${perfil.nombre || "su asesor"} de Hegamex. Quería saber cómo le ha funcionado su equipo ` +
            "y si le hace falta alguna refacción o tiene algún proyecto en puerta. Con gusto le preparo una cotización.",
        });
      }
      const r = await redactar({ anthropic, db, perfil, config, clienteId: cuerpo.cliente_id as string, canal, motivo });
      await registrar(r);
      return json({ asunto: r.asunto, mensaje: r.mensaje, modelo: r.modelo });
    }

    if (modo === "leer_documento") {
      const tipo = texto(cuerpo.tipo) as TipoDocumento;
      if (!(tipo in DOCUMENTOS)) return json({ error: "Tipo de documento desconocido" }, 400);
      const mediaType = texto(cuerpo.media_type) as TipoArchivo;
      if (!TIPOS_ARCHIVO.includes(mediaType)) return json({ error: "Claude lee PDF, JPG o PNG" }, 400);
      const datos = texto(cuerpo.datos);
      if (!datos || !/^[A-Za-z0-9+/]+=*$/.test(datos)) return json({ error: "Falta el archivo" }, 400);
      if (datos.length > MAX_BASE64) return json({ error: "El archivo pesa más de 15 MB: sube solo las páginas que importan." }, 413);
      const permiso = PERMISO_DOCUMENTO[tipo];
      const permisos = await Promise.all(permiso.modulos.map((m) => db.rpc("puede", { p_modulo: m, p_nivel: 2 })));
      if (!permisos.some((r) => r.data === true)) return json({ error: permiso.mensaje }, 403);
      if (!anthropic) return json({ tipo, campos: ejemploDocumento(tipo), simulado: true });
      const r = await leerDocumento({ anthropic, perfil, config, tipo, mediaType, datos });
      await registrar(r);
      return json({ tipo, campos: r.campos, modelo: r.modelo });
    }

    if (modo === "chat") {
      const mensajes =(Array.isArray(cuerpo.mensajes) ? cuerpo.mensajes : [])
        .filter((m): m is MensajeChat => !!m && typeof (m as MensajeChat).texto === "string")
        .map((m) => ({ rol: m.rol === "asistente" ? "asistente" as const : "usuario" as const, texto: m.texto }));
      const ruta = texto(cuerpo.ruta).slice(0, 80) || undefined;
      const codificador = new TextEncoder();
      const cuerpoSSE = new ReadableStream<Uint8Array>({
        async start(ctrl) {
          const emitir = (e: Evento) => ctrl.enqueue(codificador.encode(`data: ${JSON.stringify(e)}\n\n`));
          try {
            if (!anthropic) {
              const r = await resumenSinIA(db, ruta?.startsWith("/ventas") ? "ventas" : "direccion");
              emitir({ tipo: "texto", texto:
                "Estoy en **modo demostración**: falta conectar la llave de Claude (`ANTHROPIC_API_KEY`), así que todavía no puedo contestar preguntas abiertas.\n\n" +
                "Mientras, esto es lo que la base marca hoy:\n\n" + r.puntos.map((p) => `- **${p.titulo}.** ${p.detalle} [Ver](${p.ruta})`).join("\n") });
              emitir({ tipo: "fin", modelo: "demostracion", simulado: true });
            } else {
              const uso = await conversar({ anthropic, db, perfil, config, mensajes, ruta, emitir });
              await registrar(uso);
              emitir({ tipo: "fin", modelo: uso.modelo });
            }
          } catch (e) {
            const x = explicarError(e);
            await registrar({ error: x.codigo });
            emitir({ tipo: "error", ...x });
          } finally {
            ctrl.close();
          }
        },
      });
      return new Response(cuerpoSSE, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }

    return json({ error: `Modo desconocido: ${modo}` }, 400);
  } catch (e) {
    const x = explicarError(e);
    if (anthropic) await registrar({ error: x.codigo });
    return json({ error: x.mensaje, codigo: x.codigo }, x.codigo === "datos" ? 400 : 502);
  }
}

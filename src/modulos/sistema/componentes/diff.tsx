import { fecha, fechaYHora, numero } from "@/lib/formato";
import { NOMBRE_ROL, type Rol } from "@/lib/sesion";

/** Nombre legible de cada tabla auditada. Una tabla nueva sin nombre aquí sale con su nombre técnico. */
export const TABLAS: Record<string, string> = {
  articulos: "Artículos", bom_lineas: "Listas de materiales", politicas_precio: "Políticas de precio", tarifas_mano_obra: "Tarifas de mano de obra",
  proveedores: "Proveedores", clientes: "Clientes", cotizaciones: "Cotizaciones", pedidos: "Pedidos", cobros: "Cobros", facturas: "Facturas",
  comision_ajustes: "Ajustes de comisión", plan_escalones: "Escalones de comisión", ordenes_compra: "Órdenes de compra",
  pagos_proveedor: "Pagos a proveedores", almacenes: "Almacenes", ajustes_inventario: "Ajustes de inventario",
  ordenes_produccion: "Órdenes de producción", op_materiales: "Material de órdenes", empleados: "Empleados",
  empleado_datos: "Datos sensibles de empleados", incidencias: "Vacaciones e incidencias", departamentos: "Departamentos",
  perfiles: "Usuarios", usuario_roles: "Roles de usuario", permisos_rol: "Permisos por rol", invitaciones: "Invitaciones",
  configuracion: "Configuración", etapas: "Etapas del taller", tipos_cambio: "Tipos de cambio", textos_comerciales: "Textos comerciales",
  planes_meses: "Planes de meses", canales: "Canales de venta", simulacion_rol: "Ver como otro rol",
};
export const nombreTabla = (t: string) => TABLAS[t] ?? t.replace(/_/g, " ");

const COLUMNAS: Record<string, string> = {
  id: "Id", nombre: "Nombre", activo: "Activo", activa: "Activa", estado: "Estado", total: "Total", subtotal: "Subtotal", iva: "IVA",
  monto: "Monto", fecha: "Fecha", folio: "Folio", puesto: "Puesto", correo: "Correo", telefono: "Teléfono", rol: "Rol", roles: "Roles",
  modulo: "Módulo", nivel: "Nivel", valor: "Valor", clave: "Clave", descripcion: "Descripción", precio: "Precio", costo: "Costo",
  cantidad: "Cantidad", motivo: "Motivo", notas: "Notas", referencia: "Referencia", metodo: "Método", inicio: "Desde", fin: "Hasta",
  dias: "Días", horas: "Horas", tipo: "Tipo", salario_diario: "Salario diario", curp: "CURP", rfc: "RFC", nss: "NSS",
  cuenta_bancaria: "Cuenta bancaria", domicilio: "Domicilio", fecha_ingreso: "Fecha de ingreso", fecha_nacimiento: "Fecha de nacimiento",
  baja_en: "Fecha de baja", motivo_baja: "Motivo de baja", departamento_id: "Departamento", etapa_id: "Área de piso",
  usuario_id: "Usuario", desde: "Desde", vendedor_id: "Vendedor", cliente_id: "Cliente", proveedor_id: "Proveedor", pedido_id: "Pedido",
  orden_compra_id: "Orden de compra", empleado_id: "Empleado", resuelta_por: "Resuelta por", solicitada_por: "Solicitada por",
  registrado_por: "Registrado por", creado_por: "Creado por", invitado_por: "Invitado por", uuid_sat: "UUID del SAT",
  vence_pago: "Vence el pago", tipo_cambio: "Tipo de cambio", moneda: "Moneda", comision_pct: "Comisión", cuota_fija: "Cuota fija",
  umbral_cuota_fija: "Umbral de cuota fija", costo_envio: "Costo de envío", tasa: "Tasa", etiqueta: "Etiqueta", meses: "Meses",
  orden: "Orden", color: "Color", capacidad_horas_semana: "Capacidad (h/semana)", por_defecto: "Por defecto", texto: "Texto",
  disponible_para_planta: "Disponible para planta", utilidad: "Utilidad", razon_social: "Razón social", ciudad: "Ciudad",
  dias_credito: "Días de crédito", numero: "Número", contacto_emergencia: "Contacto de emergencia", fecha_compromiso: "Fecha compromiso",
  factura_proveedor: "Factura del proveedor", fuente: "Fuente", canal: "Canal", iniciales: "Iniciales", costo_hora: "Costo por hora",
  fecha_entrega: "Fecha de entrega", condiciones_pago: "Condiciones de pago", motivo_cancelacion: "Motivo de cancelación",
};
export function nombreColumna(c: string): string {
  if (COLUMNAS[c]) return COLUMNAS[c];
  if (/_en$/.test(c)) return nombreColumna(c.replace(/_en$/, "")) + " (cuándo)";
  const t = c.replace(/_id$/, "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ES_MOMENTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Un valor guardado en la bitácora, como lo leería una persona. `personas` traduce ids de usuario a nombres. */
export function valorLegible(v: unknown, columna: string, personas: Map<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return numero(v);
  if (Array.isArray(v)) {
    if (columna === "roles") return v.map((r) => NOMBRE_ROL[r as Rol] ?? String(r)).join(", ") || "—";
    return v.map((x) => valorLegible(x, "", personas)).join(", ") || "—";
  }
  if (typeof v === "object") return JSON.stringify(v).replace(/[{}"]/g, "").replace(/,/g, ", ").replace(/:/g, ": ");
  const s = String(v);
  if (columna === "rol") return NOMBRE_ROL[s as Rol] ?? s;
  if (ES_UUID.test(s)) return personas.get(s) ?? `${s.slice(0, 8)}…`;
  if (ES_FECHA.test(s)) return fecha(s);
  if (ES_MOMENTO.test(s)) return fechaYHora(s);
  // Valores de catálogo ("permiso_con_goce", "aprobada") como se dicen.
  if (/^[a-z]+(_[a-z]+)*$/.test(s) && columna !== "correo") return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, " ");
  if (/^-?\d+(\.\d+)?$/.test(s) && columna !== "numero" && columna !== "folio" && !/^0\d/.test(s)) return numero(Number(s));
  return s;
}

export type Cambios = Record<string, unknown> | null;

/** La bitácora guarda {col: [antes, después]}; las bajas viejas guardaban el renglón completo. Se aceptan las dos. */
export function filasDiff(cambios: Cambios, accion: string) {
  if (!cambios) return [];
  return Object.entries(cambios)
    // El id es el propio registro (ya está en el encabezado); las fechas de sistema no dicen nada.
    .filter(([k]) => !["id", "creado_en", "actualizado_en"].includes(k))
    .sort(([a], [b]) => nombreColumna(a).localeCompare(nombreColumna(b), "es"))
    .map(([k, v]) => {
      if (Array.isArray(v) && v.length === 2) return { columna: k, antes: v[0], despues: v[1] };
      return accion === "baja" ? { columna: k, antes: v, despues: null } : { columna: k, antes: null, despues: v };
    });
}

/** Algo para reconocer el registro cuando ya no existe o no se puede ver: su nombre, folio o clave en el propio cambio. */
export function etiquetaDeCambios(cambios: Cambios) {
  if (!cambios) return null;
  for (const k of ["folio", "nombre", "clave", "correo", "texto", "etiqueta"]) {
    const v = cambios[k];
    const x = Array.isArray(v) ? v[1] ?? v[0] : v;
    if (x != null && typeof x !== "object") return String(x).slice(0, 60);
  }
  return null;
}

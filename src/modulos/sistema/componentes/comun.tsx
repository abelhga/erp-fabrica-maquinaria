import type { Modulo, Rol } from "@/lib/sesion";

/** Qué hace cada rol, en palabras de la empresa. Los permisos exactos están en la matriz. */
export const ROLES: { rol: Rol; descripcion: string }[] = [
  { rol: "direccion", descripcion: "Ve y edita todo, incluidos costos y márgenes. Solo dirección da este rol." },
  { rol: "admin", descripcion: "Sistemas: usuarios, configuración e importaciones. No ve costos ni sueldos." },
  { rol: "gerente_ventas", descripcion: "Autoriza precios y ve las cotizaciones y pedidos de todos." },
  { rol: "ventas", descripcion: "Sus clientes, cotizaciones y pedidos. Ve precios, nunca costos." },
  { rol: "ingenieria", descripcion: "Equipos, listas de materiales y costeo." },
  { rol: "compras", descripcion: "Órdenes de compra, proveedores y costos de compra." },
  { rol: "almacen", descripcion: "Existencias, entradas, salidas, traspasos y conteos." },
  { rol: "gerente_produccion", descripcion: "Órdenes de producción, taller y su personal (sin datos sensibles)." },
  { rol: "produccion", descripcion: "Supervisores de piso: terminal y avance de órdenes." },
  { rol: "rrhh", descripcion: "Personal, vacaciones e incidencias, con CURP, salario y cuentas." },
  { rol: "finanzas", descripcion: "Cobranza, pagos a proveedores y pago de comisiones." },
  { rol: "pantalla", descripcion: "TV del taller: entra directo al tablero de piso y no ve nada más." },
  { rol: "importaciones", descripcion: "Embarques, documentos con el agente aduanal, pagos en dólares y costo puesto en planta." },
];

export const MODULOS: { modulo: Modulo; nombre: string; descripcion: string; alerta?: string }[] = [
  { modulo: "ventas", nombre: "Ventas", descripcion: "Clientes, cotizaciones, pedidos y comisiones. 2: captura lo suyo · 3: autoriza precios y ve lo de todos." },
  { modulo: "costeo", nombre: "Ingeniería", descripcion: "Equipos, subensambles y listas de materiales, sin costos. 2: edita listas." },
  { modulo: "costos", nombre: "Costos", descripcion: "Costos de compra, mano de obra, márgenes y políticas de precio.",
    alerta: "Quien tenga Costos, aunque sea en nivel 1, ve lo que cuesta cada equipo y el margen de cada venta. Ventas nunca debe tenerlo." },
  { modulo: "compras", nombre: "Compras", descripcion: "Proveedores, órdenes de compra y requisiciones. 2: captura · 3: autoriza." },
  { modulo: "inventario", nombre: "Almacén", descripcion: "Existencias y movimientos. 2: entradas y salidas · 3: autoriza ajustes." },
  { modulo: "produccion", nombre: "Producción", descripcion: "1: ver el avance (lo tienen los vendedores) · 2: personal de piso · 3: gerencia." },
  { modulo: "rrhh", nombre: "Recursos humanos", descripcion: "Personal y vacaciones. 3: además CURP, RFC, NSS, salario y cuenta bancaria." },
  { modulo: "finanzas", nombre: "Finanzas", descripcion: "Cobranza y pagos. 2: registra cobros, facturas y pagos." },
  { modulo: "objetivos", nombre: "Objetivos", descripcion: "1: ve y califica solo a su gente (jefe directo) · 3: todos, plantillas, revisión y ajustes. Sin montos." },
  { modulo: "nomina", nombre: "Nómina", descripcion: "Sueldos, prenómina, préstamos y el bono en pesos. 2: captura conceptos · 3: cierra la semana y registra sueldos.",
    alerta: "Quien tenga Nómina, aunque sea en nivel 1, ve lo que gana cada persona. Los jefes califican con Objetivos sin necesitarla." },
  { modulo: "admin", nombre: "Sistema", descripcion: "1: ver la bitácora · 3: usuarios, roles, invitaciones y configuración." },
  { modulo: "importaciones", nombre: "Importaciones", descripcion: "1: ver embarques y cuándo llegan (montos solo con compras, finanzas o costos) · 2: capturar · 3: administrar." },
];

export const NIVELES = [
  { nivel: 0, texto: "—", largo: "Sin acceso" },
  { nivel: 1, texto: "Ver", largo: "Ver" },
  { nivel: 2, texto: "Capturar", largo: "Ver y capturar" },
  { nivel: 3, texto: "Administrar", largo: "Administrar (aprobar, borrar, configurar)" },
];

/** Contraseña legible para dictarla en la TV: sin 0/O ni 1/l. */
export function contrasenaNueva() {
  const letras = "abcdefghjkmnpqrstuvwxyz", numeros = "23456789";
  const al = (s: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => s[x % s.length]).join("");
  return `${al(letras, 4)}-${al(numeros, 4)}-${al(letras, 4)}`;
}

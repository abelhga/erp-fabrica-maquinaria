import type { Modulo, Rol } from "@/lib/sesion";

/** Qué hace cada rol, en palabras de la empresa. Los permisos exactos están en la matriz. */
export const ROLES: { rol: Rol; descripcion: string }[] = [
  { rol: "direccion", descripcion: "Ve y edita todo, incluidos costos y márgenes. Solo dirección da este rol." },
  { rol: "admin", descripcion: "Sistemas: usuarios, configuración e importaciones. No ve costos ni sueldos." },
  { rol: "gerente_ventas", descripcion: "Autoriza precios y ve las cotizaciones y pedidos de todos." },
  { rol: "ventas", descripcion: "Sus clientes, cotizaciones y pedidos. Ve precios, nunca costos." },
  { rol: "ingenieria", descripcion: "Equipos, listas de materiales y costeo. No ve precios de venta ni márgenes." },
  { rol: "compras", descripcion: "Órdenes de compra, proveedores y costos de compra." },
  { rol: "almacen", descripcion: "Existencias, entradas, salidas, traspasos y conteos. Ve folio, cliente y partidas de los pedidos para surtir y enviar, sin montos ni costos." },
  { rol: "gerente_produccion", descripcion: "Órdenes de producción, taller y su personal (sin datos sensibles). Ve de qué pedido y cliente es cada orden, sin montos." },
  { rol: "produccion", descripcion: "Supervisores de piso: terminal y avance de órdenes." },
  { rol: "rrhh", descripcion: "Personal, vacaciones e incidencias, con CURP, salario y cuentas." },
  { rol: "finanzas", descripcion: "Cobranza, pagos a proveedores y pago de comisiones." },
  { rol: "administracion", descripcion: "Gerencia administrativa: lo mismo que finanzas (cobranza, pagos, caja chica), sin ver las comisiones de los vendedores." },
  { rol: "pantalla", descripcion: "TV del taller: entra directo al tablero de piso y no ve nada más." },
  { rol: "terminal", descripcion: "Tablet del taller: entra directo a la terminal de piso para marcar el avance de las etapas y reportar fallas de máquinas. No ve nada más." },
  { rol: "recepcion", descripcion: "Contesta el teléfono: registra leads para ventas, ve si quien llama ya es cliente y de quién, y ve el catálogo con precios de lista. No ve clientes, ventas ni costos." },
  { rol: "mantenimiento", descripcion: "Máquinas y herramienta del taller: programa preventivo, fallas, checklist, refacciones y préstamo de herramienta. Ve el avance del taller y las existencias; no ve ventas, clientes ni costos de equipos." },
  { rol: "ingenieria_procesos", descripcion: "Ingeniería de procesos (lean): métricas de la planta, el taller, las cuadrillas y las horas de cada etapa. Ve costos para medir el costo del desperdicio; no ve márgenes ni precios de venta." },
  { rol: "marketing", descripcion: "Marketing: el catálogo con precios de lista (y pone sus fotos), todos los leads y a quién le llegan, y Mercado Libre (preguntas y publicaciones). No ve clientes, cotizaciones, pedidos, costos ni márgenes." },
  { rol: "importaciones", descripcion: "Embarques, documentos con el agente aduanal, pagos en dólares y costo puesto en planta." },
];

export const MODULOS: { modulo: Modulo; nombre: string; descripcion: string; alerta?: string }[] = [
  { modulo: "ventas", nombre: "Ventas", descripcion: "Clientes, cotizaciones, pedidos y la comisión propia. 2: captura lo suyo · 3: autoriza precios y ve lo de todos." },
  { modulo: "costeo", nombre: "Ingeniería", descripcion: "Equipos, subensambles y listas de materiales, sin costos. 2: edita listas." },
  { modulo: "costos", nombre: "Costos", descripcion: "Costos de compra y de mano de obra. 2: captura costos · 3: tarifas de mano de obra.",
    alerta: "Quien tenga Costos, aunque sea en nivel 1, ve lo que cuesta cada equipo. Ventas nunca debe tenerlo." },
  { modulo: "margenes", nombre: "Márgenes", descripcion: "Utilidad, políticas de precio y la fórmula del precio. 2: fija el margen de un artículo · 3: cambia políticas e ISR.",
    alerta: "Quien tenga Márgenes ve cuánto se gana en cada equipo. Ni ventas ni compras lo necesitan." },
  { modulo: "compras", nombre: "Compras", descripcion: "Proveedores, órdenes de compra y requisiciones. 2: captura · 3: autoriza." },
  { modulo: "inventario", nombre: "Almacén", descripcion: "Existencias y movimientos. 2: entradas y salidas · 3: autoriza ajustes." },
  { modulo: "produccion", nombre: "Producción", descripcion: "1: ver el avance de las órdenes, sin lista de materiales, horas ni planos (lo tienen los vendedores) · 2: personal de piso: también cómo se fabrica, y todos los pedidos sin montos · 3: gerencia." },
  { modulo: "rrhh", nombre: "Recursos humanos", descripcion: "Personal y vacaciones. 3: además CURP, RFC, NSS, salario y cuenta bancaria." },
  { modulo: "finanzas", nombre: "Finanzas", descripcion: "Cobranza y pagos. 2: registra cobros, facturas y pagos." },
  { modulo: "comisiones", nombre: "Comisiones", descripcion: "1: ve las comisiones de todos los vendedores (cada vendedor ve la suya sin este permiso) · 2: las marca pagadas." },
  { modulo: "objetivos", nombre: "Objetivos", descripcion: "1: ve y califica solo a su gente (jefe directo) · 3: todos, plantillas, revisión y ajustes. Sin montos." },
  { modulo: "nomina", nombre: "Nómina", descripcion: "Sueldos, prenómina, préstamos y el bono en pesos. 2: captura conceptos · 3: cierra la semana y registra sueldos.",
    alerta: "Quien tenga Nómina, aunque sea en nivel 1, ve lo que gana cada persona. Los jefes califican con Objetivos sin necesitarla." },
  { modulo: "servicio", nombre: "Servicio", descripcion: "Servicio postventa a clientes: instalaciones, garantías y cuadrillas. 2: pedir servicios · 3: programar y cerrar." },
  { modulo: "mantenimiento", nombre: "Mantenimiento", descripcion: "Máquinas y herramienta del taller. 1: ver · 2: reportar fallas y subir fotos (con Producción 2 también atiende y presta herramienta) · 3: administrar el programa y cerrar órdenes." },
  { modulo: "catalogo", nombre: "Catálogo", descripcion: "1: ver lo que se vende con foto, descripción, precio de lista y existencia (recepción y ventas) · 2: poner la foto (marketing). Sin listas de materiales, planos, proveedores ni costos (eso es Ingeniería).",
    alerta: "Los precios de venta los ve quien tiene Ventas, Catálogo, Márgenes o Finanzas; ningún otro puesto." },
  { modulo: "leads", nombre: "Leads", descripcion: "Recados de gente interesada que capturan recepción y ventas. 1: ver los suyos · 2: capturar y tomar · 3: asignar, ver todos y decidir a quién le llegan." },
  { modulo: "mercadolibre", nombre: "Mercado Libre", descripcion: "Preguntas de compradores y publicaciones de ML. 1: ver · 2: contestar preguntas y ligar publicaciones a su artículo. El dinero de cada venta es de Ventas y Finanzas." },
  { modulo: "procesos", nombre: "Ingeniería de procesos", descripcion: "Métricas de la planta (entregas a tiempo, lead time, eficiencia del flujo, horas reales contra estimadas, paros y mantenimiento). Los costos dentro de las métricas solo los ve quien además tiene Costos. 3: administrar las herramientas lean cuando se habiliten." },
  { modulo: "asistente", nombre: "Asistente (Claude)", descripcion: "1: Claude escribe su resumen «Lo que importa hoy» y puede hacerle preguntas con «Pregúntale al ERP» (solo sobre lo que su puesto ya puede ver) · 3: además lee las conversaciones de los demás. Sin este permiso, el resumen sale con reglas fijas y sin chat.",
    alerta: "Cada pregunta y cada resumen de Claude gasta crédito de la API." },
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

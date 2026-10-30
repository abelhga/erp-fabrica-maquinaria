import type { AyudaPantalla } from "./index";

export const COMPRAS: Record<string, AyudaPantalla> = {
  "/compras/solicitudes": [
    "La cola de precios que piden los vendedores desde sus cotizaciones. Antes era «¿me ayudas a cotizar esta polea?» en el chat; aquí se ve qué sigue abierto, quién lo tiene y qué ya venció.",
    "Va ordenada por vencimiento, con lo vencido arriba y en rojo. «Tomar» le avisa al vendedor que ya la tienes. «Contestar» (o clic en el renglón) abre el panel de la derecha: elige el artículo del catálogo o dalo de alta, escribe proveedor, costo y días de entrega, y Enter contesta. Si no se consigue, dilo con el motivo: el vendedor se lo explica al cliente.",
    "La «Nota para quien lo pidió» la lee el vendedor: nada de costos ahí. Los cuadros de arriba filtran la lista con un clic, y el tiempo de respuesta se cuenta en horas hábiles de la planta, comparado contra lo que se tardaba en el chat.",
  ],
  "/compras/precios": [
    "Reemplaza la hoja ACTUALIZACIONES: aquí compras pone al día el costo de lo que compra cuando un proveedor cambia sus precios.",
    "Escribe el costo nuevo y Enter: se guarda esa fila y bajas a la siguiente. Con ↑ ↓ te mueves sin guardar (lo escrito queda en amarillo hasta «Guardar cambios») y Esc deshace la fila. Filtra los costos de más de 6 meses o los que no tienen, o elige un proveedor para pasar su lista completa.",
    "La columna Cambio compara en pesos, con los dólares al tipo de cambio de hoy; un triángulo avisa si el cambio pasa de 50 %, casi siempre por unidad o moneda equivocada. Al guardar te dice a cuántos equipos les cambia el precio, y a la derecha quedan los últimos cambios con quién y cuándo.",
    "Arriba a la derecha está el tipo de cambio con que se costea lo importado: si el del día no te sirve, captúralo ahí y Enter.",
  ],
  "/compras/ordenes": [
    "Todas las órdenes de compra, de la requisición al proveedor y del proveedor al almacén. Compras las arma y las envía, almacén las recibe y finanzas registra los pagos.",
    "De entrada ves las abiertas (borradores, enviadas y recibidas en parte); los cuadros de arriba y los filtros cambian la vista, y clic en un renglón abre la orden. Las atrasadas van en rojo. La barra de Recibido dice qué parte de lo pedido ya llegó.",
    "La pestaña Requisiciones tiene lo que producción y almacén le piden a compras: marca partidas y «Crear órdenes de compra» arma una en borrador por proveedor. Los importes y lo que falta por pagar solo los ve quien tiene costos o finanzas.",
  ],
  "/compras/ordenes/nueva": [
    "Para armar una orden de compra nueva. Empieza por el proveedor: de él salen la moneda, el crédito y los días de entrega.",
    "Si tienes la cotización del proveedor en PDF o foto, súbela: la IA lee las partidas y las empareja con el catálogo, y tú revisas todo antes de crear la orden. Si no, elige al proveedor y «Crear orden en borrador»; las partidas se agregan después.",
  ],
  "/compras/ordenes/:id": [
    "Una orden de compra completa: sus partidas, los datos para el proveedor, lo que ya se recibió en almacén y, para quien ve dinero, sus pagos.",
    "En borrador agregas artículos con el buscador de abajo (Enter) y editas cantidad y costo en su lugar; el costo sugerido es el vigente del artículo, y debajo ves si el del proveedor sale más caro o más barato. «Enviar al proveedor» fija las partidas; no se envía con partidas en $0. Después imprímela o mándala.",
    "Cuando llega mercancía, almacén usa «Recibir»: captura lo que de verdad llegó y lo que falte queda pendiente. Si todavía no se recibe nada, compras la puede cancelar y sus requisiciones vuelven a pendientes.",
    "Si después de enviarla se acuerda con el proveedor otro artículo, otra cantidad u otro precio, compras da el lápiz de esa partida, la corrige y escribe por qué. El folio se queda (el proveedor ya lo tiene) y la orden sube de revisión: «Rev. 2» en el título y en lo impreso, para mandársela otra vez. Abajo de las partidas queda cada cambio con su antes y después, quién lo hizo y por qué. Una partida de la que ya llegó algo no se cambia.",
    "Las partidas escritas a mano (sin artículo del catálogo) también se reciben. Si son material, en «Recibir» busca su artículo para que entren al almacén; si son un cobro, como «Manejo» o un flete, recíbelas tal cual: cuentan como recibidas y no tocan el inventario.",
    "Cuando finanzas registra la factura del proveedor y la liga a la orden, en «Factura del proveedor» dice «Registrada en finanzas» y los pagos ya se llevan en esa factura, no en la orden. Si el folio que anotó almacén al recibir es el de la factura, se ligan solas. Una partida sin artículo dice «Sin artículo del catálogo»: si es material, ponle su artículo para que entre al almacén y cuente como material.",
    "Si no pones fecha de entrega, se calcula al enviar con los días hábiles del proveedor; si pasa sin que llegue todo, la orden sale atrasada. El vencimiento del pago se fija al recibir, con los días de crédito del proveedor.",
  ],
  "/compras/proveedores": [
    "El directorio de proveedores: a quién se le compra, en qué moneda, con cuánto crédito y en cuántos días entrega.",
    "«Nuevo proveedor» lo da de alta compras, o finanzas con sus datos fiscales (si ya existe uno con ese RFC, le pone al día los datos en lugar de duplicarlo). De entrada ves solo los que surten algún artículo o tienen órdenes abiertas, porque el directorio de las hojas mezclaba acreedores (nómina, casetas, hoteles); «Todo el directorio» los muestra todos. Clic en un renglón abre su ficha; CSV baja la lista para Excel.",
    "«OC abiertas» cuenta las órdenes enviadas que esperan mercancía, con las atrasadas en rojo. Lo comprado en 12 meses solo lo ve quien tiene costos o finanzas.",
  ],
  "/compras/proveedores/:id": [
    "La ficha de un proveedor: sus datos, lo que nos surte, sus órdenes de compra y cómo se han movido sus precios.",
    "Desde aquí haces una «Nueva orden» ya con este proveedor, o editas sus datos. Compras edita todo; finanzas y la gerencia administrativa ponen al día lo fiscal, lo bancario, el crédito y el contacto, y pueden llenarlo subiendo su constancia de situación fiscal. Si cambian los datos bancarios, dirección recibe un aviso. Clic en una orden de la derecha la abre. Un artículo con la nota «su costo vigente es de otro proveedor» también se le compra a otro, y el costo de hoy viene de aquel.",
    "Finanzas ve además «Le debemos»: el saldo del proveedor y lo vencido. Dale clic para abrir su cuenta con sus facturas, todos sus movimientos y el botón para registrar un pago.",
    "Con permiso de costos ves el índice de precios del proveedor (100 en el primer mes con datos) y el cambio de sus precios en el último año; los costos en amarillo tienen más de 6 meses.",
  ],
};

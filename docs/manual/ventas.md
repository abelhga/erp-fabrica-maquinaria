# Ventas

## Números de pedido

**Cómo se ven:** `PED-26-799`.

- `26` es el año en que se levantó el pedido.
- `799` es el número corrido de siempre: el que seguía al pedido 798 de la hoja de Susana. **No
  vuelve a 1 al cambiar de año**: en 2027 seguirá el 800 y tantos (PED-27-8xx). Así «el 798» sigue
  siendo «el 798» para la planta, ventas y el cliente.
- Lo pone el ERP solo al guardar el pedido; no se escribe a mano.

**Mercado Libre, tienda web y Amazon** llevan su propia serie, que sí empieza cada año:
`ML-26-0001`, `WEB-26-0001`, `AMZ-26-0001`. Son muchas ventas chicas y no deben gastar el número
con el que la planta habla de un equipo.

**Equipos de stock:** ya no hay «S» ni «VS». El equipo para stock es una orden de producción sin
pedido; cuando se vende, el pedido lleva su número normal y la gerencia de producción le asigna
la orden con «Usar OP-…» (ver [produccion.md](produccion.md)).

**Pedidos de antes:** los que ya estaban en el ERP con otro folio (HIS-…, P-…, PED-2026-…) se
renumeraron con el número de su PDF de pedido. El folio anterior sale como «antes …» en la lista y
en el pedido, y el buscador los sigue encontrando por él. Los registros de la hoja de comisiones
que no tuvieron hoja de pedido (ventas de refacciones) conservan su folio HIS.

---

## Entregar un pedido y la hoja de salida

**Para qué:** que quede qué se entregó de cada pedido (completo o por partes) y a quién, con la
hoja firmada por el cliente, que el inventario baje con lo que salió y que un clic equivocado se
pueda deshacer.

**Quién entrega:** almacén (quien despacha), el vendedor sus propios pedidos, la gerencia de ventas
y dirección. La planta termina las órdenes, pero no entrega al cliente.

### Pasos

1. En el pedido (en Ventas o en Producción → Pedidos), **Entregar**. Arriba sale cada partida
   con lo que falta; ya viene puesto todo. Si solo sale una parte, escribe lo que sale de cada una
   (por ejemplo 2 de 4): lo demás queda por entregar.
2. **Imprimir hoja de salida** desde ese mismo cuadro: sale con lo que vas a entregar, el cliente,
   la dirección y los números de serie. No lleva precios. Imprime dos: una se queda el cliente.
3. El cliente (o quien recoge) firma.
4. Anota quién recibió, una nota si hace falta (flete, recogió en planta…) y sube la foto o el
   PDF de la hoja firmada. La hoja se puede subir después («Subir hoja firmada»); mientras falte,
   el pedido lo avisa.
5. **Registrar entrega**. Lo que salió se descuenta del inventario (lo que ya había salido a mano
   o con un envío no se descuenta otra vez) y los equipos quedan entregados.
6. Si fue todo, el pedido queda **entregado**. Si fue una parte, el recuadro de entregas dice
   «Entrega parcial: faltan …» y el botón cambia a **Entregar lo que falta**. Cada entrega queda
   con su número (PED-26-826 · 1, · 2…), quién recibió, lo que salió y su hoja.

Si algo sale pero en el ERP no había suficiente para descontarlo, la entrega se registra igual
(el cliente ya se lo llevó) y el recuadro lo marca en ámbar: almacén revisa la existencia y la
corrige con un ajuste.

### Si fue un error

- **Durante 15 minutos**, quien la marcó la deshace con **Deshacer** en el aviso.
- **Después**, la gerencia de ventas o dirección usa **Reabrir entrega** y escribe el motivo.
  Se deshace la última entrega: lo que salió regresa a las partidas y al inventario, los equipos
  vuelven a terminados y el pedido a como estaba. La entrega anulada queda anotada con su motivo.
- Los pedidos entregados con un envío de paquetería, o antes de que existiera la hoja de salida,
  no se reabren desde aquí: los regresa sistemas.

---

## ¿Cuándo sale el equipo de mi cliente?

En el pedido, abajo de Producción, **Plan del taller** enseña cada equipo del pedido en el tiempo:
cuándo entra y sale de cada área (pailería, detallado, pintura…) y, con el rombo, si llega a la fecha
compromiso (verde llega, rojo no). Es el plan que hace la planta con lo que pasa en el piso: se mueve
solo cuando algo se atrasa o se adelanta, sin que nadie lo capture.

- Pasa el mouse por una barra para ver sus fechas.
- Clic en un equipo abre su orden de producción con sus etapas y su historia.
- Si el rombo sale rojo, avísale a la gerencia de producción antes que al cliente: quizá se puede
  subir en la fila o ponerle más gente. Si no, se acuerda otra fecha.

---

## Ventas de Mercado Libre

Las ventas de Mercado Libre entran solas como pedido (cuando dirección prende las ventas en
Configuración → Integraciones). Nadie las captura, y el pedido dice todo lo que pasa en ML:

- **Pagado.** En cuanto Mercado Pago aprueba el pago, entra el cobro por Mercado Pago con su fecha:
  el pedido queda sin saldo. Si ML le regresa el dinero al comprador, entra el reembolso en negativo.
- **Lo que se queda ML.** En el recuadro «Mercado Libre» del pedido sale, tal cual lo da Mercado Pago:
  lo que pagó el comprador, la comisión, el envío que pagamos, la retención de IVA (8 % del precio sin
  IVA), la de ISR (2.5 %) y lo que llega a Mercado Pago, con el día en que queda disponible.
  Ejemplo real: $1,480 − 177.60 comisión − 84.50 envío − 102.07 IVA − 31.90 ISR = $1,083.93.
- **El envío al día.** Cuando ML hace la guía, el envío del ERP pasa a «guía lista» con ese número;
  cuando ML lo lleva, a «enviado» (y sale del inventario, aunque no se haya marcado aquí: queda
  anotado si no se registró el empaque); cuando lo entrega, a «entregado» y el pedido queda entregado.

Las retenciones no son gasto: ML se las entrega al SAT a nombre de Hegamex y se acreditan. Para
conciliar la cuenta de Mercado Pago, en Ventas → Mercado Libre → **Dinero** está cada pago del mes
con sus totales, y se baja a Excel.


---

## Seguimiento de cotizaciones: «¿Qué pasó?»

**Para qué:** que ninguna cotización enviada se quede sin saber qué pasó. Antes el embudo se
llenaba solo al cotizar y nadie lo movía: en octubre había 82 cotizaciones en «Cotizado» y una
sola nota de seguimiento.

**Cómo funciona:**

- Al **enviar** una cotización, el ERP agenda su seguimiento a **3 días hábiles** (sin fines de
  semana ni festivos). Si mandas otra versión a la misma oportunidad, el seguimiento se recorre;
  no se duplica.
- Cuando toca, aparece en **Cotizaciones → Seguimiento**, en el aviso de arriba de Cotizaciones,
  en Inicio, en tu calendario y en la tarjeta de la oportunidad.
- Solo se cierra anotando **qué pasó**. Eliges cómo va y escribes en una línea lo que dijo el
  cliente:
  - **Sigue en pie:** lo está pensando; el siguiente seguimiento queda a 3 días hábiles (o la fecha
    que pongas).
  - **No contestó:** se vuelve a intentar en 2 días hábiles. El texto es opcional.
  - **Negociando:** la oportunidad pasa a Negociación, con su siguiente seguimiento.
  - **Ya compró:** te lleva a la cotización para convertirla en pedido; eso cierra el seguimiento.
  - **Se perdió:** pide el motivo; la oportunidad y su cotización se cierran.
- Lo que escribes queda en la historia del cliente (cuenta como contacto para la cartera y para el
  objetivo de seguimiento de prospectos).
- Si la cotización se vuelve pedido o se rechaza por otro camino, el seguimiento se cierra solo.

**Negociación:** arrastrar una tarjeta a Negociación abre «¿Qué pasó?». La base no acepta
Negociación sin la nota, ni siquiera desde el detalle.

**El freno:** con **más de 10 seguimientos vencidos**, el vendedor no puede enviar cotizaciones
nuevas. El botón de enviar lo avisa antes de abrir WhatsApp, y tampoco sale el PDF ni la vista
previa de una cotización que todavía no se envía (las ya enviadas se pueden volver a compartir).
Convertir en pedido nunca se frena.
Si un cliente está esperando, la gerencia de ventas lo libera **por ese día**: en Cotizaciones →
Seguimiento, en la tarjeta del vendedor, «Liberar por hoy» con el motivo. Al vendedor le llega el
aviso.

**Para la gerencia:** la misma pestaña muestra a cada vendedor con sus seguimientos vencidos, los
de hoy y el total, y cuántas cotizaciones envió contra cuántos seguimientos anotó en los últimos 7
días. Clic en un vendedor filtra su lista. Dirección lo ve también en su Inicio, abajo del embudo
comercial.

**Arranque (23 oct 2026):** las cotizaciones que ya estaban enviadas recibieron su seguimiento.
Las que ya habían pasado sus 3 días se acomodaron desde el siguiente día hábil sin pasar de 8 por
día y vendedor (contando las que ya tocaban ese día), para que nadie amaneciera frenado.

Los plazos y el tope se cambian en la configuración `seguimiento_cotizaciones` (dias_habiles,
dias_no_contesta, tope_vencidos).

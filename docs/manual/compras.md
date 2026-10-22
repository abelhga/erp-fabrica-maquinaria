# Compras

Para quien compra. Hasta ahora todo vivía en la hoja «Costo y actualizaciones de los
componentes 2.0»: los precios en ACTUALIZACIONES, el catálogo en ListaComponentes, las órdenes
en Órdenes (un renglón por artículo, con Status a mano), los faltantes en STOCKS BAJOS 2.0 y lo
que pedía ventas, por el chat. Aquí está cómo se hace cada cosa en el ERP y qué cambió.

## El camino completo, en una vista

```
 Ventas pide un precio ──► Solicitud de precio (SP) ──► compras contesta ──► precio de lista al vendedor
                                                          │
                                                          └─► el costo entra al catálogo con su historia

 Producción: faltantes de una OP ─┐
 Almacén: reabasto (stock mínimo) ┼─► Requisición (REQ) ─┐
                                  │                      ├─► Orden de compra (OC) en borrador
 Compras: reabasto directo ───────┴──────────────────────┘        │ Enviar al proveedor
                                                                  ▼
                                    Enviada ──► Recibir (almacén o compras) ──► Recibida en parte / Recibida
                                                     │                                 │
                                                     ├─► entra al inventario           └─► finanzas registra el pago
                                                     ├─► avisa a quien la pidió
                                                     └─► (si se marca) el costo vigente se actualiza
```

Folios: `SP-2026-00012` (solicitud de precio), `REQ-2026-00034` (requisición), `OC-2026-00056`
(orden de compra). Los pone el ERP.

---

## 1. Tu día: dónde ver qué te toca

- **Inicio** (tu tablero): «Lo que importa hoy» y la tarjeta «Pendientes» juntan lo urgente:
  solicitudes por vencer, órdenes atrasadas, requisiciones nuevas.
- **La campana**: te avisa cuando un vendedor pide un precio (con «URGENTE» si el cliente está
  esperando), cuando llega una requisición nueva y cuando una solicitud está por vencer.
- **Compras → Solicitudes de precio**: lo que espera ventas.
- **Compras → Órdenes de compra**: lo abierto, con lo atrasado en rojo, y la pestaña
  **Requisiciones** con lo que te piden producción y almacén.
- **Almacén → Reabasto**: lo que está abajo de su punto de reorden.

---

## 2. Solicitudes de precio (lo que antes era «¿me ayudas a cotizar esta polea?»)

**Para qué:** que cada precio que pide ventas tenga folio, dueño y plazo, y que al contestarlo
el costo quede en el catálogo de una vez, sin capturarlo dos veces.

**Quién:** el vendedor la levanta desde su cotización (o suelta). Compras la toma y la contesta.

### Plazo

Se cuenta en **horas hábiles de la planta** (lun–vie 8–18, sáb 8–14, sin feriados): una normal
tiene 10 h (un día hábil), una urgente 4 h. Una que llega el domingo empieza a contar el lunes a
las 8. El semáforo: verde a tiempo, amarillo a menos de una hora de vencer, rojo vencida. Las
vencidas van arriba.

### Pasos

1. Abre **Compras → Solicitudes de precio**. Los cuadros de arriba filtran (sin tomar, por
   vencer, vencidas…).
2. **Tomar**: el vendedor ve que ya la tienes. Evita que dos personas busquen el mismo precio.
3. Cotiza con el proveedor como siempre (teléfono, correo, WhatsApp).
4. **Contestar** (o clic en el renglón). En el panel:
   - elige el **artículo del catálogo** o dalo de alta ahí mismo (nombre, unidad);
   - **proveedor**, **costo** sin IVA y **moneda** (si te lo dieron en dólares, captúralo en
     dólares: ya no se convierte a mano);
   - **días de entrega** (obligatorio: es lo primero que pregunta el cliente) y, si aplica,
     hasta cuándo vale el precio;
   - una **nota para quien lo pidió** (opcional). **Nunca lleva costos**: la lee el vendedor.
   - Enter contesta.
5. Si no se consigue, **No se consigue** con el motivo («descontinuado; el equivalente es…»).
   También es una respuesta y el vendedor la necesita igual de rápido.

### Qué pasa al contestar

- El costo entra al catálogo por el mismo camino que «Actualizar precios», con el folio de la
  solicitud como referencia en su historia.
- El precio de lista se recalcula solo y el vendedor lo recibe con el plazo. **No ve el costo
  ni el proveedor.**
- El tiempo de entrega queda guardado en el artículo.
- Una solicitud se contesta una sola vez. Si el vendedor ya no la necesita, él la cancela.

---

## 3. Actualizar precios (lo que antes era la hoja ACTUALIZACIONES)

**Para qué:** poner al día el costo cuando un proveedor cambia sus precios, sin agregar filas a
mano ni cuidar que el nombre esté escrito igual.

1. **Compras → Actualizar precios**.
2. Filtra los que tienen costo de más de 6 meses o ninguno, o elige un **proveedor** para pasar
   su lista completa.
3. Escribe el costo nuevo y **Enter**: se guarda y bajas al siguiente. ↑ ↓ te mueven sin guardar
   (queda en amarillo hasta «Guardar cambios»); Esc deshace la fila.
4. La columna **Cambio** compara en pesos (los dólares al tipo de cambio de hoy). Un triángulo
   avisa si el cambio pasa de 50 %: casi siempre es unidad o moneda equivocada.
5. Al guardar te dice a cuántos equipos les cambia el precio. A la derecha quedan los últimos
   cambios con quién y cuándo.

El tipo de cambio para lo importado está arriba a la derecha: si el del día no sirve, captúralo
y Enter.

**Ya no hace falta:** «NO BORRAR NINGUNA ACTUALIZACIÓN» (el historial no se puede borrar), ni
escribir el nombre exacto (eliges el artículo; la llave ya no es el texto), ni avisar al de
costeo antes de renombrar algo.

---

## 4. De «hace falta» a la orden de compra

Hay tres caminos. Todos terminan en una orden **en borrador** que tú revisas antes de mandarla.

### a) Requisiciones (lo que te piden producción y almacén)

- **Producción** las genera con «Pedir faltantes» de una orden de producción: lo que no alcanzó
  a apartarse.
- **Almacén** las genera desde Reabasto con «Pedir a compras».
- Te llega un aviso. En **Órdenes de compra → Requisiciones** marca las partidas y
  **Crear órdenes de compra**: sale una orden en borrador **por proveedor**, y el mismo
  artículo pedido varias veces se suma en una partida.
- El proveedor sale del último costo del artículo; si no tiene, la partida se queda pendiente y
  te lo avisa.
- La fecha en rojo es para menos de una semana.

### b) Reabasto directo

En **Almacén → Reabasto**, pestaña «A ordenar», marca lo que quieras y **Generar órdenes de
compra**. Igual que arriba: borradores por proveedor. Lo que ya está en un borrador o en una
requisición sale debajo del sugerido y no se vuelve a pedir.

La regla del sugerido es la de la hoja Demanda: consumo en suficientes meses de los últimos
seis, punto de reorden = demanda de los días de entrega + stock de seguridad, lote de 1 mes si
es nacional o 6 si es importado, redondeado al empaque. El botón «¿por qué?» hace la cuenta de
cada artículo.

### c) Orden a mano o desde la cotización del proveedor

**Órdenes de compra → Nueva**. Empieza por el proveedor (de él salen moneda, crédito y días de
entrega). Si tienes su cotización en PDF o foto, súbela: Claude lee partidas, cantidades y
precios y los empareja con el catálogo; tú revisas todo y nada se guarda hasta crear la orden.

---

## 5. La orden de compra

| En la hoja (Status) | En el ERP | Qué quiere decir |
|---|---|---|
| Pendiente | **Borrador** | Todavía se edita; el proveedor no la tiene |
| Pedido / Enviado | **Enviada** | Ya se mandó; lo pedido cuenta «en tránsito» para el reabasto |
| — | **Recibida en parte** | Llegó algo y falta lo demás |
| Recibido | **Recibida** | Llegó todo |
| CANCELADO | **Cancelada** | Lo que venía de requisiciones regresa a pendiente |

### Pasos

1. En borrador, agrega artículos con el buscador (Enter) y edita cantidad y costo en su lugar.
   El costo sugerido es el vigente; debajo ves si el del proveedor sale más caro o más barato.
2. **Enviar al proveedor**. No deja enviar partidas en $0: el precio se pacta antes. Desde ahí
   las partidas ya no cambian.
3. **Imprimir** (o, si es importación, «OC y contrato para aduana») y mándala.
4. Si no pusiste fecha de entrega, se calcula al enviar con los días hábiles del proveedor (7 si
   no tiene). Pasada esa fecha sin que llegue todo, sale **atrasada** en rojo: llama al
   proveedor o mueve la fecha si te dio otra.
5. **Cancelar** solo mientras no se haya recibido nada, con el motivo.

Un renglón por orden, con todas sus partidas adentro: ya no se repite el número de OC en
cada fila, ni hay «Vale», «s/n» o «1594.1».

---

## 6. Recibir material

**Quién:** el botón **Recibir** lo tiene quien puede capturar en almacén: **almacén y compras**.
Lo hace quien tiene la mercancía enfrente y la contó. Si llega a la oficina (paquetería), la
recibes tú; si baja en el andén, almacén.

En la hoja eran dos capturas: compras cambiaba el Status a «Recibido» en Órdenes y almacén
registraba la ENTRADA en el inventario. **Ahora es una sola.**

### Pasos

1. Abre la orden (enviada o recibida en parte) y **Recibir**.
2. Ya viene llenado todo lo pendiente. Corrige cada cantidad a **lo que de verdad llegó** y el
   **almacén** donde entra («Todo entra a» lo cambia para todas).
3. Escribe la **factura o remisión**.
4. La casilla **«Actualizar el costo con el precio de esta orden»** viene marcada: así el costeo
   se mueve con lo que de verdad se pagó. Desmárcala si fue un precio especial (remate,
   urgencia).
5. **Dar entrada**.

### Qué pasa

- Entra al inventario con el costo de la orden (si es importación, con el costo puesto en planta
  del embarque).
- La orden queda **recibida** o **recibida en parte**; lo que falta sigue pendiente para la
  siguiente entrega.
- Avisa a quien pidió el material (la requisición) y al canal de almacén.
- Se fija el vencimiento del pago: fecha de recepción + días de crédito del proveedor.

### Reglas

- No deja recibir más de **10 %** arriba de lo pendiente en una partida.
- Una entrada **no se edita ni se borra**. Si te equivocaste, no la captures al revés: se pide
  un ajuste en Almacén → Entradas y salidas, y lo autoriza otra persona.

---

## 7. Proveedores

**Compras → Proveedores**: a quién se le compra, en qué moneda, con cuánto crédito y en cuántos
días entrega. De entrada solo salen los que surten algo o tienen órdenes abiertas (el directorio
de las hojas mezclaba nómina, casetas y hoteles); «Todo el directorio» los muestra todos.

- Si das de alta uno con un RFC que ya existe, se ponen al día sus datos en lugar de duplicarlo.
- Su ficha trae lo que nos surte, sus órdenes y cómo se han movido sus precios (índice 100 en el
  primer mes con datos).
- Si alguien cambia sus datos bancarios, dirección recibe un aviso.
- **Los pagos los registra finanzas**, no compras.

---

## 8. Importaciones

Una orden en otra moneda o de importación se liga a un **embarque** (Importaciones → Embarques),
que lleva sus etapas, documentos y gastos. Al recibirla, el costo que entra es el costo puesto
en planta del embarque (mercancía + flete + impuestos + agente, prorrateados), no solo el de la
orden. Ya no hace falta la pestaña «Calculo costos import».

---

## ¿Por qué es mejor que la hoja?

| En la hoja | En el ERP |
|---|---|
| El nombre era la llave: renombrar rompía el historial, el costeo y el inventario | Cada artículo tiene clave; el nombre se corrige sin romper nada |
| ACTUALIZACIONES, Órdenes y el inventario se ligaban con IMPORTRANGE entre 4 archivos | Una sola base: lo que capturas lo ven al instante almacén, producción y ventas |
| Status de la orden a mano y entrada al almacén aparte | **Recibir** hace las dos cosas y avisa a quien lo pidió |
| Ventas pedía precios por chat; nadie sabía qué seguía abierto | Solicitud con folio, dueño, plazo y semáforo; el vendedor ve cuándo la tomaste |
| El precio contestado había que capturarlo además en ACTUALIZACIONES | Contestar la solicitud **es** capturar el costo |
| Dólares convertidos a mano antes de capturar | Costo en su moneda; se convierte con el tipo de cambio del día |
| STOCKS BAJOS se recalculaba en otro archivo y tenía referencias corridas | Reabasto en la misma base, con «¿por qué?» por artículo y sin pedir dos veces |
| Fecha de vencimiento o «PAGADA» en la misma columna | Vencimiento con los días de crédito; finanzas registra los pagos aparte |
| Cualquiera podía borrar o cambiar una fila | Historial que no se borra, con quién y cuándo |
| El vendedor veía la hoja con costos | El vendedor solo ve el precio de lista y el plazo |

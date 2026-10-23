# Almacén

Para quien lleva el almacén. Hasta ahora todo vivía en «2025 - Inventario 2.0- HEGAMEX»: cada
movimiento como una fila en Registro (fecha, producto, cantidad, tipo, almacén, personal, motivo,
factura), los apartados como un almacén de mentira llamado RESERVADO, los vales de papel «PEDIDO A
ALMACÉN», los conteos en pestañas sueltas (C1, C2, INVENTARIADO) y la herramienta en Herramientero.
Aquí está cómo se hace cada cosa en el ERP y qué cambió.

## Tu día, en una vista

```
 Llega material ──► Recibir (orden de compra) ──────────────► entra al inventario
                                                                  │
 Producción ──► orden de producción ──► Apartar ──► Revisar ──► Surtir ──► sale a la orden
                                          │
                                          └─ lo que falta ──► Pedir a compras (requisición)

 Taller, EPP, mostrador ──► Salida de consumo o de venta (con motivo)
 Cambio de lugar ────────► Traspaso
 Algo regresa ───────────► Devolución
 No cuadra el estante ───► Ajuste (lo autoriza otra persona) · Conteo físico
 Stock bajo ─────────────► Reabasto ──► Pedir a compras
 Pedido listo ───────────► Envío (empacar con fotos, salida) o Entrega con hoja firmada
 Herramienta prestada ───► Resguardo
```

Los almacenes son los mismos de siempre: Planta Baja, Mallado, Planta Alta, Contenedor 1 y 2,
Revolución y Almacén ML (el Full de Mercado Libre: existe, pero no cuenta para planta).

---

## 1. Existencias: cuánto hay y cuánto está libre

**Almacén → Existencias.** Cada artículo con lo que hay en cada almacén, lo apartado y lo que viene
en camino.

- **Disponible** es lo que importa: lo que hay en planta menos lo apartado. Lo de Almacén ML no
  cuenta para planta.
- **Apartado**: reservado para una orden de producción o un pedido. Ya no es un almacén aparte:
  la pieza sigue en su estante, pero nadie más la puede tomar.
- **En tránsito**: lo que compras ya pidió y no ha llegado, con su fecha estimada.
- Un número en **rojo** es existencia negativa (salió algo cuya entrada nunca se registró). Se
  corrige con un conteo y un ajuste.
- Clic en un renglón abre el artículo a un lado: cuánto hay en cada almacén, para quién está
  apartado y su kardex.

---

## 2. Entradas y salidas

**Almacén → Entradas y salidas → Registrar.** Funciona en el celular.

### Salida (consumo o venta)

1. Elige **Consumo** (taller, EPP, plasma…) o **Venta** (mostrador, Mercado Libre).
2. Busca el artículo por nombre o clave.
3. Toca el almacén: cada botón dice cuánto hay ahí.
4. Cantidad, Enter, y **para qué o para quién** (obligatorio). Los botones Taller, EPP, Plasma,
   Torno, Pintura… llenan el texto por ti. Enter otra vez guarda.

No deja sacar más de lo que hay en ese almacén. A la derecha ves lo que registraste hoy.

**Lo que va a una orden de producción no sale aquí:** sale desde la orden con **Surtir** (punto 3),
para que quede ligado a la orden y descuente su apartado.

### Devolución

Lo que regresa del taller o de una orden. Artículo, almacén, cantidad y motivo.

### Traspaso

Cambiar algo de almacén (de Mallado a Planta Baja). Es un solo movimiento: sale de uno y entra al
otro al mismo tiempo. Ya no son dos filas de AJUSTE que hay que cuadrar.

### Lo que el ERP pone solo

La **fecha, la hora y tu nombre**. No se puede capturar con fecha atrasada ni a nombre de otro.

---

## 3. Material para producción

**Producción → Órdenes y material**, o la orden desde el aviso. Cada orden de producción trae su
lista de materiales. Antes del taller pasa por cinco pasos («Validación de material»); dos son
tuyos:

1. Ingeniería revisa la lista.
2. **Se aparta el material** (lo puede hacer almacén o producción). Lo que hay libre se aparta para
   esa orden; lo que no alcanza queda como faltante.
3. **Se piden los faltantes a compras** con «Pedir a compras» (sale una requisición).
4. **Almacén revisa** que lo apartado esté de verdad en el estante: «Marcar revisado».
5. La gerencia la libera al taller.

### Surtir

Cuando el taller necesita el material, en la orden **Surtir**:

- Ya viene propuesto lo apartado para esa orden, con el almacén de donde sale.
- Corrige la cantidad que de verdad entregas y **Surtir**.
- Sale ligado a la orden y descuenta su apartado.

**No deja llevarse lo apartado para otra orden.** Si la chumacera está apartada para la OP-…112,
no la puedes surtir a la OP-…118: el ERP te dice para quién está. Así ya no pasa que «sí había»
y al llegar al estante ya no estaba.

Si el taller pide algo que no está en la lista, también se surte, pero hay que escribir el motivo:
queda marcado «fuera de lista».

---

## 4. Recibir lo que compras pidió

En la orden de compra (**Compras → Órdenes de compra**), **Recibir**:

1. Viene llenado con todo lo pendiente. Corrige cada cantidad a **lo que de verdad llegó** y el
   **almacén** donde entra.
2. Escribe la **factura o remisión**.
3. **Dar entrada**.

Entra al inventario, la orden queda recibida o recibida en parte y se avisa a quien lo pidió. No
deja recibir más de 10 % arriba de lo pendiente. También lo puede hacer compras: lo hace quien
tiene la mercancía enfrente y la contó.

Antes: una fila de ENTRADA en Registro con factura y proveedor, y aparte compras cambiaba el
Status en su hoja.

---

## 5. Cuando el estante no cuadra: ajustes y conteos

Un movimiento **no se edita ni se borra**. Si te equivocaste, no lo captures al revés.

### Pedir un ajuste

**Entradas y salidas → Ajustes**:

1. Artículo y almacén. El ERP muestra lo que dice el sistema.
2. Lo que **hay físicamente** y el **motivo** (obligatorio: lo lee quien autoriza).
3. **Pedir autorización**.

**Lo autoriza alguien distinto de quien lo pidió** (la gerencia, dirección u otra persona de
almacén). Al aprobarse, la diferencia se aplica contra lo que hay ese día.

### Conteo físico

**Entradas y salidas → Conteos físicos**:

1. Elige el almacén (uno a la vez) y **Empezar a contar**.
2. Captura lo contado renglón por renglón (Enter guarda y baja al siguiente).
3. Al **cerrar el conteo**, cada diferencia se vuelve un ajuste por autorizar. Lo que no se capturó
   no se ajusta.

Reemplaza las pestañas C1, C2 e INVENTARIADO.

---

## 6. Reabasto: pedirle a compras

**Almacén → Reabasto**, pestaña «A ordenar»: lo que está abajo de su punto de reorden.

1. Marca las casillas (la de arriba elige todo lo que tiene sugerido).
2. **Pedir a compras**: sale una requisición y compras recibe el aviso.

Lo que ya está pedido (en una requisición o una orden en borrador) sale debajo del sugerido para
que no lo pidas dos veces. «¿por qué?» hace la cuenta de cada artículo.

Reemplaza STOCKS BAJOS 2.0, sin los errores de columnas corridas que la hoja tenía.

---

## 7. Envíos y entregas

**Almacén → Envíos.** Las pestañas son la fila de trabajo: Por cotizar y guía, **Por empacar**,
**Hoy salen o recogen**, En camino, Entregados. Ventas pide el envío y la guía; almacén:

- **Empaca**: fotos del paquete, check list completo y, si es un equipo, su número de serie (tiene
  que ser el de su orden de producción). Esa evidencia ya no se cambia.
- **Marca la salida**: el inventario se descuenta en ese momento, una sola vez, sin tocar lo
  apartado para otros. Lo que surte Full sale de Almacén ML.
- **Envío a Full**: almacén arma desde aquí los envíos para reabastecer el Full de Mercado Libre.

**Entregar un pedido en planta** (lo recoge el cliente o va en flete): en el pedido, **Hoja de
salida**, firma, y **Entregar** con quién recibió y la foto de la hoja firmada.

---

## 8. Herramienta prestada

**Servicio → Resguardo de herramienta.** «Prestar herramienta»: quién se la lleva, para qué y cuándo
la regresa. «Recibir» la cierra con su estado (bien, dañada o incompleta); si regresa dañada o
incompleta, la falla se reporta sola. En rojo lo que ya se pasó de su fecha.

Reemplaza Herramientero, que tenía stock pero no decía quién tenía qué.

---

## 9. Lo que te avisa la campana

- Una orden de producción nueva por validar, y si lleva tiempo atorada.
- Llegó material de una orden de compra.
- Un embarque de importación llegó a puerto o salió hacia planta (con su llegada estimada).
- Un ajuste por autorizar (si te toca autorizar).

---

## ¿Por qué es mejor que la hoja?

| En la hoja | En el ERP |
|---|---|
| Fecha, persona y producto escritos a mano; se podía capturar con fecha atrasada | Fecha, hora y nombre los pone el sistema |
| El producto era un texto: si se escribía distinto, era otro artículo | Se elige del catálogo por nombre o clave |
| Apartar = mover a RESERVADO con dos ajustes; nadie sabía para quién | Apartado ligado a la orden o pedido; el estante no se mueve |
| Se podía sacar lo apartado para otra orden y nadie se enteraba | Surtir no deja tomar lo de otra orden y dice para quién está |
| Vale de papel «PEDIDO A ALMACÉN» y luego capturar la SALIDA | Surtir desde la orden: una captura, ligada a la orden |
| Se podía dejar en negativo | No deja sacar más de lo que hay en ese almacén |
| Corregir = otra fila al revés, sin autorización | Ajuste con motivo, autorizado por otra persona |
| El historial ya casi no cabía (Almacen Registros a ~160 filas del límite) | Sin límite de filas; nada se borra |
| STOCKS BAJOS en otro archivo, con columnas corridas | Reabasto con «¿por qué?» y botón para pedir a compras |
| Herramientero sin préstamos | Resguardos con quién, desde cuándo y cómo regresó |

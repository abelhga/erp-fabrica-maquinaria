# El proceso completo: de la cotización a la entrega

Cómo viaja un pedido de varios equipos por el ERP y quién hace cada cosa. Las páginas de cada
área ([ventas](ventas.md), [compras](compras.md), [almacén](almacen.md),
[producción](produccion.md)) cuentan el detalle; esta cuenta el hilo completo.

**El ejemplo:** un cliente pide **3 equipos**: una tolva, una banda pedestal y una banda cargadora.

## Quién hace qué, de un vistazo

| Paso | Vendedor | Gerencia de ventas | Compras | Ingeniería | Gerencia de producción | Almacén | Taller | Finanzas |
|---|---|---|---|---|---|---|---|---|
| 1. Cotización | Arma y envía | Autoriza precios bajo el mínimo | Contesta precios que falten | | | | | |
| 2. Pedido | Convierte, fecha compromiso | Comparte el crédito si lo cerraron varios | | | Recibe el aviso | Recibe el aviso | | |
| 3. Órdenes de producción | | | | | Crea una por equipo | | | |
| 4. Validación de material | | | Compra los faltantes | Revisa la lista | Libera al taller | Aparta, pide faltantes, revisa | | |
| 5. Plan y cuadrillas | Ve el plan en su pedido | | | | Acomoda la fila y la gente | Ve el plan | | |
| 6. Taller | | | | Atiende cambios a la lista | Sigue el tablero y la TV | Surte el material | Inicia, pausa, termina | |
| 7. Listo y entrega | Entrega sus pedidos | | | | | Entrega o empaca | | |
| 8. Facturas y cobros | Ve el saldo | | | | | | | Registra facturas y cobros |

---

## 1. Cotización (vendedor)

**Ventas → Cotizaciones → Nueva**, o desde el cliente o la oportunidad.

1. Agrega las 3 partidas escribiendo nombre o clave y Enter: precio de lista, descripción y foto
   se llenan solos.
2. Si algo no tiene precio, **Pedir precio a compras** desde la partida. Compras lo contesta en su
   cola (con plazo en horas hábiles) y el precio llega a la partida. El vendedor nunca ve el costo.
3. Si un precio queda abajo del mínimo, la partida sale en rojo y la cotización pasa a **Por
   autorizar**: la **gerencia de ventas** la autoriza antes de enviarla.
4. **Tiempo de entrega**: abajo dice cuándo sale de verdad con el taller como está hoy (lo que
   tarda el equipo o la fila del taller, lo que sea más tarde). «Usar» lo pone en la cotización.
5. **Enviar** por WhatsApp o PDF. Ya enviada no se edita: para cambiarla, **Nueva versión** (la
   anterior se queda como se mandó).

Enviarla pasa su oportunidad a «Cotizado».

## 2. Pedido (vendedor)

En la cotización aceptada, **Convertir a pedido**: eliges las partidas y la **fecha compromiso**
(ya viene con la fecha real del taller). El pedido toma su número (`PED-26-8xx`), la oportunidad
queda «Ganada» y la cotización «Aceptada».

- Le llega un aviso a la gerencia de producción y a almacén: «Pedido nuevo».
- En **Crédito de la venta** se ve qué vendedor cobra comisión; si la cerraron varios, la gerencia
  lo comparte en porcentajes.
- Estado: **Confirmado**.

## 3. Órdenes de producción (gerencia de producción)

En el pedido (o en **Producción → Pedidos**, filtro «Sin orden»), **Mandar a producción**:

- Sale **una orden de producción por cada equipo** (3 equipos = 3 órdenes; 2 bandas iguales = 2
  órdenes, cada una con su número de serie).
- Cada orden copia la **lista de materiales** y las **horas por etapa** del equipo.
- Si el equipo ya tiene código, toma su **número de serie** solo.
- Si hay un equipo igual hecho para stock, sale **Usar OP-…** y ya no se fabrica otro.
- El pedido pasa a **En producción**. A ingeniería y almacén les llega «Orden … por validar».

## 4. Validación de material (cinco pasos, cada quien el suyo)

En cada orden, «Validación de material»:

1. **Ingeniería** revisa la lista de materiales y cantidades. Sin esto no se puede liberar.
2. **Almacén (o producción)** aparta el material: lo libre queda separado para esa orden, en su
   mismo estante. Lo que no alcanza queda como faltante.
3. **Almacén (o producción)** pide los faltantes a compras: sale una **requisición**.
   - **Compras** la vuelve orden de compra (una por proveedor), la envía, y cuando llega **almacén o
     compras** la reciben. A quien la pidió le llega «Llegó material».
4. **Almacén** revisa que lo apartado esté de verdad en el estante: «Marcar revisado».
5. La **gerencia de producción** la **libera** al taller.

Si una orden lleva horas sin revisión, la campana se lo recuerda a ingeniería y almacén.

## 5. El plan del taller (gerencia de producción)

Nadie captura fechas: el **Gantt** calcula cuándo empieza y termina cada etapa de cada equipo con
las horas estimadas, lo que puede trabajar cada área, la cuadrilla de cada etapa y el orden de la
fila. Se recalcula solo con lo que se marca en el piso.

- El **rombo** es la fecha compromiso: verde si el plan llega, rojo si no (con los días que
  faltarían).
- La gerencia acomoda la fila arrastrando una orden; Cuadrillas y la terminal quedan en ese orden.
- En **Cuadrillas** la gerencia arrastra a cada persona a la etapa que le toca.
- El vendedor ve el mismo plan en su pedido («Plan del taller»): sabe cuándo sale cada equipo sin
  preguntar.

## 6. Taller (supervisores en la terminal)

En la **terminal de piso** (una tablet por estación):

- **Iniciar**: toca quiénes trabajan (vienen los que planeó la gerencia).
- **Se une / Sale** cambian la cuadrilla sin detener la etapa.
- **¿Cuánto lleva?** (¼, ½, ¾, casi) para que el plan sepa cuánto falta.
- **Pausar**, **Terminar** o **Problema** (falta material, falla de máquina…).
- **Almacén surte** el material desde la orden con **Surtir**; no puede llevarse lo apartado para
  otra orden.
- Si algo de la lista está mal: «Solicitar cambio a ingeniería» desde la orden.

Mientras, la **TV del taller** muestra lo que se trabaja en cada área, lo atrasado y lo que falta de
material, y el **tablero de producción** junta todo con sus alertas.

## 7. Listo y entrega

- Al terminar la última etapa, la orden queda **Terminada**.
- Cuando las **3 órdenes** terminan, el pedido pasa solo a **Listo para entregar**.
- **Entrega en planta** (lo recoge el cliente o va en flete): en el pedido, **Hoja de salida**
  (sin precios, con los números de serie), firma, y **Entregar** con quién recibió y la foto de la
  hoja firmada. Entregan almacén, el vendedor sus pedidos, la gerencia de ventas y dirección. Un
  error se deshace en 15 minutos; después lo reabre la gerencia de ventas con el motivo.
- **Por paquetería**: el vendedor pide el envío y la guía, almacén empaca con fotos, check list y
  número de serie, y marca la salida.
- El pedido queda **Entregado**.

## 8. Facturas, cobros y comisiones (finanzas)

- **Finanzas** registra facturas y cobros en el pedido (subiendo el XML) y el saldo se recalcula
  solo. Lo ven el vendedor y la gerencia.
- La **comisión** del vendedor se calcula sola con sus pedidos del mes.

---

## Los estados, en una línea

- **Cotización:** Borrador → Por autorizar → Autorizada → Enviada → Aceptada.
- **Pedido:** Confirmado → En producción → Listo para entregar → Entregado.
- **Orden de producción:** Planeada (validando material) → Liberada → En proceso → Terminada →
  Entregada.

Lo que cambia de estado solo: el pedido pasa a «En producción» al crear su primera orden y a
«Listo» cuando terminan todas; la orden pasa a «Terminada» con su última etapa.

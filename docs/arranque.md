# Plan de arranque

Cambiar todo el mismo día es la forma más segura de que nadie use el sistema. El orden de
abajo deja primero lo que menos riesgo tiene y más ayuda, y deja el inventario (lo único
que exige un "día de corte") para cuando la gente ya conoce el sistema.

## 0. Preparación (1 semana)

- Importar todo (ver `docs/despliegue.md`) y revisar en **Sistema → Importar de Sheets**:
  - 474 de 474 precios iguales a Nuevo Costeo.
  - Avisos: los 2 materiales renombrados que hoy rompen 6 equipos, E-055 sin lista de
    materiales, 40 componentes con nombre repetido, existencias negativas.
- Dirección decide: regla de cartera (12 meses / 90 días, encenderla o no), quién autoriza
  ajustes de inventario, base de comisiones (al vender, al facturar o al cobrar).
- Finanzas revisa el saldo de arranque por cliente que trae el libro de ventas
  (38 clientes, $10.09 M con IVA al importar).
- Dar de alta a cada persona con su rol.

## 1. Cotizador y catálogo (semana 1)

- Vendedores cotizan en el ERP. Las hojas de cotizar se ocultan.
- Ingeniería mantiene las listas de materiales en el ERP y aplica los subensambles sugeridos
  (empezar por los que más líneas ahorran: kit de ruedas, juego de acabado).
- Nuevo Costeo queda de solo lectura.

## 2. Compras (semana 2)

- El comprador actualiza costos en **Compras → Actualizar precios** (deja de capturar en
  ACTUALIZACIONES). Las órdenes de compra se hacen en el ERP.
- Definir meses de cobertura de los importados críticos (6 por defecto).

## 3. Inventario — día de corte (semana 3)

1. Viernes por la tarde: conteo físico por almacén (Conteos en el ERP o en papel).
2. Cargar las existencias contadas (reimportar con `--reiniciar-existencias` antes de que
   haya movimientos, o capturar los conteos y autorizar los ajustes).
3. Desde el lunes, toda entrada y salida va en el ERP. Las hojas de inventario se archivan.

## 4. Producción (semana 4)

- Las órdenes nuevas se crean desde el pedido; la validación de material ya aparta y pide
  faltantes. Instalar la tablet de la terminal de piso y la TV.

## 5. CRM, comisiones y RRHH (semana 5)

- Los paneles de ventas por vendedor se archivan; comisiones del mes se calculan en el ERP.
- RRHH captura personal y vacaciones.

En cada paso: una semana en paralelo como máximo y luego la hoja se archiva (solo lectura).
Dos sistemas vivos al mismo tiempo es peor que cualquiera de los dos.

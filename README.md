# ERP Hegamex

Sistema de gestión de **Máquinas y Herramientas Gamex** (Hegamex): ventas, cotizaciones,
costeo de maquinaria, compras, almacén, producción, recursos humanos y finanzas, en un
solo lugar y con permisos por rol. Reemplaza las hojas de Google Sheets ligadas con
IMPORTRANGE (Costo y actualizaciones de componentes, Nuevo Costeo, Inventario 2.0,
Almacén Registros, COTIZADOR GENERAL, paneles de ventas, validación de material).

## Qué resuelve

| Hoy, en las hojas | En el ERP |
|---|---|
| Todo se liga por **nombre**: un renombre en compras deja 6 equipos con "Error en el costeo". | Todo se liga por clave. El importador detecta y marca lo que ya estaba roto. |
| Una banda de 22 m es una copia de la de 20 m corregida a mano; piezas iguales repetidas en cada copia. | **Subensambles** compartidos y cantidades por **parámetro** (`largo_m = 22`). El detector encontró 40 grupos repetidos que ahorran 2,600 líneas. |
| El precio se mueve "en vivo" pero nadie sabe cuánto subió un equipo ni por qué. | Costo, precio real y precio a utilidad constante **en el tiempo**, por equipo. |
| Cualquiera con el enlace ve costos y márgenes. | **RLS por rol**: ventas ve precio de lista, nunca costo ni margen. Solo entra el dominio de la empresa. |
| El almacenista puede cambiar un registro viejo sin que nadie lo note. | Movimientos **inalterables**; las diferencias se piden como ajuste y **otra persona** lo autoriza. |
| Stock mínimo de 1 mes para todo; los importados se quedan cortos. | La misma regla de la hoja Demanda **más meses de cobertura** por artículo (6 en importados). |
| Validación de material sin reservas: cada equipo compara contra todo el stock. | La orden de producción **aparta** material; faltantes reales → requisición a compras. |
| No queda registro de cotizaciones; folios a mano por vendedor. | Folio automático, versiones, piso de precio con autorización, cotización → pedido en un clic. |
| Comisiones con rangos de filas movidos a mano cada mes. | Calculadas de los pedidos, con crédito compartido; coinciden al centavo con los paneles. |
| Un cliente es del vendedor para siempre. | Cartera con vigencia (venta en 12 meses o seguimiento en 90 días), configurable. |

Validación con los datos reales: **474 de 474** precios de equipo iguales a "Nuevo Costeo";
comisiones de Isaac (sep-2026) $73,540, igual que su panel.

## Pantallas principales

- **Inicio** por rol con indicadores, pendientes y "lo que importa hoy". Dirección ve el
  **centro de mando**: ventas contra los dos años anteriores, proyección con estacionalidad,
  clientes, vendedores contra meta, taller, inventario, cobranza; se actualiza solo.
- **Tu semana**: el lunes temprano llega un aviso con lo que pasó la semana pasada contra la
  anterior (ventas, cotizaciones, cobranza, equipos terminados, compras) y la agenda de la
  semana (entregas, órdenes comprometidas, lo que llega, servicios), con lo que cada rol ve.
- **Avisos y pendientes**: la campana avisa lo que le toca a cada quien (OC recibida, orden
  terminada, ajuste por autorizar, cotización por autorizar…) y los **pendientes** entre áreas
  tienen responsable, fecha y liga al registro. Opcional: también a un canal de Cliq.
- **Asistente** (Ctrl+J en cualquier pantalla): Claude consulta el ERP con los permisos de quien
  pregunta, explica cifras y propone qué hacer. **A quién llamar hoy**: clientes con un motivo
  concreto (cotización por vencer, ya le toca por su ritmo de compra, equipo que pide
  refacciones, dejó de comprar) y el mensaje de WhatsApp redactado con su historial.
- **Ventas**: oportunidades (tablero), cotizador con buscador de equipos/componentes, ficha de
  venta (precio mínimo, stock, envío gratis, mensualidades, precio en Mercado Libre, **fichas
  técnicas** vigentes), impresión en PDF con el formato actual, pedidos, clientes con privacidad
  entre vendedores, comisiones.
- **Ingeniería y costeo**: equipos y subensambles con editor de lista de materiales, duplicar
  con parámetros, historial de costo/precio, panel de márgenes con simulador. **Planos** con
  folio y revisión (A, B, C…): el archivo sigue en Drive, el ERP sabe cuál es el vigente y con
  cuál se fabricó cada orden, y avisa al taller si cambió después.
- **Compras**: actualización rápida de costos, órdenes de compra, requisiciones, proveedores y
  la **cola de solicitudes de precio** de ventas, con vencimiento en horas hábiles: el vendedor
  pide desde el cotizador y recibe el precio de lista y la entrega (nunca el costo).
- **Almacén**: existencias por almacén (incluido Full de Mercado Libre), entradas/salidas,
  traspasos, ajustes con autorización, conteos físicos, reabasto.
- **Importaciones**: embarques de la proforma a la bodega (ETD/ETA, días libres, documentos
  leídos por Claude, gastos y prorrateo al costo), cruzado con las órdenes de compra.
- **Producción**: pantalla del gerente (tablero por estado y carga del taller), órdenes con
  validación de material, **terminal de piso** para tablet y **pantalla de TV** del taller.
- **Servicio y mantenimiento**: instalaciones, garantías y reparaciones con cuadrilla, evidencia
  y firma; máquinas y herramienta del taller con preventivos, fallas reportadas desde el piso y
  resguardo por empleado.
- **Administración**: personal, vacaciones (LFT 2023), **objetivos y bonos** por puesto,
  checklist diario, **prenómina** semanal, "mi desempeño", cobranza, pagos a proveedores.
- **Sistema**: usuarios y permisos, importación desde Sheets, bitácora, configuración.

## Arquitectura

- **Frontend**: React 18 + Vite + TypeScript + Tailwind (`src/`). Se publica como sitio estático.
- **Backend**: Supabase — Postgres con la lógica de negocio en SQL (`supabase/migrations/`),
  Auth con Google Workspace, Realtime para la TV de piso y los precios.
- **Seguridad**: Row Level Security en todas las tablas; permisos rol × módulo × nivel.
- **Claude**: función de borde `supabase/functions/asistente` (la llave vive solo ahí). Lo
  barato primero: `hallazgos()` y `oportunidades_sugeridas()` son reglas en SQL que funcionan
  sin IA; Claude las cruza, contesta preguntas abiertas y redacta. Solo lee.
- **Pruebas**: `supabase/pruebas/*.sql` prueban reglas y permisos con usuarios reales de cada
  rol; `src/**/*.test.ts` prueba el importador con filas reales de las hojas;
  `supabase/functions/**/*.test.ts` prueba el asistente contra la base local con un Claude falso.

Detalles para quien programa: [`CLAUDE.md`](CLAUDE.md). Despliegue: [`docs/despliegue.md`](docs/despliegue.md).
Plan de arranque: [`docs/arranque.md`](docs/arranque.md). Análisis de cada hoja original: [`docs/analisis/`](docs/analisis/).

## Desarrollo local

```bash
npm install
npm run db:start                     # Supabase local (Docker)
npx supabase db reset                # crea la base desde las migraciones
node scripts/usuarios-locales.mjs    # un usuario por rol, contraseña hegamex-local
npx supabase status -o env           # copia API_URL y ANON_KEY a .env.local (ver .env.example)
npm run dev                          # http://localhost:5173
npx tsx scripts/asistente-local.ts   # el asistente en :54329 (VITE_ASISTENTE_URL en .env.local);
                                     # con ANTHROPIC_API_KEY en el entorno usa Claude de verdad
npm run db:test && npm test          # pruebas
```

Para cargar los datos reales: `npm run importar -- --dir <carpeta con volcados>` o
`--google` con un token de Google (ver `scripts/importar.ts`).

### Verificar desde cero sin tocar tu base

`db reset` borra lo que tengas cargado. Para comprobar que las migraciones aplican limpias en
una base nueva, levanta **otra** instancia con otro `project_id` y otros puertos:

```bash
V=/tmp/erp-verif && mkdir -p $V/supabase && cp -r supabase/migrations supabase/functions $V/supabase/
sed -E -e 's/^project_id = .*/project_id = "erp-verif"/' -e 's/^(\s*)(port|shadow_port) = 54([0-9]{3})$/\1\2 = 55\3/' \
  -e 's/^inspector_port = 8083/inspector_port = 9083/' supabase/config.toml > $V/supabase/config.toml
ln -s $PWD/node_modules $V/node_modules
(cd $V && SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start -x logflare,vector,imgproxy,edge-runtime,studio,mailpit,supavisor)
(cd $V && node $OLDPWD/scripts/usuarios-locales.mjs)
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres VITE_SUPABASE_URL=http://127.0.0.1:55321
npm run db:test && npm test                      # las pruebas aceptan esas dos variables
npx vite --port 5174 &                           # el navegador contra la base nueva
APP_URL=http://localhost:5174 node scripts/recorrido.mjs   # todas las pantallas con cada rol
```

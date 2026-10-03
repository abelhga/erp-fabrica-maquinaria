# Notas para Claude

ERP de Hegamex (Máquinas y Herramientas Gamex): fábrica de bandas transportadoras,
dosificadoras, cribadoras, tolvas, silos y elevadores, que además vende componentes
(colectores, poleas, cangilones, catarinas, cosedoras) directo, por Mercado Libre y por
su sitio web. Reemplaza un sistema de hojas de Google Sheets ligadas con IMPORTRANGE.

**Todo lo que ve el usuario va en español de México.** Comentarios y commits también,
y explican **por qué**, no qué. Mira `git log` antes del primer commit.

## Arquitectura en un párrafo

React + Vite + TypeScript + Tailwind en `src/`, Supabase (Postgres + Auth + Realtime) en
`supabase/`. **La lógica de negocio vive en la base**: costeo, precios, folios, reservas,
reabasto, comisiones, permisos. La pantalla llama funciones (`supabase.rpc`) y lee vistas;
no recalcula nada que la base ya sepa. Si una regla importa (un precio, un permiso, que
un movimiento no se edite), va en SQL con su prueba, no en un `if` de React.

## Seguridad: la RLS es la que manda

- Permisos por **rol × módulo × nivel** (1 ver, 2 capturar, 3 administrar) en
  `permisos_rol`. `puede('compras', 2)` en SQL y `useSesion().puede("compras", 2)` en React
  dicen lo mismo. El menú y las rutas se esconden por comodidad; **la barrera es la RLS**.
- **"costos" es un módulo aparte.** Los costos viven en tablas propias (`costos_articulo`,
  `costos_calculados`, `historial_costeo`, `politicas_precio`…). Ventas ve `precios_lista`,
  nunca un costo ni un margen. Si agregas una columna con costo a una tabla que ve ventas,
  acabas de filtrar los márgenes: no lo hagas.
- **"produccion" nivel 1 lo tienen los vendedores** (para ver el avance de sus equipos).
  Para "es personal de producción" usa nivel 2. Esa confusión ya abrió los pedidos de
  todos a todos una vez (lo atrapó `20_ventas.sql`).
- Los **movimientos de inventario no se editan ni se borran** (disparador). No hay política
  de escritura: solo las funciones `security definer` (`registrar_salida`, `traspasar`,
  `surtir_material`, `recibir_orden_compra`, `resolver_ajuste`…) insertan. Un error se
  corrige con un ajuste que autoriza otra persona.
- Funciones nuevas: `security invoker` si solo leen (la RLS filtra sola); `security definer`
  solo si de verdad tienen que saltarse la RLS, y entonces **revisan `puede()` al inicio**.
- En una política, **nada que se evalúe por renglón**: `(select puede('x', n))`,
  `(select auth.uid())` y `id in (select mis_…())` (una función que regresa el conjunto). Una
  función `security definer` por renglón (`pedido_visible(id)`) o `puede()` dentro del `where`
  de una función de conjunto le costaba 0.5 s a cada consulta de un vendedor (ver `086`).

## Cómo se prueba aquí

Nada se da por bueno sin correrlo contra Supabase y el navegador de verdad.

```bash
npm run db:start                 # Supabase local (imágenes de Docker Hub; ver package.json)
npx supabase db reset            # aplica todas las migraciones desde cero
npm run db:test                  # supabase/pruebas/*.sql, cada archivo en una transacción que se deshace
node scripts/usuarios-locales.mjs   # un usuario por rol, contraseña "hegamex-local"
npx vite                         # http://localhost:5173
node scripts/capturas.mjs isaac@hegamex.com /ventas/cotizaciones   # entra con ese usuario y toma captura
OSCURO=1 node scripts/capturas.mjs …                               # en modo oscuro
ANCHO=390 ALTO=844 node scripts/capturas.mjs …                     # tamaño celular
npx tsc --noEmit -p tsconfig.json
```

- **Las pruebas SQL prueban la RLS de verdad**: `pg_temp.usuario(correo, roles)` crea la
  cuenta y `pg_temp.como(id)` cambia de usuario (ver `supabase/pruebas/_ayudas.sql`).
  Cada regla nueva lleva su caso, incluido el caso "este rol NO debe poder".
- `capturas.mjs` imprime los errores de consola: una pantalla que se ve bien pero tira
  errores no está bien. **Mira cada captura** antes de dar algo por terminado.
- Docker: si `docker info` falla, arranca el demonio con `dockerd &`.
- La base local es compartida: **no hagas `db reset` si hay otro trabajo en curso** sobre
  ella; aplica tu migración nueva con `psql "$DB_URL" -f archivo.sql`.
- Para probar **desde cero** sin borrar la base de nadie, levanta otra instancia con otro
  `project_id` y puertos 55xxx (receta en el README, "Verificar desde cero"). `probar-bd.mjs`,
  `vitest`, `importar.ts`, `recorrido.mjs` y `asistente-local.ts` aceptan `DATABASE_URL` /
  `VITE_SUPABASE_URL` / `APP_URL` del entorno.
- Para detener tu Vite, mata **su PID**; nunca `pkill vite` (puede haber otros corriendo).

## Convenciones del frontend

- Cada pantalla es `src/modulos/<módulo>/<Pantalla>.tsx` con `export default`. Las rutas
  están en `src/App.tsx` y el menú en `src/navegacion.ts`.
- Estructura de página: `<Pagina titulo descripcion acciones>` (en `components/layout/Shell`).
- Listas: `TablaDatos` (búsqueda sin acentos, orden, CSV). Detalle: página propia
  `/…/:id` o `Lateral` (panel derecho) si el usuario no debe perder la lista.
- Datos: React Query + Supabase. `q()` convierte errores en excepción, `useAccion()` hace
  la mutación con aviso en español e invalida consultas, `useTiempoReal(tabla, claves)`
  recarga cuando algo cambia (producción, precios, existencias).
- Buscar artículos: `BuscadorArticulo`. Elegir cliente: `SelectorCliente`.
- Formato siempre con `lib/formato` (`dinero`, `numero`, `fecha`, `porcentaje`): pesos con
  $, fechas "03 oct 2026", cifras con `className="cifra"` para que alineen.
- Colores por token (`bg-superficie`, `text-tenue`, `text-marca-texto`, `bg-ok-suave`…), nunca
  hex sueltos, para que el modo oscuro funcione solo. Gráficas: `SERIE(n)` en orden fijo,
  un solo eje, leyenda si hay 2+ series, tooltip con tinta de texto.
- Estados vacíos con `Vacio` que diga qué hacer, no solo "sin datos".
- Pensado para gente que viene de hojas de cálculo: captura rápida con teclado (Enter
  guarda, Tab avanza), nada de formularios eternos, y lo importante visible sin clics.

## El negocio, en lo que más importa

- **Precio de equipo** = costo × (1 + recargos sobre costo) [+ medida especial] ÷
  (1 − utilidad/(1 − ISR) − recargos sobre precio), redondeado hacia arriba a $100 (abajo
  de $100k) o $1,000. Es la forma despejada de la referencia circular de "Nuevo Costeo"; da
  idénticos los 476 precios de la hoja. Componentes: costo ÷ 0.70.
- **Subensambles** se comparten entre equipos (no se copian). Las cantidades pueden
  depender de un parámetro del equipo (`largo_m`): la banda de 22 m es la de 20 m con otro
  parámetro (`duplicar_articulo`).
- **Stock mínimo**: la regla de la hoja Demanda (3 de 6 meses con consumo, promedio de los
  meses con consumo, punto de reorden = demanda/22 × días de entrega + seguridad) más
  meses de cobertura por artículo: 1 nacional, 6 importado.
- **Comisiones**: 2 % sin IVA de todo lo que no es refacción + bono por escalón de meta de
  maquinaria + bono por escalón de refacciones. Crédito compartido entre vendedores.
- **Almacenes**: Planta Baja, Mallado, Planta Alta, Contenedor 1 y 2, Revolución y
  Almacén ML (Full de Mercado Libre: existe, pero no cuenta para planta).

Los análisis completos de cada hoja original están en `docs/analisis/`.

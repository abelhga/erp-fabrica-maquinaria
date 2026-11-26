# Demostración comercial: «Fábrica Atlas Industrial»

Una copia del ERP con una fábrica inventada de **remolques y carrocerías**, para enseñárselo a un
posible socio sin enseñar nada de Hegamex (clientes, costos, márgenes, ventas, personas,
proveedores, agentes aduanales) ni su giro: con bandas y dosificadoras se reconocía a Hegamex
aunque tuviera otro nombre.

## Qué hay

- **Base**: `scripts/demo-comercial/cargar.sh` llena una base recién migrada, en este orden:
  - las cuentas de prueba y los scripts de `scripts/demo/*` (cada módulo, con las funciones de la app);
  - `giro.sql`: el catálogo, las etapas, los tipos, las familias y los textos pasan a remolques;
  - `historial.sql`: ~110 clientes, el libro de ventas de 2023 a septiembre de 2026, y octubre y
    noviembre como meses normales en el ERP (pedidos, cobros y gastos de operación);
  - `actividad.sql`: los remolques confirmados entran a producción, órdenes para stock, 45 días de
    uso del ERP por persona y la bitácora repartida en esos días;
  - el análisis, `maquillaje.sql` (personas, correos, proveedores reales y la marca «DEMO»; se
    detiene si queda algo de Hegamex) y `funciones_con_marca.sql`.
- **Sitio**: https://forja-erp-demo.pages.dev (Cloudflare Pages, proyecto `forja-erp-demo`, se
  construye solo desde la rama `claude/dazzling-einstein-7mh2of`). El mismo código con
  `VITE_EMPRESA="Fábrica Atlas Industrial"`, `VITE_PRODUCTO="Forja ERP"`, `VITE_LOGO=generico` y
  `VITE_ENTRAR_CON_GOOGLE=no` (ver `src/lib/marca.ts`). Sin esas variables todo dice Hegamex.
- **Cuentas** (una por puesto): `direccion@`, `rodrigo@` / `fernando@` / `paola@` (ventas),
  `gerente.ventas@`, `ingenieria@`, `compras@`, `almacen@`, `gerente.produccion@`, `taller@`,
  `rrhh@`, `finanzas@`, `importaciones@`, `recepcion@`, `mantenimiento@`, `marketing@`,
  `procesos@`, `tv@` y `sistemas@`, todas `@fabricaatlas.demo`.

## Armarla en local

```bash
npx supabase db reset
bash scripts/demo-comercial/cargar.sh
```

## Subirla a la nube (proyecto `erp-demo`, ref `ommeldwculmfxbxihxhl`, us-west-1)

Estado al 26 nov 2026: arriba y funcionando (remolques). Para volver a subirla (o a otro proyecto),
en orden (la llave de Supabase del conector debe alcanzar al proyecto):

1. Migraciones: `NUBE_REF=ommeldwculmfxbxihxhl python3 scripts/nube/migrar.py` (crea pg_cron).
   Antes, `create extension if not exists pg_net;`. Después (y después de cada migración nueva),
   `scripts/demo-comercial/funciones_con_marca.sql`: los mensajes de las funciones dicen Hegamex.
2. Datos: armar la base local (arriba) y `scripts/demo-comercial/subir_datos.py` (ahí dice cómo
   sacar el respaldo; `--reemplazar` cambia una demo anterior completa).
3. `despues_de_subir.sql` y una contraseña propia para las cuentas (no `hegamex-local`).
4. Funciones: `asistente`, `revision` (`--no-verify-jwt`) y `ver-como`, desplegadas desde una
   copia de `supabase/functions` con «Hegamex» / «Máquinas y Herramientas Gamex» / «Yao Han»
   cambiados por la empresa inventada (sus instrucciones a la IA traen el nombre escrito).
5. La llave de la IA: Abel la pone en `erp-demo` → Edge Functions → Secrets → `ANTHROPIC_API_KEY`.
6. Sitio: Worker aparte en Cloudflare (otro `name`, no `erp-fabrica-maquinaria`) con
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DOMINIO_EMPRESA=fabricaatlas.demo`,
   `VITE_EMPRESA=Fábrica Atlas Industrial`, `VITE_LOGO=generico`.
8. Revisar con `capturas.mjs` contra el sitio publicado, con varios puestos.

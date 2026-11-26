# Demostración comercial: «Fábrica Atlas Industrial»

Una copia del ERP con una fábrica inventada, para enseñárselo a un posible socio sin enseñar
nada de Hegamex (clientes, costos, márgenes, ventas, personas, proveedores, agentes aduanales).

## Qué hay

- **Base**: `scripts/demo-comercial/cargar.sh` llena una base recién migrada: las cuentas de
  prueba, los scripts de `scripts/demo/*`, la historia de ventas inventada (`historial.sql`), el
  análisis y al final `maquillaje.sql`, que cambia personas, correos, proveedores y la marca
  «DEMO» por los de la empresa inventada y se detiene si queda algo de Hegamex.
- **Sitio**: el mismo código construido con `VITE_EMPRESA="Fábrica Atlas Industrial"` y
  `VITE_LOGO=generico` (ver `src/lib/marca.ts`). Sin esas variables todo dice Hegamex.
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

Estado al 26 nov 2026: el proyecto existe y está **vacío**. La llave de Supabase de las sesiones
en la nube (la del conector de claude.ai) solo alcanzaba a `erp-hegamex`; hay que darle acceso a
`erp-demo` antes de seguir. Falta, en orden:

1. Migraciones: `NUBE_REF=ommeldwculmfxbxihxhl python3 scripts/nube/migrar.py` (crea pg_cron).
   Antes, `create extension if not exists pg_net;`.
2. Datos: armar la base local (arriba) y pasar un respaldo de solo datos de `public` y de
   `auth.users` / `auth.identities` (pg_dump del contenedor: el de Ubuntu es versión 16), vaciando
   antes las tablas de `public` que llenan las migraciones y con
   `session_replication_role = replica` (hay llaves circulares y tablas inalterables).
3. Contraseña propia para las cuentas (no `hegamex-local`) y `asistente.limite_diario` bajo.
4. Funciones: `asistente`, `revision` (`--no-verify-jwt`) y `ver-como`, desplegadas desde una
   copia de `supabase/functions` con «Hegamex» / «Máquinas y Herramientas Gamex» / «Yao Han»
   cambiados por la empresa inventada (sus instrucciones a la IA traen el nombre escrito).
5. La llave de la IA: Abel la pone en `erp-demo` → Edge Functions → Secrets → `ANTHROPIC_API_KEY`.
6. Sitio: Worker aparte en Cloudflare (otro `name`, no `erp-fabrica-maquinaria`) con
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DOMINIO_EMPRESA=fabricaatlas.demo`,
   `VITE_EMPRESA=Fábrica Atlas Industrial`, `VITE_LOGO=generico`.
7. Borrar la función `cargador` de `erp-demo` (quedó desactivada; fue un intento de carga sin la
   API de administración).
8. Revisar con `capturas.mjs` contra el sitio publicado, con varios puestos.

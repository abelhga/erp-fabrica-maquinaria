// Mientras almacén siga capturando en "2025 - Inventario 2.0", el ERP se pone al día con
// la hoja: las existencias de cada artículo por almacén salen de la pestaña Inventario, y
// los renglones nuevos de Registro se agregan al historial (de ahí sale la demanda).
//
//   npx tsx scripts/sincronizar-inventario.ts --inventario inventario.json --registro registro.json \
//     --encabezado registro_encabezado.json --desde-fila 31975 > sincronizar.sql
//
// Los .json son volcados de la API de Sheets ({ values: [[…]] }): Inventario!A1:AA8000, las
// filas 1 a 12 de Registro (encabezado) y Registro desde --desde-fila. Escribe un SQL de una
// sola transacción; con --ensayo termina en "raise exception 'ENSAYO …'" para ver el resumen
// sin cambiar nada (scripts/nube/sql_nube.py lo corre en la nube).
//
// Las existencias se reemplazan (no se suman ajustes): solo mientras el ERP no tenga
// movimientos propios. El día que almacén capture en el ERP, el SQL se niega a correr.
import { readFileSync } from "node:fs";
import * as T from "../src/importador/transformar";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const valores = (ruta: string) => (JSON.parse(readFileSync(ruta, "utf8")).values ?? []) as string[][];
const requerido = (n: string) => arg(n) ?? (() => { throw new Error(`Falta ${n}`); })();

const inventario = T.inventario(valores(requerido("--inventario")));
const desde = Number(requerido("--desde-fila"));
const encabezado = valores(requerido("--encabezado"));
const nuevos = valores(requerido("--registro"));
// registro() numera desde el encabezado (fila 12); se recorre a la fila real de la hoja.
const { movimientos } = T.registro([[...encabezado, ...nuevos]]);
const filaReal = (f: number) => f - (encabezado.length + 1) + desde;

const filas: { llave: string; almacen: string; cantidad: number }[] = [];
const reservados: { llave: string; cantidad: number }[] = [];
const negativos: string[] = [];
for (const e of inventario) {
  for (const [alm, n] of Object.entries(e.por_almacen)) {
    if (n < 0) { negativos.push(`${e.nombre} (${alm}: ${n})`); continue; }
    // Lo apartado en la hoja está físicamente en Planta Baja; en el ERP queda como reserva.
    if (alm === "RESERVADO") { filas.push({ llave: e.llave, almacen: "Planta Baja", cantidad: n }); reservados.push({ llave: e.llave, cantidad: n }); }
    else filas.push({ llave: e.llave, almacen: alm, cantidad: n });
  }
}
const historial = movimientos.map((m) => ({ ...m, fila: filaReal(m.fila) }));
// Lo que almacén dio de alta (o renombró) en la hoja después de importar: entra como
// componente, igual que en el importador, para que su existencia no se pierda.
const articulosHoja = inventario.filter((e) => !/^horas? hombre/.test(e.llave))
  .map((e) => ({ llave: e.llave, nombre: e.nombre, unidad: e.unidad, tipo: T.tipoComponente(e.nombre, e.unidad), concepto: e.concepto, seguridad: e.seguridad }));
const hoy = new Date().toISOString().slice(0, 10);
const lit = (x: unknown) => `$json$${JSON.stringify(x)}$json$::jsonb`;

const sql = `-- Sincronización de inventario con la hoja (${hoy}): ${filas.length} existencias, ${historial.length} renglones de Registro.
do $s$
begin
  if exists (select 1 from public.movimientos_inventario where tipo <> 'inicial') then
    raise exception 'El ERP ya tiene movimientos propios: las existencias ya no se reemplazan con la hoja (corrige con conteo y ajustes)';
  end if;
end $s$;

create temp table _nuevos on commit drop as
  select x.*, row_number() over (order by x.nombre) n
  from jsonb_to_recordset(${lit(articulosHoja)}) x(llave text, nombre text, unidad text, tipo text, concepto text, seguridad numeric)
  where not exists (select 1 from public.articulos a where a.legacy_id = 'LC:' || x.llave);
insert into public.articulos (legacy_id, clave, tipo, nombre, unidad, categoria_id, stock_minimo_fijo)
select 'LC:' || x.llave,
  'C-N' || lpad((coalesce((select max(substr(clave, 4)::int) from public.articulos where clave ~ '^C-N[0-9]+$'), 0) + x.n)::text, 4, '0'),
  x.tipo::public.tipo_articulo, x.nombre, x.unidad, (select id from public.categorias where nombre = x.concepto), x.seguridad
from _nuevos x;

create temp table _antes on commit drop as
  select articulo_id, almacen_id, sum(cantidad) c from public.movimientos_inventario group by 1, 2;

alter table public.movimientos_inventario disable trigger inalterable;
delete from public.reservas where motivo = 'Apartado en la hoja (RESERVADO) al importar';
delete from public.movimientos_inventario where tipo = 'inicial';
delete from public.existencias;
alter table public.movimientos_inventario enable trigger inalterable;

insert into public.movimientos_inventario (tipo, articulo_id, almacen_id, cantidad, motivo, costo_unitario)
select 'inicial', a.id, al.id, sum(x.cantidad), 'Existencia sincronizada con la hoja Inventario (${hoy})', max(c.costo)
from jsonb_to_recordset(${lit(filas)}) x(llave text, almacen text, cantidad numeric)
join public.articulos a on a.legacy_id = 'LC:' || x.llave
join public.almacenes al on al.nombre = x.almacen
left join public.costos_articulo c on c.articulo_id = a.id
group by a.id, al.id having sum(x.cantidad) > 0;

insert into public.reservas (articulo_id, cantidad, motivo)
select a.id, x.cantidad, 'Apartado en la hoja (RESERVADO) al importar'
from jsonb_to_recordset(${lit(reservados)}) x(llave text, cantidad numeric) join public.articulos a on a.legacy_id = 'LC:' || x.llave;

-- Registro: solo lo que el historial todavía no tiene.
create temp table _hist on commit drop as
  select x.* from jsonb_to_recordset(${lit(historial)}) x(fecha text, llave text, nombre text, cantidad numeric, tipo text, almacen text,
    personal text, motivo text, documento text, proveedor text, notas text, merma boolean, fila int)
  where x.fila > coalesce((select max(fila_origen) from public.historial_movimientos_hoja), 0);
insert into public.historial_movimientos_hoja (fecha, articulo_id, nombre_original, cantidad, tipo, almacen, personal, motivo, documento, proveedor, notas, merma, fila_origen)
select x.fecha::timestamptz, a.id, x.nombre, x.cantidad, x.tipo, x.almacen, x.personal, x.motivo, x.documento, x.proveedor, x.notas, x.merma, x.fila
from _hist x left join public.articulos a on a.legacy_id = 'LC:' || x.llave;

do $s$
declare r jsonb;
begin
  select jsonb_build_object(
    'existencias_cargadas', (select count(*) from public.movimientos_inventario where tipo = 'inicial'),
    'articulos_que_cambiaron', (select count(*) from (
        select coalesce(a.articulo_id, d.articulo_id), coalesce(a.almacen_id, d.almacen_id)
        from _antes a full join (select articulo_id, almacen_id, sum(cantidad) c from public.movimientos_inventario group by 1, 2) d
          on d.articulo_id = a.articulo_id and d.almacen_id = a.almacen_id
        where coalesce(a.c, 0) <> coalesce(d.c, 0)) z),
    'piezas_antes', (select sum(c) from _antes), 'piezas_despues', (select sum(cantidad) from public.movimientos_inventario),
    'articulos_nuevos', (select jsonb_agg(c.clave || ' ' || c.nombre order by c.clave) from public.articulos c join _nuevos x on c.legacy_id = 'LC:' || x.llave),
    'registro_nuevos', (select count(*) from _hist), 'registro_sin_articulo', (select count(*) from _hist x where not exists (select 1 from public.articulos a where a.legacy_id = 'LC:' || x.llave)),
    'negativos_omitidos', ${negativos.length})
  into r;
  ${args.includes("--ensayo") ? "raise exception 'ENSAYO %', r;" : "raise notice 'Sincronizado: %', r;"}
end $s$;
`;
process.stdout.write(sql);
if (negativos.length) process.stderr.write(`Existencias negativas en la hoja (no se cargan, revisar con conteo):\n  ${negativos.join("\n  ")}\n`);

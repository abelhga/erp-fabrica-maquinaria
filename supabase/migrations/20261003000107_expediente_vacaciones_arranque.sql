-- =============================================================================
-- Expediente del empleado y saldo de vacaciones con que arranca el ERP.
--
-- Por qué: RRHH llevaba en DATOS COLABORADORES el tipo de sangre, la información
-- médica, el crédito Infonavit y si cada contrato está firmado, y en NOMINAS los
-- días de vacaciones que le quedan a cada quien. El ERP no tenía dónde guardarlo,
-- y el saldo de vacaciones salía como si nadie hubiera tomado ningún día este año.
--
-- 1. empleado_datos (solo RRHH administración, como CURP o salario): tipo de sangre,
--    información médica, Infonavit y contratos.
-- 2. vacaciones_arranque: el saldo que traía la hoja y su fecha. Mientras siga el
--    mismo periodo, el saldo es ese menos lo que se tome en el ERP; al cumplir otro
--    año, se calcula como siempre.
-- =============================================================================

alter table public.empleado_datos
  add column tipo_sangre text check (tipo_sangre in ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  add column informacion_medica text,            -- alergias, enfermedades, medicamentos: lo que hay que saber en una emergencia
  add column infonavit_credito text,             -- número de crédito
  add column infonavit_descuento text,           -- tipo y monto del descuento, como lo dice el aviso de retención
  add column contrato_trabajo text check (contrato_trabajo in ('firmado', 'pendiente')),
  add column contrato_confidencialidad text check (contrato_confidencialidad in ('firmado', 'pendiente')),
  add column contrato_adicional text check (contrato_adicional in ('firmado', 'pendiente', 'no_aplica'));

create table public.vacaciones_arranque (
  empleado_id uuid primary key references public.empleados(id) on delete cascade,
  fecha date not null,                  -- día en que se tomó el saldo de la hoja
  saldo numeric(5,1) not null,          -- días que le quedaban ese día (puede incluir días de años anteriores)
  nota text,
  registrado_por uuid default auth.uid() references public.perfiles(id),
  creado_en timestamptz not null default now()
);
alter table public.vacaciones_arranque enable row level security;
-- Lo ve quien ve las vacaciones (RRHH, la gerencia de producción y el propio empleado); lo cambia RRHH administración.
create policy ver on public.vacaciones_arranque for select to authenticated using (
  (select puede('rrhh', 1)) or (select puede('produccion', 3))
  or empleado_id in (select id from public.empleados where usuario_id = (select auth.uid())));
create policy editar on public.vacaciones_arranque for all to authenticated
  using ((select puede('rrhh', 3))) with check ((select puede('rrhh', 3)));
create trigger auditar after insert or update or delete on public.vacaciones_arranque for each row execute function public.auditar();

create or replace view public.v_vacaciones with (security_invoker = true) as
select e.id empleado_id, e.nombre, e.fecha_ingreso, x.anios,
  dias_vacaciones(x.anios) as dias_periodo,
  x.inicio_periodo,
  -- Con saldo de arranque (lo que la hoja decía al pasar al ERP) cuenta ese saldo menos lo
  -- tomado después; sin él, o ya en el periodo siguiente, como siempre.
  case when a.saldo is null then t.tomados else t.tomados_desde + greatest(0, dias_vacaciones(x.anios) - a.saldo) end as tomados,
  case when a.saldo is null then dias_vacaciones(x.anios) - t.tomados else a.saldo - t.tomados_desde end as saldo,
  (x.inicio_periodo + interval '1 year')::date as proximo_aniversario,
  dias_vacaciones(x.anios + 1) as dias_proximo_periodo,
  t.solicitados,
  (x.inicio_periodo + interval '6 months')::date as disfrutar_antes_de,    -- art. 81: dentro de los 6 meses siguientes
  a.saldo as saldo_arranque, a.fecha as fecha_arranque
from public.empleados e
cross join lateral (
  select extract(year from age(current_date, e.fecha_ingreso))::int anios,
         (e.fecha_ingreso + make_interval(years => extract(year from age(current_date, e.fecha_ingreso))::int))::date inicio_periodo
) x
left join lateral (
  select v.saldo, v.fecha from public.vacaciones_arranque v
  where v.empleado_id = e.id and v.fecha >= x.inicio_periodo
) a on true
cross join lateral (
  select coalesce(sum(i.dias) filter (where i.estado = 'aprobada'), 0) tomados,
         coalesce(sum(i.dias) filter (where i.estado = 'aprobada' and i.inicio >= coalesce(a.fecha, x.inicio_periodo)), 0) tomados_desde,
         coalesce(sum(i.dias) filter (where i.estado = 'solicitada'), 0) solicitados
  from public.incidencias i
  where i.empleado_id = e.id and i.tipo = 'vacaciones' and i.inicio >= x.inicio_periodo
) t
where e.activo;

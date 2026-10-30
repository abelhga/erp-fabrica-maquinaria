-- Revisión nocturna: cada madrugada la base barre lo capturado buscando errores de captura y
-- patrones raros, y le deja a cada responsable lo suyo en «Por revisar».
--
-- Por qué así y no un agente que corra toda la noche:
--   * Lo que se puede decir con una regla (un artículo dado de alta dos veces, un pago repetido,
--     un tiempo de taller que nadie cerró) lo dice SQL: es exacto, no cuesta y se puede probar.
--   * Lo que pide criterio (una nota que no cuadra, una salida que no se parece a las demás) lo
--     lee Claude por la API de lotes (Message Batches): sale a mitad de precio y tiene hasta 24 h,
--     y a las 2 de la mañana nadie está esperando. No hay ningún servidor prendido para esto:
--     pg_cron despierta a una función de Supabase, que manda el lote y se apaga; a las 6 otra
--     vuelta recoge lo que Claude contestó.
--   * Claude nunca corrige nada solo. Propone; la persona contesta «Está bien así», «Ya lo
--     corregí» o, cuando la corrección es segura y está definida aquí, «Corrígelo». A Claude no le
--     llegan costos de artículos, márgenes, sueldos ni datos personales (teléfonos, correos, RFC).
--   * Lo que huele a robo hormiga (consumos que se disparan, ajustes negativos que se repiten,
--     gastos de caja chica iguales) va SOLO a dirección, como «patrón a revisar», con la
--     evidencia, sin acusar a nadie.
--
-- Además, los lunes Claude escribe a cada persona hasta tres consejos con sus propios números:
-- a un vendedor, si sus cotizaciones con llamada cierran más que las de solo WhatsApp, y cómo
-- probarlo él mismo; a quien captura todo de golpe en la tarde (como en la hoja), por qué conviene
-- capturar al momento. La persona dice si le sirvió y eso entra a los consejos siguientes.

-- 1. ---------------------------------------------------------------------------------------
-- Interruptores. «claude» y «consejos» se pueden apagar sin apagar las reglas; el tope de tokens
-- del mes evita que un mes con muchos datos se coma el presupuesto de la API.
insert into public.configuracion (clave, valor, descripcion) values ('revision_nocturna',
  jsonb_build_object('activa', true, 'claude', true, 'consejos', true, 'modelo', 'claude-opus-5-5',
                     'tope_tokens_mes', 30000000, 'dia_consejos', 1),
  'Revisión nocturna: reglas, lectura de Claude y consejos semanales')
on conflict (clave) do nothing;

-- Guardar la configuración recalcula el costeo (192); la de la revisión no toca ningún costo.
create or replace function public.disparar_recalculo_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from nuevos n join viejos v on v.clave = n.clave
             where n.valor is distinct from v.valor and n.clave <> 'horas_taller' and n.clave not like 'mercadolibre%'
               and n.clave <> 'revision_nocturna') then
    perform recalcular_costos();
  end if;
  return null;
end $$;

-- La llave con la que pg_cron despierta a la función. Nadie con sesión la lee (RLS sin políticas).
create table public.revision_cuenta (
  id int primary key default 1 check (id = 1),
  url_funciones text,
  llave text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
alter table public.revision_cuenta enable row level security;
insert into public.revision_cuenta (id) values (1);

-- 2. ---------------------------------------------------------------------------------------
create table public.revision_reglas (
  clave text primary key,
  modulo text not null,
  nombre text not null,
  descripcion text not null,
  -- «direccion»: patrones que pueden señalar a una persona; nunca le llegan al responsable.
  para text not null check (para in ('responsable', 'direccion')),
  activa boolean not null default true,
  -- Las que miden un estado (un tiempo abierto, una OC atrasada) se cierran solas cuando el
  -- estado se corrige; las de un hecho (un pago repetido) esperan respuesta.
  se_resuelve_sola boolean not null default false
);

create table public.revision_corridas (
  id bigserial primary key,
  empezo_en timestamptz not null default now(),
  reglas_en timestamptz,
  claude_estado text not null default 'no' check (claude_estado in ('no', 'enviado', 'recogido', 'error', 'apagado', 'tope')),
  lote_id text,
  peticiones int not null default 0,
  entrada_tokens bigint not null default 0,
  salida_tokens bigint not null default 0,
  hallazgos_reglas int not null default 0,
  hallazgos_claude int not null default 0,
  consejos int not null default 0,
  -- Lo que Claude leyó de cada módulo en dos o tres frases: { "inventario": "…", … }.
  lecturas jsonb not null default '{}',
  nota text,
  termino_en timestamptz
);

create table public.revision_hallazgos (
  id uuid primary key default gen_random_uuid(),
  corrida_id bigint references public.revision_corridas on delete set null,
  origen text not null check (origen in ('regla', 'claude')),
  regla text references public.revision_reglas on delete set null,
  modulo text not null,
  tabla text,
  registro_id text,
  ruta text,
  titulo text not null,
  detalle text not null,
  evidencia jsonb not null default '[]',
  para text not null check (para in ('responsable', 'direccion')),
  responsables uuid[] not null default '{}',
  gravedad text not null default 'media' check (gravedad in ('baja', 'media', 'alta')),
  -- La corrección segura que la persona puede pedir con «Corrígelo» (ver revision_aplicar_accion).
  accion jsonb,
  -- Lo que hace que un hallazgo sea «el mismo» de una noche a otra.
  huella text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'bien_asi', 'corregido', 'resuelto')),
  respuesta text,
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  cerrado_por uuid references public.perfiles
);
create unique index revision_hallazgos_huella_abierta on public.revision_hallazgos (huella) where estado = 'abierto';
create index revision_hallazgos_huella on public.revision_hallazgos (huella);
create index revision_hallazgos_abiertos on public.revision_hallazgos using gin (responsables) where estado = 'abierto';
alter table public.revision_hallazgos enable row level security;
-- Cada quien ve lo suyo; dirección, todo. Los patrones (para = direccion) no traen responsables.
create policy revision_hallazgos_ver on public.revision_hallazgos for select to authenticated using (
  (para = 'responsable' and (select auth.uid()) = any (responsables)) or (select tiene_rol('direccion')));

alter table public.revision_reglas enable row level security;
create policy revision_reglas_ver on public.revision_reglas for select to authenticated using ((select tiene_rol('direccion')));
alter table public.revision_corridas enable row level security;
create policy revision_corridas_ver on public.revision_corridas for select to authenticated using ((select tiene_rol('direccion')));

create table public.consejos (
  id uuid primary key default gen_random_uuid(),
  corrida_id bigint references public.revision_corridas on delete set null,
  usuario_id uuid not null references public.perfiles on delete cascade,
  semana date not null,
  tema text not null check (tema in ('ventas', 'uso_erp', 'habito', 'experimento', 'equipo')),
  titulo text not null,
  texto text not null,
  por_que text,
  experimento text,
  opinion text check (opinion in ('util', 'no_util')),
  opinado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index consejos_usuario on public.consejos (usuario_id, semana desc);
alter table public.consejos enable row level security;
create policy consejos_ver on public.consejos for select to authenticated using (
  usuario_id = (select auth.uid()) or (select tiene_rol('direccion')));

-- 3. ---------------------------------------------------------------------------------------
-- Ayudas para las reglas.
create type public.revision_hallazgo_nuevo as (
  tabla text, registro_id text, ruta text, titulo text, detalle text, evidencia jsonb,
  responsables uuid[], gravedad text, accion jsonb, huella text);

-- Quién dio de alta un registro: lo dice la bitácora (artículos y otras tablas no guardan creado_por).
create or replace function public.revision_quien_dio_alta(p_tabla text, p_registro text) returns uuid
language sql stable security definer set search_path = public as $$
  select usuario_id from bitacora where tabla = p_tabla and registro_id = p_registro and accion = 'alta'
  order by en limit 1
$$;
revoke execute on function public.revision_quien_dio_alta(text, text) from public, anon, authenticated;

create or replace function public.revision_nombre(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(nombre), ''), split_part(correo, '@', 1)) from perfiles where id = p
$$;
revoke execute on function public.revision_nombre(uuid) from public, anon, authenticated;

-- Para comparar nombres capturados a mano: sin acentos, minúsculas, un espacio.
create or replace function public.revision_normalizar(p text) returns text
language sql stable set search_path = public, extensions as $$
  select trim(regexp_replace(lower(unaccent(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function public.revision_ruta_articulo(p_tipo text, p_id uuid) returns text
language sql immutable as $$
  select case when p_tipo = 'equipo' then '/costeo/equipos/' else '/costeo/componentes/' end || p_id
$$;

-- 4. ---------------------------------------------------------------------------------------
-- Las reglas. Cada una es una función sin parámetros que regresa hallazgos; el corredor les pone
-- módulo, corrida y estado. Ventana corta en las de «hechos» (3 días: si una noche falla, la
-- siguiente la alcanza) y todo lo vigente en las de «estado».

-- 4.1 Un artículo dado de alta otra vez con otra clave. Mismo tipo y unidad, nombre casi igual
-- y LAS MISMAS CIFRAS en el nombre: «Chumacera 1"» y «Chumacera 1 1/4"» se parecen mucho y no son
-- el mismo, por eso las medidas tienen que coincidir. Los equipos no entran: una variante se copia
-- de otro a propósito («Tolva doble 7 m³» e «inoxidable» se parecen y son dos). 14 días porque una
-- alta repetida se nota tarde (se ve cuando alguien busca y salen dos).
create or replace function public.revision_r_articulo_duplicado() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with nuevos as (
    select a.*, revision_normalizar(a.nombre) n, regexp_replace(a.nombre, '\D', '', 'g') cifras,
           revision_quien_dio_alta('articulos', a.id::text) quien
    from articulos a
    where a.activo and a.tipo <> 'equipo'
      and exists (select 1 from bitacora b where b.tabla = 'articulos' and b.registro_id = a.id::text
                    and b.accion = 'alta' and b.en > now() - interval '14 days')
  ), pares as (
    select distinct on (n.id) n.id, n.clave, n.nombre, n.tipo, n.quien, o.id o_id, o.clave o_clave, o.nombre o_nombre,
           similarity(n.n, revision_normalizar(o.nombre)) sim
    from nuevos n
    join articulos o on o.id <> n.id and o.activo and o.tipo = n.tipo and coalesce(o.unidad, '') = coalesce(n.unidad, '')
      and regexp_replace(o.nombre, '\D', '', 'g') = n.cifras
      and o.creado_en < n.creado_en
      and similarity(n.n, revision_normalizar(o.nombre)) >= 0.8
    order by n.id, similarity(n.n, revision_normalizar(o.nombre)) desc
  )
  select 'articulos', p.id::text, revision_ruta_articulo(p.tipo::text, p.id),
    format('¿%s es el mismo artículo que %s?', p.clave, p.o_clave),
    format('«%s» se dio de alta hace poco y se parece a «%s» (%s), que ya existía. Si es el mismo, conviene dejar solo uno para que las existencias y las compras no se partan en dos.',
           p.nombre, p.o_nombre, p.o_clave),
    jsonb_build_array(
      jsonb_build_object('tipo', 'articulo', 'referencia', p.id, 'folio', p.clave, 'detalle', p.nombre),
      jsonb_build_object('tipo', 'articulo', 'referencia', p.o_id, 'folio', p.o_clave, 'detalle', p.o_nombre)),
    case when p.quien is not null then array[p.quien] else (select array_agg(u) from usuarios_con_rol('compras') u) end,
    'media',
    jsonb_build_object('tipo', 'desactivar_articulo', 'articulo', p.id, 'queda', p.o_id,
                       'texto', format('Inhabilitar %s y quedarse con %s', p.clave, p.o_clave)),
    'articulo_duplicado:' || p.id
  from pares p
$$;

-- 4.2 Una partida de compra muy lejos de lo que costó la última vez (±30 %, en pesos).
-- Atrapa el error de dedo (12,000 por 1,200) y la cotización que subió sin que nadie lo notara.
create or replace function public.revision_r_costo_compra_atipico() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with lineas as (
    select l.id, l.articulo_id, l.costo_unitario * case when o.moneda::text = 'MXN' then 1 else coalesce(o.tipo_cambio, 1) end mxn,
           o.id oc_id, o.folio, o.creado_por, o.creado_en, a.clave, a.nombre, o.moneda::text moneda, l.costo_unitario
    from oc_lineas l join ordenes_compra o on o.id = l.orden_compra_id join articulos a on a.id = l.articulo_id
    where o.estado not in ('borrador', 'cancelada') and coalesce(l.costo_unitario, 0) > 0
  ), con_anterior as (
    select l.*, (select p.mxn from lineas p where p.articulo_id = l.articulo_id and p.oc_id <> l.oc_id
                   and p.creado_en < l.creado_en and p.creado_en > l.creado_en - interval '180 days'
                 order by p.creado_en desc limit 1) anterior,
                (select p.folio from lineas p where p.articulo_id = l.articulo_id and p.oc_id <> l.oc_id
                   and p.creado_en < l.creado_en and p.creado_en > l.creado_en - interval '180 days'
                 order by p.creado_en desc limit 1) folio_anterior
    from lineas l where l.creado_en > now() - interval '3 days'
  )
  select 'ordenes_compra', c.oc_id::text, '/compras/ordenes/' || c.oc_id,
    format('%s: %s cuesta %s %s que la última vez', c.folio, c.clave,
           round(abs(c.mxn / c.anterior - 1) * 100) || ' %', case when c.mxn > c.anterior then 'más' else 'menos' end),
    format('En %s, «%s» quedó a $%s por pieza (en pesos); en %s, la compra anterior, fue de $%s. Si es un error de captura, corrígelo antes de que se reciba; si el precio cambió de verdad, contesta «Está bien así».',
           c.folio, c.nombre, to_char(c.mxn, 'FM999,999,990.00'), c.folio_anterior, to_char(c.anterior, 'FM999,999,990.00')),
    jsonb_build_array(
      jsonb_build_object('tipo', 'oc', 'referencia', c.oc_id, 'folio', c.folio, 'detalle', 'esta compra', 'cantidad', round(c.mxn, 2)),
      jsonb_build_object('tipo', 'oc', 'folio', c.folio_anterior, 'detalle', 'compra anterior', 'cantidad', round(c.anterior, 2))),
    array_remove(array[c.creado_por], null),
    case when c.mxn / c.anterior > 3 or c.mxn / c.anterior < 0.34 then 'alta' else 'media' end,
    null::jsonb,
    'costo_compra_atipico:' || c.id
  from con_anterior c
  where c.anterior > 0 and (c.mxn / c.anterior > 1.3 or c.mxn / c.anterior < 0.7)
$$;

-- 4.3 Alguien entra al ERP y no está ligado a su ficha de empleado: sus indicadores, vacaciones y
-- objetivos no le salen (le pasaba a dos vendedores). Si hay una ficha libre con nombre parecido,
-- se propone ligarla; si no, se pregunta si es empleado. Solo cuentas con movimiento en 30 días,
-- para no preguntar por cuentas viejas o de prueba. A dirección (los dueños) solo se le propone
-- ligar si hay una ficha con su nombre; no se pregunta si es empleado.
create or replace function public.revision_r_usuario_sin_ficha() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with sin as (
    select p.id, p.nombre, p.correo
    from perfiles p
    where p.activo
      and exists (select 1 from usuario_roles r where r.usuario_id = p.id and r.rol not in ('pantalla', 'terminal'))
      and not exists (select 1 from empleados e where e.usuario_id = p.id)
      and exists (select 1 from bitacora b where b.usuario_id = p.id and b.en > now() - interval '30 days')
  ), candidato as (
    select s.*, c.id e_id, c.nombre e_nombre
    from sin s
    left join lateral (
      select e.id, e.nombre from empleados e
      where e.activo and e.usuario_id is null
        and (lower(e.correo) = lower(s.correo)
             or similarity(revision_normalizar(e.nombre), revision_normalizar(s.nombre)) >= 0.5)
      order by lower(e.correo) = lower(s.correo) desc, similarity(revision_normalizar(e.nombre), revision_normalizar(s.nombre)) desc
      limit 1) c on true
  )
  select 'perfiles', c.id::text, '/rrhh/empleados',
    case when c.e_id is null then format('¿%s es empleado? Entra al ERP sin ficha', coalesce(c.nombre, c.correo))
         else format('%s entra al ERP pero no está ligado a la ficha de %s', coalesce(c.nombre, c.correo), c.e_nombre) end,
    case when c.e_id is null then
      format('La cuenta %s captura en el ERP y no tiene ficha de empleado. Sin ficha no le salen sus indicadores, objetivos ni vacaciones. Si es empleado, dale de alta y liga su cuenta; si no lo es (un externo), contesta «Está bien así».', c.correo)
    else
      format('La cuenta %s no está ligada a ninguna ficha, y la de «%s» no tiene cuenta. Mientras no estén ligadas, sus indicadores se miden con el equipo completo y no con lo suyo.', c.correo, c.e_nombre) end,
    jsonb_build_array(jsonb_build_object('tipo', 'cuenta', 'referencia', c.id, 'detalle', c.correo)),
    (select array_agg(u) from usuarios_con_rol('rrhh') u),
    'media',
    case when c.e_id is null then null else
      jsonb_build_object('tipo', 'ligar_empleado', 'perfil', c.id, 'empleado', c.e_id,
                         'texto', format('Ligar la cuenta %s a la ficha de %s', c.correo, c.e_nombre)) end,
    'usuario_sin_ficha:' || c.id
  from candidato c
  where c.e_id is not null or not exists (select 1 from usuario_roles r where r.usuario_id = c.id and r.rol = 'direccion')
$$;

-- 4.4 Etapas que alguien marcó terminadas en el ERP sin ningún tiempo de la terminal: sus horas
-- hombre quedan en cero y «horas contra costeo» mide mal (en octubre fueron 50 de 57). Uno por
-- semana con la lista, no uno por etapa: es un hábito, no un error suelto. (Un tiempo abierto en
-- una etapa pausada no hace falta revisarlo: cerrar_tramos_etapa lo cierra solo.)
create or replace function public.revision_r_etapas_sin_tiempos() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with sin as (
    select op.id, op.orden_id, o.folio, et.nombre etapa, e.usuario_id quien, e.en
    from op_operaciones op
    join ordenes_produccion o on o.id = op.orden_id
    join etapas et on et.id = op.etapa_id
    join lateral (select x.usuario_id, x.en from op_eventos x where x.operacion_id = op.id and x.tipo = 'fin'
                  order by x.en desc limit 1) e on true
    where op.estado::text = 'terminada' and e.en > now() - interval '7 days' and e.usuario_id is not null
      and not exists (select 1 from op_tiempos t where t.operacion_id = op.id)
  )
  select 'op_operaciones', null::text, '/produccion/ordenes',
    format('%s etapas se terminaron esta semana sin tiempos de la terminal', count(*)),
    format('Se marcaron terminadas %s etapas sin que nadie las iniciara en la terminal, así que sus horas hombre quedaron en cero y «horas contra costeo» sale más bajo de lo real. Si la cuadrilla marca inicio y fin en la terminal, las horas salen solas.',
           count(*)),
    jsonb_agg(jsonb_build_object('tipo', 'orden', 'referencia', s.orden_id, 'folio', s.folio, 'detalle', s.etapa || ' · marcó ' || coalesce(revision_nombre(s.quien), '—'),
                                 'fecha', s.en) order by s.en),
    (select array_agg(u) from usuarios_con_rol('gerente_produccion') u),
    'baja', null::jsonb,
    'etapas_sin_tiempos:' || to_char(current_date, 'IYYY-IW')
  from sin s
  having count(*) >= 3
$$;

-- 4.5 (dirección) Un consumo que se dispara: lo que salió como consumo en 7 días es 3 veces o más
-- el promedio semanal de las 12 semanas anteriores. Lleva quién registró las salidas, sin juzgar.
create or replace function public.revision_r_salida_consumo_atipica() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with semana as (
    select articulo_id, sum(-cantidad) cant, count(*) veces,
           jsonb_agg(distinct coalesce(revision_nombre(usuario_id), 'sin nombre')) quienes
    from movimientos_inventario
    where tipo = 'salida_consumo' and en > now() - interval '7 days'
    group by articulo_id
  ), antes as (
    select articulo_id, sum(-cantidad) / 12.0 promedio
    from movimientos_inventario
    where tipo = 'salida_consumo' and en between now() - interval '91 days' and now() - interval '7 days'
    group by articulo_id
  )
  select 'articulos', a.id::text, revision_ruta_articulo(a.tipo::text, a.id),
    format('Consumo de %s: %s en una semana, contra %s de costumbre', a.clave, round(s.cant, 1), round(an.promedio, 1)),
    format('En los últimos 7 días salieron %s %s de «%s» como consumo (%s salidas), y el promedio de las 12 semanas anteriores era %s por semana. Puede ser un trabajo especial; vale la pena preguntar para qué fue.',
           round(s.cant, 1), coalesce(a.unidad, 'pzas'), a.nombre, s.veces, round(an.promedio, 1)),
    jsonb_build_array(jsonb_build_object('tipo', 'articulo', 'referencia', a.id, 'folio', a.clave, 'detalle', 'registraron: ' ||
                        (select string_agg(x, ', ') from jsonb_array_elements_text(s.quienes) x), 'cantidad', round(s.cant, 2))),
    '{}'::uuid[], 'media', null::jsonb,
    'salida_consumo_atipica:' || a.id || ':' || to_char(current_date, 'IYYY-IW')
  from semana s join antes an using (articulo_id) join articulos a on a.id = s.articulo_id
  where an.promedio > 0 and s.cant >= 5 and s.cant >= 3 * an.promedio
$$;

-- 4.6 (dirección) Ajustes negativos que se repiten: el mismo artículo «se pierde» 3 veces en un
-- mes, o una misma persona pide 5 o más ajustes a la baja. Es la huella típica del robo hormiga,
-- pero también de una unidad mal capturada: por eso va como patrón, no como acusación.
create or replace function public.revision_r_ajustes_repetidos() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with neg as (
    select * from ajustes_inventario
    where estado = 'aprobado' and diferencia < 0 and coalesce(resuelto_en, solicitado_en) > now() - interval '30 days'
  )
  select 'articulos', a.id::text, '/almacen/movimientos',
    format('%s se ajustó a la baja %s veces en 30 días', a.clave, count(*)),
    format('«%s» perdió %s %s en %s ajustes aprobados este mes. Si la unidad de compra y la de salida no coinciden, eso explica faltantes que se repiten; si no, conviene un conteo con otra persona.',
           a.nombre, round(-sum(n.diferencia), 2), coalesce(a.unidad, 'pzas'), count(*)),
    jsonb_agg(jsonb_build_object('tipo', 'ajuste', 'referencia', n.id, 'folio', n.folio, 'detalle',
                coalesce(n.motivo, '') || ' · pidió ' || coalesce(revision_nombre(n.solicitado_por), '—'),
                'cantidad', n.diferencia, 'fecha', n.solicitado_en) order by n.solicitado_en),
    '{}'::uuid[], 'media', null::jsonb,
    'ajustes_repetidos:art:' || a.id || ':' || to_char(current_date, 'YYYY-MM')
  from neg n join articulos a on a.id = n.articulo_id
  group by a.id having count(*) >= 3
  union all
  select 'perfiles', n.solicitado_por::text, '/almacen/movimientos',
    format('%s pidió %s ajustes a la baja en 30 días', revision_nombre(n.solicitado_por), count(*)),
    format('Se aprobaron %s ajustes negativos pedidos por la misma persona, de %s artículos distintos. Puede ser que es quien cuenta; vale la pena ver si los faltantes se concentran en su almacén o turno.',
           count(*), count(distinct n.articulo_id)),
    jsonb_agg(jsonb_build_object('tipo', 'ajuste', 'referencia', n.id, 'folio', n.folio, 'detalle', a.clave || ' · ' || coalesce(n.motivo, ''),
                'cantidad', n.diferencia, 'fecha', n.solicitado_en) order by n.solicitado_en),
    '{}'::uuid[], 'media', null::jsonb,
    'ajustes_repetidos:per:' || n.solicitado_por || ':' || to_char(current_date, 'YYYY-MM')
  from neg n join articulos a on a.id = n.articulo_id
  where n.solicitado_por is not null
  group by n.solicitado_por having count(*) >= 5
$$;

-- 4.7 Un cliente dado de alta dos veces (mismo RFC, o el mismo nombre escrito igual). Parte el
-- historial de compras y la propiedad del cliente entre dos fichas.
create or replace function public.revision_r_cliente_duplicado() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  with todos as (
    select c.id, c.nombre, c.creado_en, c.creado_por, c.vendedor_id, revision_normalizar(c.nombre) n, upper(trim(c.rfc)) r
    from clientes c where c.activo
  ), coinciden as (
    select n.id, o.id o_id, 'el mismo RFC' por, o.creado_en o_en from todos n join todos o on o.r = n.r and o.id <> n.id and o.creado_en < n.creado_en
    where n.creado_en > now() - interval '14 days' and length(n.r) >= 12 and n.r not in ('XAXX010101000', 'XEXX010101000')
    union all
    select n.id, o.id, 'el mismo nombre', o.creado_en from todos n join todos o on o.n = n.n and o.id <> n.id and o.creado_en < n.creado_en
    -- Con dos palabras o más: dos clientes que se llaman «Alejandro» no son el mismo.
    where n.creado_en > now() - interval '14 days' and length(n.n) >= 6 and n.n like '% %'
  ), pares as (
    select distinct on (k.id) k.id, n.nombre, n.creado_por, n.vendedor_id, k.o_id, o.nombre o_nombre, k.por
    from coinciden k join todos n on n.id = k.id join todos o on o.id = k.o_id
    order by k.id, k.por = 'el mismo RFC' desc, k.o_en
  )
  select 'clientes', p.id::text, '/ventas/clientes/' || p.id,
    format('«%s» parece repetido', p.nombre),
    format('El cliente «%s» se dio de alta hace poco y tiene %s que «%s», que ya existía. Si es el mismo, junta lo suyo en una sola ficha para que su historial y su vendedor no se partan.',
           p.nombre, p.por, p.o_nombre),
    jsonb_build_array(jsonb_build_object('tipo', 'cliente', 'referencia', p.id, 'detalle', p.nombre),
                      jsonb_build_object('tipo', 'cliente', 'referencia', p.o_id, 'detalle', p.o_nombre)),
    array(select distinct u from unnest(array[p.creado_por, p.vendedor_id]) u where u is not null),
    'baja', null::jsonb,
    'cliente_duplicado:' || p.id
  from pares p
$$;

-- 4.8 Dos pagos al mismo proveedor por el mismo monto en 5 días: o se pagó dos veces, o se
-- capturó dos veces el mismo pago (y el saldo del proveedor quedó mal).
create or replace function public.revision_r_pago_duplicado() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  select 'movimientos_proveedor', b.id::text, '/finanzas/pagos',
    format('Pago repetido a %s: $%s dos veces', coalesce(pr.nombre, 'un proveedor'), to_char(b.monto, 'FM999,999,990.00')),
    format('Hay dos pagos a %s por $%s, del %s y del %s. Si es el mismo pago capturado dos veces, borra uno para que el saldo del proveedor cuadre.',
           coalesce(pr.nombre, 'el proveedor'), to_char(b.monto, 'FM999,999,990.00'), to_char(a.fecha, 'DD/MM'), to_char(b.fecha, 'DD/MM')),
    jsonb_build_array(
      jsonb_build_object('tipo', 'pago', 'referencia', a.id, 'detalle', coalesce(a.descripcion, a.cuenta, ''), 'fecha', a.fecha, 'cantidad', a.monto,
                         'quien', revision_nombre(a.registrado_por)),
      jsonb_build_object('tipo', 'pago', 'referencia', b.id, 'detalle', coalesce(b.descripcion, b.cuenta, ''), 'fecha', b.fecha, 'cantidad', b.monto,
                         'quien', revision_nombre(b.registrado_por))),
    array(select distinct u from unnest(array[a.registrado_por, b.registrado_por]) u where u is not null),
    'alta', null::jsonb,
    'pago_duplicado:' || a.id || ':' || b.id
  from movimientos_proveedor b
  join movimientos_proveedor a on a.proveedor_id = b.proveedor_id and a.tipo = 'pago' and a.monto = b.monto and a.id <> b.id
    and (a.creado_en, a.id) < (b.creado_en, b.id) and abs(b.fecha - a.fecha) <= 5
  left join proveedores pr on pr.id = b.proveedor_id
  where b.tipo = 'pago' and b.monto > 0 and b.creado_en > now() - interval '3 days'
$$;

-- 4.9 (dirección) El mismo gasto de caja chica, mismo concepto y mismo importe, 3 veces o más en
-- un mes. A veces es una renta o una recarga; a veces es lo que nadie revisa porque es poquito.
create or replace function public.revision_r_caja_chica_repetida() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  select 'caja_chica', min(c.id)::text, '/finanzas/caja-chica',
    format('Caja chica: «%s» por $%s, %s veces en 30 días', min(c.concepto), to_char(-c.importe, 'FM999,999,990.00'), count(*)),
    format('El mismo gasto se registró %s veces este mes (suma $%s). Si es un gasto fijo, contesta «Está bien así» y no vuelve a salir este mes.',
           count(*), to_char(-sum(c.importe), 'FM999,999,990.00')),
    jsonb_agg(jsonb_build_object('tipo', 'caja_chica', 'referencia', c.id, 'detalle', c.concepto, 'fecha', c.fecha,
                                 'cantidad', -c.importe, 'quien', revision_nombre(c.registrado_por)) order by c.fecha),
    '{}'::uuid[], 'baja', null::jsonb,
    'caja_chica_repetida:' || md5(revision_normalizar(min(c.concepto)) || (-c.importe)::text) || ':' || to_char(current_date, 'YYYY-MM')
  from caja_chica c
  where c.tipo = 'salida' and c.fecha > current_date - 30 and c.importe < 0
  group by revision_normalizar(c.concepto), c.importe
  having count(*) >= 3 and length(revision_normalizar(min(c.concepto))) > 0
$$;

-- 4.10 Una orden de compra enviada que ya debió llegar hace más de 3 días y no tiene ninguna
-- entrada: o llegó y no se recibió en el ERP (las existencias están cortas), o el proveedor se
-- atrasó y nadie le ha preguntado.
create or replace function public.revision_r_oc_vencida_sin_recibir() returns setof public.revision_hallazgo_nuevo
language sql stable security definer set search_path = public, extensions as $$
  select 'ordenes_compra', o.id::text, '/compras/ordenes/' || o.id,
    format('%s debió llegar el %s y no tiene entradas', o.folio, to_char(o.fecha_entrega, 'DD/MM')),
    format('La orden %s a %s estaba para el %s (hace %s días) y no se ha recibido nada. Si ya llegó, recíbela para que la existencia esté al día; si no, pregúntale al proveedor y cambia la fecha.',
           o.folio, coalesce(pr.nombre, 'el proveedor'), to_char(o.fecha_entrega, 'DD/MM'), current_date - o.fecha_entrega),
    jsonb_build_array(jsonb_build_object('tipo', 'oc', 'referencia', o.id, 'folio', o.folio, 'fecha', o.fecha_entrega)),
    array_remove(array[o.creado_por], null),
    case when current_date - o.fecha_entrega > 15 then 'alta' else 'media' end, null::jsonb,
    'oc_vencida_sin_recibir:' || o.id || ':' || o.fecha_entrega
  from ordenes_compra o left join proveedores pr on pr.id = o.proveedor_id
  where o.estado = 'enviada' and o.fecha_entrega < current_date - 3
    and not exists (select 1 from oc_lineas l where l.orden_compra_id = o.id and coalesce(l.recibido, 0) > 0)
$$;

do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p where p.proname like 'revision\_r\_%' and p.pronamespace = 'public'::regnamespace loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

insert into public.revision_reglas (clave, modulo, nombre, descripcion, para, se_resuelve_sola) values
  ('articulo_duplicado', 'compras', 'Artículo dado de alta dos veces', 'Un artículo nuevo con el mismo tipo, unidad y medidas que otro y un nombre casi igual.', 'responsable', true),
  ('costo_compra_atipico', 'compras', 'Costo muy distinto al de la última compra', 'Una partida de compra que cuesta 30 % más o menos que la compra anterior del mismo artículo (en pesos, últimos 6 meses).', 'responsable', false),
  ('usuario_sin_ficha', 'rrhh', 'Cuenta sin ficha de empleado', 'Alguien que captura en el ERP y no está ligado a su ficha, o no tiene.', 'responsable', true),
  ('etapas_sin_tiempos', 'produccion', 'Etapas terminadas sin tiempos', 'Tres o más etapas en la semana que se marcaron terminadas sin haberse iniciado en la terminal.', 'responsable', false),
  ('salida_consumo_atipica', 'almacen', 'Consumo que se dispara', 'Lo que salió como consumo en 7 días es 3 veces o más el promedio semanal de las 12 semanas anteriores.', 'direccion', false),
  ('ajustes_repetidos', 'almacen', 'Ajustes a la baja que se repiten', 'Un artículo con 3 o más ajustes negativos en 30 días, o una persona que pidió 5 o más.', 'direccion', false),
  ('cliente_duplicado', 'ventas', 'Cliente dado de alta dos veces', 'Un cliente nuevo con el mismo RFC o el mismo nombre que otro.', 'responsable', true),
  ('pago_duplicado', 'finanzas', 'Pago repetido a un proveedor', 'Dos pagos al mismo proveedor por el mismo monto con 5 días o menos de diferencia.', 'responsable', true),
  ('caja_chica_repetida', 'finanzas', 'Gasto de caja chica que se repite', 'El mismo concepto e importe 3 veces o más en 30 días.', 'direccion', false),
  ('oc_vencida_sin_recibir', 'compras', 'Compra atrasada sin recibir', 'Una orden enviada que debió llegar hace más de 3 días y no tiene ninguna entrada.', 'responsable', true);

-- 5. ---------------------------------------------------------------------------------------
-- El corredor. Una regla que truena no detiene a las demás: queda anotada en la corrida.
create or replace function public.revision_correr_reglas(p_corrida bigint) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_salida jsonb; v_n int; v_total int := 0; v_nota text := '';
begin
  for r in select * from revision_reglas where activa order by clave loop
    begin
      execute format('select coalesce(jsonb_agg(to_jsonb(h)), ''[]'') from public.%I() h', 'revision_r_' || r.clave) into v_salida;

      -- Lo que ya se arregló solo se cierra (si la regla mide un estado).
      if r.se_resuelve_sola then
        update revision_hallazgos h set estado = 'resuelto', cerrado_en = now(), respuesta = coalesce(h.respuesta, 'Se corrigió')
        where h.regla = r.clave and h.estado = 'abierto'
          and h.huella not in (select x->>'huella' from jsonb_array_elements(v_salida) x);
      end if;

      -- Lo nuevo entra, salvo que ya esté abierto o alguien haya dicho que está bien así. «Ya lo
      -- corregí» también lo calla en las reglas de hechos (el hecho no cambia aunque se corrija).
      insert into revision_hallazgos (corrida_id, origen, regla, modulo, tabla, registro_id, ruta, titulo, detalle, evidencia,
                                      para, responsables, gravedad, accion, huella)
      select p_corrida, 'regla', r.clave, r.modulo, h.tabla, h.registro_id, h.ruta, h.titulo, h.detalle, coalesce(h.evidencia, '[]'),
             case when r.para = 'responsable' and cardinality(array_remove(coalesce(h.responsables, '{}'), null)) > 0 then 'responsable' else 'direccion' end,
             case when r.para = 'responsable' then array_remove(coalesce(h.responsables, '{}'), null) else '{}' end,
             coalesce(h.gravedad, 'media'), h.accion, h.huella
      from jsonb_populate_recordset(null::revision_hallazgo_nuevo, v_salida) h
      where not exists (select 1 from revision_hallazgos x where x.huella = h.huella
                          and (x.estado in ('abierto', 'bien_asi') or (x.estado = 'corregido' and not r.se_resuelve_sola)))
      on conflict (huella) where estado = 'abierto' do nothing;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    exception when others then
      v_nota := v_nota || format('%s: %s. ', r.clave, sqlerrm);
    end;
  end loop;
  update revision_corridas set reglas_en = now(), hallazgos_reglas = v_total, nota = nullif(trim(coalesce(nota, '') || ' ' || v_nota), '')
  where id = p_corrida;
  return v_total;
end $$;
revoke execute on function public.revision_correr_reglas(bigint) from public, anon, authenticated;

-- ¿Le toca a Claude? Activo, con la dirección de la función conocida y sin pasar el tope del mes.
create or replace function public.revision_estado_claude() returns text
language sql stable security definer set search_path = public as $$
  select case
    when not coalesce((c.valor->>'claude')::boolean, false) then 'apagado'
    when (select coalesce(sum(entrada_tokens + salida_tokens), 0) from revision_corridas
          where empezo_en >= date_trunc('month', now())) >= coalesce((c.valor->>'tope_tokens_mes')::bigint, 0) then 'tope'
    when coalesce((select url_funciones from revision_cuenta where id = 1), (select url_funciones from ml_cuenta where id = 1)) is null then 'no'
    else 'si' end
  from configuracion c where c.clave = 'revision_nocturna'
$$;
revoke execute on function public.revision_estado_claude() from public, anon, authenticated;

create or replace function public.revision_disparar(p_ruta text) returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_llave text;
begin
  select coalesce(r.url_funciones, (select url_funciones from ml_cuenta where id = 1)), r.llave into v_url, v_llave
  from revision_cuenta r where r.id = 1;
  if v_url is null then return; end if;
  perform net.http_post(url := v_url || '/functions/v1/revision/' || p_ruta, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-llave', v_llave));
end $$;
revoke execute on function public.revision_disparar(text) from public, anon, authenticated;

-- La corrida de la madrugada: reglas y, si toca, el lote para Claude. Los avisos salen a las 6
-- (revision_recoger_disparar), ya con lo de Claude, para no sonar celulares a las 2 de la mañana.
create or replace function public.revision_noche() returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_cfg jsonb; v_claude text;
begin
  select valor into v_cfg from configuracion where clave = 'revision_nocturna';
  if not coalesce((v_cfg->>'activa')::boolean, false) then return null; end if;
  insert into revision_corridas default values returning id into v_id;
  perform revision_correr_reglas(v_id);
  v_claude := revision_estado_claude();
  if v_claude = 'si' then
    perform revision_disparar('enviar');
  else
    update revision_corridas set claude_estado = v_claude where id = v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.revision_noche() from public, anon, authenticated;

-- Dirección puede correrla a mano (para probar una regla nueva o después de corregir algo).
create or replace function public.revision_correr_ahora() returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not tiene_rol('direccion') then raise exception 'Solo dirección corre la revisión' using errcode = '42501'; end if;
  insert into revision_corridas default values returning id into v_id;
  perform revision_correr_reglas(v_id);
  update revision_corridas set claude_estado = 'apagado', nota = coalesce(nota || ' ', '') || 'Corrida a mano, solo reglas.' where id = v_id;
  perform revision_terminar(v_id, 0, 0);
  return v_id;
end $$;

-- 6. ---------------------------------------------------------------------------------------
-- Lo que se le manda a Claude. Solo lo de ayer (y lo poco de contexto que hace falta), sin costos,
-- sin sueldos, sin teléfonos ni correos. Cada registro trae «ref»: con eso Claude dice de qué
-- habla y revision_guardar_claude lo encuentra.
create or replace function public.revision_datos_noche() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with desde as (select now() - interval '26 hours' t)
  select jsonb_strip_nulls(jsonb_build_object(
    'hoy', to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'),
    'inventario', jsonb_build_object(
      'salidas_y_entradas', (select coalesce(jsonb_agg(x order by x->>'en'), '[]') from (
        select jsonb_build_object('ref', m.id::text, 'tipo', m.tipo, 'articulo', a.clave || ' · ' || a.nombre, 'unidad', a.unidad,
               'cantidad', m.cantidad, 'almacen', al.nombre, 'motivo', m.motivo, 'recibio', m.recibio,
               'orden', op.folio, 'pedido', pe.folio, 'capturo', revision_nombre(m.usuario_id),
               'en', to_char(m.en at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI')) x
        from movimientos_inventario m join articulos a on a.id = m.articulo_id left join almacenes al on al.id = m.almacen_id
        left join ordenes_produccion op on op.id = m.orden_produccion_id left join pedidos pe on pe.id = m.pedido_id
        where m.en > (select t from desde) and m.tipo <> 'inicial'
        order by m.en limit 400) s),
      'ajustes', (select coalesce(jsonb_agg(jsonb_build_object('ref', j.folio, 'articulo', a.clave || ' · ' || a.nombre,
               'sistema', j.cantidad_sistema, 'fisico', j.cantidad_fisica, 'diferencia', j.diferencia, 'motivo', j.motivo, 'estado', j.estado,
               'pidio', revision_nombre(j.solicitado_por), 'resolvio', revision_nombre(j.resuelto_por))), '[]')
        from ajustes_inventario j join articulos a on a.id = j.articulo_id
        where j.solicitado_en > (select t from desde) or j.resuelto_en > (select t from desde))),
    'compras', jsonb_build_object(
      'ordenes', (select coalesce(jsonb_agg(jsonb_build_object('ref', o.folio, 'proveedor', pr.nombre, 'estado', o.estado,
               'fecha_entrega', o.fecha_entrega, 'moneda', o.moneda, 'capturo', revision_nombre(o.creado_por), 'notas', o.notas,
               'partidas', (select jsonb_agg(jsonb_build_object('articulo', coalesce(a.clave || ' · ' || a.nombre, l.descripcion),
                              'cantidad', l.cantidad, 'recibido', l.recibido, 'unidad', a.unidad)) from oc_lineas l
                            left join articulos a on a.id = l.articulo_id where l.orden_compra_id = o.id))), '[]')
        from ordenes_compra o left join proveedores pr on pr.id = o.proveedor_id
        where o.creado_en > (select t from desde) or o.actualizado_en > (select t from desde)),
      -- Cada artículo nuevo con los tres más parecidos que ya existían: Claude ve si es otro o el mismo.
      'articulos_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('ref', a.clave, 'nombre', a.nombre, 'tipo', a.tipo, 'unidad', a.unidad,
               'categoria', ca.nombre, 'capturo', revision_nombre(revision_quien_dio_alta('articulos', a.id::text)),
               'parecidos', (select jsonb_agg(jsonb_build_object('clave', o.clave, 'nombre', o.nombre, 'unidad', o.unidad, 'activo', o.activo))
                             from (select o.* from articulos o where o.id <> a.id and o.tipo = a.tipo
                                   order by revision_normalizar(o.nombre) <-> revision_normalizar(a.nombre) limit 3) o))), '[]')
        from articulos a left join categorias ca on ca.id = a.categoria_id
        where exists (select 1 from bitacora b where b.tabla = 'articulos' and b.registro_id = a.id::text and b.accion = 'alta'
                        and b.en > (select t from desde)))),
    'ventas', jsonb_build_object(
      'cotizaciones', (select coalesce(jsonb_agg(jsonb_build_object('ref', c.folio, 'estado', c.estado, 'vendedor', revision_nombre(c.vendedor_id),
               'cliente', coalesce(cl.nombre, c.empresa), 'total', round(c.total), 'moneda', c.moneda, 'descuento_pct', c.descuento_pct,
               'condiciones_pago', c.condiciones_pago, 'tiempo_entrega', c.tiempo_entrega, 'notas', left(array_to_string(c.notas, ' · '), 300),
               'partidas', (select count(*) from cotizacion_lineas cl2 where cl2.cotizacion_id = c.id))), '[]')
        from cotizaciones c left join clientes cl on cl.id = c.cliente_id
        where c.actualizado_en > (select t from desde) and c.estado <> 'borrador'),
      'seguimientos_cerrados', (select coalesce(jsonb_agg(jsonb_build_object('cotizacion', co.folio, 'vendedor', revision_nombre(s.vendedor_id),
               'resultado', s.resultado, 'que_paso', s.que_paso)), '[]')
        from seguimientos_cotizacion s left join cotizaciones co on co.id = s.cotizacion_id
        where s.cerrado_en > (select t from desde)),
      'clientes_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('ref', c.id::text, 'nombre', c.nombre, 'ciudad', c.ciudad, 'estado', c.estado,
               'giro', c.giro, 'vendedor', revision_nombre(c.vendedor_id), 'capturo', revision_nombre(c.creado_por))), '[]')
        from clientes c where c.creado_en > (select t from desde)),
      'leads_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('ref', l.id::text, 'empresa', l.empresa, 'ciudad', l.ciudad, 'interes', l.interes,
               'estado', l.estado, 'vendedor', revision_nombre(l.vendedor_id), 'capturo', revision_nombre(l.capturado_por))), '[]')
        from leads l where l.creado_en > (select t from desde))),
    'produccion', jsonb_build_object(
      'eventos', (select coalesce(jsonb_agg(jsonb_build_object('orden', o.folio, 'etapa', et.nombre, 'tipo', e.tipo, 'nota', left(e.nota, 300),
               'en', to_char(e.en at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI')) order by e.en), '[]')
        from op_eventos e join ordenes_produccion o on o.id = e.orden_id left join op_operaciones op on op.id = e.operacion_id
        left join etapas et on et.id = op.etapa_id
        where e.en > (select t from desde) and e.tipo not in ('inicio', 'fin', 'pausa', 'reanudar')),
      'ordenes_en_espera', (select coalesce(jsonb_agg(jsonb_build_object('orden', o.folio, 'motivo', o.en_espera_motivo)), '[]')
        from ordenes_produccion o where o.en_espera_motivo is not null and o.estado in ('planeada', 'liberada', 'en_proceso'))),
    'finanzas', jsonb_build_object(
      'caja_chica', (select coalesce(jsonb_agg(jsonb_build_object('ref', c.id::text, 'tipo', c.tipo, 'importe', c.importe, 'concepto', c.concepto,
               'fecha', c.fecha, 'capturo', revision_nombre(c.registrado_por))), '[]')
        from caja_chica c where c.creado_en > (select t from desde)),
      'pagos_a_proveedores', (select coalesce(jsonb_agg(jsonb_build_object('ref', m.id::text, 'tipo', m.tipo, 'proveedor', pr.nombre, 'monto', m.monto,
               'fecha', m.fecha, 'factura', m.factura, 'descripcion', m.descripcion, 'capturo', revision_nombre(m.registrado_por))), '[]')
        from movimientos_proveedor m left join proveedores pr on pr.id = m.proveedor_id where m.creado_en > (select t from desde))),
    -- Para no repetirse: lo que sigue abierto y lo que la gente contestó en 30 días.
    'ya_dicho', (select coalesce(jsonb_agg(jsonb_build_object('modulo', h.modulo, 'titulo', h.titulo, 'estado', h.estado, 'respuesta', h.respuesta)), '[]')
      from (select * from revision_hallazgos where estado = 'abierto' or cerrado_en > now() - interval '30 days'
            order by creado_en desc limit 120) h)
  ))
$$;
revoke execute on function public.revision_datos_noche() from public, anon, authenticated;

-- Los números de cada persona para sus consejos del lunes. Solo de ella, de 4 semanas (12 en
-- ventas, que cierra más lento) y sin nombrar a compañeros.
create or replace function public.revision_datos_consejos() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with gente as (
    select p.id, split_part(coalesce(nullif(trim(p.nombre), ''), p.correo), ' ', 1) nombre, p.puesto,
           (select array_agg(r.rol::text order by r.rol) from usuario_roles r where r.usuario_id = p.id) roles
    from perfiles p
    where p.activo
      and exists (select 1 from usuario_roles r where r.usuario_id = p.id and r.rol not in ('pantalla', 'terminal'))
      and (select count(*) from bitacora b where b.usuario_id = p.id and b.en > now() - interval '28 days') >= 5
  ), uso as (
    select b.usuario_id,
      count(*) capturas,
      count(distinct (b.en at time zone 'America/Mexico_City')::date) dias,
      round(100.0 * count(*) filter (where extract(hour from b.en at time zone 'America/Mexico_City') >= 18) / count(*)) pct_despues_6pm,
      round(100.0 * count(*) filter (where extract(isodow from b.en at time zone 'America/Mexico_City') >= 6) / count(*)) pct_fin_de_semana
    from bitacora b where b.en > now() - interval '28 days' and b.usuario_id is not null
    group by b.usuario_id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'usuario', g.id, 'nombre', g.nombre, 'puesto', g.puesto, 'roles', g.roles,
    'uso_4_semanas', jsonb_build_object(
      'capturas', u.capturas, 'dias_con_capturas', u.dias, 'pct_despues_de_6pm', u.pct_despues_6pm, 'pct_fin_de_semana', u.pct_fin_de_semana,
      'por_hora', (select jsonb_object_agg(h, n) from (select extract(hour from b.en at time zone 'America/Mexico_City')::int h, count(*) n
                   from bitacora b where b.usuario_id = g.id and b.en > now() - interval '28 days' group by 1 order by 1) x),
      'que_captura', (select jsonb_object_agg(tabla || ' ' || accion, n) from (select tabla, accion, count(*) n from bitacora b
                      where b.usuario_id = g.id and b.en > now() - interval '28 days' group by 1, 2 order by 3 desc limit 10) x),
      -- «Rachas»: 20 capturas o más en 15 minutos. Es la hoja: anotar en papel y pasarlo todo al final.
      'rachas', (select count(*) from (select date_trunc('hour', b.en) + interval '15 min' * floor(extract(minute from b.en) / 15) v, count(*) n
                 from bitacora b where b.usuario_id = g.id and b.en > now() - interval '28 days' group by 1 having count(*) >= 20) x),
      'pendientes_a_tiempo', (select jsonb_build_object('cerrados', count(*), 'a_tiempo', count(*) filter (where (p.cerrado_en at time zone 'America/Mexico_City')::date <= p.vence))
                              from pendientes p where p.responsable_id = g.id and p.estado = 'hecho' and p.cerrado_en > now() - interval '28 days')),
    'ventas', case when g.roles && array['ventas', 'gerente_ventas'] then (
      select jsonb_build_object(
        'cotizaciones_enviadas_90d', count(*),
        'ganadas', count(*) filter (where c.estado = 'aceptada'),
        'perdidas', count(*) filter (where c.estado in ('rechazada', 'vencida', 'cancelada')),
        -- Con llamada: hubo una llamada registrada a ese cliente entre el envío y 14 días después.
        'con_llamada', jsonb_build_object('cotizaciones', count(*) filter (where c.llamada),
                         'ganadas', count(*) filter (where c.llamada and c.estado = 'aceptada'),
                         'cerradas', count(*) filter (where c.llamada and c.estado in ('aceptada', 'rechazada', 'vencida', 'cancelada'))),
        'sin_llamada', jsonb_build_object('cotizaciones', count(*) filter (where not c.llamada),
                         'ganadas', count(*) filter (where not c.llamada and c.estado = 'aceptada'),
                         'cerradas', count(*) filter (where not c.llamada and c.estado in ('aceptada', 'rechazada', 'vencida', 'cancelada'))),
        'horas_a_primer_contacto_mediana', (select round(percentile_cont(0.5) within group (order by extract(epoch from l.atendido_en - l.asignado_en) / 3600)::numeric, 1)
                                            from leads l where l.vendedor_id = g.id and l.atendido_en is not null and l.asignado_en > now() - interval '90 days'),
        'actividades_28d', (select jsonb_object_agg(a.tipo, a.n) from (select tipo, count(*) n from actividades
                            where usuario_id = g.id and en > now() - interval '28 days' group by 1) a),
        'intentos_28d', (select jsonb_object_agg(i.canal, i.n) from (select canal, count(*) n from intentos_contacto
                         where usuario_id = g.id and en > now() - interval '28 days' group by 1) i),
        'seguimientos_28d', (select jsonb_build_object('cerrados', count(*), 'a_tiempo', count(*) filter (where s.cerrado_en::date <= s.vence))
                             from seguimientos_cotizacion s where s.vendedor_id = g.id and s.cerrado_en > now() - interval '28 days'),
        'descuento_promedio_pct', round(100 * avg(c.descuento_pct), 1))
      from (select c.*, exists (select 1 from intentos_contacto i where i.cliente_id = c.cliente_id and i.canal = 'llamada'
                                  and i.en between c.enviada_en and c.enviada_en + interval '14 days')
                     or exists (select 1 from actividades a where a.cliente_id = c.cliente_id and a.tipo = 'llamada'
                                  and a.en between c.enviada_en and c.enviada_en + interval '14 days') llamada
            from cotizaciones c where c.vendedor_id = g.id and c.enviada_en > now() - interval '90 days') c) end,
    'consejos_anteriores', (select jsonb_agg(jsonb_build_object('semana', k.semana, 'tema', k.tema, 'titulo', k.titulo,
                              'experimento', k.experimento, 'opinion', k.opinion) order by k.semana desc)
                            from (select * from consejos where usuario_id = g.id order by semana desc limit 9) k)
  ))), '[]')
  from gente g join uso u on u.usuario_id = g.id
$$;
revoke execute on function public.revision_datos_consejos() from public, anon, authenticated;

-- 7. ---------------------------------------------------------------------------------------
-- Lo que Claude regresa. Claude dice tabla y «ref»; aquí se convierte en registro, ruta y
-- responsable con lo que la base sabe (nunca con un nombre que Claude escribió). Si no se
-- encuentra a quién, va a dirección.
create or replace function public.revision_guardar_claude(p_corrida bigint, p_modulo text, p_lectura text, p_hallazgos jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare h jsonb; v_id text; v_ruta text; v_resp uuid[]; v_n int := 0; v_para text; v_huella text;
begin
  update revision_corridas set lecturas = lecturas || jsonb_build_object(p_modulo, p_lectura) where id = p_corrida;
  for h in select * from jsonb_array_elements(coalesce(p_hallazgos, '[]')) loop
    v_id := null; v_ruta := null; v_resp := '{}';
    case h->>'tabla'
      when 'ordenes_compra' then
        select o.id::text, '/compras/ordenes/' || o.id, array_remove(array[o.creado_por], null) into v_id, v_ruta, v_resp
        from ordenes_compra o where o.folio = h->>'ref';
      when 'articulos' then
        select a.id::text, revision_ruta_articulo(a.tipo::text, a.id), array_remove(array[revision_quien_dio_alta('articulos', a.id::text)], null)
        into v_id, v_ruta, v_resp from articulos a where a.clave = h->>'ref';
      when 'cotizaciones' then
        select c.id::text, '/ventas/cotizaciones/' || c.id, array_remove(array[c.vendedor_id], null) into v_id, v_ruta, v_resp
        from cotizaciones c where c.folio = h->>'ref' order by c.version desc limit 1;
      when 'pedidos' then
        select p.id::text, '/ventas/pedidos/' || p.id, array_remove(array[p.vendedor_id], null) into v_id, v_ruta, v_resp
        from pedidos p where p.folio = h->>'ref';
      when 'clientes' then
        select c.id::text, '/ventas/clientes/' || c.id, array(select distinct u from unnest(array[c.creado_por, c.vendedor_id]) u where u is not null)
        into v_id, v_ruta, v_resp from clientes c where c.id::text = h->>'ref';
      when 'leads' then
        select l.id::text, '/ventas/leads', array_remove(array[l.capturado_por], null) into v_id, v_ruta, v_resp
        from leads l where l.id::text = h->>'ref';
      when 'movimientos_inventario' then
        select m.id::text, '/almacen/movimientos', array_remove(array[m.usuario_id], null) into v_id, v_ruta, v_resp
        from movimientos_inventario m where m.id::text = h->>'ref';
      when 'ajustes_inventario' then
        select j.id::text, '/almacen/movimientos', array_remove(array[j.solicitado_por], null) into v_id, v_ruta, v_resp
        from ajustes_inventario j where j.folio = h->>'ref';
      when 'ordenes_produccion' then
        select o.id::text, '/produccion/ordenes/' || o.id, (select array_agg(u) from usuarios_con_rol('gerente_produccion') u)
        into v_id, v_ruta, v_resp from ordenes_produccion o where o.folio = h->>'ref';
      when 'caja_chica' then
        select c.id::text, '/finanzas/caja-chica', array_remove(array[c.registrado_por], null) into v_id, v_ruta, v_resp
        from caja_chica c where c.id::text = h->>'ref';
      when 'movimientos_proveedor' then
        select m.id::text, '/finanzas/pagos', array_remove(array[m.registrado_por], null) into v_id, v_ruta, v_resp
        from movimientos_proveedor m where m.id::text = h->>'ref';
      else null;
    end case;
    v_resp := coalesce(v_resp, '{}');
    v_para := case when h->>'para' = 'responsable' and cardinality(v_resp) > 0 then 'responsable' else 'direccion' end;
    v_huella := 'claude:' || p_modulo || ':' || coalesce(h->>'tabla', '-') || ':' || coalesce(v_id, md5(lower(h->>'titulo')));
    -- Lo que la gente ya contestó sobre ese registro no se vuelve a preguntar.
    continue when exists (select 1 from revision_hallazgos x where x.huella = v_huella and x.estado in ('abierto', 'bien_asi', 'corregido'));
    insert into revision_hallazgos (corrida_id, origen, modulo, tabla, registro_id, ruta, titulo, detalle, evidencia, para, responsables, gravedad, huella)
    values (p_corrida, 'claude', p_modulo, case when v_id is null then null else h->>'tabla' end, v_id, v_ruta,
            left(h->>'titulo', 160), left(h->>'detalle', 1200),
            case when v_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('tipo', h->>'tabla', 'referencia', v_id, 'folio', h->>'ref')) end,
            v_para, case when v_para = 'responsable' then v_resp else '{}' end,
            case when h->>'gravedad' in ('baja', 'media', 'alta') then h->>'gravedad' else 'media' end, v_huella)
    on conflict (huella) where estado = 'abierto' do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  update revision_corridas set hallazgos_claude = hallazgos_claude + v_n where id = p_corrida;
  return v_n;
end $$;
revoke execute on function public.revision_guardar_claude(bigint, text, text, jsonb) from public, anon, authenticated;

create or replace function public.revision_guardar_consejos(p_corrida bigint, p_usuario uuid, p_consejos jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_semana date := date_trunc('week', now() at time zone 'America/Mexico_City')::date; v_n int;
begin
  delete from consejos where usuario_id = p_usuario and semana = v_semana and opinion is null;
  insert into consejos (corrida_id, usuario_id, semana, tema, titulo, texto, por_que, experimento)
  select p_corrida, p_usuario, v_semana,
         case when c->>'tema' in ('ventas', 'uso_erp', 'habito', 'experimento', 'equipo') then c->>'tema' else 'uso_erp' end,
         left(c->>'titulo', 140), left(c->>'texto', 900), left(c->>'por_que', 500), left(nullif(c->>'experimento', ''), 600)
  from jsonb_array_elements(coalesce(p_consejos, '[]')) c
  where coalesce(c->>'titulo', '') <> '' and coalesce(c->>'texto', '') <> ''
  limit 3;
  get diagnostics v_n = row_count;
  update revision_corridas set consejos = consejos + v_n where id = p_corrida;
  return v_n;
end $$;
revoke execute on function public.revision_guardar_consejos(bigint, uuid, jsonb) from public, anon, authenticated;

-- La función de Supabase anota el lote; si un día el lote no regresa, la vuelta de las 6 cierra
-- la corrida con lo que hay (las reglas), para que los avisos salgan de todos modos.
create or replace function public.revision_anotar_lote(p_corrida bigint, p_lote text, p_peticiones int) returns void
language sql security definer set search_path = public as $$
  update revision_corridas set lote_id = p_lote, peticiones = p_peticiones, claude_estado = 'enviado' where id = p_corrida
$$;
revoke execute on function public.revision_anotar_lote(bigint, text, int) from public, anon, authenticated;

-- Lo que salió mal del lado de Claude queda en la corrida (dirección lo ve en «Anoche»). Con
-- p_sigue la corrida sigue su curso (un consejo que no llegó no tumba los demás).
create or replace function public.revision_anotar_error(p_corrida bigint, p_nota text, p_sigue boolean default false) returns void
language sql security definer set search_path = public as $$
  update revision_corridas set nota = left(coalesce(nota || ' ', '') || p_nota, 1000),
         claude_estado = case when p_sigue then claude_estado
                              when p_nota like 'Claude: apagado%' then 'apagado' when p_nota like 'Claude: tope%' then 'tope' else 'error' end
  where id = p_corrida
$$;
revoke execute on function public.revision_anotar_error(bigint, text, boolean) from public, anon, authenticated;

create or replace function public.revision_fijar_url(p text) returns void
language sql security definer set search_path = public as $$
  update revision_cuenta set url_funciones = nullif(trim(p), '') where id = 1
$$;
revoke execute on function public.revision_fijar_url(text) from public, anon, authenticated;

create or replace function public.revision_llave_valida(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(length(p) >= 32 and exists (select 1 from revision_cuenta where id = 1 and llave = p), false)
$$;
revoke execute on function public.revision_llave_valida(text) from public, anon, authenticated;

-- Cierra la corrida y avisa: a cada quien cuántas cosas suyas salieron; a dirección, el total y
-- los patrones; a quien recibió consejos, que ya están en su Inicio.
create or replace function public.revision_terminar(p_corrida bigint, p_entrada bigint, p_salida bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_dir uuid[];
begin
  if (select termino_en from revision_corridas where id = p_corrida) is not null then return; end if;
  update revision_corridas set termino_en = now(), entrada_tokens = entrada_tokens + coalesce(p_entrada, 0),
         salida_tokens = salida_tokens + coalesce(p_salida, 0),
         claude_estado = case when claude_estado = 'enviado' and coalesce(p_entrada, 0) > 0 then 'recogido' else claude_estado end
  where id = p_corrida;

  for r in
    select u, count(*) n, string_agg(h.titulo, ' · ' order by h.gravedad = 'alta' desc, h.creado_en) titulos
    from revision_hallazgos h, unnest(h.responsables) u
    where h.corrida_id = p_corrida and h.estado = 'abierto' and h.para = 'responsable'
    group by u
  loop
    perform avisar(array[r.u], 'revision',
      case when r.n = 1 then 'La revisión de anoche encontró 1 cosa por revisar' else format('La revisión de anoche encontró %s cosas por revisar', r.n) end,
      left(r.titulos, 400), '/revision', 'revision_corridas', p_corrida::text, true);
  end loop;

  v_dir := (select array_agg(u) from usuarios_con_rol('direccion') u);
  select count(*) n, count(*) filter (where para = 'direccion') patrones into r
  from revision_hallazgos where corrida_id = p_corrida and estado = 'abierto';
  if r.n > 0 then
    perform avisar(v_dir, 'revision', format('Revisión de anoche: %s hallazgo(s), %s para ti', r.n, r.patrones),
      'Cada responsable ya tiene lo suyo en «Por revisar». Los patrones solo los ves tú.', '/revision', 'revision_corridas', p_corrida::text, true);
  end if;

  perform avisar(array(select distinct usuario_id from consejos where corrida_id = p_corrida), 'consejos',
    'Tus consejos de la semana', 'Están en tu Inicio. Dinos si te sirvieron.', '/', 'revision_corridas', p_corrida::text, true);
end $$;
revoke execute on function public.revision_terminar(bigint, bigint, bigint) from public, anon, authenticated;

-- La corrida que espera a Claude, para la función de Supabase.
create or replace function public.revision_por_recoger() returns table (id bigint, lote_id text, empezo_en timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.lote_id, c.empezo_en from revision_corridas c
  where c.termino_en is null and c.claude_estado = 'enviado' and c.lote_id is not null
  order by c.id desc limit 1
$$;
revoke execute on function public.revision_por_recoger() from public, anon, authenticated;

-- La corrida de anoche, para la función de Supabase al armar el lote.
create or replace function public.revision_ultima_sin_lote() returns bigint
language sql stable security definer set search_path = public as $$
  select c.id from revision_corridas c
  where c.termino_en is null and c.lote_id is null and c.claude_estado = 'no' and c.empezo_en > now() - interval '6 hours'
  order by c.id desc limit 1
$$;
revoke execute on function public.revision_ultima_sin_lote() from public, anon, authenticated;

-- A las 6, 7 y 8 de la mañana: recoger lo de Claude. En la última, lo que no regresó se da por
-- perdido y la corrida se cierra con las reglas.
create or replace function public.revision_recoger_disparar() returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select * from revision_corridas where termino_en is null and empezo_en > now() - interval '2 days' loop
    if c.claude_estado = 'enviado' and c.lote_id is not null and now() - c.empezo_en < interval '6 hours 30 minutes' then
      perform revision_disparar('recoger');
    else
      if c.claude_estado in ('enviado', 'no') then
        update revision_corridas set claude_estado = 'error', nota = coalesce(nota || ' ', '') || 'Claude no regresó a tiempo.' where id = c.id;
      end if;
      perform revision_terminar(c.id, 0, 0);
    end if;
  end loop;
end $$;
revoke execute on function public.revision_recoger_disparar() from public, anon, authenticated;

-- 8. ---------------------------------------------------------------------------------------
-- Contestar. Solo un responsable o dirección; «Corrígelo» solo si el hallazgo trae una corrección
-- definida, y la corrección revisa sus propios permisos (no basta con ser el responsable).
create or replace function public.revision_aplicar_accion(p_accion jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_art uuid; v_emp uuid; v_per uuid; v_clave text;
begin
  case p_accion->>'tipo'
    when 'desactivar_articulo' then
      if not (puede('costeo', 2) or puede('compras', 2)) then
        raise exception 'Para inhabilitar un artículo necesitas capturar en costeo o compras' using errcode = '42501';
      end if;
      v_art := (p_accion->>'articulo')::uuid;
      select clave into v_clave from articulos where id = v_art;
      if exists (select 1 from existencias where articulo_id = v_art and cantidad <> 0) then
        raise exception '% tiene existencias: pásalas al otro con un ajuste antes de inhabilitarlo', v_clave;
      end if;
      if exists (select 1 from oc_lineas l join ordenes_compra o on o.id = l.orden_compra_id
                 where l.articulo_id = v_art and o.estado in ('borrador', 'enviada', 'parcial')) then
        raise exception '% está en una orden de compra abierta: cámbiala al otro artículo primero', v_clave;
      end if;
      if exists (select 1 from bom_lineas where hijo_id = v_art) then
        raise exception '% se usa en la lista de materiales de un equipo: cámbialo ahí primero', v_clave;
      end if;
      update articulos set activo = false where id = v_art;
      return format('Se inhabilitó %s', v_clave);
    when 'ligar_empleado' then
      if not puede('rrhh', 2) then raise exception 'Ligar cuentas es de Recursos Humanos' using errcode = '42501'; end if;
      v_emp := (p_accion->>'empleado')::uuid; v_per := (p_accion->>'perfil')::uuid;
      if exists (select 1 from empleados where usuario_id = v_per) then raise exception 'Esa cuenta ya está ligada a otra ficha'; end if;
      update empleados set usuario_id = v_per where id = v_emp and usuario_id is null;
      if not found then raise exception 'Esa ficha ya tiene cuenta'; end if;
      return 'Se ligó la cuenta a su ficha';
    else
      raise exception 'Este hallazgo no tiene una corrección automática';
  end case;
end $$;
revoke execute on function public.revision_aplicar_accion(jsonb) from public, anon, authenticated;

create or replace function public.revision_responder(p_hallazgo uuid, p_respuesta text, p_nota text default null) returns text
language plpgsql security definer set search_path = public as $$
declare h revision_hallazgos; v_msg text;
begin
  select * into h from revision_hallazgos where id = p_hallazgo for update;
  if h.id is null then raise exception 'No existe ese hallazgo'; end if;
  if not ((h.para = 'responsable' and auth.uid() = any (h.responsables)) or tiene_rol('direccion')) then
    raise exception 'Esto no te toca a ti' using errcode = '42501';
  end if;
  if h.estado <> 'abierto' then raise exception 'Ya se contestó'; end if;
  if p_respuesta = 'corregir' then
    if h.accion is null then raise exception 'Este hallazgo no tiene una corrección automática: corrígelo y contesta «Ya lo corregí»'; end if;
    v_msg := revision_aplicar_accion(h.accion);
    update revision_hallazgos set estado = 'corregido', respuesta = coalesce(nullif(trim(p_nota), ''), v_msg),
           cerrado_en = now(), cerrado_por = auth.uid() where id = h.id;
    return v_msg;
  elsif p_respuesta in ('bien_asi', 'corregido') then
    update revision_hallazgos set estado = p_respuesta, respuesta = nullif(trim(p_nota), ''), cerrado_en = now(), cerrado_por = auth.uid()
    where id = h.id;
    return case when p_respuesta = 'bien_asi' then 'Listo: no vuelve a salir' else 'Gracias: queda como corregido' end;
  else
    raise exception 'Respuesta no válida';
  end if;
end $$;
revoke execute on function public.revision_responder(uuid, text, text) from public, anon;
grant execute on function public.revision_responder(uuid, text, text) to authenticated;

create or replace function public.consejo_opinar(p_consejo uuid, p_util boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update consejos set opinion = case when p_util then 'util' else 'no_util' end, opinado_en = now()
  where id = p_consejo and usuario_id = auth.uid();
  if not found then raise exception 'Ese consejo no es tuyo' using errcode = '42501'; end if;
end $$;
revoke execute on function public.consejo_opinar(uuid, boolean) from public, anon;
grant execute on function public.consejo_opinar(uuid, boolean) to authenticated;

-- Interruptores de dirección: la revisión entera, cada regla, Claude y los consejos.
create or replace function public.revision_configurar(p_cambios jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('direccion') then raise exception 'Solo dirección' using errcode = '42501'; end if;
  update configuracion set valor = valor || (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(p_cambios) x(k, v)
                                             where k in ('activa', 'claude', 'consejos') and jsonb_typeof(v) = 'boolean'),
         actualizado_en = now()
  where clave = 'revision_nocturna';
  update revision_reglas r set activa = (p_cambios->'reglas'->>r.clave)::boolean
  where p_cambios->'reglas' ? r.clave and jsonb_typeof(p_cambios->'reglas'->r.clave) = 'boolean';
end $$;
revoke execute on function public.revision_configurar(jsonb) from public, anon;
grant execute on function public.revision_configurar(jsonb) to authenticated;

revoke execute on function public.revision_correr_ahora() from public, anon;
grant execute on function public.revision_correr_ahora() to authenticated;

-- 9. ---------------------------------------------------------------------------------------
-- 2:07 de la planta (8:07 UTC) la revisión; 6:07, 7:07 y 8:07 recoger y avisar.
do $$ begin
  perform cron.schedule('revision-nocturna', '7 8 * * *', 'select public.revision_noche()');
  perform cron.schedule('revision-recoger', '7 12,13,14 * * *', 'select public.revision_recoger_disparar()');
end $$;

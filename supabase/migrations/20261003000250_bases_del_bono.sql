-- Bases del bono: dónde se captura cuánto vale el bono de objetivos de cada puesto (o de una persona).
--
-- bono_bases existe desde 070 pero no tenía pantalla: Objetivos y Prenómina decían «Falta definir la
-- base» y no había dónde definirla. Lo captura RRHH (nómina nivel 3) en Objetivos › Bases del bono.
--
-- Una base vale desde un mes: bono_base() la busca con «desde <= mes de la evaluación», y la evaluación
-- es del día 1. Una base «desde el 15 de noviembre» no le tocaría a noviembre, así que se guarda
-- siempre el día 1 y un mes tiene una sola base por puesto o persona (volver a capturarla la corrige).
-- Lo ya pagado no cambia: nomina_bonos guarda la base con la que se pagó.

-- Sin renglones en la nube (se revisó antes de escribir esto); en otra base se juntan antes del candado.
update public.bono_bases set desde = date_trunc('month', desde)::date where desde <> date_trunc('month', desde)::date;
delete from public.bono_bases b using public.bono_bases o
 where b.id <> o.id and b.puesto_id is not distinct from o.puesto_id and b.empleado_id is not distinct from o.empleado_id
   and b.desde = o.desde and b.registrado_en < o.registrado_en;

alter table public.bono_bases drop constraint if exists bono_bases_desde_mes;
alter table public.bono_bases add constraint bono_bases_desde_mes check (desde = date_trunc('month', desde)::date);
create unique index if not exists bono_bases_puesto_mes on public.bono_bases (puesto_id, desde) where empleado_id is null;
create unique index if not exists bono_bases_persona_mes on public.bono_bases (empleado_id, desde) where empleado_id is not null;

-- Guardar la base de un puesto o de una persona a partir de un mes. security invoker: la RLS de
-- bono_bases (nómina 3) es la barrera; el puede() de arriba solo da un mensaje claro.
create or replace function public.fijar_bono_base(p_puesto int, p_empleado uuid, p_base numeric, p_desde date, p_nota text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_desde date := date_trunc('month', p_desde)::date; v_id uuid;
begin
  if not puede('nomina', 3) then
    raise exception 'Solo Recursos Humanos o dirección definen la base del bono' using errcode = '42501';
  end if;
  if num_nonnulls(p_puesto, p_empleado) <> 1 then
    raise exception 'La base es de un puesto o de una persona, no de los dos' using errcode = '22023';
  end if;
  if p_base is null or p_base < 0 then
    raise exception 'La base mensual va en pesos y no puede ser negativa' using errcode = '22023';
  end if;
  if v_desde is null then
    raise exception 'Falta el mes desde el que vale' using errcode = '22023';
  end if;

  select id into v_id from bono_bases
   where desde = v_desde and (case when p_empleado is null then puesto_id = p_puesto and empleado_id is null else empleado_id = p_empleado end);
  if v_id is null then
    insert into bono_bases (puesto_id, empleado_id, base_mensual, desde, nota)
    values (p_puesto, p_empleado, p_base, v_desde, nullif(trim(p_nota), '')) returning id into v_id;
  else
    update bono_bases set base_mensual = p_base, nota = nullif(trim(p_nota), ''),
                          registrado_por = auth.uid(), registrado_en = now()
     where id = v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.fijar_bono_base(int, uuid, numeric, date, text) from public, anon;
grant execute on function public.fijar_bono_base(int, uuid, numeric, date, text) to authenticated;

-- Quién cambió cuánto vale el bono queda en la bitácora, como los sueldos de la ficha.
drop trigger if exists auditar on public.bono_bases;
create trigger auditar after insert or update or delete on public.bono_bases for each row execute function public.auditar();

-- La bitácora guarda valores completos: el renglón de una base del bono solo lo ve quien ve nómina
-- (sistemas tiene «admin» para ver la bitácora y no tiene nómina). Lo demás queda como en 117.
drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated using (
  ((select puede('admin', 1)) or (select tiene_rol('direccion')))
  and (tabla <> 'empleado_datos' or (select puede('rrhh', 3)))
  and (tabla not in ('empleados', 'incidencias') or (select puede('rrhh', 1)) or (select puede('produccion', 3)))
  and (tabla not in ('costos_articulo', 'historial_costos', 'costos_calculados', 'tarifas_mano_obra', 'historial_costeo')
       or (select puede('costos', 1)))
  and (tabla not in ('politicas_precio', 'costos_articulo', 'historial_costeo') or (select puede('margenes', 1)))
  and (tabla not in ('cobros', 'facturas', 'comision_ajustes', 'comision_pagos', 'vendedor_plan')
       or (select puede('finanzas', 1)) or (select puede('ventas', 3)))
  and (tabla <> 'bono_bases' or (select puede('nomina', 1)))
);

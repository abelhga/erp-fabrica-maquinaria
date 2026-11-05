-- Uso del ERP en vivo: el mapa de calor de «Uso del ERP» enciende el cuadro de hoy de una persona
-- en cuanto hace algo (registra un cambio o usa una pantalla), sin recargar.
--
-- No se publica la bitácora ni uso_diario en tiempo real: la bitácora trae costos y datos
-- personales, y cada renglón viajaría a quien escuche. En su lugar la base difunde solo «quién y qué
-- tipo» (cambio o vista) por un canal privado, «uso-en-vivo», que únicamente escucha quien puede ver
-- Uso del ERP (los mismos de uso_tablero: dirección y sistemas, admin nivel 3).
--
-- Disparadores por sentencia con tabla de transición: una acción que escribe 40 renglones de
-- bitácora (una orden y sus partidas) manda un aviso por persona, no 40.

create or replace function public.uso_en_vivo_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v_tipo text := case tg_table_name when 'bitacora' then 'cambio' else 'vista' end;
begin
  for r in select usuario_id u, count(*) n from nuevos where usuario_id is not null group by usuario_id loop
    begin
      perform realtime.send(jsonb_build_object('u', r.u, 'tipo', v_tipo, 'n', r.n), 'actividad', 'uso-en-vivo', true);
    exception when others then
      null;  -- El aviso en vivo es adorno: si Realtime falla, el cambio de verdad se guarda igual.
    end;
  end loop;
  return null;
end $$;
revoke execute on function public.uso_en_vivo_avisar() from public, anon, authenticated;

drop trigger if exists uso_en_vivo on public.bitacora;
create trigger uso_en_vivo after insert on public.bitacora
  referencing new table as nuevos for each statement execute function public.uso_en_vivo_avisar();

drop trigger if exists uso_en_vivo_alta on public.uso_diario;
create trigger uso_en_vivo_alta after insert on public.uso_diario
  referencing new table as nuevos for each statement execute function public.uso_en_vivo_avisar();
drop trigger if exists uso_en_vivo_cambio on public.uso_diario;
create trigger uso_en_vivo_cambio after update on public.uso_diario
  referencing new table as nuevos for each statement execute function public.uso_en_vivo_avisar();

-- Quién puede escuchar el canal: el mismo permiso que la pantalla. Los demás canales privados no cambian.
drop policy if exists uso_en_vivo_escuchar on realtime.messages;
create policy uso_en_vivo_escuchar on realtime.messages for select to authenticated
  using (realtime.topic() = 'uso-en-vivo' and (select public.puede('admin', 3)));

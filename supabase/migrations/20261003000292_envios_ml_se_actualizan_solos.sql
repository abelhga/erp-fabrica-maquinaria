-- =============================================================================
-- Los envíos de Mercado Libre avanzan solos con lo que reporta ML.
--
-- Por qué: el 13 nov había cinco envíos de ML en «Hoy salen» que ML ya reportaba dejados en la
-- paquetería (dropped_off) desde días antes, y dos en «Por empacar» cuya venta ML ya había cancelado.
-- Nadie había marcado «Enviado»: el inventario de lo que ya salió seguía sin descontarse y las listas
-- de almacén estaban llenas de cosas que ya no eran trabajo.
--
-- Qué cambia: cada vez que la sincronización de ML guarda el estado de una venta (ml_ventas), su envío
-- de paquetería o de Full en el ERP se pone al día:
--   * ML canceló la venta → el envío que no ha salido se cancela (la guía de ML se reembolsa sola).
--   * ML lo reporta en la paquetería o en camino (dropped_off, picked_up, shipped) → «Enviado», con su
--     salida de inventario, como si almacén le hubiera dado «Enviado».
--   * ML lo reporta entregado (delivered) → «Entregado», y el pedido avanza.
-- Cada cambio queda en la historia del envío diciendo que lo reportó Mercado Libre. Lo que ya estaba
-- más adelante no se toca (nunca regresa un envío).
-- =============================================================================

create or replace function public._envio_segun_ml(p_pedido uuid, p_estado text, p_envio text, p_sub text) returns int
language plpgsql security definer set search_path = public as $$
declare e envios; v_n int := 0;
  v_salio boolean := p_envio in ('shipped', 'delivered') or p_sub in ('dropped_off', 'picked_up');
begin
  if p_pedido is null then return 0; end if;
  for e in select * from envios where pedido_id = p_pedido and tipo in ('paqueteria', 'full')
           and estado not in ('entregado', 'cancelado') order by solicitado_en for update loop
    if p_estado = 'cancelled' then
      if e.estado <> 'enviado' then
        update envios set estado = 'cancelado', cancelado_en = now(), motivo_cancelacion = 'Mercado Libre canceló la venta',
          guia_reembolsada = case when numero_guia is not null then true end
        where id = e.id;
        insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'cancelado', 'Mercado Libre canceló la venta');
        v_n := v_n + 1;
      end if;
      continue;
    end if;
    if v_salio and e.estado <> 'enviado' then
      perform _dar_salida(e.id);
      update envios set estado = 'enviado', enviado_en = now() where id = e.id;
      insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'enviado',
        concat_ws(' · ', case p_sub when 'dropped_off' then 'Mercado Libre lo reporta dejado en la paquetería'
                                    when 'picked_up' then 'Mercado Libre lo reporta recolectado'
                                    else 'Mercado Libre lo reporta en camino' end,
                  case when e.numero_guia is not null then 'guía ' || e.numero_guia end));
      e.estado := 'enviado';
      v_n := v_n + 1;
    end if;
    if p_envio = 'delivered' and e.estado = 'enviado' then
      update envios set estado = 'entregado', entregado_en = now() where id = e.id;
      perform _entregar_en_pedido(e.id);
      insert into eventos_envio (envio_id, tipo, nota) values (e.id, 'entregado', 'Mercado Libre lo reporta entregado');
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public._envio_segun_ml(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.ml_venta_al_envio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (new.estado, new.envio_ml, new.envio_sub, new.pedido_id)
                         is distinct from (old.estado, old.envio_ml, old.envio_sub, old.pedido_id) then
    perform _envio_segun_ml(new.pedido_id, new.estado, new.envio_ml, new.envio_sub);
  end if;
  return null;
end $$;
drop trigger if exists al_envio on public.ml_ventas;
create trigger al_envio after insert or update on public.ml_ventas
  for each row execute function public.ml_venta_al_envio();

-- Lo que ya estaba reportado y nadie marcó, se pone al día una vez.
select _envio_segun_ml(v.pedido_id, v.estado, v.envio_ml, v.envio_sub) from ml_ventas v
where exists (select 1 from envios e where e.pedido_id = v.pedido_id and e.tipo in ('paqueteria', 'full')
              and e.estado not in ('entregado', 'cancelado'));

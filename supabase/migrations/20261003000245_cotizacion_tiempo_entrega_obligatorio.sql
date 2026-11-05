-- =============================================================================
-- Una cotización no se envía sin tiempo de entrega.
--
-- Por qué: en los últimos 60 días se enviaron 21 de 78 cotizaciones de un vendedor sin tiempo de
-- entrega (los demás, ninguna). El cliente no sabe cuándo recibe y luego la fecha compromiso del
-- pedido sale de la nada. Se pide al enviarla (no al capturar: el borrador se arma a ratos). Si de
-- verdad no se sabe, hay textos para eso: «Se confirma al recibir el anticipo» o «Inmediata (en
-- existencia)»; la pantalla los ofrece con un clic junto al que estima el ERP con la carga del taller.
-- =============================================================================

create or replace function public.trg_cotizacion_entrega() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'enviada' and old.estado is distinct from 'enviada' and coalesce(trim(new.tiempo_entrega), '') = '' then
    raise exception 'Escribe el tiempo de entrega antes de enviarla (si no se sabe todavía: «Se confirma al recibir el anticipo»)'
      using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists entrega_al_enviar on public.cotizaciones;
create trigger entrega_al_enviar before update of estado on public.cotizaciones
  for each row execute function public.trg_cotizacion_entrega();

-- Los dos textos de entrega que ofrece la pantalla, también en el catálogo de textos (si no estaban).
insert into public.textos_comerciales (tipo, texto, orden, activo)
select 'entrega', t.texto, t.orden, true
from (values ('Inmediata (en existencia)', 90), ('Se confirma al recibir el anticipo', 91)) t(texto, orden)
where not exists (select 1 from public.textos_comerciales x where x.tipo = 'entrega' and lower(x.texto) = lower(t.texto));

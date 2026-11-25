-- =============================================================================
-- Categoría por renglón de la hoja («Sin efectos» de Manguitos), ventas que no se pierden si siguen
-- vivas, y clientes con nombre y estado que sirvan.
--
-- Por qué:
-- 1. Las compras de Manguitos (otro proyecto, no Hegamex) en la hoja contaban como gasto de
--    Hegamex: 31 renglones por unos $256 mil (19 de Aceros Ocotlán, la mayoría vigas). En la hoja la
--    categoría va por proveedor, así que no había forma de sacar solo esas. Ahora un renglón de la
--    hoja puede llevar su propia categoría, con motivo, como las compras del ERP (314).
-- 2. Isaac cerró como perdidas 182 de 388 seguimientos en 45 días (Juan Manuel, 30 de 173), y en
--    24 su «qué pasó» decía que la venta seguía viva («lo está revisando», «él me avisa», «aún no se
--    decide»): como «No respondió» pide insistir (255), se elegía otro motivo. Esas ventas salen del
--    embudo y nadie las vuelve a seguir. Ahora, si el texto dice que el cliente sigue decidiendo, no
--    se puede cerrar como perdida (por ninguno de los tres caminos); y si dice que no contesta, aplica
--    la misma regla que «No respondió».
-- 3. Clientes dados de alta con un teléfono, «pendiente» o texto del chat como nombre, y con la
--    ciudad en el campo del estado (Toluca, Pachuca). Ahora el nombre así no entra, y el estado se
--    acomoda solo al de la lista (si escribieron una ciudad que solo existe en un estado, pasa a
--    «ciudad» y el estado se pone bien). En pantalla el estado se elige de la lista.
-- =============================================================================

-- 1. --------------------------------------------------------------------------------------------
create table if not exists public.compras_hoja_categoria_renglon (
  hoja_id bigint primary key references public.historial_compras_hoja(id) on delete cascade,
  categoria text not null check (length(btrim(categoria)) > 0),
  antes text,
  motivo text not null check (length(btrim(motivo)) >= 5),
  por uuid default auth.uid(),
  en timestamptz not null default now()
);
alter table public.compras_hoja_categoria_renglon enable row level security;
drop policy if exists ver on public.compras_hoja_categoria_renglon;
create policy ver on public.compras_hoja_categoria_renglon for select to authenticated using ((select puede('finanzas', 2)));
grant select on public.compras_hoja_categoria_renglon to authenticated;

create or replace function public.cambiar_categoria_compra_hoja(p_hoja bigint, p_categoria text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare h historial_compras_hoja; v_cat text := nullif(btrim(p_categoria), ''); v_antes text;
begin
  if not puede('finanzas', 2) then raise exception 'La categoría de una compra la cambia finanzas' using errcode = '42501'; end if;
  if v_cat is null then raise exception 'Escribe la categoría' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué cambia la categoría (queda en la cuenta del proveedor)' using errcode = '22023';
  end if;
  select * into h from historial_compras_hoja where id = p_hoja;
  if not found or h.tipo <> 'Compra' then raise exception 'Solo las compras de la hoja llevan categoría' using errcode = '22023'; end if;
  v_antes := coalesce((select categoria from compras_hoja_categoria_renglon where hoja_id = p_hoja),
                      (select categoria from compras_hoja_categoria where proveedor_llave = h.proveedor_llave),
                      (select nullif(trim(categoria), '') from proveedores where id = h.proveedor_id));
  if lower(coalesce(v_antes, '')) = lower(v_cat) then raise exception 'La compra ya está en «%»', v_cat using errcode = '22023'; end if;
  insert into compras_hoja_categoria_renglon (hoja_id, categoria, antes, motivo) values (p_hoja, v_cat, v_antes, btrim(p_motivo))
  on conflict (hoja_id) do update set categoria = excluded.categoria, motivo = excluded.motivo, por = auth.uid(), en = now();
end $$;
revoke execute on function public.cambiar_categoria_compra_hoja(bigint, text, text) from public, anon;
grant execute on function public.cambiar_categoria_compra_hoja(bigint, text, text) to authenticated;

-- compras_hoja: la categoría del renglón manda sobre la del proveedor (y una «fuera» se respeta, 218).
do $$
declare v_def text := pg_get_functiondef('public.compras_hoja(date, date)'::regprocedure);
  a1 text := 'select h.fecha, h.proveedor_llave, h.proveedor_id, h.monto, h.factura,';
  a2 text := 'select h.fecha, h.proveedor_llave, null, h.monto, h.factura,';
  a3 text := 'select h.*, coalesce(k.categoria, nullif(trim(pr.categoria), '''')) cat_prov';
begin
  if v_def like '%compras_hoja_categoria_renglon%' then return; end if;
  if position(a1 in v_def) = 0 or position(a2 in v_def) = 0 or position(a3 in v_def) = 0 then
    raise exception 'compras_hoja ya no es la que se conocía';
  end if;
  v_def := replace(v_def, a1, 'select h.id::bigint as hoja_id, h.fecha, h.proveedor_llave, h.proveedor_id, h.monto, h.factura,');
  v_def := replace(v_def, a2, 'select null::bigint, h.fecha, h.proveedor_llave, null, h.monto, h.factura,');
  v_def := replace(v_def, a3, 'select h.*, coalesce((select r.categoria from compras_hoja_categoria_renglon r where r.hoja_id = h.hoja_id), k.categoria, nullif(trim(pr.categoria), '''')) cat_prov');
  execute v_def;
end $$;

-- 2. --------------------------------------------------------------------------------------------
-- ¿El texto dice que la venta sigue viva? (el cliente lo revisa, va a avisar, no decide, se le recotiza)
create or replace function public.texto_venta_viva(p text) returns boolean
language sql immutable set search_path = public as $$
  select lower(sin_acentos(coalesce(p, ''))) ~
    '(lo (esta|estan) (revisando|checando|viendo|analizando|pensando)|(esta|estan) (checando|revisando|analizando)|(me|nos) (avisa|avisara|va a avisar|confirma|confirmara)|el (me |nos )?avisa|aun no (se )?(decide|define|sabe)|todavia no (se )?(decide|define|sabe)|no (se )?(ha )?decidid|no sabe (bien )?aun|lo va a pensar|se (pone|pondra|va a poner) en contacto|(me|nos) (va a|vuelve a) (llamar|marcar|contactar)|sigue interesad|(se le va a|le vamos a|vamos a|voy a|le voy a) (re)?cotizar|recotizando|re cotizando)'
$$;
grant execute on function public.texto_venta_viva(text) to authenticated;

do $$
declare v_def text := pg_get_functiondef('public.registrar_seguimiento(uuid, text, text, text, date, text)'::regprocedure);
  v_ancla text := 'if p_resultado = ''perdida'' and es_motivo_sin_respuesta(p_motivo) and not (v_estado->>''puede_sin_respuesta'')::boolean then';
begin
  if v_def like '%texto_venta_viva%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'registrar_seguimiento ya no es la que se conocía'; end if;
  v_def := replace(v_def, v_ancla,
    'if p_resultado = ''perdida'' and texto_venta_viva(concat_ws('' '', p_que_paso, p_motivo)) then
    raise exception ''Lo que escribiste dice que el cliente sigue decidiendo: no es una venta perdida. Déjala en «Sigue en pie» con la fecha en que le vuelves a buscar; si de verdad se perdió, escribe por qué.''
      using errcode = ''23514'', hint = ''venta_viva'';
  end if;
  if p_resultado = ''perdida'' and (es_motivo_sin_respuesta(p_motivo) or es_motivo_sin_respuesta(p_que_paso)) and not (v_estado->>''puede_sin_respuesta'')::boolean then');
  execute v_def;
end $$;

-- Los otros dos caminos (arrastrar a Perdida, «Marcar rechazada…») revisan el motivo igual.
do $$
declare v_def text := pg_get_functiondef('public.trg_perder_sin_respuesta()'::regprocedure);
  v_ancla text := '  if es_motivo_sin_respuesta(v_m) then';
begin
  if v_def like '%texto_venta_viva%' then return; end if;
  if position(v_ancla in v_def) = 0 then raise exception 'trg_perder_sin_respuesta ya no es la que se conocía'; end if;
  v_def := replace(v_def, v_ancla, '  if texto_venta_viva(v_m) then
    raise exception ''El motivo dice que el cliente sigue decidiendo: no es una venta perdida. Anota un seguimiento «Sigue en pie» con fecha; si de verdad se perdió, escribe por qué.''
      using errcode = ''23514'', hint = ''venta_viva'';
  end if;
' || v_ancla);
  execute v_def;
end $$;

-- 3. --------------------------------------------------------------------------------------------
create or replace function public.trg_cliente_datos() returns trigger
language plpgsql set search_path = public, extensions as $$
declare n text; v_cve text; v_mun record; v_cuantos int;
begin
  if auth.uid() is null then return new; end if;   -- cargas e importaciones no se frenan
  if tg_op = 'INSERT' or new.nombre is distinct from old.nombre then
    n := lower(sin_acentos(btrim(coalesce(new.nombre, ''))));
    if n ~ '^(pendiente|sin nombre|no dio( su)? nombre.*|no dio nombre de empresa|particular|cliente|cliente nuevo|n/?a|x+|\.+|-+)$'
       or n ~ '(asignar esta conversacion|la empresa se llama|mi nombre es|se llama )'
       or (length(regexp_replace(n, '[^0-9]', '', 'g')) >= 7 and length(regexp_replace(n, '[^a-z]', '', 'g')) < 3) then
      raise exception '«%» no sirve como nombre del cliente: escribe el nombre de la persona (nombre y apellido) o la razón social de la empresa, sin teléfonos ni texto del chat.', new.nombre
        using errcode = '23514';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.estado is distinct from old.estado) and nullif(btrim(coalesce(new.estado, '')), '') is not null
     and geo_pais(new.pais, new.estado) = 'México' then
    v_cve := geo_estado_de(new.estado);
    if v_cve is not null then
      new.estado := (select nombre from geo_estados where cve_ent = v_cve);
    else
      -- ¿Escribieron una ciudad (Toluca, Pachuca)? Si existe en un solo estado, se acomoda.
      select count(distinct cve_ent), min(cve_ent) into v_cuantos, v_cve from geo_municipios where nombre_norm = geo_normalizar(new.estado);
      if v_cuantos = 1 then
        new.ciudad := coalesce(nullif(btrim(new.ciudad), ''), btrim(new.estado));
        new.estado := (select nombre from geo_estados where cve_ent = v_cve);
      end if;
      -- Si no se reconoce, se queda como está: la pantalla ya da la lista y convertir a pedido lo pide bien.
    end if;
  end if;
  return new;
end $$;
drop trigger if exists datos_que_sirven on public.clientes;
create trigger datos_que_sirven before insert or update of nombre, estado on public.clientes
  for each row execute function public.trg_cliente_datos();

-- La lista para elegir el estado en pantalla.
grant select on public.geo_estados to authenticated;

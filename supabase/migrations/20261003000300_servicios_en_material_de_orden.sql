-- =============================================================================
-- A una orden también se le agregan servicios (un vulcanizado, un maquilado).
--
-- Por qué: ingeniería quiso agregar a una orden el «Servicio de vulcanizado de rodillo 26" en planta
-- Transbelt» (C-N0540) y el buscador decía que no existía, ni por clave. Existe, pero es de tipo
-- «servicio», y «Agregar a esta orden» y «Reemplazar» solo aceptaban componentes, materia prima y
-- subensambles. En la lista de materiales del equipo sí se puede: 111 equipos llevan servicios en su
-- lista (173 renglones) y sus órdenes los heredan, así que la orden ya sabía manejarlos (salen como
-- faltante y se piden a compras). Solo faltaba poder agregarlos o cambiarlos a mano. El de 8" sí
-- aparecía porque se dio de alta como componente con unidad «servicio».
--
-- Qué cambia: agregar_material_orden y reemplazar_material_orden aceptan también «servicio». Mismos
-- cuerpos que en 238; se parcha solo la lista de tipos y su mensaje.
-- =============================================================================
do $$
declare s text;
begin
  s := pg_get_functiondef('public.agregar_material_orden(uuid, uuid, numeric, text)'::regprocedure);
  if position('''servicio''' in s) = 0 then
    if position('a.tipo not in (''componente'', ''materia_prima'', ''subensamble'')' in s) = 0
       or position('A una orden se agregan componentes, materia prima o subensambles' in s) = 0 then
      raise exception 'agregar_material_orden ya no es la de 238: revisa este parche';
    end if;
    s := replace(s, 'a.tipo not in (''componente'', ''materia_prima'', ''subensamble'')',
                    'a.tipo not in (''componente'', ''materia_prima'', ''subensamble'', ''servicio'')');
    s := replace(s, 'A una orden se agregan componentes, materia prima o subensambles',
                    'A una orden se agregan componentes, materia prima, servicios o subensambles');
    execute s;
  end if;

  s := pg_get_functiondef('public.reemplazar_material_orden(uuid, uuid, numeric, text)'::regprocedure);
  if position('''servicio''' in s) = 0 then
    if position('a_nuevo.tipo not in (''componente'', ''materia_prima'', ''subensamble'')' in s) = 0
       or position('Se reemplaza con un componente, materia prima o subensamble' in s) = 0 then
      raise exception 'reemplazar_material_orden ya no es la de 238: revisa este parche';
    end if;
    s := replace(s, 'a_nuevo.tipo not in (''componente'', ''materia_prima'', ''subensamble'')',
                    'a_nuevo.tipo not in (''componente'', ''materia_prima'', ''subensamble'', ''servicio'')');
    s := replace(s, 'Se reemplaza con un componente, materia prima o subensamble',
                    'Se reemplaza con un componente, materia prima, servicio o subensamble');
    execute s;
  end if;
end $$;

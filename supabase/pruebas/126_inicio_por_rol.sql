-- Inicio: la base calcula solo las secciones que pide la pantalla, y nunca una que el rol
-- no pueda ver aunque la pida. Importaciones tiene "Finanzas: ver", pero su Inicio no pide
-- la cobranza; si alguien la pidiera a mano, la vería (es su permiso, no su Inicio).
do $$
declare v_imp uuid; v_ven uuid; r jsonb;
begin
  v_imp := pg_temp.usuario('imp126@hegamex.com', '{importaciones}');
  v_ven := pg_temp.usuario('ven126@hegamex.com', '{ventas}');

  perform pg_temp.como(v_imp);
  r := indicadores(array['compras', 'importaciones']);
  assert r ? 'importaciones' and r ? 'compras', format('importaciones no recibió sus secciones: %s', r);
  assert not (r ? 'cobranza' or r ? 'por_pagar' or r ? 'valor_inventario'), format('importaciones recibió algo que no pidió: %s', r);
  assert (r->'importaciones') ?& array['activos', 'en_camino', 'llegan_semana', 'docs_pendientes'], 'faltan cifras de embarques';
  -- Sin secciones, como antes: todo lo que su rol puede leer.
  assert indicadores() ? 'cobranza', 'sin secciones debería calcular todo lo permitido';

  perform pg_temp.como(v_ven);
  r := indicadores(array['ventas', 'produccion', 'cobranza', 'importaciones', 'rrhh']);
  assert r ? 'ventas' and r ? 'produccion', format('ventas no recibió sus secciones: %s', r);
  -- Pedirlas no basta: ventas 2 no ve la cobranza de todos, ni embarques, ni personal.
  assert not (r ? 'cobranza' or r ? 'importaciones' or r ? 'rrhh'), format('ventas recibió secciones sin permiso: %s', r);
end $$;

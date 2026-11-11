-- En un pendiente se contesta con una captura. La sube quien lo tiene o quien lo pidió, la ve quien
-- ve el pendiente. Lo que NO: que alguien ajeno la suba o la vea, o ligar la imagen de otro pendiente.
do $$
declare v_a uuid; v_b uuid; v_c uuid; p1 uuid; p2 uuid; v_ok boolean; v_msg text;
begin
  v_a := pg_temp.usuario('abel280@hegamex.com', '{ventas}');
  v_b := pg_temp.usuario('fer280@hegamex.com', '{ingenieria}');
  v_c := pg_temp.usuario('otro280@hegamex.com', '{ventas}');
  perform pg_temp.como(v_b);
  insert into pendientes (titulo, responsable_id, creado_por) values ('Cambio de gabinete 280', v_a, v_b) returning id into p1;
  insert into pendientes (titulo, responsable_id, creado_por) values ('Otro 280', v_b, v_b) returning id into p2;

  -- 1. Quien lo tiene sube la captura y la manda sin texto.
  perform pg_temp.como(v_a);
  insert into storage.objects (bucket_id, name) values ('pendientes', p1 || '/captura.png');
  perform comentar_pendiente(p1, '', p1 || '/captura.png');
  perform pg_temp.como(v_b);
  assert (select adjunto = p1 || '/captura.png' from pendiente_mensajes where pendiente_id = p1), 'quien lo pidió no ve la captura';
  assert exists (select 1 from storage.objects where bucket_id = 'pendientes' and name = p1 || '/captura.png'), 'quien lo pidió no ve el archivo';
  assert exists (select 1 from avisos where usuario_id = v_b and cuerpo like '%te mandó una captura%'), 'el aviso no dice que trae captura';

  -- 2. Lo que NO: alguien ajeno no la ve ni sube a ese pendiente.
  perform pg_temp.como(v_c);
  assert not exists (select 1 from storage.objects where bucket_id = 'pendientes' and name = p1 || '/captura.png'), 'alguien ajeno vio la captura';
  begin insert into storage.objects (bucket_id, name) values ('pendientes', p1 || '/intruso.png'); v_ok := true;
  exception when insufficient_privilege then v_ok := false; end;
  assert not v_ok, 'alguien ajeno subió una imagen al pendiente';

  -- 3. Lo que NO: ligar la imagen de otro pendiente.
  perform pg_temp.como(v_b);
  insert into storage.objects (bucket_id, name) values ('pendientes', p2 || '/otra.png');
  perform pg_temp.como(v_a);
  begin perform comentar_pendiente(p1, 'mira', p2 || '/otra.png'); v_ok := true; exception when invalid_parameter_value then v_ok := false; v_msg := sqlerrm; end;
  assert not v_ok, format('ligó la imagen de otro pendiente: %s', v_msg);
end $$;

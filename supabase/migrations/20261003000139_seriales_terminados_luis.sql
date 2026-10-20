-- Luis confirmó (20 oct 2026) que los 11 pedidos que SERIALES marcaba "en proceso" y que no
-- están en su hoja de fabricación ya están terminados. 12 de sus 17 seriales seguían en
-- proceso; los otros 5 ya decían terminado. Sin esto, la carga del taller y "Números de
-- serie" contaban como en fabricación equipos que ya salieron del taller.
do $$
declare n int;
begin
  update public.equipos_historicos set estado = 'terminado'
  where estado = 'proceso' and numero_serie in (
    'TB18030163E252', 'CV0500C153', 'TB20120390E244', 'CV0200N152', 'TB18030163E245', 'SF290000000041',
    'TP12020163E250', 'TG10060275E028', 'TB24090390E255', 'TC05B064', '3AAMBACE3TMMJA040', 'TB18030163E246');
  get diagnostics n = row_count;
  raise notice 'Seriales marcados terminados: %', n;
end $$;

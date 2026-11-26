-- «Después se comunica» también es una venta viva (319 no lo veía: la COT-2026-00550 de $759,800 se
-- cerró como perdida con «después e comunica»). Se agregan las formas de «él se comunica / se
-- reporta / me llama después», con el error de dedo «e» por «se».
create or replace function public.texto_venta_viva(p text) returns boolean
language sql immutable set search_path = public as $$
  select lower(sin_acentos(coalesce(p, ''))) ~
    '(lo (esta|estan) (revisando|checando|viendo|analizando|pensando)|(esta|estan) (checando|revisando|analizando)|(me|nos) (avisa|avisara|va a avisar|confirma|confirmara)|el (me |nos )?avisa|aun no (se )?(decide|define|sabe)|todavia no (se )?(decide|define|sabe)|no (se )?(ha )?decidid|no sabe (bien )?aun|lo va a pensar|se (pone|pondra|va a poner) en contacto|(me|nos) (va a|vuelve a) (llamar|marcar|contactar)|sigue interesad|(se le va a|le vamos a|vamos a|voy a|le voy a) (re)?cotizar|recotizando|re cotizando|(despues|luego|mas tarde|al rato|en unos dias) (e |se |me |nos |el )?(comunica|comunicara|va a comunicar|reporta|reportara|llama|llamara|marca)|(el|ella|ellos) (se )?(comunica|comunicara|reporta|reportara)|se (comunica|comunicara|reporta|reportara) (despues|luego|mas tarde|con (migo|nosotros)))'
$$;
grant execute on function public.texto_venta_viva(text) to authenticated;

-- Teléfonos y cuentas que llegaron del Excel con ".0" al final ("3312637588.0").
--
-- En "DATOS COLABORADORES" esas celdas estaban guardadas como número, no como texto: al
-- leerlas llegaron como decimal y se guardaron con el ".0". Las que estaban escritas como
-- texto ("33 1708 9348") llegaron bien, por eso salían unas sí y otras no. Las cuentas
-- son de 11 dígitos y caben completas en un decimal: no se perdió ninguno, solo sobra el ".0".
--
-- La limpieza vive en un disparador para que no regrese si se vuelve a importar o alguien
-- pega desde Excel; los datos de hoy se corrigen con las mismas funciones.

-- Solo toca lo que es puro número con ".0": cualquier otro texto se queda como está.
create or replace function public.limpiar_numero_hoja(p text) returns text
language sql immutable as $$
  select case when p ~ '^\s*[0-9]+\.0+\s*$' then regexp_replace(trim(p), '\.0+$', '') else p end;
$$;

-- Diez dígitos con el formato que ya usa RRHH: lada de 2 (33, 55, 81) o de 3 (391, 378…).
-- Lo que no son 10 dígitos ("no tiene", con extensión, con nombre) se queda igual.
create or replace function public.formato_telefono(p text) returns text
language sql immutable as $$
  select case
    when p is null then null
    when regexp_replace(p, '[\s\-().]', '', 'g') !~ '^[0-9]{10}$' then nullif(trim(p), '')
    else (select case when left(d, 2) in ('33', '55', '81')
                      then substr(d, 1, 2) || ' ' || substr(d, 3, 4) || ' ' || substr(d, 7, 4)
                      else substr(d, 1, 3) || ' ' || substr(d, 4, 3) || ' ' || substr(d, 7, 4) end
          from (select regexp_replace(p, '[\s\-().]', '', 'g') d) x)
  end;
$$;

-- Corre antes de "validar" (los disparadores BEFORE van en orden alfabético).
create or replace function public.trg_limpiar_numeros_empleado() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'empleados' then
    new.telefono := formato_telefono(limpiar_numero_hoja(new.telefono));
    new.contacto_emergencia := formato_telefono(limpiar_numero_hoja(new.contacto_emergencia));
  else
    new.cuenta_bancaria := limpiar_numero_hoja(new.cuenta_bancaria);
  end if;
  return new;
end $$;
drop trigger if exists limpiar_numeros on public.empleados;
create trigger limpiar_numeros before insert or update on public.empleados for each row execute function public.trg_limpiar_numeros_empleado();
drop trigger if exists limpiar_numeros on public.empleado_datos;
create trigger limpiar_numeros before insert or update on public.empleado_datos for each row execute function public.trg_limpiar_numeros_empleado();

-- Los datos de hoy: tocar el renglón basta, el disparador hace la limpieza.
update public.empleados set telefono = telefono
where telefono is distinct from formato_telefono(limpiar_numero_hoja(telefono))
   or contacto_emergencia is distinct from formato_telefono(limpiar_numero_hoja(contacto_emergencia));
update public.empleado_datos set cuenta_bancaria = cuenta_bancaria
where cuenta_bancaria is distinct from limpiar_numero_hoja(cuenta_bancaria);

-- Dos renglones del Excel traían en "cuenta" el nombre del PDF del contrato de
-- confidencialidad (columna corrida): el contrato existe, la cuenta nunca llegó.
update public.empleado_datos
set contrato_confidencialidad = coalesce(contrato_confidencialidad, 'firmado'), cuenta_bancaria = null
where cuenta_bancaria ~* '\.pdf$';

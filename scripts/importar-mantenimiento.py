"""Carga el «Programa de Mantenimiento» de Luis (hoja de Google) al módulo de mantenimiento.

    python3 scripts/importar-mantenimiento.py hoja.json [--ensayo] > mantenimiento.sql

hoja.json es {"PESTAÑA": [[fila], …]} con las pestañas de la hoja (los nombres sin acentos
ni espacios: CAT_LOGO_MAESTRO, INSTRUCCIONES_DE_MANTENIMIENTO, COSTOS, BD_MANTENIMIENTOS,
DETALLE_COSTOS, CONTROL_DE_DISPONIBILIDAD, CONTROL_DE_HERRAMIENTAS y las cartas máquina).
Escribe un SQL de una sola transacción; con --ensayo termina en "raise exception 'ENSAYO …'".

Qué carga y por qué así:
- Las 89 máquinas del catálogo maestro, con criticidad, tipo de mantenimiento, quién lo
  hace y tipo de equipo. El área sale de la carta máquina de cada tipo y se guarda como
  texto (Área 1…6, Herramientero): la hoja no usa las etapas del taller.
- Las rutinas de «Instrucciones de mantenimiento», con sus puntos, una por tipo y frecuencia.
- Un plan preventivo por máquina con la frecuencia del catálogo y la rutina de esa
  frecuencia (si es semestral y no hay rutina semestral, la trimestral). Ninguno tenía
  fecha: se escalonan desde hoy para que no venzan todos el mismo día, los más críticos
  primero.
- El historial (3 mantenimientos) con su costo, y los 2 paros abiertos como fallas que
  tienen la máquina parada.
- Las refacciones de COSTOS como componentes (con su costo si lo tienen) y ligadas al tipo
  y modelo de máquina; la mano de obra no es un artículo.
- La herramienta asignada a una persona (soldadoras y esmeriles de CONTROL DE HERRAMIENTAS),
  si el apodo empata con una sola persona del personal.
Se niega a correr si ya hay máquinas en el ERP: es una carga de arranque, no una sincronización.
"""
import json, re, sys, unicodedata
from datetime import date, datetime

args = sys.argv[1:]
H = json.load(open(args[0], encoding="utf-8"))
ENSAYO = "--ensayo" in args


def limpio(s):
    return re.sub(r"\s+", " ", str(s or "").replace("\xa0", " ").replace("\u2009", " ")).strip()


def llave(s):
    return unicodedata.normalize("NFD", limpio(s)).encode("ascii", "ignore").decode().lower()


def lit(x):
    return "$json$" + json.dumps(x, ensure_ascii=False) + "$json$::jsonb"


def numero(s):
    s = limpio(s).replace("$", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def fecha(s):
    s = limpio(s)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m[1]}-{m[2]}-{m[3]}"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?", s)
    if not m:
        return None
    a = int(m[3]) + (2000 if int(m[3]) < 100 else 0)
    hh, mm = (int(m[4]), int(m[5])) if m[4] else (12, 0)
    return f"{a:04d}-{int(m[2]):02d}-{int(m[1]):02d} {hh:02d}:{mm:02d}"


# Nombres de tipo como los escribe la hoja → categoría del ERP (sin errores de dedo).
CATEGORIA = {"sierras electicas": "sierras eléctricas", "pulmones": "pulmones", "pantografo": "pantógrafos",
             "rectificadores": "rectificadores"}


def categoria(sub):
    k = llave(sub)
    return CATEGORIA.get(k, limpio(sub).lower())


CRIT = {"muy alto": "muy_alta", "alto": "alta", "medio": "media", "bajo": "baja", "muy bajo": "muy_baja"}
TMTO = {"preventivo": "preventivo", "predictivo": "predictivo", "autonomo": "autonomo"}
ESPE = {"tecnico": "tecnico", "externo": "externo", "operador": "operador", "jefe de mtto": "jefe"}
TEQ = {"electrico": "electrico", "neumatico": "neumatico", "hidraulico": "hidraulico", "mecanico": "mecanico"}
DIAS = {"semanal": 7, "mensual": 30, "trimestral": 91, "semestral": 182, "anual": 365}
# Herramienta de mano: se presta y puede quedar asignada a una persona.
DE_MANO = ("ESC", "ESG", "TTS", "TTE", "TDB", "IDB", "RMA", "RMI", "AXT", "MIL", "TBV", "ABV", "IBA", "PL")

# ---------------------------------------------------------------------------- catálogo
cat = H["CAT_LOGO_MAESTRO"]
enc = next(i for i, r in enumerate(cat) if len(r) > 3 and limpio(r[2]) == "Nombre" and limpio(r[3]) == "Código")
maquinas, marca = [], None
for r in cat[enc + 1:]:
    r = r + [""] * (18 - len(r))
    codigo = limpio(r[3]).upper()
    if not re.match(r"^[A-Z]+-\d+$", codigo):
        continue
    marca = limpio(r[6]) or marca          # la hoja deja el fabricante vacío cuando es el de arriba
    ident = limpio(r[7])
    nombre = limpio(r[2]) + (f" {ident}" if ident.isdigit() else "")
    notas = [f"Identificación: {ident}"] if ident not in ("", "-") and not ident.isdigit() else []
    if limpio(r[17]):                      # Observaciones (P y Q son «tiene carta máquina / manual»)
        notas.append(limpio(r[17]))
    pref = codigo.split("-")[0]
    maquinas.append(dict(
        numero=codigo, nombre=nombre, categoria=categoria(r[4]), modelo=limpio(r[5]) or None, marca=marca,
        tipo="herramienta" if pref in DE_MANO else "maquina",
        criticidad=CRIT.get(llave(r[9])), tipo_equipo=TEQ.get(llave(r[8])), especialidad=ESPE.get(llave(r[10])),
        tipo_mantenimiento=TMTO.get(llave(r[11])), frecuencia=llave(r[12]) or None,
        notas=" · ".join(notas) or None, ubicacion=None))
por_codigo = {m["numero"]: m for m in maquinas}

# Área de cada máquina: está en la carta máquina de su tipo ("Código: ESC-01 - ESC-10").
def expandir(txt):
    txt = limpio(txt).upper().replace(" ", "")
    salen = set()
    for pref, a, b in re.findall(r"([A-Z]+)-?(\d+)(?:-[A-Z]*-?(\d+)|/(?:\d+))?", txt):
        ini = int(a)
        fin = int(b) if b else ini
        for n in range(ini, fin + 1):
            salen.add(f"{pref}-{n:02d}")
    for pref, a, b in re.findall(r"([A-Z]+)-?(\d+)/(\d+)", txt):
        salen.update({f"{pref}-{int(a):02d}", f"{pref}-{int(b):02d}"})
    return {c for c in salen if c in por_codigo} | {c.replace("-0", "-") for c in salen if c.replace("-0", "-") in por_codigo}


for pestana, filas in H.items():
    for i, r in enumerate(filas):
        if len(r) > 11 and limpio(r[7]) == "Código":
            area = next((limpio(x[11]) for x in filas[i + 1:i + 3] if len(x) > 11 and limpio(x[7]).startswith("Área")), "")
            for c in expandir(r[11]):
                if area and not por_codigo[c]["ubicacion"]:
                    por_codigo[c]["ubicacion"] = area

# ---------------------------------------------------------------------------- rutinas
NOMBRE_SECCION = {"inversoras axt": "Inversoras AXT", "millermatic 252": "Millermatic 252", "comprespor vspm": "Compresor VSPM",
                  "comprespor 10 hp": "Compresor 10 HP (DeVilbiss)", "esmeriles de banco": "Esmeril de banco",
                  "taladro de banco": "Taladro de banco", "torno nardini": "Torno Nardini", "torno libby": "Torno Libby",
                  "fresadora": "Fresadora", "sierra electrica": "Sierra eléctrica", "cortadora de disco": "Cortadora de disco",
                  "guillotina motorizada": "Guillotina motorizada", "pantografos": "Pantógrafos", "plasmas manuales": "Plasmas manuales",
                  "esmeriles": "Esmeriles", "taladro tipo sandwich": "Taladro tipo sándwich", "taladro tipo espada": "Taladro tipo espada",
                  "taladro e impacto de baterias": "Taladro e impacto de baterías", "rectificadores": "Rectificadores",
                  "aires acondicionados": "Aires acondicionados"}
SECCIONES = {"inversoras axt": ["AXT"], "millermatic 252": ["MIL"], "comprespor vspm": ["VSPM"], "comprespor 10 hp": ["PUL"],
             "esmeriles de banco": ["ESB"], "taladro de banco": ["TAB"], "torno nardini": ["TNA"], "torno libby": ["TLI"],
             "fresadora": ["FR"], "sierra electrica": ["SE"], "cortadora de disco": ["COD"], "guillotina motorizada": ["GU"],
             "pantografos": ["PA"], "plasmas manuales": ["PL"], "esmeriles": ["ESC", "ESG"], "taladro tipo sandwich": ["TTS"],
             "taladro tipo espada": ["TTE"], "taladro e impacto de baterias": ["TDB", "IDB"], "rectificadores": ["RMA", "RMI"],
             "aires acondicionados": ["ACM"]}
NO_SECCION = re.compile(r"^(N° / SERIE|COMENTARIOS|MANTENIMIENTO PREVENTIVO|FECHA|PRÓXIMO|↑|◄|SUBÍNDICE|\d+\. )", re.I)
rutinas, actual, seccion, recomendacion = [], None, None, None
ins = H["INSTRUCCIONES_DE_MANTENIMIENTO"]
for i, r in enumerate(ins):
    t = limpio(r[2] if len(r) > 2 else "")
    if not t:
        continue
    m = re.match(r"^SUBÍNDICE:\s*(.+)$", t, re.I)
    if m:
        seccion, actual = llave(m[1]), None
        continue
    if t.lower().startswith("recomendaciones para"):
        sig = next((limpio(x[2]) for x in ins[i + 1:i + 4] if len(x) > 2 and limpio(x[2])), "")
        recomendacion = sig
        continue
    m = re.search(r"rutina\s+(semanal|mensual|trimestral|semestral|por horas)", t, re.I)
    if m and seccion:
        frec = llave(m[1])
        actual = dict(nombre=f"{NOMBRE_SECCION.get(seccion, seccion.capitalize())} · {frec}", seccion=seccion,
                      frecuencia=None if frec == "por horas" else frec, recomendaciones=recomendacion, puntos=[], _sec=None)
        recomendacion = None
        rutinas.append(actual)
        continue
    if actual is None:
        continue
    if t[0] in "☐□":
        actual["puntos"].append({"seccion": actual["_sec"], "texto": limpio(t.lstrip("☐□"))})
    elif re.match(r"^\d[\d,]* ?hrs?$", t, re.I) and len(r) > 5 and limpio(r[5]):
        actual["puntos"].append({"seccion": "Por horas de uso", "texto": f"{t}: {limpio(r[5])}"})
    elif t.isupper() and not NO_SECCION.match(t) and len(t) < 80 and not re.match(r"^(\w )+\w$", t):
        actual["_sec"] = t.capitalize()
# El nombre sale de la sección, no del título: la hoja titula «Taladro tipo espada — Rutina
# trimestral» a la trimestral de baterías y «…semanal» a algunas mensuales.
for x in rutinas:
    x.pop("_sec")
rutinas = [x for x in rutinas if x["puntos"]]
assert len({x["nombre"] for x in rutinas}) == len(rutinas), "rutinas con el mismo nombre"

# Plan por máquina: su frecuencia del catálogo con la rutina de esa frecuencia de su tipo.
def rutina_para(m):
    pref = m["numero"].split("-")[0]
    deltipo = [x for x in rutinas if pref in SECCIONES.get(x["seccion"], [])]
    for f in [m["frecuencia"], "trimestral" if m["frecuencia"] == "semestral" else None]:
        r = next((x for x in deltipo if x["frecuencia"] == f), None)
        if r:
            return r["nombre"]
    return None


ORDEN_CRIT = {"muy_alta": 0, "alta": 1, "media": 2, "baja": 3, "muy_baja": 4, None: 5}
hoy = date.today()
planes = []
for f, cada in DIAS.items():
    grupo = sorted([m for m in maquinas if m["frecuencia"] == f], key=lambda m: (ORDEN_CRIT[m["criticidad"]], m["numero"]))
    for i, m in enumerate(grupo):
        # El primero toca en 3 días; los demás se reparten en su ciclo (los críticos antes).
        toca = 3 + (i * (cada - 3)) // max(len(grupo), 1)
        planes.append(dict(numero=m["numero"], nombre=f"Rutina {f}", cada_dias=cada, dias_para_tocar=toca, rutina=rutina_para(m),
                           tareas=None if rutina_para(m) else "Sin rutina en la hoja para esta frecuencia: revisar con mantenimiento."))

# ---------------------------------------------------------------------------- historial y paros
bd = H["BD_MANTENIMIENTOS"]
historial = []
for r in bd[1:]:
    r = r + [""] * (23 - len(r))
    if not limpio(r[0]).startswith("MTTO"):
        continue
    historial.append(dict(folio=limpio(r[0]), fecha=fecha(r[1]), numero=limpio(r[2]).upper(),
                          tipo="correctivo" if llave(r[8]) == "correctivo" else "preventivo", tipo_hoja=limpio(r[8]),
                          estado="cerrada" if llave(r[10]).startswith("cerrad") else "en_proceso",
                          falla=limpio(r[11]), diagnostico=limpio(r[12]) or None, trabajo=limpio(r[13]) or None,
                          tecnico=limpio(r[14]) or None, horas=numero(r[15]), registrado=fecha(r[22])))
costos = []
for r in H["DETALLE_COSTOS"][1:]:
    r = r + [""] * (13 - len(r))
    if limpio(r[0]).startswith("MTTO") and numero(r[11]):
        costos.append(dict(folio=limpio(r[0]), concepto="mano_obra" if llave(r[5]) == "mano de obra" else "otro",
                           descripcion=f"{limpio(r[5])}: {limpio(r[7])} × {limpio(r[8])} {limpio(r[9]).lower()}", monto=round(numero(r[11]), 2)))
paros = []
for r in H["CONTROL_DE_DISPONIBILIDAD"]:
    r = r + [""] * (13 - len(r))
    if limpio(r[2]).startswith("PARO") and not limpio(r[9]):
        paros.append(dict(folio=limpio(r[2]), numero=limpio(r[3]).upper(), desde=fecha(r[7]),
                          falla=f"{limpio(r[11])}. {limpio(r[12])}".strip(". ") + f" ({limpio(r[2])} de la hoja)"))

# ---------------------------------------------------------------------------- refacciones
modelos = {}
for m in maquinas:
    if m["modelo"]:
        modelos.setdefault(llave(m["modelo"]).replace(" ", ""), set()).add((m["categoria"], m["modelo"]))
refacciones = []
for r in H["COSTOS"]:
    r = r + [""] * (13 - len(r))
    if not re.match(r"^RF-\d+$", limpio(r[1])):
        continue
    mod = llave(r[6]).replace(" ", "")
    ligas = sorted(modelos.get(mod, set()))
    pieza = limpio(r[4]).strip("-").strip()
    refacciones.append(dict(codigo=limpio(r[1]), nombre=limpio(r[3]) + (f" ({pieza})" if pieza and llave(pieza) not in llave(r[3]) else ""),
                            unidad=llave(r[7]) or "pieza", costo=numero(r[8]), proveedor=limpio(r[9]) or None,
                            ligas=[{"categoria": c, "modelo": mo} for c, mo in ligas]))
for x in refacciones:
    x["unidad"] = {"pieza": "pieza", "piezas": "pieza", "metro": "metro", "metros": "metro", "litro": "litro", "juego": "juego",
                   "kit": "juego", "caja": "caja", "rollo": "rollo", "kilo": "kilo"}.get(x["unidad"], "pieza")

# ---------------------------------------------------------------------------- asignadas
asignadas = []
he = H["CONTROL_DE_HERRAMIENTAS"]
modo = None
for r in he:
    r = r + [""] * (9 - len(r))
    a, b = limpio(r[2]), limpio(r[3])
    if a == "Número de Esmeril":
        modo = "esmeril"; continue
    if a == "Personal":
        modo = "soldar" if modo in ("esmeril", None) else "inversora"; continue
    if modo == "esmeril" and a.isdigit() and b not in ("", "-"):
        asignadas.append(dict(numero=f"ESC-{int(a):02d}", persona=b))
    elif modo in ("soldar", "inversora") and a and re.search(r"\d+", b):
        n = int(re.search(r"\d+", b)[0])
        prefs = ("AXT", "MIL") if modo == "soldar" else ("TBV", "ABV")
        cod = next((f"{p}-{n:02d}" for p in prefs if f"{p}-{n:02d}" in por_codigo), None)
        if cod and llave(a) != "don abel":
            asignadas.append(dict(numero=cod, persona=a))

# ---------------------------------------------------------------------------- SQL
sql = f"""-- Programa de mantenimiento de Luis → módulo de mantenimiento ({hoy}).
do $s$ begin
  if exists (select 1 from public.maquinas) then
    raise exception 'Ya hay máquinas en el ERP: esta carga es de arranque y no se repite';
  end if;
end $s$;

insert into public.maquinas (numero, nombre, tipo, categoria, marca, modelo, ubicacion, criticidad, tipo_mantenimiento, especialidad,
  tipo_equipo, prestable, notas, fecha_alta)
select x.numero, x.nombre, x.tipo, x.categoria, x.marca, x.modelo, x.ubicacion, x.criticidad, x.tipo_mantenimiento, x.especialidad,
  x.tipo_equipo, x.tipo = 'herramienta', x.notas, current_date
from jsonb_to_recordset({lit(maquinas)}) x(numero text, nombre text, tipo text, categoria text, marca text, modelo text, ubicacion text,
  criticidad text, tipo_mantenimiento text, especialidad text, tipo_equipo text, notas text);

insert into public.rutinas_mantenimiento (nombre, categoria, frecuencia, recomendaciones, puntos)
select x.nombre, x.seccion, x.frecuencia, x.recomendaciones, x.puntos
from jsonb_to_recordset({lit(rutinas)}) x(nombre text, seccion text, frecuencia text, recomendaciones text, puntos jsonb);

-- Escalonados: la próxima fecha es hoy + días para tocar; la orden sale 7 días antes.
insert into public.planes_preventivos (maquina_id, nombre, tareas, cada_dias, ultima_fecha, rutina_id)
select m.id, x.nombre, x.tareas, x.cada_dias, current_date + x.dias_para_tocar - x.cada_dias, r.id
from jsonb_to_recordset({lit(planes)}) x(numero text, nombre text, tareas text, cada_dias int, dias_para_tocar int, rutina text)
join public.maquinas m on m.numero = x.numero
left join public.rutinas_mantenimiento r on r.nombre = x.rutina;

-- Historial: la falla lleva el folio de la hoja para encontrarla.
create temp table _h on commit drop as
  select x.*, m.id maquina_id from jsonb_to_recordset({lit(historial)}) x(folio text, fecha timestamp, numero text, tipo text, tipo_hoja text,
    estado text, falla text, diagnostico text, trabajo text, tecnico text, horas numeric, registrado timestamp)
  join public.maquinas m on m.numero = x.numero;
create temp table _o (folio text, orden_id uuid) on commit drop;
do $s$
declare h record; v uuid;
begin
  for h in select * from _h order by fecha loop
    insert into public.ordenes_mantenimiento (maquina_id, tipo, estado, falla, reportado_por, reportado_por_nombre, reportado_en, diagnostico,
      atendido_por, trabajo_realizado, inicio_en, cerrada_en, horas_trabajadas)
    values (h.maquina_id, h.tipo, h.estado, '[' || h.folio || case when h.tipo_hoja ilike 'predictivo' then ', predictivo' else '' end || '] ' || h.falla,
      null, h.tecnico, h.fecha at time zone 'America/Mexico_City', h.diagnostico, h.tecnico,
      case when h.estado = 'cerrada' then h.trabajo end, h.fecha at time zone 'America/Mexico_City',
      case when h.estado = 'cerrada' then h.registrado at time zone 'America/Mexico_City' end, h.horas)
    returning id into v;
    insert into _o values (h.folio, v);
    perform public.recalcular_estado_maquina(h.maquina_id);
  end loop;
end $s$;
insert into public.costos_servicio (mantenimiento_id, concepto, descripcion, monto, registrado_por)
select o.orden_id, x.concepto, x.descripcion, x.monto, null
from jsonb_to_recordset({lit(costos)}) x(folio text, concepto text, descripcion text, monto numeric) join _o o on o.folio = x.folio;

-- Paros abiertos: falla con la máquina parada desde el inicio del paro.
do $s$
declare p record;
begin
  for p in select x.*, m.id maquina_id from jsonb_to_recordset({lit(paros)}) x(folio text, numero text, desde timestamp, falla text)
           join public.maquinas m on m.numero = x.numero loop
    insert into public.ordenes_mantenimiento (maquina_id, tipo, falla, detiene, reportado_por, reportado_por_nombre, reportado_en, fuera_desde)
    values (p.maquina_id, 'correctivo', p.falla, true, null, 'Hoja de mantenimiento', p.desde at time zone 'America/Mexico_City',
            p.desde at time zone 'America/Mexico_City');
    perform public.recalcular_estado_maquina(p.maquina_id);
  end loop;
end $s$;

-- Refacciones: componentes nuevos (o el que ya existe con esa pieza) ligados al tipo y modelo.
insert into public.categorias (nombre, descripcion)
select 'Refacciones de mantenimiento', 'Piezas para las máquinas y herramienta del taller (del programa de mantenimiento)'
where not exists (select 1 from public.categorias where nombre = 'Refacciones de mantenimiento');
create temp table _r on commit drop as
  select x.*, row_number() over (order by x.codigo) n
  from jsonb_to_recordset({lit(refacciones)}) x(codigo text, nombre text, unidad text, costo numeric, proveedor text, ligas jsonb)
  where not exists (select 1 from public.articulos a where a.legacy_id = 'MTTO:' || x.codigo);
insert into public.articulos (legacy_id, clave, tipo, nombre, unidad, categoria_id)
select 'MTTO:' || x.codigo,
  'C-N' || lpad((coalesce((select max(substr(clave, 4)::int) from public.articulos where clave ~ '^C-N[0-9]+$'), 0) + x.n)::text, 4, '0'),
  'componente', x.nombre, x.unidad, (select id from public.categorias where nombre = 'Refacciones de mantenimiento')
from _r x;
insert into public.costos_articulo (articulo_id, costo, proveedor_id)
select a.id, x.costo, (select p.id from public.proveedores p where lower(p.nombre) = lower(x.proveedor) limit 1)
from _r x join public.articulos a on a.legacy_id = 'MTTO:' || x.codigo
where x.costo > 0
on conflict (articulo_id) do nothing;
insert into public.refacciones_maquina (articulo_id, categoria, modelo)
select a.id, l->>'categoria', l->>'modelo'
from _r x join public.articulos a on a.legacy_id = 'MTTO:' || x.codigo, jsonb_array_elements(x.ligas) l
on conflict do nothing;

-- Asignadas: solo si el apodo empata con una sola persona activa.
create temp table _a on commit drop as
  select x.numero, x.persona,
    (select array_agg(e.id) from public.empleados e
     where e.activo and translate(lower(e.nombre), 'áéíóúñ', 'aeioun') ~ ('\\m' || translate(lower(x.persona), 'áéíóúñ', 'aeioun') || '\\M')) ids
  from jsonb_to_recordset({lit(asignadas)}) x(numero text, persona text);
update public.maquinas m set asignada_a = a.ids[1]
from _a a where m.numero = a.numero and cardinality(a.ids) = 1;

do $s$
declare r jsonb;
begin
  select jsonb_build_object(
    'maquinas', (select count(*) from public.maquinas),
    'por_criticidad', (select jsonb_object_agg(coalesce(criticidad, 'sin'), n) from (select criticidad, count(*) n from public.maquinas group by 1) z),
    'sin_ubicacion', (select coalesce(jsonb_agg(numero order by numero), '[]') from public.maquinas where ubicacion is null),
    'rutinas', (select count(*) from public.rutinas_mantenimiento),
    'puntos', (select sum(jsonb_array_length(puntos)) from public.rutinas_mantenimiento),
    'planes', (select count(*) from public.planes_preventivos),
    'planes_sin_rutina', (select coalesce(jsonb_agg(m.numero || ' ' || p.nombre order by m.numero), '[]')
                          from public.planes_preventivos p join public.maquinas m on m.id = p.maquina_id where p.rutina_id is null),
    'primeros_vencen', (select jsonb_agg(z) from (select min(ultima_fecha + cada_dias) primero, max(ultima_fecha + cada_dias) ultimo
                        from public.planes_preventivos) z),
    'ordenes', (select jsonb_agg(numero || ' ' || estado || ' ' || left(falla, 40)) from public.v_ordenes_mantenimiento),
    'costos', (select sum(monto) from public.costos_servicio where mantenimiento_id is not null),
    'refacciones_nuevas', (select count(*) from _r),
    'refacciones_con_costo', (select count(*) from _r where costo > 0),
    'refacciones_ligadas', (select count(distinct articulo_id) from public.refacciones_maquina),
    'asignadas', (select coalesce(jsonb_agg(m.numero || ' → ' || e.nombre order by m.numero), '[]') from public.maquinas m join public.empleados e on e.id = m.asignada_a),
    'asignadas_sin_empatar', (select coalesce(jsonb_agg(numero || ' ' || persona || ' (' || coalesce(cardinality(ids), 0) || ')'), '[]') from _a where coalesce(cardinality(ids), 0) <> 1),
    'estados', (select jsonb_object_agg(estado, n) from (select estado, count(*) n from public.maquinas group by 1) z))
  into r;
  {"raise exception 'ENSAYO %', jsonb_pretty(r);" if ENSAYO else "raise notice 'Mantenimiento cargado: %', jsonb_pretty(r);"}
end $s$;
"""
sys.stdout.write(sql)
print(f"{len(maquinas)} máquinas, {len(rutinas)} rutinas ({sum(len(x['puntos']) for x in rutinas)} puntos), {len(planes)} planes, "
      f"{len(historial)} historial, {len(costos)} costos, {len(paros)} paros, {len(refacciones)} refacciones, {len(asignadas)} asignadas",
      file=sys.stderr)

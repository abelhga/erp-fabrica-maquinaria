# Pasa los datos de la demostración (la base local armada con cargar.sh) a un proyecto en la nube
# que ya tiene las migraciones, por la API de administración (scripts/nube/sql_nube.py).
#
#   C=supabase_db_erp-fabrica-maquinaria
#   docker exec $C pg_dump -U postgres --data-only --inserts --rows-per-insert=200 -n public -f /tmp/publico.sql postgres
#   docker exec $C pg_dump -U postgres --data-only --inserts -t auth.users -t auth.identities -f /tmp/auth.sql postgres
#   docker cp $C:/tmp/publico.sql . && docker cp $C:/tmp/auth.sql .
#   NUBE_REF=<ref> python3 scripts/demo-comercial/subir_datos.py auth.sql publico.sql
#
# (El pg_dump del contenedor: el de Ubuntu es de otra versión y se niega.)
# Vacía antes todas las tablas de public: las migraciones ya sembraron configuración, permisos y
# catálogos, y el respaldo los trae completos. Se niega si el proyecto tiene pedidos o un libro de
# ventas: es para un proyecto de demostración recién migrado, nunca para el de planta.
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../nube"))
from sql_nube import correr

ok, cuerpo = correr("select (select count(*) from public.pedidos) + (select count(*) from public.historial_ventas_hoja) n,"
                    " (select count(*) from auth.users) u", "¿proyecto vacío?")
if not ok:
    sys.exit(1)
r = json.loads(cuerpo)[0]
if r["n"] or r["u"]:
    sys.exit(f"El proyecto ya tiene datos ({r['n']} pedidos/ventas, {r['u']} cuentas): no se toca.")

# Disparadores apagados: hay llaves circulares (cotizaciones, movimientos) y tablas que no dejan
# insertar historia "a mano"; los datos ya vienen cuadrados de la base local.
REPLICA = "set session_replication_role = replica;\n"
ok, _ = correr(REPLICA + """do $$ declare t text; begin
  select string_agg(format('public.%I', tablename), ', ') into t from pg_tables where schemaname = 'public';
  execute 'truncate ' || t || ' restart identity cascade';
end $$;""", "vaciar public")
if not ok:
    sys.exit(1)


def sentencias(archivo):
    actual = []
    for linea in open(archivo, encoding="utf8"):
        if linea.startswith("\\") or linea.startswith("SET ") or linea.startswith("--") \
           or linea.startswith("SELECT pg_catalog.set_config('search_path'"):
            continue
        if (linea.startswith("INSERT INTO ") or linea.startswith("SELECT pg_catalog.setval")) and actual:
            yield "".join(actual)
            actual = []
        actual.append(linea)
    if "".join(actual).strip():
        yield "".join(actual)


for archivo in sys.argv[1:]:
    pedazo, tam, n = [], 0, 0
    def mandar():
        global pedazo, tam, n
        if not pedazo:
            return
        n += 1
        ok, _ = correr(REPLICA + "".join(pedazo), f"{os.path.basename(archivo)} parte {n}")
        if not ok:
            sys.exit(1)
        pedazo, tam = [], 0
    for s in sentencias(archivo):
        pedazo.append(s)
        tam += len(s)
        if tam > 1_500_000:
            mandar()
    mandar()
print("Datos arriba.")

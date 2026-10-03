# Aplica en la nube las migraciones que falten, en orden, y deja su registro en
# supabase_migrations.schema_migrations (el mismo que usa `supabase db push`, para que
# el CLI no las vuelva a aplicar). Cada archivo va en una sola petición: si falla, no
# queda a medias. Se detiene en la primera que falle.
#   NUBE_REF=<ref> python3 scripts/nube/migrar.py
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sql_nube import correr

M = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../supabase/migrations")
ok, _ = correr("""create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);""",
               "pg_cron y registro de migraciones")
if not ok:
    sys.exit(1)
ok, hechas = correr("select coalesce(json_agg(version), '[]') v from supabase_migrations.schema_migrations", "migraciones ya aplicadas")
ya = set(json.loads(hechas)[0]["v"])
for f in sorted(os.listdir(M)):
    if not f.endswith(".sql"):
        continue
    version, nombre = f[:-4].split("_", 1)
    if version in ya:
        continue
    registro = ("insert into supabase_migrations.schema_migrations (version, name, statements) "
                f"values ($v${version}$v$, $n${nombre}$n$, array[]::text[]);")
    ok, _ = correr(open(os.path.join(M, f)).read() + "\n;\n" + registro, f)
    if not ok:
        sys.exit(1)
print("Al día.")

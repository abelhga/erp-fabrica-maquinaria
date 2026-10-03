# Corre supabase/pruebas/*.sql en la nube igual que scripts/probar-bd.mjs: cada archivo
# con _ayudas.sql dentro de una transacción que se deshace (no deja nada en la base).
#   NUBE_REF=<ref> python3 scripts/nube/pruebas.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sql_nube import correr

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../supabase/pruebas")
ayudas = open(os.path.join(P, "_ayudas.sql")).read()
archivos = sorted(f for f in os.listdir(P) if f.endswith(".sql") and not f.startswith("_"))
fallas = 0
for f in archivos:
    ok, _ = correr("begin;\n" + ayudas + "\n" + open(os.path.join(P, f)).read() + "\nrollback;\n", f)
    fallas += not ok
print(f"\n{fallas} con fallas" if fallas else f"\nTodo bien ({len(archivos)} archivos)")
sys.exit(1 if fallas else 0)

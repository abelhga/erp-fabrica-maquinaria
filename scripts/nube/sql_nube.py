# Ejecuta SQL en el proyecto de Supabase en la nube por la API de administración
# (POST /v1/projects/{ref}/database/query). La llave (token personal de Supabase) NO va
# aquí: en una sesión de Claude en la nube la agrega el proxy del entorno como "API
# credential" para api.supabase.com; en tu computadora, exporta SUPABASE_ACCESS_TOKEN.
#   NUBE_REF=<ref del proyecto> python3 scripts/nube/sql_nube.py archivo.sql
import json, os, subprocess, sys, tempfile

# Sin valor por omisión: que nadie le aplique algo a producción por no haber dicho a cuál.
REF = os.environ.get("NUBE_REF") or sys.exit("Falta NUBE_REF (Project Settings → General → Reference ID).")

def correr(sql, etiqueta, tiempo=600):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump({"query": sql}, f)
        ruta = f.name
    cabeceras = ["-H", "Content-Type: application/json"]
    if os.environ.get("SUPABASE_ACCESS_TOKEN"):
        cabeceras += ["-H", f"Authorization: Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}"]
    try:
        r = subprocess.run(["curl", "-sS", "-m", str(tiempo), "-X", "POST",
                            f"https://api.supabase.com/v1/projects/{REF}/database/query",
                            *cabeceras, "--data-binary", f"@{ruta}", "-w", "\n%{http_code}"],
                           capture_output=True, text=True)
    finally:
        os.unlink(ruta)
    cuerpo, _, codigo = r.stdout.rpartition("\n")
    ok = codigo in ("200", "201")
    print(f"{'✔' if ok else '✘'} {etiqueta} [{codigo}]" + ("" if ok else f"\n   {cuerpo[:1500]}{r.stderr[:300]}"))
    return ok, cuerpo

if __name__ == "__main__":
    ok, cuerpo = correr(open(sys.argv[1]).read(), sys.argv[1])
    if ok:
        print(cuerpo[:3000])
    sys.exit(0 if ok else 1)

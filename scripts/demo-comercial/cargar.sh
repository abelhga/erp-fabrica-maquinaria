#!/usr/bin/env bash
# Llena una base VACÍA (solo migraciones) con "Fábrica Atlas Industrial", la fábrica inventada de la
# demostración comercial. Se arma en el Supabase local y de ahí se pasa a la nube
# (scripts/demo-comercial/subir.sh); ver docs/demo-comercial.md.
#
#   npx supabase db reset            # o una instancia aparte (README, "Verificar desde cero")
#   bash scripts/demo-comercial/cargar.sh
#
# Orden: las cuentas de prueba, los scripts de cada módulo (firman con esas cuentas y usan las
# funciones de la app, así que también prueban los permisos), la historia de ventas inventada,
# el análisis (su meta sale del año anterior) y al final el maquillaje, que cambia nombres,
# correos y la marca "DEMO" por los de la empresa inventada.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB_URL=${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
LOG=${TMPDIR:-/tmp}/demo-comercial
mkdir -p "$LOG"

if [ "$(psql "$DB_URL" -Atc "select count(*) from public.pedidos")" != "0" ]; then
  echo "La base ya tiene pedidos: esto es solo para una base recién migrada." >&2
  exit 1
fi

node scripts/usuarios-locales.mjs > "$LOG/usuarios.log"

correr() {
  printf '%-40s' "$1"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$1" > "$LOG/$(basename "$1").log" 2>&1; then
    echo "✔"
  else
    echo "✘"; grep -m3 -A3 ERROR "$LOG/$(basename "$1").log" >&2; exit 1
  fi
}

for s in costeo compras_almacen importaciones ventas produccion rrhh_finanzas objetivos_prenomina \
         servicio envios solicitudes_precio; do
  correr "scripts/demo/$s.sql"
done
correr scripts/demo-comercial/historial.sql
correr scripts/demo/analisis.sql
correr scripts/demo-comercial/maquillaje.sql
echo "Listo. Bitácoras en $LOG"

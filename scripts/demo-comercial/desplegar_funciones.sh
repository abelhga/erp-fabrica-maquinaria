#!/usr/bin/env bash
# Despliega en el proyecto de demostración las funciones que la demo usa (asistente, revisión
# nocturna y "ver como"), con el nombre de la empresa inventada. Las instrucciones que reciben la
# IA y la revisión traen "Hegamex" escrito (quiénes somos, qué fabricamos, cómo firma un vendedor):
# aquí se cambian en una copia, no en el código de planta.
#
#   NUBE_REF=<ref> bash scripts/demo-comercial/desplegar_funciones.sh
# El CLI necesita SUPABASE_ACCESS_TOKEN (en una sesión de Claude en la nube, cualquier valor con
# forma de token: el proxy pone el de verdad).
set -euo pipefail
cd "$(dirname "$0")/../.."
REF=${NUBE_REF:?Falta NUBE_REF}
EMPRESA=${EMPRESA:-Fábrica Atlas Industrial}
RAZON=${RAZON:-Fábrica Atlas Industrial S.A. de C.V.}
COPIA=$(mktemp -d)
mkdir -p "$COPIA/supabase"
cp -r supabase/functions "$COPIA/supabase/"
cp supabase/config.toml "$COPIA/supabase/"
find "$COPIA/supabase/functions" -name "*.test.ts" -delete
# De lo más largo a lo más corto (y «(á|a)», no «[áa]»: sed lee la clase byte por byte). "Atotonilco el Alto, Jalisco" es dónde está Hegamex: fuera.
find "$COPIA/supabase/functions" -name "*.ts" -exec sed -i -E \
  -e "s/M(á|a)quinas y Herramientas Gamex( S\.A\. de C\.V\.)?, Atotonilco el Alto, Jalisco/$RAZON, Zapopan, Jalisco/g" \
  -e "s/M(á|a)quinas y Herramientas Gamex( S\.A\. de C\.V\.)?/$RAZON/g" \
  -e "s/Hegamex/$EMPRESA/g; s/HEGAMEX/${EMPRESA^^}/g" \
  -e "s/Yao Han Industries Co\., Ltd\./Huaxin Packing Machinery Co., Ltd./g" {} +
# Los datos de importaciones guardan «hegamex» como la clave de «nos toca» (una regla de la base la
# exige así) y la IA la leía tal cual: «la carta de Hegamex». Se le dice qué significa.
NOTA="En los datos, la clave «hegamex» (por ejemplo en «debe») quiere decir esta empresa: escríbela como «nosotros» o con su nombre, nunca tal cual."
sed -i -E "s/(Eres el asistente del ERP de [^\n]*Jalisco\)\.)/\1 $NOTA/" "$COPIA/supabase/functions/asistente/nucleo.ts"
sed -i -E "s/(Eres el revisor nocturno del ERP de [^,]*, )/\1($NOTA) /" "$COPIA/supabase/functions/revision/nucleo.ts"
grep -q "la clave «hegamex»" "$COPIA/supabase/functions/asistente/nucleo.ts" || { echo "No entró la nota de «hegamex» al asistente" >&2; exit 1; }
if grep -rn "Hegamex\|Gamex\|Yao Han" "$COPIA/supabase/functions" --include=*.ts | grep -v "^\S*:\s*//" | grep -q .; then
  echo "Quedó «Hegamex» en las funciones:" >&2
  grep -rn "Hegamex\|Gamex\|Yao Han" "$COPIA/supabase/functions" --include=*.ts | head >&2
  exit 1
fi
: "${SUPABASE_ACCESS_TOKEN:?Falta SUPABASE_ACCESS_TOKEN (en una sesión en la nube, un valor de relleno con forma de token: el proxy pone el de verdad)}"
(cd "$COPIA" && npx --prefix "$OLDPWD" supabase functions deploy asistente --project-ref "$REF" --use-api \
  && npx --prefix "$OLDPWD" supabase functions deploy revision --project-ref "$REF" --no-verify-jwt --use-api \
  && npx --prefix "$OLDPWD" supabase functions deploy ver-como --project-ref "$REF" --no-verify-jwt --use-api)
rm -rf "$COPIA"

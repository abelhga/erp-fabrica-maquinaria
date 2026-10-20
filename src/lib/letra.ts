// Importes con letra para pagarés y recibos: "MIL QUINIENTOS PESOS 00/100 M.N.", como se
// escriben a mano en México (el papel firmado vale por lo que dice en letra).
const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function hastaMil(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? " Y " + UNIDADES[r % 10] : "");
  return [CENTENAS[c], resto].filter(Boolean).join(" ");
}

/** Entero a letra en mayúsculas ("UN MILLÓN DOSCIENTOS MIL"). */
export function enteroConLetra(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  return [
    millones ? (millones === 1 ? "UN MILLÓN" : `${enteroConLetra(millones)} MILLONES`) : "",
    miles ? (miles === 1 ? "MIL" : `${hastaMil(miles)} MIL`) : "",
    resto ? hastaMil(resto) : "",
  ].filter(Boolean).join(" ");
}

/** 1500.5 → "MIL QUINIENTOS PESOS 50/100 M.N." */
export function pesosConLetra(importe: number | string): string {
  const centavos = Math.round(Number(importe) * 100);
  const enteros = Math.floor(centavos / 100);
  const millonesExactos = enteros >= 1_000_000 && enteros % 1_000_000 === 0;
  return `${enteroConLetra(enteros)} ${millonesExactos ? "DE PESOS" : enteros === 1 ? "PESO" : "PESOS"} ${String(centavos % 100).padStart(2, "0")}/100 M.N.`;
}

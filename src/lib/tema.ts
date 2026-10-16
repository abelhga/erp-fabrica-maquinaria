/**
 * Tema claro u oscuro. Manda lo que la persona eligió con el botón (se guarda en su
 * navegador); si nunca eligió, el de la empresa (Configuración → Empresa → Apariencia),
 * que se recuerda en el navegador para pintar bien desde la pantalla de entrar.
 *
 * Antes se guardaba "tema" en cada carga aunque nadie lo eligiera: todos quedaban
 * con "claro" guardado y un cambio de la empresa no le llegaba a nadie. Esa llave
 * vieja ya no se lee; solo cuenta lo elegido a propósito.
 */
export type Tema = "oscuro" | "claro";

const ELEGIDO = "tema_elegido";
const EMPRESA = "tema_empresa";

function leer(llave: string): Tema | null {
  try {
    const v = localStorage.getItem(llave);
    return v === "oscuro" || v === "claro" ? v : null;
  } catch { return null; }
}

export const temaEmpresa = (): Tema => leer(EMPRESA) ?? "oscuro";
export const temaInicial = (): Tema => leer(ELEGIDO) ?? temaEmpresa();
export const aplicarTema = (t: Tema) => document.documentElement.classList.toggle("dark", t === "oscuro");

/** La persona escogió con el botón: eso manda en este navegador. */
export function elegirTema(t: Tema) {
  try { localStorage.setItem(ELEGIDO, t); localStorage.removeItem("tema"); } catch { /* modo privado */ }
  aplicarTema(t);
}

/** Llegó el tema de la empresa: se recuerda, y se aplica si la persona no ha elegido uno. */
export function recordarTemaEmpresa(t: Tema): Tema {
  try { localStorage.setItem(EMPRESA, t); } catch { /* modo privado */ }
  const vigente = leer(ELEGIDO) ?? t;
  aplicarTema(vigente);
  return vigente;
}

// El PDF que se adjunta al correo, hecho en el navegador con la misma hoja que se imprime: así
// lo que recibe el cliente es lo que el vendedor ve en «Imprimir / PDF». Es una foto de la hoja
// por página (no texto seleccionable): a cambio, no hay un segundo formato que mantener.
// Las librerías se cargan solo al mandar un correo.

const CARTA = { ancho: 612, alto: 792 }; // puntos (8.5 × 11 in)

/** Dónde se puede cortar la página sin partir un renglón: el final de cada fila y de cada bloque. */
function cortes(raiz: HTMLElement, escala: number) {
  const arriba = raiz.getBoundingClientRect().top;
  const ys = new Set<number>();
  raiz.querySelectorAll<HTMLElement>("tr, :scope > *, :scope > * > *, li, p").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0) ys.add(Math.round((r.bottom - arriba) * escala));
  });
  return [...ys].sort((a, b) => a - b);
}

/**
 * Convierte un elemento ya pintado (en esta página o en un iframe del mismo sitio) en un PDF
 * tamaño carta. `margen` en pulgadas arriba y abajo de cada página; a lo ancho, el elemento
 * ocupa la hoja completa (la hoja de impresión ya trae su margen).
 */
export async function pdfDeElemento(el: HTMLElement, margen = 0.35): Promise<Uint8Array> {
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([import("html2canvas"), import("pdf-lib")]);
  const escala = 2;
  const lienzo = await html2canvas(el, {
    scale: escala, useCORS: true, backgroundColor: "#ffffff", logging: false,
    windowWidth: el.ownerDocument.documentElement.scrollWidth,
  });
  const pxPorPt = lienzo.width / CARTA.ancho;
  const margenPx = Math.round(margen * 72 * pxPorPt);
  const altoUtil = Math.round(CARTA.alto * pxPorPt) - 2 * margenPx;
  const posibles = cortes(el, escala);

  const pdf = await PDFDocument.create();
  for (let y = 0; y < lienzo.height - 2;) {
    let fin = Math.min(y + altoUtil, lienzo.height);
    if (fin < lienzo.height) {
      // El último corte limpio que deje la página por lo menos a la mitad; si no hay, se corta donde caiga.
      const limpio = posibles.filter((c) => c > y + altoUtil / 2 && c <= y + altoUtil).pop();
      if (limpio) fin = limpio;
    }
    const trozo = document.createElement("canvas");
    trozo.width = lienzo.width;
    trozo.height = fin - y;
    const ctx = trozo.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, trozo.width, trozo.height);
    ctx.drawImage(lienzo, 0, y, lienzo.width, fin - y, 0, 0, lienzo.width, fin - y);
    const jpg = await (await fetch(trozo.toDataURL("image/jpeg", 0.88))).arrayBuffer();
    const img = await pdf.embedJpg(jpg);
    const pagina = pdf.addPage([CARTA.ancho, CARTA.alto]);
    const alto = (fin - y) / pxPorPt;
    pagina.drawImage(img, { x: 0, y: CARTA.alto - margen * 72 - alto, width: CARTA.ancho, height: alto });
    y = fin;
  }
  return pdf.save();
}

/**
 * Abre una página del ERP en un iframe escondido (con la sesión de siempre), espera a que
 * aparezca `selector` con sus imágenes cargadas y la convierte en PDF.
 */
export async function pdfDeRuta(ruta: string, selector = ".hoja", espera = 25_000): Promise<Uint8Array> {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  // Fuera de la vista pero con su tamaño: html2canvas necesita que esté pintado.
  marco.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;";
  marco.src = ruta;
  document.body.appendChild(marco);
  try {
    const hasta = Date.now() + espera;
    for (;;) {
      const doc = marco.contentDocument;
      const el = doc?.querySelector<HTMLElement>(selector);
      if (el && [...el.querySelectorAll("img")].every((i) => i.complete)) {
        await doc!.fonts?.ready;
        await new Promise((r) => setTimeout(r, 300));
        return await pdfDeElemento(el);
      }
      if (Date.now() > hasta) throw new Error("No se pudo preparar el PDF (la hoja no terminó de cargar). Inténtalo otra vez.");
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    marco.remove();
  }
}

export function aBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Para lo que solo existe al imprimir (la orden de compra, escondida en pantalla): una copia
 * visible fuera de la vista, en tinta negra sobre blanco aunque la app esté en modo oscuro, con
 * el margen de la hoja impresa.
 */
export async function pdfDeCopia(original: HTMLElement): Promise<Uint8Array> {
  const caja = document.createElement("div");
  caja.className = "pdf-claro";
  caja.style.cssText = "position:fixed;left:-10000px;top:0;width:8.5in;padding:0 0.5in 0.3in;background:#fff;color:#111;";
  const estilo = document.createElement("style");
  estilo.textContent = ".pdf-claro, .pdf-claro * { color: #111 !important; border-color: #bbb !important; } .pdf-claro .tenue { color: #555 !important; }";
  const copia = original.cloneNode(true) as HTMLElement;
  copia.classList.remove("hidden");
  copia.style.display = "block";
  caja.append(estilo, copia);
  document.body.appendChild(caja);
  try {
    await document.fonts?.ready;
    return await pdfDeElemento(caja, 0.5);
  } finally {
    caja.remove();
  }
}

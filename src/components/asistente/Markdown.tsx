// Markdown mínimo para las respuestas del asistente: párrafos, negritas, cursivas,
// código, listas, tablas y enlaces. Sin HTML crudo (nada de dangerouslySetInnerHTML):
// el texto viene de un modelo y no debe poder meter etiquetas en la página.
// Los enlaces a rutas del ERP navegan sin recargar; los externos abren en otra pestaña.
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

function enLinea(texto: string, clave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let ultimo = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const k = `${clave}-${i++}`;
    if (m[2]) partes.push(<strong key={k} className="font-semibold">{m[2]}</strong>);
    else if (m[3] || m[4]) partes.push(<em key={k}>{m[3] ?? m[4]}</em>);
    else if (m[5]) partes.push(<code key={k} className="rounded bg-fondo px-1 py-0.5 text-[0.85em]">{m[5]}</code>);
    else if (m[6] && m[7]) {
      const href = m[7];
      partes.push(href.startsWith("/")
        ? <Link key={k} to={href} className="text-marca-texto font-medium underline underline-offset-2 hover:no-underline">{m[6]}</Link>
        : /^https?:\/\//.test(href)
          ? <a key={k} href={href} target="_blank" rel="noreferrer noopener" className="text-marca-texto underline underline-offset-2">{m[6]}</a>
          : m[6]);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function Markdown({ texto }: { texto: string }) {
  const lineas = texto.replace(/\r/g, "").split("\n");
  const bloques: ReactNode[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    // Tabla: | a | b | seguida de |---|---|
    if (l.trim().startsWith("|") && lineas[i + 1]?.match(/^\s*\|?\s*:?-{2,}/)) {
      const celdas = (s: string) => s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const cab = celdas(l);
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && lineas[i].trim().startsWith("|")) filas.push(celdas(lineas[i++]));
      bloques.push(
        <div key={`t${i}`} className="overflow-x-auto my-2 rounded-lg border border-borde">
          <table className="w-full text-xs">
            <thead className="bg-fondo"><tr>{cab.map((c, j) => <th key={j} className="px-2 py-1.5 text-left font-semibold">{enLinea(c, `h${i}${j}`)}</th>)}</tr></thead>
            <tbody>{filas.map((f, r) => <tr key={r} className="border-t border-borde">{f.map((c, j) =>
              <td key={j} className={`px-2 py-1.5 ${/^[-$\d.,% ]+$/.test(c) ? "text-right cifra" : ""}`}>{enLinea(c, `c${i}${r}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+\.)\s+/.test(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lineas.length && /^\s*([-*•]|\d+\.)\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*([-*•]|\d+\.)\s+/, ""));
      const Lista = ordenada ? "ol" : "ul";
      bloques.push(
        <Lista key={`l${i}`} className={`my-1.5 space-y-1 pl-5 ${ordenada ? "list-decimal" : "list-disc"} marker:text-tenue`}>
          {items.map((it, j) => <li key={j}>{enLinea(it, `li${i}${j}`)}</li>)}
        </Lista>,
      );
      continue;
    }
    const titulo = l.match(/^#{1,4}\s+(.*)$/);
    if (titulo) { bloques.push(<p key={`h${i}`} className="font-semibold mt-2">{enLinea(titulo[1], `t${i}`)}</p>); i++; continue; }
    const parrafo: string[] = [];
    while (i < lineas.length && lineas[i].trim() && !/^\s*([-*•]|\d+\.)\s+/.test(lineas[i]) && !lineas[i].trim().startsWith("|") && !/^#{1,4}\s/.test(lineas[i])) parrafo.push(lineas[i++]);
    bloques.push(<p key={`p${i}`} className="my-1.5">{parrafo.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(p, `p${i}${j}`)}</Fragment>)}</p>);
  }
  return <div className="text-sm leading-relaxed">{bloques}</div>;
}

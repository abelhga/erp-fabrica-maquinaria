// Los manuales interactivos: la fuente vive en docs/manuales (de ahí también se publican
// como artefactos), y `npm run manuales` arma la copia que sirve el ERP en public/manuales.
// Sin React: lo usan la pantalla, el script que arma las copias y su prueba.

export type ClaveManual = "general" | "importaciones" | "finanzas" | "susana";

export interface Manual {
  clave: ClaveManual;
  titulo: string;
  para: string;
  descripcion: string;
  /** El artefacto publicado del mismo manual: sus ligas entre manuales apuntan ahí y aquí se cambian a /ayuda. */
  artefacto: string;
}

export const MANUALES: Manual[] = [
  {
    clave: "general", titulo: "Manual del ERP", para: "Todos",
    descripcion: "El recorrido de un pedido de equipo de la primera llamada a la cobranza: qué hace cada puesto, los estados de cada documento y las reglas que cuida el sistema.",
    artefacto: "QmgwqhqZRrr2cCT999aDrg",
  },
  {
    clave: "importaciones", titulo: "Importaciones", para: "Importaciones, compras y finanzas",
    descripcion: "Un embarque de la PI a la bodega: etapas con su fecha real, documentos por modalidad, dinero en dólares, costo puesto en planta y alertas. Trae un simulador.",
    artefacto: "JE9GJshYh1zd6DNMzDFDuZ",
  },
  {
    clave: "finanzas", titulo: "Finanzas", para: "Finanzas y gerencia administrativa",
    descripcion: "Cobranza, pagos a proveedores con XML, cómo se aplica un pago, caja chica y qué significa cada mensaje del sistema.",
    artefacto: "UzrNvDHUUs6zPB24CPivdU",
  },
  {
    clave: "susana", titulo: "Gerencia administrativa", para: "Susana",
    descripcion: "Lo que cambia de la hoja al ERP: ingresos, egresos y caja chica, la venta de un equipo de la cotización al último pago, refacciones y números de serie.",
    artefacto: "RieLcpSnJCnCJ6soYgJSA9",
  },
];

const PUENTE_TEMA = `<script>
// El manual sigue el tema del ERP: dentro de la pantalla de ayuda copia el del marco (y
// cambia si alguien lo cambia); abierto solo, el que se eligió o el de la empresa.
(function () {
  var raiz = document.documentElement;
  function tema() {
    var t = null;
    try { t = localStorage.getItem("tema_elegido") || localStorage.getItem("tema_empresa"); } catch (e) {}
    try { if (window.parent !== window) t = window.parent.document.documentElement.classList.contains("dark") ? "oscuro" : "claro"; } catch (e) {}
    raiz.setAttribute("data-theme", (t || "oscuro") === "oscuro" ? "dark" : "light");
  }
  tema();
  try { if (window.parent !== window) new MutationObserver(tema).observe(window.parent.document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
  window.addEventListener("storage", tema);
})();
</script>`;

/**
 * La copia que sirve el ERP. La fuente se escribió para publicarse como artefacto, que pone
 * su propio esqueleto; aquí se le pone el nuestro, el tema del ERP, y las ligas a los otros
 * manuales abren su pantalla de ayuda (en toda la ventana, no dentro del marco).
 */
export function armarManual(fuente: string): string {
  let html = fuente;
  for (const m of MANUALES) {
    html = html.replace(new RegExp(`href="https://claude\\.ai/artifact/${m.artefacto}(#[\\w-]+)?"`, "g"),
      (_, ancla = "") => `href="/ayuda/${m.clave}${ancla}" target="_top"`);
  }
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<!-- Generado por \`npm run manuales\` desde docs/manuales. No se edita aquí. -->
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
${PUENTE_TEMA}
</head>
<body>
${html.trim()}
</body>
</html>
`;
}

import { describe, expect, it } from "vitest";
import { folioCfdi, leerCfdi } from "./cfdi";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A" Folio="3354" Fecha="2026-10-08T15:37:11"
  FormaPago="99" SubTotal="10000.00" Moneda="MXN" Total="11600.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="44100">
  <cfdi:Emisor Rfc="TTA0101019Z8" Nombre="TECNOLOGIA EN TRANSPORTADORES ANVA &amp; CIA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="MHG160202UX1" Nombre="MAQUINAS Y HERRAMIENTAS GAMEX" UsoCFDI="G01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="31151600" Cantidad="10" Descripcion="Banda PVC 120 blanca" ValorUnitario="1000" Importe="10000"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="6f2a1c4e-1111-4bbb-9ccc-0123456789ab" FechaTimbrado="2026-10-08T15:38:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

describe("CFDI", () => {
  it("lee lo que hace falta para registrar la compra", () => {
    const c = leerCfdi(XML);
    expect(c).toMatchObject({
      version: "4.0", uuid: "6F2A1C4E-1111-4BBB-9CCC-0123456789AB", serie: "A", folio: "3354", fecha: "2026-10-08",
      tipo: "I", subtotal: 10000, total: 11600, moneda: "MXN", metodoPago: "PPD",
      emisor: { rfc: "TTA0101019Z8", nombre: "TECNOLOGIA EN TRANSPORTADORES ANVA & CIA" },
      receptor: { rfc: "MHG160202UX1" },
    });
    expect(c.conceptos).toEqual(["Banda PVC 120 blanca"]);
    expect(folioCfdi(c)).toBe("A 3354");
  });
  it("avisa si el archivo no es una factura", () => {
    expect(() => leerCfdi("<html><body>hola</body></html>")).toThrow(/no es una factura/);
  });
});

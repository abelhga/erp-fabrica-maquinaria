import { describe, expect, it } from "vitest";
import { cfdiDeLectura, folioCfdi, leerCfdi, metodoDeFormaPago, uuidValido } from "./cfdi";

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
  it("lee los pagos de un complemento y las facturas que liquida", () => {
    const xml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="P" Folio="88" Fecha="2026-10-12T10:00:00" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P">
  <cfdi:Emisor Rfc="MHG160202UX1" Nombre="MAQUINAS Y HERRAMIENTAS GAMEX"/><cfdi:Receptor Rfc="GDN010101AA1" Nombre="GRANOS DEL NORTE"/>
  <cfdi:Complemento><pago20:Pagos Version="2.0"><pago20:Totales MontoTotalPagos="15000.00"/>
    <pago20:Pago FechaPago="2026-10-10T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="15000.00">
      <pago20:DoctoRelacionado IdDocumento="aaaaaaaa-1111-2222-3333-444444444444" Serie="A" Folio="3301" MonedaDR="MXN" NumParcialidad="2" ImpSaldoAnt="20000" ImpPagado="10000.00" ImpSaldoInsoluto="10000.00"/>
      <pago20:DoctoRelacionado IdDocumento="bbbbbbbb-1111-2222-3333-444444444444" Serie="A" Folio="3302" MonedaDR="MXN" NumParcialidad="1" ImpSaldoAnt="5000" ImpPagado="5000.00" ImpSaldoInsoluto="0"/>
    </pago20:Pago></pago20:Pagos>
  <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="cccccccc-1111-2222-3333-444444444444"/></cfdi:Complemento>
</cfdi:Comprobante>`;
    const c = leerCfdi(xml);
    expect(c.tipo).toBe("P");
    expect(c.pagos).toHaveLength(1);
    expect(c.pagos[0]).toMatchObject({ fecha: "2026-10-10", formaPago: "03", monto: 15000 });
    expect(c.pagos[0].doctos.map((d) => [d.uuid, d.pagado, d.parcialidad])).toEqual([
      ["AAAAAAAA-1111-2222-3333-444444444444", 10000, 2], ["BBBBBBBB-1111-2222-3333-444444444444", 5000, 1]]);
    expect(metodoDeFormaPago("03")).toBe("transferencia");
    expect(leerCfdi(XML).pagos).toEqual([]);
  });
});

describe("cfdiDeLectura (lo que Claude leyó de un PDF)", () => {
  it("lo pone en la misma forma que el XML", () => {
    const c = cfdiDeLectura({ uuid: "aaaabbbb-1111-2222-3333-444455556666", rfc_emisor: "rbb-980512-kz3", nombre_emisor: "RODAMIENTOS", rfc_receptor: null,
      serie: "A", folio: "4471", fecha: "2026-10-08", tipo_comprobante: "E", metodo_pago: "PUE", moneda: "usd", tipo_cambio: 18.5,
      subtotal: 100, total: 116, conceptos: ["Rodamiento", ""], advertencias: [] });
    expect(c.uuid).toBe("AAAABBBB-1111-2222-3333-444455556666");
    expect(c.emisor.rfc).toBe("RBB980512KZ3");
    expect(c.tipo).toBe("E");
    expect(c.metodoPago).toBe("PUE");
    expect(c.moneda).toBe("USD");
    expect(c.total).toBe(116);
    expect(c.conceptos).toEqual(["Rodamiento"]);
  });
  it("un UUID incompleto no se usa (dejaría pasar duplicados)", () => {
    expect(cfdiDeLectura({ uuid: "AAAABBBB-1111-2222-3333" }).uuid).toBeNull();
    expect(uuidValido("AAAABBBB-1111-2222-3333-444455556666")).toBe(true);
  });
});

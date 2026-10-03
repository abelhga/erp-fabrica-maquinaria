import { describe, expect, it } from "vitest";
import { dinero, fecha, imagen, llave, numero, rfc, unidad } from "./util";
import { actualizaciones, baseEquipos, componentes, equipos, etapaDeManoObra, inventario, tipoComponente, ventasPanel } from "./transformar";

// Filas tal como las entrega la API de Sheets (copiadas de las hojas reales).
describe("limpieza de valores", () => {
  it("lee dinero en los formatos que usan los vendedores", () => {
    expect(dinero("$1,050.00")).toBe(1050);
    expect(dinero(" $ 226,000.00 ")).toBe(226000);   // panel de Susy
    expect(dinero("#N/A")).toBeNull();
    expect(dinero("")).toBeNull();
  });
  it("lee fechas mexicanas de 2 y 4 dígitos y descarta las imposibles", () => {
    expect(fecha("03/03/26")).toBe("2026-03-03");
    expect(fecha("24/4/2024 13:00:00", { conHora: true })).toBe("2024-04-24T13:00:00-06:00");
    expect(fecha("31/02/25")).toBeNull();
    expect(fecha("15/01/2035")).toBeNull();          // la hoja de órdenes trae años imposibles
  });
  it("normaliza unidades sucias", () => {
    expect(unidad("Pieza ")).toBe("pieza");
    expect(unidad("mts")).toBe("metro");
    expect(unidad("horas")).toBe("hora");
  });
  it("compara nombres sin acentos ni espacios dobles", () => {
    expect(llave("  Catarina  80-14 ")).toBe(llave("catarina 80-14"));
    expect(llave("Pailería")).toBe("paileria");
  });
  it("convierte links de Drive a imagen directa", () => {
    expect(imagen("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view")).toBe(
      "https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456=w1000");
  });
  it("valida RFC", () => {
    expect(rfc("SEM980701STA")).toBe("SEM980701STA");
    expect(rfc("no tiene")).toBeNull();
  });
  it("lee números con texto pegado", () => expect(numero("12 pzas")).toBe(12));
});

describe("ListaComponentes", () => {
  const filas = [
    ["⚠ no mover"],
    ["Componente", "Unidad de medida", "Nuevo\n Cantidad mínima de unidades por paquete o metros/cm por pieza", "Número de Ítem", "Último costo por unidad registrado", "Precio de venta sugerido (antes de iva)", "Fecha de actualización más reciente ", "Proveedor del último precio registrado", "Tiempo Estimado de Entrega del último precio (días hábiles)\n(No modificar aquí)", "DESCRIPCIÓN \n(Cuidar ortografía y redacción)"],
    ["Festo Sensor Magnetico Smt-8m-a-ps-24v-e-0,3-m8d", "pieza", "1", "0", "$735.00", "$1,050.00", "03/03/26", "", "7"],
    ["Cadena de paso 80 (vienen 3 metros)", "cm", "300", "5", "$2.00", "$2.86", "19/06/25", "Carlos Fernando Barrios Vargas", "7"],
    ["Horas hombre pailería", "horas", "1", "900", "$87.67", "$125.24", "01/01/26", "", "1"],
    ["Cadena de paso 80 (vienen 3 metros) ", "cm", "300", "6", "$2.10", "$3.00", "19/06/25", "", "7"],
  ];
  const { componentes: cs, duplicados } = componentes(filas);
  it("lee costo, precio de la hoja, empaque y fecha", () => {
    expect(cs[0]).toMatchObject({ nombre: "Festo Sensor Magnetico Smt-8m-a-ps-24v-e-0,3-m8d", costo: 735, precio_hoja: 1050, fecha_costo: "2026-03-03", dias_entrega: 7 });
    expect(cs[1]).toMatchObject({ unidad: "cm", empaque: 300, proveedor: "Carlos Fernando Barrios Vargas" });
  });
  it("marca la mano de obra y detecta nombres repetidos (la hoja liga por nombre)", () => {
    expect(cs[2].es_mano_obra).toBe(true);
    expect(etapaDeManoObra("Horas hombre Pintor")).toBe("Pintura");
    // "Extras" ($8) no es pailería: si se mezclaba, pisaba la tarifa de $87.67.
    expect(etapaDeManoObra("Horas hombre Extras")).toBeNull();
    expect(duplicados).toEqual(["Cadena de paso 80 (vienen 3 metros)"]);
  });
  it("clasifica acero como materia prima", () => {
    expect(tipoComponente("PTR 3X3 Blanco Inoxidable Cal.11", "pieza")).toBe("materia_prima");
    expect(tipoComponente("Lamina calibre 14 4X10", "pieza")).toBe("materia_prima");
    expect(tipoComponente("Chumacera 1 1/2 de 2B. piso UCP 208-24", "pieza")).toBe("componente");
    expect(tipoComponente("Vulcanizado de banda", "servicio")).toBe("servicio");
  });
});

describe("ACTUALIZACIONES", () => {
  it("toma el encabezado de la fila 6 y descarta filas sin fecha o costo", () => {
    const filas = [["banner"], [], [], [], [],
      ["FECHA DEL PRECIO", "Componente", "Unidad de medida", "COSTO sin iva", "Proveedor de la referencia", "Tiempo Estimado de Entrega (días hábiles)", "Nota"],
      ["23/02/11", "Tornillo 3/8 x 3\"", "pieza", "$2.62", "Torninox-Benport", "", "2.62"],
      ["", "Sin fecha", "pieza", "$1.00", "", "", ""]];
    const r = actualizaciones(filas);
    expect(r.precios).toHaveLength(1);
    expect(r.precios[0]).toMatchObject({ fecha: "2011-02-23", costo: 2.62, proveedor: "Torninox-Benport" });
    expect(r.descartadas).toBe(1);
  });
});

describe("Nuevo Costeo", () => {
  it("lee EQUIPOS con tipo, medida especial y precio de lista para validar", () => {
    const filas = [["", "Este será el nombre mostrado en el cotizador."],
      ["ID", "Título del Equipo", "Inoxidable", "GASOLINA", "Tipo", "¿Medida especial?", "Descripcion", "Imagen (Link de drive o con terminación .jpg, png, o jpeg)", "Imagen del link", "Costo", "Cargo por medida especial", "Mermas", "Luz", "Administrativos y servicios", "Gastos Fin", "MKT", "Rec", "Comisiones", "Rec Garantía", "Gastos", "Costo Total", "Precio Bruto", "Precio de lista bruto (sin iva)"],
      ["E-000", "BASE (NO BORRAR)", "", "", "OTRO", "No"],
      ["E-409", "Tolva de 2.5 metros", "", "", "Tolva", "Sí", "• Pesaje", "", "", "$73,049.83", "", "", "", "", "", "", "", "", "", "", "", "", "$187,000.00"]];
    expect(equipos(filas)).toEqual([expect.objectContaining({ clave: "E-409", tipo: "Tolva", medida_especial: true, costo_hoja: 73049.83, precio_hoja: 187000 })]);
  });
  it("lee BASE EQUIPOS y deja visibles las líneas sin cantidad", () => {
    const filas = [["Filtrar materiales"], [], ["ID", "Nombre del equipo", "Material", "Cantidad", "Unidad", "Costo Unit", "Costo", "¿Repetido?"],
      ["E-000", "BASE (NO BORRAR)", "0", "", "#N/A", "#N/A", "", "FALSE"],
      ["E-442", "Banda", "12.35 MTS BANDA NERVADA EN 18\" ANCHO SIN FIN", "1.30", "tramo", "$11,500.00", "$14,950.00", "FALSE"],
      ["E-225", "Equipo", "Colector de polvos", "", "pieza", "$17,787.00", "", "FALSE"]];
    const r = baseEquipos(filas);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ equipo: "E-442", cantidad: 1.3, unidad: "tramo", costo_hoja: 11500 });
    expect(r[1].cantidad).toBeNull();
  });
});

describe("Inventario", () => {
  it("suma por almacén y separa lo RESERVADO", () => {
    const enc = ["", "Nombre del artículo", "Unidad", "Concepto", "STOCK ACTUAL TOTAL DISP", "Inventario Inicial 12/2025", "1 - PA", "Inventario Inicial 12/2025", "2 - PB", "Inventario Inicial 12/2025", "3 - M", "Inventario inicial: 31/12/23", "4 - C1", "Inventario Inicial 1/08/2024", "5- C2", "", " R", "", "6 - ML", "", "7 - R", "STATUS", "Notas 1", "Notas 2", "Inventario de seguridad manual", "⚠️", "¿ML?"];
    const filas = [[], [], [], [], [], [], enc,
      ["", "Solera 1\" x 6\"", "metro", "Acero", "24.00", "", "0.00", "", "0.00", "1", "24.00", "", "0.00", "", "0.00", "", "0.00", "", "2.00", "", "3.00", "OK", "", "", "10", "", "TRUE"]];
    const [e] = inventario(filas);
    expect(e.por_almacen).toEqual({ Mallado: 24, "Almacén ML (Full)": 2, RESERVADO: 3 });
    expect(e).toMatchObject({ concepto: "Acero", seguridad: 10, en_ml: true });
  });
});

describe("paneles de ventas", () => {
  it("lee montos con espacios y clasifica la línea como en la fórmula de comisiones", () => {
    const filas = [["Fecha", "Cliente", "Concepto ", "Tipo", "Monto Bruto", "Fuente de la Venta", "Cotización (si aplica)", "Factura (si aplica)", "N. Pedido (si aplica)", "Nota 1", "Nota 2"],
      ["01/09/2026", "Concretos X", "Banda 18\"", "Maquinaria", " $ 226,000.00 ", "Visita de ruta", "", "A 1234", "P790", "", ""],
      ["02/09/2026", "Concretos X", "Cangilones", "Refacciones y/o Herramientas", "$12,900.00", "", "", "", "", "", ""]];
    const { ventas } = ventasPanel(filas);
    expect(ventas.map((v) => [v.linea, v.monto])).toEqual([["maquinaria", 226000], ["refacciones", 12900]]);
  });
});

describe("BASE DE DATOS ACTUAL", async () => {
  const { directorioClientes, libroVentas } = await import("./transformar");
  it("lee el directorio con RFC, agente y dos contactos", () => {
    const filas = [[], [], ["", "Cliente / Empresa", "TELÉFONO", "TELÉFONO 2", "CONTACTO 1", "CORREO ELECTRÓNICO CONTACTO 1", "CELULAR CONTACTO 1", "CONTACTO 2", "CORREO ELECTRÓNICO CONTACTO 2", "CELULAR CONTACTO 2", "DOMICILIO", "Municipio ", "CP", "ESTADO", "PAÍS", "RFC", "NUMERO DE CUENTA", "NOTAS", "Adeudo fin 2021", "BALANCE", "Ventas Históricas", "Agente de Ventas"],
      ["", "Concretos Prueba SA de CV", "", "", "Ing. Ruiz", "ruiz@concretos.mx", "33 1234 5678", "", "", "", "Calle 6", "Guadalajara ", "44940", "Jalisco", "México", "CPR141006570", "", "", "$0.00", "$0.00", "$60,000.00", "J. Manuel"]];
    const [c] = directorioClientes(filas);
    expect(c).toMatchObject({ nombre: "Concretos Prueba SA de CV", rfc: "CPR141006570", ciudad: "Guadalajara", agente: "J. Manuel" });
    expect(c.contactos).toEqual([{ nombre: "Ing. Ruiz", correo: "ruiz@concretos.mx", telefono: "3312345678" }]);
  });
  it("lee el libro de ventas y cobros (montos con y sin $)", () => {
    const filas = [...Array(11).fill([]), ["", "Fecha", "Cliente ", "Tipo", "MONTO NETO", "CUENTA RECEPTORA DE PAGO", "Descripción", "N. Factura", "N. Pedido"],
      ["", "03/01/22", "Grupo X", "Venta", "5,646.88", "", "5.50 g.t. 18\"", "A 1731", "-"],
      ["", "03/01/22", "Grupo X", "Pago", "$5,646.88", "SANTANDER FISCAL", "transferencia", "A 1731", "-"]];
    const { movimientos } = libroVentas(filas);
    expect(movimientos.map((m) => [m.tipo, m.monto, m.factura, m.pedido])).toEqual([["Venta", 5646.88, "A 1731", null], ["Pago", 5646.88, "A 1731", null]]);
  });
});

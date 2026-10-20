import { describe, expect, it } from "vitest";
import { pesosConLetra } from "./letra";

describe("importes con letra", () => {
  it("como se escriben en un pagaré", () => {
    expect(pesosConLetra(1)).toBe("UN PESO 00/100 M.N.");
    expect(pesosConLetra(21)).toBe("VEINTIÚN PESOS 00/100 M.N.");
    expect(pesosConLetra(100)).toBe("CIEN PESOS 00/100 M.N.");
    expect(pesosConLetra(101)).toBe("CIENTO UN PESOS 00/100 M.N.");
    expect(pesosConLetra(1500.5)).toBe("MIL QUINIENTOS PESOS 50/100 M.N.");
    expect(pesosConLetra(2345.67)).toBe("DOS MIL TRESCIENTOS CUARENTA Y CINCO PESOS 67/100 M.N.");
    expect(pesosConLetra(31000)).toBe("TREINTA Y UN MIL PESOS 00/100 M.N.");
    expect(pesosConLetra(100000)).toBe("CIEN MIL PESOS 00/100 M.N.");
    expect(pesosConLetra(1000000)).toBe("UN MILLÓN DE PESOS 00/100 M.N.");
    expect(pesosConLetra(2750300.1)).toBe("DOS MILLONES SETECIENTOS CINCUENTA MIL TRESCIENTOS PESOS 10/100 M.N.");
  });
});

// El buscador del manual del asistente (los textos del modo tutorial): que encuentre lo que la
// gente pregunta y que no le explique a nadie lo de una pantalla que no puede abrir.
import { describe, expect, it } from "vitest";
import { buscarEnManual, palabras } from "./manual.ts";

describe("buscar en el manual", () => {
  it("las palabras de una pregunta, sin relleno y en singular", () => {
    expect(palabras("¿Cómo agrego cuando hacen horas extras en una cuadrilla?")).toEqual(["hora", "extra", "cuadrilla"]);
  });

  // La pregunta que el asistente contestó adivinando «Incidencias»: el tiempo extra del taller va en
  // el horario (Cuadrillas) y el pago, en Incidencias → Prenómina.
  it("horas extra de una cuadrilla: el horario del taller y el pago", () => {
    const r = buscarEnManual("como agrego cuando hacen horas extras en una cuadrilla", { produccion: 3, rrhh: 3, nomina: 3 });
    expect(r.pantallas.map((p) => p.ruta)).toContain("/produccion/cuadrillas");
    expect(r.conceptos.map((c) => c.concepto)).toContain("diaEspecialTaller");
    expect(r.conceptos.map((c) => c.concepto)).toContain("horasDoblesTriples");
  });

  it("a quien no ve el costeo no le explica la fórmula del precio", () => {
    const ventas = buscarEnManual("como se calcula el precio de un equipo formula", { ventas: 2, catalogo: 1 });
    expect(ventas.conceptos.map((c) => c.concepto)).not.toContain("formulaPrecio");
    expect(ventas.pantallas.some((p) => p.ruta.startsWith("/costeo"))).toBe(false);
    const direccion = buscarEnManual("como se calcula el precio de un equipo formula", { ventas: 3, costeo: 3, margenes: 3 });
    expect(direccion.conceptos.map((c) => c.concepto)).toContain("formulaPrecio");
  });

  it("sin palabras clave no busca, y lo de todos sale aunque no tenga permisos", () => {
    expect(buscarEnManual("¿cómo?", {}).pantallas).toEqual([]);
    expect(buscarEnManual("pendientes vencidos pedir algo a alguien", {}).pantallas.map((p) => p.ruta)).toContain("/pendientes");
  });
});

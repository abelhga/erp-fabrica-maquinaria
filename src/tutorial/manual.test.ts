import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { archivoManual } from "./manual";

describe("manual del asistente", () => {
  it("está al día con el tutorial (si falla: npm run manual)", () => {
    const actual = readFileSync(new URL("../../supabase/functions/asistente/manual-datos.ts", import.meta.url), "utf8");
    expect(actual === archivoManual(), "el tutorial cambió y el manual del asistente no: corre `npm run manual`").toBe(true);
  });

});

import { CheckCircle2, CircleDashed, CircleDot, MinusCircle } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/utilidades";
import { fechaYHora } from "@/lib/formato";
import type { PasoValidacion } from "./datos";
import { GLOSARIO } from "@/tutorial/glosario";

// El globo va en el paso completo y no en su botón: el botón se deshabilita justo cuando más
// hace falta saber por qué (liberar sin la revisión de ingeniería), y deshabilitado no recibe el mouse.
const EXPLICA: Record<PasoValidacion["paso"], string> = {
  ingenieria: GLOSARIO.revisionIngenieria, apartado: GLOSARIO.pasoApartarMaterial, faltantes: GLOSARIO.pasoPedirFaltantes,
  almacen: GLOSARIO.revisionAlmacen, liberada: GLOSARIO.pasoLiberarOrden,
};

const ESTILO: Record<PasoValidacion["estado"], { icono: typeof CheckCircle2; clase: string; texto: string }> = {
  hecho: { icono: CheckCircle2, clase: "text-ok", texto: "Hecho" },
  parcial: { icono: CircleDot, clase: "text-aviso", texto: "Con faltantes" },
  pendiente: { icono: CircleDashed, clase: "text-tenue", texto: "Pendiente" },
  no_aplica: { icono: MinusCircle, clase: "text-tenue", texto: "No hizo falta" },
};

export interface AccionPaso {
  texto: string; alClic: () => void; cargando?: boolean; deshabilitado?: string | false; secundaria?: boolean;
  /** Una segunda acción del mismo paso, más discreta (soltar lo apartado), con su explicación. */
  extra?: { texto: string; alClic: () => void; explica?: string };
}

/**
 * Los pasos de la hoja de validación (técnico → almacén → compras → salida),
 * ahora con nombre y hora de quien los hizo. Cada rol ve el botón de su paso.
 */
export function PasosValidacion({ pasos, acciones, firmar }: {
  pasos: PasoValidacion[]; acciones: Partial<Record<PasoValidacion["paso"], AccionPaso | null>>;
  /** Firmar una especialidad de la revisión de ingeniería (cuando hay más de una). */
  firmar?: { alFirmar: (clave: string) => void; cargando: boolean };
}) {
  return (
    <ol className="grid gap-px rounded-xl overflow-hidden border border-borde bg-borde sm:grid-cols-2 lg:grid-cols-5">
      {pasos.map((p, i) => {
        const e = ESTILO[p.estado];
        const a = acciones[p.paso];
        return (
          <li key={p.paso} className="bg-superficie p-4 flex flex-col gap-2 min-w-0" data-explain={EXPLICA[p.paso]} data-explain-title={p.titulo}>
            <div className="flex items-center gap-2">
              <span className={cn("h-6 w-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0",
                p.estado === "hecho" ? "bg-ok text-white" : p.estado === "parcial" ? "bg-aviso text-white" : "bg-fondo text-tenue border border-borde")}>
                {i + 1}
              </span>
              <p className="font-medium text-sm leading-tight">{p.titulo}</p>
            </div>
            <p className={cn("flex items-center gap-1.5 text-sm", e.clase)}><e.icono className="h-4 w-4" />{p.paso === "ingenieria" && p.estado === "parcial" ? "Falta una firma" : e.texto}</p>
            <div className="text-xs text-tenue space-y-0.5 flex-1">
              {p.por && <p className="text-texto">{p.por}</p>}
              {p.en && <p className="cifra">{fechaYHora(p.en)}</p>}
              {p.detalle && <p>{p.detalle}</p>}
            </div>
            {(p.firmas?.length ?? 0) > 1 && (
              <ul className="space-y-1.5 text-xs" data-explain={GLOSARIO.firmasIngenieria} data-explain-title="Firmas de ingeniería">
                {p.firmas!.map((f) => (
                  <li key={f.clave} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className={cn("font-medium", f.por ? "text-ok" : "text-texto")}>{f.nombre}</span>{" "}
                      <span className="text-tenue">{f.por ? `· ${f.por}${f.en_lugar_de ? " (en lugar de)" : ""}` : `· ${f.responsables ?? "ingeniería"}`}</span>
                    </span>
                    {!f.por && f.puedo && firmar && (
                      <Boton tamano="sm" variante={f.mia ? "primario" : "fantasma"} cargando={firmar.cargando} onClick={() => firmar.alFirmar(f.clave)}>
                        {f.mia ? "Firmar" : "Firmar en su lugar"}
                      </Boton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {a && (
              <div className="flex flex-wrap gap-1.5">
                <Boton tamano="sm" variante={a.secundaria ? "secundario" : "primario"} onClick={a.alClic} cargando={a.cargando}
                       disabled={!!a.deshabilitado} title={a.deshabilitado || undefined}>
                  {a.texto}
                </Boton>
                {a.extra && (
                  <Boton tamano="sm" variante="fantasma" className="text-peligro" onClick={a.extra.alClic}
                         data-explain={a.extra.explica} data-explain-title={a.extra.explica ? a.extra.texto : undefined}>
                    {a.extra.texto}
                  </Boton>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

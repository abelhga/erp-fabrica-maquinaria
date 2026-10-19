import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Cargando } from "@/components/ui/estados";
import { BuscadorArticulo } from "@/components/datos/BuscadorArticulo";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { cant, enTrozos, NOMBRE_TIPO, type TipoArticulo } from "./comun";
import { GLOSARIO } from "@/tutorial/glosario";

interface Pieza { id: string; clave: string; nombre: string; unidad?: string | null }
interface Uso { linea: string; padre_id: string; cantidad: number; parametro: string | null; clave: string; nombre: string; tipo: TipoArticulo; activo: boolean }

/**
 * Cambiar una pieza por otra en varias listas de materiales a la vez, con las mismas
 * cantidades. La pieza vieja no se toca: sigue en el catálogo con su precio y se puede
 * seguir vendiendo como refacción. Es de ingeniería (costeo 3): un error mueve el costo y
 * el precio de muchos equipos, por eso se eligen las listas una por una y se confirma.
 */
export function BotonReemplazarComponente({ viejo, variante = "secundario" }: { viejo?: Pieza; variante?: "secundario" | "fantasma" }) {
  const { puede } = useSesion();
  const [abierto, setAbierto] = useState(false);
  if (!puede("costeo", 3)) return null;
  return (
    <>
      <Boton variante={variante} onClick={() => setAbierto(true)} data-explain={GLOSARIO.reemplazarComponente} data-explain-title="Reemplazar componente">
        <ArrowLeftRight className="h-4 w-4" /> Reemplazar componente</Boton>
      {abierto && <DialogoReemplazar viejoInicial={viejo ?? null} alCerrar={() => setAbierto(false)} />}
    </>
  );
}

function DialogoReemplazar({ viejoInicial, alCerrar }: { viejoInicial: Pieza | null; alCerrar: () => void }) {
  const [viejo, setViejo] = useState<Pieza | null>(viejoInicial);
  const [nuevo, setNuevo] = useState<Pieza | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);

  const usos = useQuery({
    queryKey: ["costeo", "usos_directos", viejo?.id], enabled: !!viejo,
    queryFn: async () => {
      const lineas = await q<{ id: string; padre_id: string; cantidad: number; parametro: string | null }[]>(
        supabase.from("v_bom").select("id, padre_id, cantidad, parametro").eq("hijo_id", viejo!.id));
      const padres = await enTrozos<{ id: string; clave: string; nombre: string; tipo: TipoArticulo; activo: boolean }>(
        [...new Set(lineas.map((l) => l.padre_id))], (t) => supabase.from("articulos").select("id, clave, nombre, tipo, activo").in("id", t) as never);
      const m = new Map(padres.map((p) => [p.id, p]));
      return lineas.map((l) => ({ linea: l.id, padre_id: l.padre_id, cantidad: Number(l.cantidad), parametro: l.parametro, ...m.get(l.padre_id)! } as Uso))
        .filter((u) => u.clave).sort((a, b) => Number(b.activo) - Number(a.activo) || a.clave.localeCompare(b.clave, "es", { numeric: true }));
    },
  });
  // Nada viene marcado: cada lista se elige a propósito (o con "Marcar todas las activas").
  useEffect(() => { setElegidos(new Set()); setConfirmar(false); }, [usos.data]);
  const padres = useMemo(() => [...elegidos], [elegidos]);
  const conSub = (usos.data ?? []).some((u) => u.tipo === "subensamble" && elegidos.has(u.padre_id));

  const aplicar = useAccion(() => q<number>(supabase.rpc("reemplazar_componente", { p_viejo: viejo!.id, p_nuevo: nuevo!.id, p_padres: padres })), {
    exito: (n) => `${viejo!.clave} → ${nuevo!.clave} en ${n} ${n === 1 ? "lista" : "listas"}. ${viejo!.clave} sigue en el catálogo.`,
    invalidar: [["costeo"]], alTerminar: alCerrar,
  });
  const alternar = (id: string) => setElegidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Dialogo abierto alCambiar={(v) => !v && !aplicar.isPending && alCerrar()} ancho="max-w-2xl" titulo="Reemplazar componente en varias listas"
      descripcion="Cambia una pieza por otra con las mismas cantidades. La pieza actual no se borra ni pierde su precio: se puede seguir vendiendo como refacción."
      pie={<><Boton variante="secundario" onClick={alCerrar} disabled={aplicar.isPending}>Cancelar</Boton>
        {!confirmar
          ? <Boton onClick={() => setConfirmar(true)} disabled={!viejo || !nuevo || padres.length === 0}>Revisar cambio</Boton>
          : <Boton variante="peligro" onClick={() => aplicar.mutate(undefined)} cargando={aplicar.isPending}>Sí, reemplazar en {padres.length} {padres.length === 1 ? "lista" : "listas"}</Boton>}</>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-start">
          <Elegir etiqueta="Pieza actual" valor={viejo} alQuitar={viejoInicial ? undefined : () => { setViejo(null); setNuevo(null); }}
            alElegir={(a) => setViejo(a)} />
          <ArrowRight className="hidden sm:block h-5 w-5 mt-8 text-tenue" />
          <Elegir etiqueta="Pieza nueva" valor={nuevo} alQuitar={() => { setNuevo(null); setConfirmar(false); }} deshabilitado={!viejo}
            alElegir={(a) => { if (a.id !== viejo?.id) setNuevo(a); }} />
        </div>

        {viejo && (usos.isLoading ? <Cargando filas={3} /> : (usos.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg bg-fondo px-3 py-2 text-sm text-tenue">{viejo.clave} no va directo en ninguna lista de materiales.</p>
        ) : (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Listas donde va directo <span className="font-normal text-tenue">· marca en cuáles cambiarla</span></p>
              <span className="flex gap-1">
                <Boton tamano="sm" variante="fantasma" onClick={() => { setElegidos(new Set(usos.data!.filter((u) => u.activo).map((u) => u.padre_id))); setConfirmar(false); }}>
                  Marcar todas las activas</Boton>
                {elegidos.size > 0 && <Boton tamano="sm" variante="fantasma" onClick={() => { setElegidos(new Set()); setConfirmar(false); }}>Ninguna</Boton>}
              </span>
            </div>
            <ul className="max-h-72 overflow-auto divide-y divide-borde rounded-xl border border-borde">
              {usos.data!.map((u) => (
                <li key={u.linea}>
                  <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-fondo">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--marca))]" checked={elegidos.has(u.padre_id)}
                      onChange={() => { alternar(u.padre_id); setConfirmar(false); }} />
                    <span className="cifra font-medium w-24 shrink-0">{u.clave}</span>
                    <span className="min-w-0 flex-1 truncate">{u.nombre}</span>
                    {u.tipo === "subensamble" && <Insignia tono="marca">{NOMBRE_TIPO[u.tipo]}</Insignia>}
                    {!u.activo && <Insignia>Inhabilitado</Insignia>}
                    <span className="cifra text-tenue whitespace-nowrap">{cant(u.cantidad)}{u.parametro ? ` + × ${u.parametro}` : ""} {viejo.unidad ?? ""}</span>
                  </label>
                </li>
              ))}
            </ul>
            {conSub && <p className="text-xs text-aviso">Elegiste subensambles: el cambio llega a todos los equipos que los usan.</p>}
          </section>
        ))}

        {confirmar && viejo && nuevo && (
          <p className="rounded-xl border border-aviso/30 bg-aviso-suave px-4 py-3 text-sm">
            En <b>{padres.length} {padres.length === 1 ? "lista" : "listas"}</b>, <b>{viejo.clave}</b> {viejo.nombre} pasa a <b>{nuevo.clave}</b> {nuevo.nombre} con la misma cantidad.
            El costo y el precio de esos equipos se vuelven a calcular. En cada línea queda la nota «antes {viejo.clave}».
          </p>
        )}
      </div>
    </Dialogo>
  );
}

function Elegir({ etiqueta, valor, alElegir, alQuitar, deshabilitado }: {
  etiqueta: string; valor: Pieza | null; alElegir: (a: Pieza) => void; alQuitar?: () => void; deshabilitado?: boolean;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-sm font-medium">{etiqueta}</p>
      {valor ? (
        <div className="flex items-center gap-2 rounded-lg border border-borde bg-fondo px-3 py-2 text-sm">
          <span className="cifra font-medium">{valor.clave}</span><span className="min-w-0 flex-1 truncate">{valor.nombre}</span>
          {alQuitar && <button type="button" onClick={alQuitar} className="text-tenue hover:text-texto" aria-label={`Cambiar ${etiqueta.toLowerCase()}`}><X className="h-4 w-4" /></button>}
        </div>
      ) : deshabilitado ? <p className="text-sm text-tenue py-2">Primero elige la pieza actual.</p> : (
        <BuscadorArticulo autoFocus mostrarPrecio={false} tipos={["componente", "materia_prima", "subensamble"]} placeholder="Clave o nombre…" alElegir={alElegir} />
      )}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox, UserCheck, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { GLOSARIO } from "@/tutorial/glosario";
import { LINEA, useFuentes, type Linea } from "../comun";
import { CLAVE_LEADS, useConfigLeads, useVendedoresLeads } from "./datos";

interface Coincidencia { cliente_id: string; nombre: string; ciudad: string | null; estado: string | null; vendedor: string | null; vigente: boolean; coincide: string }
const VACIO = { nombre: "", empresa: "", telefono: "", correo: "", ciudad: "", estado_mx: "", interes: "", linea: "maquinaria" as Linea, fuente_id: "", notas: "", vendedor_id: "" };

/** Lo que importa para buscar: el teléfono si ya tiene 7 dígitos; si no, la empresa o el nombre. */
function useCoincidencias(telefono: string, texto: string) {
  const [t, setT] = useState({ telefono: "", texto: "" });
  useEffect(() => {
    const id = setTimeout(() => setT({ telefono, texto }), 350);
    return () => clearTimeout(id);
  }, [telefono, texto]);
  const digitos = t.telefono.replace(/\D/g, "");
  return useQuery({
    queryKey: ["buscar_cliente_lead", digitos, t.texto.trim().toLowerCase()],
    enabled: digitos.length >= 7 || t.texto.trim().length >= 3,
    staleTime: 30_000,
    queryFn: async () => {
      const buscar = (x: string) => q<Coincidencia[]>(supabase.rpc("buscar_cliente_lead", { p_texto: x }));
      const [a, b] = await Promise.all([digitos.length >= 7 ? buscar(digitos) : [], t.texto.trim().length >= 3 ? buscar(t.texto) : []]);
      const vistos = new Set<string>();
      return [...a, ...b].filter((c) => !vistos.has(c.cliente_id) && vistos.add(c.cliente_id)).slice(0, 5);
    },
  });
}

/**
 * Registrar un lead mientras se habla por teléfono: quién, cómo contactarlo y qué busca.
 * Mientras escribes el teléfono o la empresa te dice si ya es cliente y de quién; si lo es,
 * le llega directo a su vendedor. Enter lo guarda.
 */
export function DialogoLead({ abierto, alCambiar }: { abierto: boolean; alCambiar: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(VACIO);
  const [cliente, setCliente] = useState<Coincidencia | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cfg = useConfigLeads();
  const fuentes = useFuentes();
  const modo = cfg.data?.modo ?? "bandeja";
  const vendedores = useVendedoresLeads(abierto && modo === "recepcion");
  const coincidencias = useCoincidencias(cliente ? "" : f.telefono, cliente ? "" : f.empresa || f.nombre);
  const directo = cliente?.vigente && cliente.vendedor;
  const escoger = modo === "recepcion" && !directo;

  useEffect(() => { if (abierto) { setF(VACIO); setCliente(null); } }, [abierto]);
  const cambia = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    if (guardando) return;
    if (f.nombre.trim().length < 2) { toast.error("¿Cómo se llama quien llamó?"); return; }
    if (f.interes.trim().length < 3) { toast.error("Escribe qué busca, con sus palabras."); return; }
    if (!f.telefono.trim() && !f.correo.trim() && !cliente) { toast.error("Anota un teléfono o un correo para que el vendedor lo busque."); return; }
    if (escoger && !f.vendedor_id) { toast.error("Escoge a qué vendedor se lo pasas."); return; }
    setGuardando(true);
    try {
      const datos = {
        nombre: f.nombre.trim(), empresa: f.empresa.trim() || null, telefono: f.telefono.trim() || null, correo: f.correo.trim() || null,
        ciudad: f.ciudad.trim() || null, estado_mx: f.estado_mx.trim() || null, interes: f.interes.trim(), linea: f.linea,
        fuente_id: f.fuente_id ? Number(f.fuente_id) : null, notas: f.notas.trim() || null, cliente_id: cliente?.cliente_id ?? null,
        vendedor_id: escoger ? f.vendedor_id : null,
      };
      const nuevo = await q<{ id: string }>(supabase.from("leads").insert(datos).select("id").single());
      // A quién le tocó lo decide la base (cliente con dueño, modo de reparto): se le pregunta.
      const l = await q<{ estado: string; vendedor: string | null }>(supabase.from("v_leads").select("estado, vendedor").eq("id", nuevo.id).single());
      toast.success(l.estado === "asignado" ? `Lead registrado: le llegó a ${l.vendedor}` :
        modo === "gerente" ? "Lead registrado: la gerencia de ventas lo asigna" : "Lead registrado: ya les avisamos a los vendedores");
      qc.invalidateQueries({ queryKey: [...CLAVE_LEADS] });
      qc.invalidateQueries({ queryKey: ["indicadores"] });
      alCambiar(false);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const destino = directo ? <>Es cliente de <b>{cliente!.vendedor}</b>: le llega directo.</>
    : modo === "bandeja" ? <>Les avisamos a los vendedores; el primero que lo tome se lo queda.</>
    : modo === "gerente" ? <>Le llega a la gerencia de ventas, que decide a quién se lo da.</> : null;

  return (
    <Dialogo abierto={abierto} alCambiar={alCambiar} ancho="max-w-2xl"
      titulo={<span className="inline-flex items-center gap-2"><Inbox className="h-5 w-5 text-marca" />Registrar lead</span>}
      descripcion="Quién llamó, cómo contactarlo y qué busca. Enter lo guarda."
      pie={<>
        <Boton variante="secundario" onClick={() => alCambiar(false)}>Cancelar</Boton>
        <Boton onClick={() => guardar()} cargando={guardando}>Registrar</Boton>
      </>}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre *"><Entrada autoFocus value={f.nombre} onChange={cambia("nombre")} placeholder="Ing. Luis Ortega" /></Campo>
          <Campo etiqueta="Empresa"><Entrada value={f.empresa} onChange={cambia("empresa")} placeholder="Agregados del Norte" /></Campo>
          <Campo etiqueta="Teléfono"><Entrada value={f.telefono} onChange={cambia("telefono")} inputMode="tel" placeholder="844 123 4567" /></Campo>
          <Campo etiqueta="Correo"><Entrada value={f.correo} onChange={cambia("correo")} type="email" /></Campo>
        </div>

        {cliente ? (
          <div className="flex items-start gap-2 rounded-lg border border-ok/30 bg-ok-suave px-3 py-2 text-sm">
            <UserCheck className="h-4 w-4 mt-0.5 text-ok shrink-0" />
            <span className="flex-1"><b>{cliente.nombre}</b>{cliente.ciudad && <span className="text-tenue"> · {cliente.ciudad}</span>}
              <span className="block text-xs text-tenue">{cliente.vigente && cliente.vendedor ? `Su vendedor: ${cliente.vendedor}` : "Sin vendedor vigente: sigue la regla de siempre."}</span></span>
            <button type="button" className="text-tenue hover:text-texto" onClick={() => setCliente(null)} aria-label="No es este cliente"><X className="h-4 w-4" /></button>
          </div>
        ) : (coincidencias.data?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-borde" data-explain={GLOSARIO.yaEsCliente} data-explain-title="¿Ya es cliente?">
            <p className="px-3 pt-2 text-xs font-medium text-tenue">¿Ya es cliente? Coincide con:</p>
            <ul className="divide-y divide-borde">
              {coincidencias.data!.map((c) => (
                <li key={c.cliente_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 min-w-0"><b>{c.nombre}</b>{c.ciudad && <span className="text-tenue"> · {c.ciudad}</span>}
                    <span className="block text-xs text-tenue">Por {c.coincide} · {c.vigente && c.vendedor ? `de ${c.vendedor}` : "sin vendedor vigente"}</span></span>
                  <Boton tamano="sm" variante="secundario" onClick={() => setCliente(c)}>Es este</Boton>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Campo etiqueta="¿Qué busca? *" ayuda="Con sus palabras: equipo, medida, para qué material, para cuándo.">
          <Entrada value={f.interes} onChange={cambia("interes")} placeholder="Banda de 10 m para arena, la quiere para noviembre" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo etiqueta="Ciudad"><Entrada value={f.ciudad} onChange={cambia("ciudad")} /></Campo>
          <Campo etiqueta="Estado"><Entrada value={f.estado_mx} onChange={cambia("estado_mx")} /></Campo>
          <Campo etiqueta="Línea">
            <Seleccion value={f.linea} onChange={cambia("linea")}>
              {(Object.keys(LINEA) as Linea[]).map((l) => <option key={l} value={l}>{LINEA[l]}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="¿Cómo llegó?">
            <Seleccion value={f.fuente_id} onChange={cambia("fuente_id")}>
              <option value="">Llamada a recepción</option>
              {(fuentes.data ?? []).filter((x) => x.nombre !== "Llamada a recepción").map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </Seleccion>
          </Campo>
        </div>
        <Campo etiqueta="Notas"><AreaTexto rows={2} value={f.notas} onChange={cambia("notas")} placeholder="Mejor hora para llamarle, quién lo recomendó…" /></Campo>

        {escoger ? (
          <Campo etiqueta="¿A quién se lo pasas? *">
            <Seleccion value={f.vendedor_id} onChange={cambia("vendedor_id")}>
              <option value="">Escoge un vendedor…</option>
              {(vendedores.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </Seleccion>
          </Campo>
        ) : destino && <p className="text-sm text-tenue" data-explain={GLOSARIO.modoLeads} data-explain-title="¿A quién le llega?">{destino}</p>}
        <button type="submit" hidden />
      </form>
    </Dialogo>
  );
}

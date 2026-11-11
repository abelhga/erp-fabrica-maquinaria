import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Inbox, PhoneIncoming, UserCheck, Users, X } from "lucide-react";
import { Dialogo } from "@/components/ui/dialogo";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { supabase } from "@/lib/supabase";
import { mensajeError, q } from "@/lib/consultas";
import { GLOSARIO } from "@/tutorial/glosario";
import { LINEA, useFuentes, type Linea } from "../comun";
import { CLAVE_LEADS, hace, useConfigLeads, useVendedoresLeads, type EstadoLead } from "./datos";

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

interface LlamadaReciente {
  cuando: string; nadie_contesto: boolean; lead_id: string | null; lead_nombre: string | null;
  vendedor: string | null; estado: EstadoLead | null; lo_ves: boolean;
}

/**
 * ¿Ese número ya llamó esta semana? Si la IA del teléfono ya dejó su lead, no se captura otra vez.
 * Con el teléfono completo (10 dígitos) y la misma espera que la búsqueda de clientes.
 */
function useLlamadaReciente(telefono: string) {
  const [t, setT] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setT(telefono), 350);
    return () => clearTimeout(id);
  }, [telefono]);
  const digitos = t.replace(/\D/g, "");
  return useQuery({
    queryKey: ["llamada_reciente_de", digitos.slice(-10)],
    enabled: digitos.length >= 10,
    staleTime: 30_000,
    queryFn: () => q<LlamadaReciente[]>(supabase.rpc("llamada_reciente_de", { p_tel: digitos })),
  });
}

interface LeadParecido {
  lead_id: string; lead_nombre: string; empresa: string | null; creado_en: string; vendedor: string | null;
  estado: EstadoLead; por_telefono: boolean; coincide: string; lo_ves: boolean;
}

/**
 * ¿Ya hay un lead abierto de esta persona o esta empresa? El aviso por teléfono no basta: Sandra
 * Patlán entró por la IA con un número y recepción la volvió a registrar con otro. La base compara
 * el nombre completo, la empresa (sin «S.A. de C.V.») y el teléfono.
 */
function useLeadParecido(nombre: string, empresa: string, telefono: string) {
  const [t, setT] = useState({ nombre: "", empresa: "", telefono: "" });
  useEffect(() => {
    const id = setTimeout(() => setT({ nombre, empresa, telefono }), 350);
    return () => clearTimeout(id);
  }, [nombre, empresa, telefono]);
  const listo = t.nombre.trim().includes(" ") || t.empresa.trim().length >= 4 || t.telefono.replace(/\D/g, "").length >= 10;
  return useQuery({
    queryKey: ["lead_parecido", t.nombre.trim().toLowerCase(), t.empresa.trim().toLowerCase(), t.telefono.replace(/\D/g, "").slice(-10)],
    enabled: listo,
    staleTime: 30_000,
    queryFn: () => q<LeadParecido[]>(supabase.rpc("lead_parecido", {
      p_nombre: t.nombre.trim() || null, p_empresa: t.empresa.trim() || null, p_tel: t.telefono.trim() || null,
    })),
  });
}

/** «Sandra Patlán · El Surco: entró por teléfono hace 10 min, es de Susana. Coincide el nombre.» */
function AvisoParecido({ leads, alAbrir }: { leads: LeadParecido[]; alAbrir: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm"
      data-explain={GLOSARIO.leadParecido} data-explain-title="Ya hay un lead parecido">
      <Users className="h-4 w-4 mt-0.5 text-aviso shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-medium">Ya hay {leads.length === 1 ? "un lead parecido" : `${leads.length} leads parecidos`}: revisa que no sea la misma persona</p>
        {leads.map((l) => (
          <div key={l.lead_id}>
            <b>{l.lead_nombre}</b>{l.empresa && <span className="text-tenue"> · {l.empresa}</span>}
            <span className="block text-xs text-tenue">
              {l.por_telefono ? "Entró por el teléfono" : "Se registró"} {hace(l.creado_en)}
              {l.vendedor ? <>, es de <b className="text-texto">{l.vendedor}</b></> : ", todavía sin vendedor"}
              {l.estado === "convertido" ? " y ya es oportunidad" : ""}. Coincide {l.coincide}.
            </span>
            {l.lo_ves && <Link to={`/ventas/leads?id=${l.lead_id}`} onClick={alAbrir} className="text-xs text-marca-texto hover:underline">Ver ese lead →</Link>}
          </div>
        ))}
        <p className="text-xs text-tenue">Si es la misma, no la registres otra vez: avísale a su vendedor.</p>
      </div>
    </div>
  );
}

/** «Este número llamó hace 2 h; la IA ya registró su lead (de Isaac)», con la liga si lo puedes abrir. */
function AvisoLlamada({ ll, alAbrir }: { ll: LlamadaReciente; alAbrir: () => void }) {
  const como = ll.estado === "convertido" ? " y ya es oportunidad" : ll.estado === "descartado" ? " y se descartó" : "";
  return (
    <div className="flex items-start gap-2 rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm"
      data-explain={GLOSARIO.yaEntroPorTelefono} data-explain-title="Ya entró por teléfono">
      <PhoneIncoming className="h-4 w-4 mt-0.5 text-aviso shrink-0" />
      <span className="flex-1 min-w-0">
        Este número llamó {hace(ll.cuando)}
        {ll.lead_id ? <>; la IA ya registró su lead{ll.vendedor ? <> (de <b>{ll.vendedor}</b>)</> : " (todavía sin vendedor)"}{como}.</>
          : ll.nadie_contesto ? "; nadie contestó y no dejó lead." : ", pero no dejó lead."}
        {ll.lead_id && (ll.lo_ves
          ? <Link to={`/ventas/leads?id=${ll.lead_id}`} onClick={alAbrir} className="block text-xs text-marca-texto hover:underline">Ver su lead →</Link>
          : <span className="block text-xs text-tenue">No lo registres otra vez: {ll.vendedor ? "ya le llegó a su vendedor" : "ya está en los leads por repartir"}.</span>)}
      </span>
    </div>
  );
}

/**
 * Registrar un lead mientras se habla por teléfono: quién, cómo contactarlo y qué busca.
 * Mientras escribes el teléfono o la empresa te dice si ya es cliente y de quién; si lo es,
 * le llega directo a su vendedor. Si el número ya llamó y la IA dejó su lead, o si ya hay un lead
 * abierto con el mismo nombre o empresa, lo avisa para no capturarlo dos veces. Enter lo guarda.
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
  const llamada = useLlamadaReciente(abierto ? f.telefono : "");
  const parecidos = useLeadParecido(abierto ? f.nombre : "", abierto ? f.empresa : "", abierto ? f.telefono : "");
  // Lo que ya avisa la llamada (mismo lead) no se repite aquí.
  const yaAvisado = llamada.data?.[0]?.lead_id;
  const otros = (parecidos.data ?? []).filter((l) => l.lead_id !== yaAvisado);
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

        {llamada.data?.[0] && <AvisoLlamada ll={llamada.data[0]} alAbrir={() => alCambiar(false)} />}
        {otros.length > 0 && <AvisoParecido leads={otros} alAbrir={() => alCambiar(false)} />}

        {cliente ? (
          <div className="flex items-start gap-2 rounded-lg border border-ok/30 bg-ok-suave px-3 py-2 text-sm" data-explain={GLOSARIO.yaEsCliente} data-explain-title="Ya es cliente">
            <UserCheck className="h-4 w-4 mt-0.5 text-ok shrink-0" />
            <span className="flex-1"><b>{cliente.nombre}</b>{cliente.ciudad && <span className="text-tenue"> · {cliente.ciudad}</span>}
              <span className="block text-xs text-tenue">{cliente.vigente && cliente.vendedor ? `Su vendedor: ${cliente.vendedor}` : "Sin vendedor vigente: sigue la regla de siempre."}</span></span>
            <button type="button" className="text-tenue hover:text-texto" onClick={() => setCliente(null)} aria-label="No es este cliente"
              data-explain={GLOSARIO.noEsEsteClienteLead} data-explain-title="No es este cliente"><X className="h-4 w-4" /></button>
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
            <Seleccion value={f.linea} onChange={cambia("linea")} data-explain={GLOSARIO.lineaLead} data-explain-title="Línea">
              {(Object.keys(LINEA) as Linea[]).map((l) => <option key={l} value={l}>{LINEA[l]}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="¿Cómo llegó?">
            <Seleccion value={f.fuente_id} onChange={cambia("fuente_id")} data-explain={GLOSARIO.fuenteCliente} data-explain-title="¿Cómo llegó?">
              <option value="">Llamada a recepción</option>
              {(fuentes.data ?? []).filter((x) => x.nombre !== "Llamada a recepción").map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </Seleccion>
          </Campo>
        </div>
        <Campo etiqueta="Notas"><AreaTexto rows={2} value={f.notas} onChange={cambia("notas")} placeholder="Mejor hora para llamarle, quién lo recomendó…" /></Campo>

        {escoger ? (
          <Campo etiqueta="¿A quién se lo pasas? *">
            <Seleccion value={f.vendedor_id} onChange={cambia("vendedor_id")} data-explain={GLOSARIO.modoLeads} data-explain-title="¿A quién se lo pasas?">
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

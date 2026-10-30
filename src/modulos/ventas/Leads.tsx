import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Hand, Inbox, Mail, MessageCircle, Phone, Plus, Settings2, Sparkles, UserPlus, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { SelectorCliente, type ClienteBreve } from "@/components/datos/SelectorCliente";
import { Boton } from "@/components/ui/boton";
import { Dialogo, Lateral } from "@/components/ui/dialogo";
import { AreaTexto, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha } from "@/lib/formato";
import { GLOSARIO } from "@/tutorial/glosario";
import { LINEA, enlaceWhatsApp } from "./comun";
import { DialogoMotivo } from "./componentes/dialogos";
import { DialogoLead } from "./leads/DialogoLead";
import { ConfigLeads } from "./leads/ConfigLeads";
import { CANAL_INTENTO, CLAVE_LEADS, MODOS, estadoLead, hace, useConfigLeads, useVendedoresLeads, type CanalIntento, type IntentoLead, type Lead, type ModoLeads } from "./leads/datos";

type Vista = "abiertos" | "por_tomar" | "mios" | "registre" | "cerrados" | "todos";
const COMO: Record<NonNullable<Lead["como_se_asigno"]>, string> = {
  cliente: "ya era su cliente", bandeja: "lo tomó de la bandeja", gerente: "se lo asignó la gerencia", recepcion: "se lo pasó quien lo registró",
};

/**
 * Leads: los recados de gente interesada que registra recepción (o cualquier vendedor),
 * hasta que un vendedor los vuelve oportunidad o los descarta. Recepción ve los suyos y en
 * qué quedaron; los vendedores, los que pueden tomar y los suyos; la gerencia, todos.
 */
export default function Leads() {
  const { puede, perfil } = useSesion();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [nuevo, setNuevo] = useState(false);
  const [config, setConfig] = useState(false);
  const cfg = useConfigLeads();
  const modo = cfg.data?.modo ?? "bandeja";
  const gerencia = puede("leads", 3);
  const vende = puede("ventas", 2);
  useTiempoReal("leads", [[...CLAVE_LEADS], ["indicadores"]]);

  // Con la RLS cada quien recibe solo lo que le toca: recepción lo suyo, ventas la bandeja y lo suyo.
  const leads = useQuery({ queryKey: [...CLAVE_LEADS],
    queryFn: () => q<Lead[]>(supabase.from("v_leads").select("*").order("creado_en", { ascending: false }).limit(1000)) });
  const todos = leads.data ?? [];
  const yo = perfil?.id;
  const pasa = (l: Lead, v: Vista) =>
    v === "abiertos" ? l.estado === "nuevo" || l.estado === "asignado"
    : v === "por_tomar" ? l.estado === "nuevo"
    : v === "mios" ? l.vendedor_id === yo && l.estado === "asignado"
    : v === "registre" ? l.capturado_por === yo
    : v === "cerrados" ? l.estado === "convertido" || l.estado === "descartado" : true;
  const cuenta = (v: Vista) => todos.filter((l) => pasa(l, v)).length;

  // Recepción abre en lo que registró; un vendedor, en lo que hay por tomar (o lo suyo); la gerencia, en lo abierto.
  const porOmision: Vista = gerencia ? "abiertos" : !vende ? "registre" : cuenta("por_tomar") > 0 ? "por_tomar" : "mios";
  const vista = (params.get("filtro") as Vista) || porOmision;
  const cambiar = (v: Vista) => { const p = new URLSearchParams(params); p.set("filtro", v); setParams(p, { replace: true }); };
  const abiertoId = params.get("id");
  const abrir = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("id", id); else p.delete("id"); setParams(p, { replace: true }); };
  const abierto = todos.find((l) => l.id === abiertoId) ?? null;

  const opciones: { valor: Vista; texto: string; cuenta?: number; explica?: string }[] = [
    ...(gerencia ? [{ valor: "abiertos" as Vista, texto: "Abiertos", cuenta: cuenta("abiertos") }] : []),
    ...(vende || gerencia ? [{ valor: "por_tomar" as Vista, texto: modo === "gerente" ? "Por asignar" : "Por tomar", cuenta: cuenta("por_tomar"), explica: GLOSARIO.modoLeads }] : []),
    ...(vende ? [{ valor: "mios" as Vista, texto: "Míos", cuenta: cuenta("mios") }] : []),
    { valor: "registre", texto: "Los que registré", cuenta: cuenta("registre") },
    { valor: "cerrados", texto: "Atendidos" },
    { valor: "todos", texto: "Todos" },
  ];

  const columnas: Columna<Lead>[] = [
    { clave: "creado_en", titulo: "Llegó", clase: "whitespace-nowrap text-tenue", valor: (l) => l.creado_en, celda: (l) => hace(l.creado_en) },
    { clave: "nombre", titulo: "Quién", clase: "min-w-[200px]", valor: (l) => `${l.nombre} ${l.empresa ?? ""} ${l.cliente_nombre ?? ""} ${l.telefono ?? ""}`,
      celda: (l) => <span><b className="font-medium">{l.nombre}</b>
        <span className="block text-xs text-tenue">{l.cliente_nombre ? <>Cliente: {l.cliente_nombre}</> : l.empresa ?? l.telefono ?? l.correo}</span></span> },
    { clave: "interes", titulo: "Qué busca", clase: "max-w-[340px]", celda: (l) => <span className="line-clamp-2">{l.interes}</span> },
    { clave: "estado", titulo: "En qué va", explica: GLOSARIO.estadoLead, valor: (l) => estadoLead(l, modo).texto,
      celda: (l) => { const e = estadoLead(l, modo); return <span title={l.motivo_descarte ?? undefined}><Insignia tono={e.tono}>{e.texto}</Insignia></span>; } },
    { clave: "intentos", titulo: "Intentos", explica: GLOSARIO.intentoLead, oculta: !gerencia && !vende, alinear: "der", valor: (l) => l.intentos,
      celda: (l) => l.estado !== "asignado" ? <span className="text-tenue">—</span> : l.contesto ? <Insignia tono="ok">Contestó</Insignia>
        : l.intentos ? <span className="whitespace-nowrap text-sm">{l.intentos} sin respuesta<span className="block text-[11px] text-tenue">{hace(l.ultimo_intento)}</span></span>
        : <span className="text-sm text-aviso">Ninguno</span> },
    { clave: "capturo", titulo: "Lo registró", clase: "whitespace-nowrap text-tenue", oculta: !gerencia && !vende },
  ];

  return (
    <Pagina titulo="Leads"
      descripcion={vende || gerencia ? "Gente interesada que llamó o escribió y todavía no es oportunidad. Tómalo, llámale y vuélvelo oportunidad, o descártalo con el motivo."
        : "Registra a quien llama interesado y aquí ves en qué quedó cada uno: quién lo tomó y si ya se volvió oportunidad."}
      acciones={<>
        {gerencia && <Boton variante="secundario" onClick={() => setConfig(true)}><Settings2 className="h-4 w-4" />A quién le llega</Boton>}
        {puede("leads", 2) && <Boton onClick={() => setNuevo(true)}><Plus className="h-4 w-4" />Registrar lead</Boton>}
      </>}>
      <TablaDatos filas={todos.filter((l) => pasa(l, vista))} columnas={columnas} cargando={leads.isLoading} error={leads.error}
        claveFila={(l) => l.id} alClicFila={(l) => abrir(l.id)} placeholder="Buscar nombre, empresa, teléfono o qué busca…" exportarComo="leads"
        claseFila={(l) => (l.id === abiertoId ? "bg-marca-suave" : undefined)}
        filtros={<>
          <Filtro<Vista> valor={vista} alCambiar={cambiar} opciones={opciones} />
          <span className="ml-auto text-xs text-tenue" data-explain={GLOSARIO.modoLeads} data-explain-title="¿A quién le llega?">
            {MODOS.find((m) => m.valor === modo)?.texto}</span>
        </>}
        vacio={{ icono: Inbox, titulo: vista === "por_tomar" ? "No hay leads por tomar" : vista === "mios" ? "No tienes leads pendientes" : "Nada con este filtro",
          texto: puede("leads", 2) ? "Cuando alguien llame interesado, regístralo con «Registrar lead»: quién, su teléfono y qué busca." : undefined,
          accion: puede("leads", 2) ? <Boton variante="secundario" onClick={() => setNuevo(true)}><Plus className="h-4 w-4" />Registrar lead</Boton> : undefined }} />

      <DetalleLead lead={abierto} modo={modo} alCerrar={() => abrir(null)} alConvertir={(cliente) => ir(`/ventas/clientes/${cliente}`)} />
      <DialogoLead abierto={nuevo} alCambiar={setNuevo} />
      <Dialogo abierto={config} alCambiar={setConfig} ancho="max-w-3xl" titulo="¿A quién le llegan los leads?">
        <ConfigLeads editable={gerencia} />
      </Dialogo>
    </Pagina>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div><dt className="text-xs text-tenue">{etiqueta}</dt><dd className="text-sm mt-0.5">{children}</dd></div>;
}

/** El lead abierto: cómo contactarlo, qué busca, por dónde ha pasado y lo que sigue. */
function DetalleLead({ lead: l, modo, alCerrar, alConvertir }: {
  lead: Lead | null; modo: ModoLeads; alCerrar: () => void; alConvertir: (cliente: string) => void;
}) {
  const { puede, perfil } = useSesion();
  const gerencia = puede("leads", 3);
  const [descartar, setDescartar] = useState(false);
  const [para, setPara] = useState("");
  const [cliente, setCliente] = useState<ClienteBreve | null>(null);
  const [canal, setCanal] = useState<CanalIntento>("whatsapp");
  const [dijo, setDijo] = useState("");
  const vendedores = useVendedoresLeads(!!l && gerencia);
  const intentos = useQuery({
    queryKey: [...CLAVE_LEADS, l?.id, "intentos"], enabled: !!l,
    queryFn: () => q<IntentoLead[]>(supabase.from("lead_intentos").select("id, canal, resultado, nota, en, usuario:perfiles(nombre)").eq("lead_id", l!.id).order("en", { ascending: false }).returns<IntentoLead[]>()),
  });
  // ¿Su teléfono ya es de un cliente? Se ofrece esa cuenta antes de dar de alta otra (la base no deja duplicar).
  const yaExiste = useQuery({
    queryKey: [...CLAVE_LEADS, l?.id, "ya-existe"], enabled: !!l && l.estado === "asignado" && !l.cliente_id && !!(l.telefono || l.correo), staleTime: 60_000,
    queryFn: async () => (await q<{ cliente_id: string; nombre: string; ciudad: string | null; vendedor: string | null; coincide: string }[]>(
      supabase.rpc("buscar_cliente_lead", { p_texto: l!.telefono ?? l!.correo }))).find((c) => c.coincide !== "nombre") ?? null,
  });
  const invalidar = [[...CLAVE_LEADS], ["indicadores"]];

  const tomar = useAccion((id: string) => q(supabase.rpc("tomar_lead", { p_lead: id })), { exito: "Es tuyo: llámale y vuélvelo oportunidad", invalidar });
  const asignar = useAccion((a: { id: string; vendedor: string }) => q(supabase.rpc("asignar_lead", { p_lead: a.id, p_vendedor: a.vendedor })),
    { exito: "Asignado: ya le avisamos", invalidar, alTerminar: () => setPara("") });
  const convertir = useAccion(async (a: { id: string; cliente: string | null }) => {
    await q(supabase.rpc("convertir_lead", { p_lead: a.id, p_cliente: a.cliente }));
    return q<{ cliente_id: string }>(supabase.from("leads").select("cliente_id").eq("id", a.id).single());
  }, { exito: "Listo: ya es oportunidad de su cliente", invalidar: [...invalidar, ["v_oportunidades"], ["v_clientes"]], alTerminar: (r) => alConvertir(r.cliente_id) });
  const intento = useAccion(async (a: { id: string; resultado: "contesto" | "no_contesto" }) => {
    await q(supabase.rpc("registrar_intento_lead", { p_lead: a.id, p_canal: canal, p_resultado: a.resultado, p_nota: a.resultado === "contesto" ? dijo : null }));
    return a.resultado;
  }, { exito: (r) => (r === "contesto" ? "Anotado: ya lo puedes volver oportunidad" : "Anotado: vuelve a intentarlo más tarde"), invalidar, alTerminar: () => setDijo("") });
  const descarte = useAccion((a: { id: string; motivo: string }) => q(supabase.rpc("descartar_lead", { p_lead: a.id, p_motivo: a.motivo })),
    { exito: "Lead descartado", invalidar, alTerminar: () => setDescartar(false) });

  if (!l) return <Lateral abierto={false} alCambiar={() => alCerrar()} titulo="">{null}</Lateral>;
  const abierto = l.estado === "nuevo" || l.estado === "asignado";
  const esMio = l.vendedor_id === perfil?.id;
  const puedeTomar = l.estado === "nuevo" && modo === "bandeja" && puede("ventas", 2);
  const puedeAtender = l.estado === "asignado" && puede("ventas", 2) && (esMio || gerencia);
  const puedeDescartar = abierto && (gerencia || esMio || (l.capturado_por === perfil?.id && l.estado === "nuevo"));
  const e = estadoLead(l, modo);

  return (
    <Lateral abierto alCambiar={(v) => !v && alCerrar()} ancho="max-w-xl"
      titulo={l.nombre} subtitulo={<span className="inline-flex flex-wrap items-center gap-2">{l.cliente_nombre ?? l.empresa ?? "Sin empresa"}
        <span data-explain={GLOSARIO.estadoLead} data-explain-title="En qué va"><Insignia tono={e.tono}>{e.texto}</Insignia></span></span>}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {l.telefono && <Boton asChild tamano="sm" variante="secundario"><a href={`tel:${l.telefono.replace(/[^\d+]/g, "")}`}><Phone className="h-3.5 w-3.5" />{l.telefono}</a></Boton>}
          {l.telefono && <Boton asChild tamano="sm" variante="secundario"><a href={enlaceWhatsApp(l.telefono, `Hola ${l.nombre.split(" ")[0]}, le escribo de Hegamex por lo que nos preguntó: ${l.interes}.`)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a></Boton>}
          {l.correo && <Boton asChild tamano="sm" variante="secundario"><a href={`mailto:${l.correo}`}><Mail className="h-3.5 w-3.5" />{l.correo}</a></Boton>}
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Dato etiqueta="Qué busca">{l.interes}</Dato></div>
          <Dato etiqueta="Dónde">{[l.ciudad, l.estado_mx].filter(Boolean).join(", ") || "—"}</Dato>
          <Dato etiqueta="Línea · cómo llegó">{LINEA[l.linea]} · {l.fuente ?? "—"}</Dato>
          {l.notas && <div className="sm:col-span-2"><Dato etiqueta="Notas"><span className="whitespace-pre-line">{l.notas}</span></Dato></div>}
          <Dato etiqueta="Lo registró">{l.capturo ?? "—"} · {fecha(l.creado_en)} ({hace(l.creado_en)})</Dato>
          {l.vendedor && <Dato etiqueta="Lo tiene">{l.vendedor}{l.como_se_asigno && <span className="text-tenue"> · {COMO[l.como_se_asigno]}</span>}
            {l.asignado_en && <span className="block text-xs text-tenue">{hace(l.asignado_en)}</span>}</Dato>}
          {l.estado === "descartado" && <div className="sm:col-span-2"><Dato etiqueta="Por qué se descartó">{l.motivo_descarte}</Dato></div>}
          {l.estado === "convertido" && l.cliente_id && puede("ventas") && (
            <div className="sm:col-span-2"><Link to={`/ventas/clientes/${l.cliente_id}`} className="text-sm text-marca-texto hover:underline">Ver cliente y su oportunidad →</Link></div>
          )}
        </dl>

        {puedeTomar && (
          <div className="rounded-lg border border-aviso/30 bg-aviso-suave p-3 flex items-center gap-3">
            <p className="flex-1 text-sm">Nadie lo ha tomado. El primero que lo toma se lo queda.</p>
            <Boton onClick={() => tomar.mutate(l.id)} cargando={tomar.isPending}><Hand className="h-4 w-4" />Tomarlo</Boton>
          </div>
        )}

        {gerencia && abierto && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-tenue">{l.vendedor ? "Pasárselo a otro vendedor" : "Asignarlo"}</p>
            <div className="flex gap-2">
              <Seleccion value={para} onChange={(ev) => setPara(ev.target.value)} aria-label="Vendedor">
                <option value="">Escoge…</option>
                {(vendedores.data ?? []).filter((v) => v.id !== l.vendedor_id).map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </Seleccion>
              <Boton variante="secundario" disabled={!para} cargando={asignar.isPending} onClick={() => asignar.mutate({ id: l.id, vendedor: para })}>
                <UserPlus className="h-4 w-4" />Asignar</Boton>
            </div>
          </div>
        )}

        {(puedeAtender || (intentos.data ?? []).length > 0) && (
          <div className="space-y-2" data-explain={GLOSARIO.intentoLead} data-explain-title="Intentos de contacto">
            <p className="text-sm font-medium">Intentos de contacto</p>
            {(intentos.data ?? []).length > 0 && (
              <ul className="space-y-1.5">
                {intentos.data!.map((x) => (
                  <li key={x.id} className="text-sm flex gap-2">
                    <Insignia tono={x.resultado === "contesto" ? "ok" : "neutro"} className="shrink-0 h-fit">{x.resultado === "contesto" ? "Contestó" : "No contestó"}</Insignia>
                    <span className="min-w-0"><span className="text-tenue">{CANAL_INTENTO[x.canal]} · {hace(x.en)}{x.usuario ? ` · ${x.usuario.nombre}` : ""}</span>
                      {x.nota && <span className="block">{x.nota}</span>}</span>
                  </li>
                ))}
              </ul>
            )}
            {puedeAtender && (
              <div className="rounded-lg border border-borde p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Seleccion value={canal} onChange={(ev) => setCanal(ev.target.value as CanalIntento)} aria-label="Por dónde" className="w-auto">
                    {Object.entries(CANAL_INTENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Seleccion>
                  <Boton variante="secundario" tamano="sm" cargando={intento.isPending && intento.variables?.resultado === "no_contesto"}
                    onClick={() => intento.mutate({ id: l.id, resultado: "no_contesto" })}>No contestó</Boton>
                </div>
                <AreaTexto rows={2} value={dijo} onChange={(ev) => setDijo(ev.target.value)} aria-label="Qué te dijo"
                  placeholder="Si contestó: qué te dijo (qué busca, para cuándo, si pidió cotización)" />
                <div className="flex justify-end">
                  <Boton tamano="sm" disabled={dijo.trim().length < 5} cargando={intento.isPending && intento.variables?.resultado === "contesto"}
                    onClick={() => intento.mutate({ id: l.id, resultado: "contesto" })}>Contestó</Boton>
                </div>
              </div>
            )}
          </div>
        )}

        {puedeAtender && (
          <div className="rounded-lg border border-borde p-3 space-y-2" data-explain={GLOSARIO.convertirLead} data-explain-title="Volverlo oportunidad">
            <p className="text-sm font-medium">Volverlo oportunidad</p>
            {!l.contesto ? <p className="text-xs text-tenue">Cuando te conteste (o te pida cotización), anótalo arriba con lo que te dijo y aquí se vuelve oportunidad. Mientras, sigue siendo lead.</p>
            : l.cliente_id ? <p className="text-xs text-tenue">Va a la cuenta de {l.cliente_nombre}, con su contacto.</p> : <>
              <p className="text-xs text-tenue">Si ya existe la empresa, elígela; si no, se da de alta como cliente nuevo con este contacto.</p>
              {yaExiste.data && cliente?.id !== yaExiste.data.cliente_id && (
                <div className="rounded-md bg-aviso-suave px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <span className="flex-1">Su {yaExiste.data.coincide} ya es de <b>{yaExiste.data.nombre}</b>{yaExiste.data.vendedor ? ` (de ${yaExiste.data.vendedor})` : ""}.</span>
                  <Boton tamano="sm" variante="secundario" onClick={() => setCliente({ id: yaExiste.data!.cliente_id, nombre: yaExiste.data!.nombre, razon_social: null,
                    ciudad: yaExiste.data!.ciudad, vendedor: yaExiste.data!.vendedor, vendedor_id: null })}>Usar ese cliente</Boton>
                </div>
              )}
              <SelectorCliente valor={cliente} alCambiar={setCliente} />
            </>}
            <div className="flex justify-end">
              <Boton variante="exito" disabled={!l.contesto} cargando={convertir.isPending} onClick={() => convertir.mutate({ id: l.id, cliente: l.cliente_id ? null : cliente?.id ?? null })}>
                <Sparkles className="h-4 w-4" />Crear oportunidad</Boton>
            </div>
          </div>
        )}

        {puedeDescartar && (
          <div className="flex justify-end">
            <Boton variante="fantasma" tamano="sm" onClick={() => setDescartar(true)}><X className="h-3.5 w-3.5" />Descartar</Boton>
          </div>
        )}
      </div>
      <DialogoMotivo abierto={descartar} alCambiar={setDescartar} titulo={`Descartar el lead de ${l.nombre}`}
        descripcion="Sale de los pendientes. Quien lo registró ve el motivo." etiqueta="¿Por qué?"
        sugerencias={["No contestó después de varios intentos", "Busca algo que no fabricamos ni vendemos", "Solo pedía informes, sin proyecto", "Duplicado", "Número equivocado"]}
        textoBoton="Descartar" cargando={descarte.isPending} alConfirmar={(motivo) => descarte.mutate({ id: l.id, motivo })} />
    </Lateral>
  );
}

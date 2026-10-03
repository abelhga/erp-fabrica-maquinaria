import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, Hand, PackageCheck, Plus, Undo2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { fecha, fechaYHora, hace, numero } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { CLAVE, isoLocal, useMaquinas, usePersonal, useServicioEnVivo, useServicios, type Resguardo } from "./datos";
import { usePermisosServicio } from "./componentes/piezas";

type Vista = "prestadas" | "vencidas" | "historial";

/**
 * Resguardo de herramienta: quién la tiene, desde cuándo y cómo la regresó.
 * "Las pinzas se las prestó a los ingenieros y no se las han regresado" (may-2024).
 */
export default function Resguardos() {
  useServicioEnVivo(["resguardos", "maquinas"]);
  const ir = useNavigate();
  const p = usePermisosServicio();
  const [params, setParams] = useSearchParams();
  const cfg = useQuery({
    queryKey: ["configuracion", "servicio"],
    staleTime: 30 * 60_000,
    queryFn: () => q<{ valor: { dias_herramienta?: number } } | null>(supabase.from("configuracion").select("valor").eq("clave", "servicio").maybeSingle()),
  });
  const [dias, setDias] = useState<string>("");
  const n = Number(dias || cfg.data?.valor.dias_herramienta || 7);
  const [vista, setVista] = useState<Vista>("prestadas");
  const [prestar, setPrestar] = useState<string | null>(params.get("prestar") ? params.get("prestar") : null);
  const [devolver, setDevolver] = useState<Resguardo | null>(null);
  const lista = useQuery({
    queryKey: [...CLAVE, "resguardos"],
    queryFn: () => q<Resguardo[]>(supabase.from("v_resguardos").select("*").order("entregado_en", { ascending: false }).limit(500)),
  });

  const hoy = isoLocal(new Date());
  const tarde = (r: Resguardo) => r.abierto && (r.dias > n || (!!r.devolver_en && r.devolver_en < hoy));
  const abiertos = (lista.data ?? []).filter((r) => r.abierto);
  const vencidos = abiertos.filter(tarde);
  const filas = vista === "prestadas" ? abiertos : vista === "vencidas" ? vencidos : (lista.data ?? []).filter((r) => !r.abierto);
  const cerrarPrestar = () => { setPrestar(null); if (params.get("prestar")) setParams((x) => { x.delete("prestar"); return x; }, { replace: true }); };

  const columnas: Columna<Resguardo>[] = [
    { clave: "herramienta", titulo: "Herramienta", valor: (r) => `${r.numero} ${r.herramienta}`, celda: (r) => (
      <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); ir(`/servicio/maquinas/${r.maquina_id}`); }}>
        <span className="block font-medium leading-tight hover:underline">{r.herramienta}</span><span className="text-xs text-tenue cifra">{r.numero}</span>
      </button>
    ) },
    { clave: "quien", titulo: "La tiene", celda: (r) => <span>{r.quien}{r.puesto && <span className="block text-xs text-tenue">{r.puesto}</span>}</span> },
    { clave: "entregado_en", titulo: "Desde", celda: (r) => <span className="whitespace-nowrap">{fecha(r.entregado_en)}<span className="block text-xs text-tenue">entregó {r.entregado_por_nombre ?? "—"}</span></span> },
    { clave: "dias", titulo: "Días", alinear: "der", celda: (r) => (
      <span className={cn("cifra font-semibold", tarde(r) && "text-peligro")}>{numero(r.dias)}</span>
    ) },
    { clave: "servicio_folio", titulo: "Para", celda: (r) => r.servicio_folio ?? <span className="text-tenue">{r.notas ?? "—"}</span> },
    { clave: "devolver_en", titulo: vista === "historial" ? "Regresó" : "Regresa", valor: (r) => r.devuelto_en ?? r.devolver_en, celda: (r) => r.devuelto_en ? (
      <span className="whitespace-nowrap">{fecha(r.devuelto_en)}
        {r.estado_devolucion !== "bien" && <Insignia tono="peligro" className="ml-1">{r.estado_devolucion === "con_dano" ? "Dañada" : "Incompleta"}</Insignia>}
        <span className="block text-xs text-tenue">recibió {r.recibido_por_nombre ?? "—"}</span></span>
    ) : r.devolver_en ? <span className={cn(r.devolver_en < hoy && "text-peligro")}>{fecha(r.devolver_en)}</span> : <span className="text-tenue">Sin fecha</span> },
    { clave: "accion", titulo: "", sinBusqueda: true, oculta: vista === "historial" || !p.personal, celda: (r) => r.abierto && (
      <Boton tamano="sm" variante="secundario" onClick={(e) => { e.stopPropagation(); setDevolver(r); }}><Undo2 className="h-3.5 w-3.5" />Recibir</Boton>
    ) },
  ];

  return (
    <Pagina
      titulo="Resguardo de herramienta"
      descripcion="Quién se llevó qué, desde cuándo, y cómo la regresó. Lo que pasa de los días marcados sale como pendiente."
      acciones={p.personal && <Boton onClick={() => setPrestar("")}><Plus className="h-4 w-4" />Prestar herramienta</Boton>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi titulo="Prestadas ahora" valor={numero(abiertos.length)} icono={Hand} tono="marca" alClic={() => setVista("prestadas")}
             detalle={abiertos.filter((r) => r.servicio_id).length ? `${abiertos.filter((r) => r.servicio_id).length} en servicios de campo` : "Ninguna en servicio"} />
        <Kpi titulo={`Más de ${n} días sin regresar`} valor={numero(vencidos.length)} icono={AlarmClock} tono={vencidos.length ? "peligro" : "ok"}
             alClic={() => setVista("vencidas")} detalle={vencidos[0] ? `${vencidos[0].herramienta}: ${vencidos[0].quien}, ${vencidos[0].dias} días` : "Todo a tiempo"} />
        <Kpi titulo="Regresaron dañadas (historial)" valor={numero((lista.data ?? []).filter((r) => r.estado_devolucion && r.estado_devolucion !== "bien").length)}
             icono={PackageCheck} tono="neutro" alClic={() => setVista("historial")} detalle="Se reporta la falla sola al recibirla" />
      </div>
      <TablaDatos filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(r) => r.id}
        exportarComo="resguardos" placeholder="Herramienta, persona, servicio…"
        claseFila={(r) => (tarde(r) ? "bg-peligro-suave/40" : undefined)}
        filtros={<div className="flex flex-wrap items-center gap-3">
          <Filtro<Vista> valor={vista} alCambiar={setVista} opciones={[
            { valor: "prestadas", texto: "Prestadas", cuenta: abiertos.length },
            { valor: "vencidas", texto: "Sin regresar", cuenta: vencidos.length },
            { valor: "historial", texto: "Regresadas" },
          ]} />
          <label className="inline-flex items-center gap-1.5 text-xs text-tenue">
            Marcar después de
            <Entrada type="number" min="1" className="h-8 w-16 text-xs" value={dias || String(n)} onChange={(e) => setDias(e.target.value)} aria-label="Días para marcar como sin regresar" />
            días
          </label>
        </div>}
        vacio={{ icono: Hand, titulo: vista === "historial" ? "Nada regresado todavía" : vista === "vencidas" ? "Nada pasado de tiempo" : "No hay herramienta prestada",
                 texto: p.personal && vista === "prestadas" ? "Cuando alguien se lleve una herramienta (a campo o a otra área), regístralo aquí con su nombre." : undefined }} />
      {prestar != null && <DialogoPrestar maquinaInicial={prestar || null} alCerrar={cerrarPrestar} />}
      {devolver && <DialogoDevolver r={devolver} alCerrar={() => setDevolver(null)} />}
    </Pagina>
  );
}

function DialogoPrestar({ maquinaInicial, alCerrar }: { maquinaInicial: string | null; alCerrar: () => void }) {
  const maquinas = useMaquinas();
  const personal = usePersonal();
  const servicios = useServicios();
  const [maquina, setMaquina] = useState(maquinaInicial ?? "");
  const [quien, setQuien] = useState("");          // empleado_id u "otro"
  const [persona, setPersona] = useState("");
  const [servicio, setServicio] = useState("");
  const [devolverEn, setDevolverEn] = useState("");
  const [notas, setNotas] = useState("");
  const disponibles = (maquinas.data ?? []).filter((m) => (m.prestable || m.tipo === "herramienta") && !m.resguardo_id
    && !["baja", "fuera_de_servicio", "en_mantenimiento"].includes(m.estado));
  const enCampo = (servicios.data ?? []).filter((s) => s.estado === "programada" || s.estado === "en_curso");
  const prestar = useAccion(() => q(supabase.rpc("prestar_herramienta", {
    p_maquina: maquina, p_empleado: quien && quien !== "otro" ? quien : null, p_persona: quien === "otro" ? persona : null,
    p_devolver_en: devolverEn || null, p_servicio: servicio || null, p_notas: notas || null,
  })), { exito: "Préstamo registrado", invalidar: [CLAVE], alTerminar: alCerrar });
  const listo = maquina && (quien && (quien !== "otro" || persona.trim()));
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo="Prestar herramienta" ancho="max-w-xl"
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-prestar" disabled={!listo} cargando={prestar.isPending}>Registrar préstamo</Boton></>}>
      <form id="form-prestar" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) prestar.mutate(); }}>
        <Campo etiqueta="Herramienta" ayuda={disponibles.length === 0 && !maquinas.isLoading ? "No hay herramienta disponible: toda está prestada o en reparación." : undefined}>
          <Seleccion value={maquina} onChange={(e) => setMaquina(e.target.value)} autoFocus>
            <option value="">Elige…</option>
            {disponibles.map((m) => <option key={m.id} value={m.id}>{m.numero} · {m.nombre}</option>)}
          </Seleccion>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Se la lleva">
            <Seleccion value={quien} onChange={(e) => setQuien(e.target.value)}>
              <option value="">Elige…</option>
              {(personal.data ?? []).filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.etapa ? ` (${x.etapa})` : ""}</option>)}
              <option value="otro">Otra persona o área…</option>
            </Seleccion>
          </Campo>
          {quien === "otro" && <Campo etiqueta="¿Quién?"><Entrada value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Ingeniería (Miguel), un externo…" /></Campo>}
          <Campo etiqueta="Para un servicio">
            <Seleccion value={servicio} onChange={(e) => setServicio(e.target.value)}>
              <option value="">No (uso en planta)</option>
              {enCampo.map((s) => <option key={s.id} value={s.id}>{s.folio} · {s.cliente}</option>)}
            </Seleccion>
          </Campo>
          <Campo etiqueta="La regresa el"><Entrada type="date" value={devolverEn} onChange={(e) => setDevolverEn(e.target.value)} /></Campo>
        </div>
        <Campo etiqueta="Notas"><Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Con estuche, con 2 discos…" /></Campo>
      </form>
    </Dialogo>
  );
}

function DialogoDevolver({ r, alCerrar }: { r: Resguardo; alCerrar: () => void }) {
  const [estado, setEstado] = useState<"bien" | "con_dano" | "incompleta">("bien");
  const [notas, setNotas] = useState("");
  const devolver = useAccion(() => q(supabase.rpc("devolver_herramienta", { p_resguardo: r.id, p_estado: estado, p_notas: notas || null })), {
    exito: estado === "bien" ? "Herramienta recibida" : "Recibida; la falla quedó reportada a la gerencia", invalidar: [CLAVE], alTerminar: alCerrar,
  });
  const listo = estado === "bien" || notas.trim().length >= 3;
  return (
    <Dialogo abierto alCambiar={(v) => !v && alCerrar()} titulo={`Recibir ${r.herramienta}`}
      descripcion={`La tiene ${r.quien} desde el ${fechaYHora(r.entregado_en)} (${hace(r.entregado_en)}).`}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-devolver" disabled={!listo} cargando={devolver.isPending}>Recibir</Boton></>}>
      <form id="form-devolver" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (listo) devolver.mutate(); }}>
        <div className="grid grid-cols-3 gap-2">
          {([["bien", "Bien"], ["con_dano", "Dañada"], ["incompleta", "Incompleta"]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setEstado(v)} aria-pressed={estado === v}
                    className={cn("h-11 rounded-lg border text-sm font-medium", estado === v ? (v === "bien" ? "border-ok bg-ok-suave text-ok" : "border-peligro bg-peligro-suave text-peligro") : "border-borde")}>
              {t}
            </button>
          ))}
        </div>
        {estado !== "bien" && (
          <Campo etiqueta="¿Qué le pasó o qué le falta?" ayuda="Se reporta como falla para que no se preste otra vez sin revisarla.">
            <AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} autoFocus />
          </Campo>
        )}
      </form>
    </Dialogo>
  );
}

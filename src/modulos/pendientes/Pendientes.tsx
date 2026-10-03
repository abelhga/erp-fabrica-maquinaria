// Mis pendientes: lo que me toca y lo que pedí. Reemplaza el "??" del chat:
// quien pidió algo ve si ya se hizo, y lo vencido se ve en rojo y avisa solo.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CheckCircle2, ListTodo, X } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Cargando, ErrorCarga, Vacio } from "@/components/ui/estados";
import { NuevoPendiente } from "@/components/avisos/NuevoPendiente";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { fecha, hace, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

interface Pendiente {
  id: string; titulo: string; detalle: string | null; vence: string | null; estado: "abierto" | "hecho" | "cancelado";
  ruta: string | null; nota_cierre: string | null; creado_en: string; cerrado_en: string | null;
  responsable_id: string; creado_por: string;
  responsable: { nombre: string } | null; creador: { nombre: string } | null;
}

export default function Pendientes() {
  const { perfil } = useSesion();
  const [vista, setVista] = useState<"mios" | "pedidos" | "cerrados">("mios");
  const [cerrando, setCerrando] = useState<Pendiente | null>(null);
  const lista = useQuery({
    queryKey: ["pendientes"],
    queryFn: () => q<Pendiente[]>(supabase.from("pendientes")
      .select("*, responsable:perfiles!pendientes_responsable_id_fkey(nombre), creador:perfiles!pendientes_creado_por_fkey(nombre)")
      .order("vence", { ascending: true, nullsFirst: false }).order("creado_en", { ascending: false }).limit(300)),
  });
  useTiempoReal("pendientes", [["pendientes"]]);
  const cancelar = useAccion((id: string) => q(supabase.from("pendientes").update({ estado: "cancelado" }).eq("id", id).select("id").single()),
    { exito: "Pendiente cancelado", invalidar: [["pendientes"]] });

  const hoy = hoyISO();
  const todos = lista.data ?? [];
  const abiertos = todos.filter((p) => p.estado === "abierto");
  const mios = abiertos.filter((p) => p.responsable_id === perfil?.id);
  const pedidos = abiertos.filter((p) => p.creado_por === perfil?.id && p.responsable_id !== perfil?.id);
  const cerrados = todos.filter((p) => p.estado !== "abierto");
  const visibles = vista === "mios" ? mios : vista === "pedidos" ? pedidos : cerrados;
  const vencidos = mios.filter((p) => p.vence && p.vence < hoy).length;

  return (
    <Pagina titulo="Pendientes" descripcion="Lo que te toca y lo que pediste a otros. Cuando alguien termina, a quien lo pidió le llega un aviso."
      acciones={<NuevoPendiente />}>
      <div className="flex flex-wrap gap-2">
        {([["mios", `Me tocan`, mios.length], ["pedidos", "Los que pedí", pedidos.length], ["cerrados", "Cerrados", cerrados.length]] as const).map(([v, t, n]) => (
          <button key={v} onClick={() => setVista(v)}
            className={cn("h-9 px-3.5 rounded-full border text-sm inline-flex items-center gap-2 transition",
              vista === v ? "bg-marca text-white border-marca" : "border-borde hover:border-marca/40")}>
            {t}<span className={cn("cifra text-xs", vista === v ? "text-white/80" : "text-tenue")}>{n}</span>
          </button>
        ))}
        {vencidos > 0 && <Insignia tono="peligro" className="self-center">{vencidos} vencido{vencidos === 1 ? "" : "s"}</Insignia>}
      </div>

      {lista.error ? <ErrorCarga error={lista.error} /> : lista.isLoading ? <Cargando filas={5} /> : visibles.length === 0 ? (
        <Vacio icono={vista === "mios" ? CheckCircle2 : ListTodo}
          titulo={vista === "mios" ? "Nada pendiente" : vista === "pedidos" ? "No has pedido nada" : "Nada cerrado todavía"}
          texto={vista === "pedidos" ? "Desde un pedido, una orden o aquí mismo, pídele algo a alguien con fecha: le llega un aviso y tú ves cuándo lo termina." : "Cuando alguien te asigne algo, aparece aquí y en la campana."} />
      ) : (
        <div className="tarjeta divide-y divide-borde">
          {visibles.map((p, i) => {
            const vencido = p.estado === "abierto" && p.vence && p.vence < hoy;
            const esHoy = p.vence === hoy;
            return (
              <div key={p.id} className="flex items-start gap-3 p-4 animate-entrar" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                {p.estado === "abierto" && p.responsable_id === perfil?.id ? (
                  <button onClick={() => setCerrando(p)} title="Marcar como hecho"
                    className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-borde hover:border-ok hover:bg-ok-suave grid place-items-center transition">
                    <Check className="h-3 w-3 text-ok opacity-0 hover:opacity-100" />
                  </button>
                ) : (
                  <span className={cn("mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center",
                    p.estado === "hecho" ? "bg-ok text-white" : p.estado === "cancelado" ? "bg-fondo text-tenue" : "border-2 border-dashed border-borde")}>
                    {p.estado === "hecho" && <Check className="h-3 w-3" />}{p.estado === "cancelado" && <X className="h-3 w-3" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", p.estado !== "abierto" && "line-through text-tenue")}>{p.titulo}</p>
                  {p.detalle && <p className="text-xs text-tenue mt-0.5 whitespace-pre-wrap">{p.detalle}</p>}
                  <p className="text-xs text-tenue mt-1">
                    {vista === "pedidos" ? <>Para <b className="text-texto font-medium">{p.responsable?.nombre}</b></> : <>De {p.creador?.nombre}</>}
                    {" · "}{hace(p.creado_en)}
                    {p.nota_cierre && <> · <span className="text-texto">“{p.nota_cierre}”</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.vence && (
                    <Insignia tono={vencido ? "peligro" : esHoy ? "aviso" : "neutro"}>{vencido ? "Venció " : esHoy ? "Hoy" : "Para "}{!esHoy && fecha(p.vence)}</Insignia>
                  )}
                  {p.ruta && <Link to={p.ruta} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue" title="Ir"><ArrowRight className="h-4 w-4" /></Link>}
                  {p.estado === "abierto" && p.creado_por === perfil?.id && (
                    <button onClick={() => cancelar.mutate(p.id)} title="Cancelar" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-fondo text-tenue"><X className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {cerrando && <Cerrar p={cerrando} alCerrar={() => setCerrando(null)} />}
    </Pagina>
  );
}

function Cerrar({ p, alCerrar }: { p: Pendiente; alCerrar: () => void }) {
  const [nota, setNota] = useState("");
  const hecho = useAccion(() => q(supabase.from("pendientes").update({ estado: "hecho", nota_cierre: nota.trim() || null }).eq("id", p.id).select("id").single()),
    { exito: "Listo: a quien lo pidió le llegó el aviso", invalidar: [["pendientes"]], alTerminar: alCerrar });
  return (
    <Dialogo abierto alCambiar={(a) => !a && alCerrar()} titulo="¿Ya quedó?" descripcion={p.titulo}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Todavía no</Boton><Boton variante="exito" cargando={hecho.isPending} onClick={() => hecho.mutate(undefined)}><Check className="h-4 w-4" />Hecho</Boton></>}>
      <form onSubmit={(e) => { e.preventDefault(); hecho.mutate(undefined); }}>
        <label className="block">
          <span className="etiqueta">Respuesta para {p.creador?.nombre ?? "quien lo pidió"} (opcional)</span>
          <input autoFocus className="campo mt-1" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. $12,400, entrega en 3 semanas" />
        </label>
      </form>
    </Dialogo>
  );
}

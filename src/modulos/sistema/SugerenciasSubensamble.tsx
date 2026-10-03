import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Layers, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q, useAccion } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { numero } from "@/lib/formato";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, EncabezadoTarjeta } from "@/components/ui/tarjeta";
import { Vacio, Cargando } from "@/components/ui/estados";

interface Sugerencia {
  id: number; estado: "pendiente" | "aplicada" | "descartada"; lineas: number; ahorro: number; nombre_sugerido: string | null;
  num_equipos: number; subensamble_id: string | null;
  componentes: { articulo_id: string; clave: string; nombre: string; unidad: string; cantidad: number }[];
  equipos: { id: string; clave: string; nombre: string }[];
}

/**
 * Grupos de piezas que se repiten idénticos en varios equipos (las listas se
 * hicieron copiando y pegando). Aplicar uno lo convierte en subensamble en todos
 * esos equipos: se captura y se mantiene una sola vez, y el costo no cambia.
 */
export function SugerenciasSubensamble() {
  const { puede } = useSesion();
  const [abierta, setAbierta] = useState<number | null>(null);
  const [aplicando, setAplicando] = useState<Sugerencia | null>(null);
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const lista = useQuery({
    queryKey: ["sugerencias_subensamble"],
    queryFn: () => q<Sugerencia[]>(supabase.from("v_sugerencias_subensamble").select("*").order("ahorro", { ascending: false })),
  });
  const aplicar = useAccion(
    (s: Sugerencia) => q(supabase.rpc("aplicar_sugerencia_subensamble", { p_id: s.id, p_clave: clave.trim(), p_nombre: nombre.trim() })),
    { exito: "Subensamble creado y aplicado en sus equipos. Ningún costo cambió.", invalidar: [["sugerencias_subensamble"]], alTerminar: () => setAplicando(null) },
  );
  const descartar = useAccion((id: number) => q(supabase.rpc("descartar_sugerencia_subensamble", { p_id: id })),
    { exito: "Sugerencia descartada", invalidar: [["sugerencias_subensamble"]] });

  const pendientes = (lista.data ?? []).filter((s) => s.estado === "pendiente");
  const ahorro = pendientes.reduce((t, s) => t + s.ahorro, 0);

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-marca" /> Subensambles escondidos en las listas copiadas</span>}
        descripcion={pendientes.length
          ? `${pendientes.length} grupos de piezas se repiten idénticos en varios equipos. Aplicarlos todos ahorra ${numero(ahorro)} líneas de captura.`
          : "Grupos de piezas que se repiten idénticos en varios equipos."}
      />
      {lista.isLoading ? <Cargando /> : !lista.data?.length ? (
        <Vacio icono={Layers} titulo="Sin sugerencias todavía" texto="Corre scripts/detectar-subensambles.ts después de importar las listas de materiales." />
      ) : (
        <div className="divide-y divide-borde border-t border-borde">
          {lista.data.map((s) => (
            <div key={s.id}>
              <div className="flex items-center gap-3 px-5 py-3">
                <button onClick={() => setAbierta(abierta === s.id ? null : s.id)} className="text-tenue" aria-label="Ver detalle">
                  {abierta === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.nombre_sugerido ?? `Grupo ${s.id}`}</p>
                  <p className="text-xs text-tenue">{s.lineas} piezas · en {s.num_equipos} equipos · ahorra {numero(s.ahorro)} líneas</p>
                </div>
                {s.estado === "pendiente" ? (
                  puede("costeo", 2) && (
                    <div className="flex gap-2">
                      <Boton tamano="sm" variante="fantasma" onClick={() => descartar.mutate(s.id)}>Descartar</Boton>
                      <Boton tamano="sm" onClick={() => { setAplicando(s); setNombre(""); setClave(`SUB-${String(s.id).padStart(3, "0")}`); }}>Convertir en subensamble</Boton>
                    </div>
                  )
                ) : <Insignia tono={s.estado === "aplicada" ? "ok" : "neutro"}>{s.estado}</Insignia>}
              </div>
              {abierta === s.id && (
                <div className="grid md:grid-cols-2 gap-4 px-12 pb-4 text-sm">
                  <div>
                    <p className="etiqueta mb-1">Piezas del grupo</p>
                    <ul className="space-y-0.5">
                      {s.componentes.map((c) => <li key={c.articulo_id} className="flex gap-2"><span className="cifra text-tenue w-14 text-right shrink-0">{numero(c.cantidad)}</span><span className="truncate">{c.nombre}</span></li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="etiqueta mb-1">Equipos que lo tienen completo</p>
                    <ul className="space-y-0.5">
                      {s.equipos.map((e) => <li key={e.id} className="truncate"><span className="text-tenue">{e.clave}</span> {e.nombre}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialogo abierto={!!aplicando} alCambiar={(v) => !v && setAplicando(null)} titulo="Convertir en subensamble"
        descripcion={aplicando && `Se crea un subensamble con ${aplicando.lineas} piezas y reemplaza esas piezas en ${aplicando.num_equipos} equipos. Los costos y precios no cambian.`}
        pie={<>
          <Boton variante="secundario" onClick={() => setAplicando(null)}>Cancelar</Boton>
          <Boton cargando={aplicar.isPending} disabled={!clave.trim() || nombre.trim().length < 4} onClick={() => aplicando && aplicar.mutate(aplicando)}>Crear y aplicar</Boton>
        </>}>
        <div className="space-y-4">
          <Campo etiqueta="Nombre del subensamble" ayuda={"Cómo lo llaman en el taller: «Kit de ruedas 14\"», «Cabezal motriz 18\"»…"}>
            <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={aplicando?.nombre_sugerido ?? ""} />
          </Campo>
          <Campo etiqueta="Clave"><Entrada value={clave} onChange={(e) => setClave(e.target.value.toUpperCase())} /></Campo>
        </div>
      </Dialogo>
    </Tarjeta>
  );
}

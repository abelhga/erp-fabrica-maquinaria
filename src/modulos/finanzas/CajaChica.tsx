import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Calculator, Coins, ScanLine, Trash2 } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Dialogo } from "@/components/ui/dialogo";
import { Campo, Entrada } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { supabase } from "@/lib/supabase";
import { q, useAccion, useTiempoReal } from "@/lib/consultas";
import { dinero, dineroCompacto, fecha, hoyISO } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import { GLOSARIO } from "@/tutorial/glosario";

interface Movimiento {
  id: number; fecha: string; tipo: "entrada" | "salida" | "arqueo"; importe: number; concepto: string; en_turno: string | null;
  notas: string | null; origen: "erp" | "hoja"; saldo: number;
}
const INVALIDAR = [["v_caja_chica"], ["hallazgos"]];

/**
 * Caja chica: el efectivo de la oficina con su saldo corrido. En la hoja el saldo era una
 * fórmula por renglón que se rompía al insertar uno; aquí sale de sumar los movimientos.
 */
export default function CajaChica() {
  const [elegida, setVista] = useState<"mes" | "todo" | null>(null);
  const [arqueo, setArqueo] = useState(false);
  const datos = useQuery({
    queryKey: ["v_caja_chica"],
    queryFn: () => q<Movimiento[]>(supabase.from("v_caja_chica").select("*").order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000)),
  });
  useTiempoReal("caja_chica", [["v_caja_chica"]]);
  const topes = useQuery({
    queryKey: ["configuracion", "caja_chica"], staleTime: 10 * 60_000,
    queryFn: async () => {
      const f = await q<{ clave: string; valor: unknown }[]>(supabase.from("configuracion").select("clave, valor").in("clave", ["caja_chica_minimo", "caja_chica_maximo"]));
      const v = Object.fromEntries(f.map((x) => [x.clave, Number(x.valor)]));
      return { minimo: v.caja_chica_minimo ?? 1000, maximo: v.caja_chica_maximo ?? 5000 };
    },
  });
  const movs = datos.data ?? [];
  const saldo = movs.length ? Number(movs[0].saldo) : 0;
  const mes = hoyISO().slice(0, 7);
  const delMes = movs.filter((m) => m.fecha.startsWith(mes));
  const salidasMes = delMes.filter((m) => m.tipo === "salida").reduce((s, m) => s - Number(m.importe), 0);
  const entradasMes = delMes.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.importe), 0);
  const ultimoArqueo = movs.find((m) => m.tipo === "arqueo");
  const min = topes.data?.minimo ?? 1000, max = topes.data?.maximo ?? 5000;
  const estado = saldo < min ? { tono: "peligro" as const, texto: `Abajo del mínimo (${dinero(min)}): toca reponer` }
    : saldo > max ? { tono: "aviso" as const, texto: `Arriba del máximo (${dinero(max)}): llévalo al banco` }
    : { tono: "ok" as const, texto: `Entre ${dinero(min)} y ${dinero(max)}` };
  // Abre en el mes; si este mes no hay nada todavía (el primer día), en el historial.
  const vista = elegida ?? (delMes.length ? "mes" : "todo");
  const filas = vista === "mes" ? delMes : movs;
  const borrar = useAccion((id: number) => q(supabase.from("caja_chica").delete().eq("id", id)), { exito: "Movimiento borrado", invalidar: INVALIDAR });

  const columnas: Columna<Movimiento>[] = [
    { clave: "fecha", titulo: "Fecha", sinBusqueda: true, valor: (m) => `${m.fecha}-${String(m.id).padStart(8, "0")}`, celda: (m) => <span className="whitespace-nowrap">{fecha(m.fecha)}</span> },
    { clave: "concepto", titulo: "Concepto", clase: "min-w-[200px] max-w-[380px]", valor: (m) => `${m.concepto} ${m.notas ?? ""}`,
      celda: (m) => <div>
        <p className="break-words flex flex-wrap items-center gap-2">{m.tipo === "arqueo" && <span data-explain={GLOSARIO.arqueo}><Insignia tono={Number(m.importe) < 0 ? "peligro" : "info"}>Arqueo</Insignia></span>}{m.concepto}</p>
        {m.notas && <p className="text-xs text-tenue break-words">{m.notas}</p>}
      </div> },
    { clave: "en_turno", titulo: "Quién", valor: (m) => m.en_turno ?? "", celda: (m) => <span className="text-tenue">{m.en_turno ?? "—"}{m.origen === "hoja" && <span className="block text-xs">Hoja</span>}</span> },
    { clave: "entrada", titulo: "Entra", alinear: "der", sinBusqueda: true, valor: (m) => (Number(m.importe) > 0 ? Number(m.importe) : 0),
      celda: (m) => (Number(m.importe) > 0 ? <span className="text-ok">{dinero(m.importe)}</span> : null) },
    { clave: "salida", titulo: "Sale", alinear: "der", sinBusqueda: true, valor: (m) => (Number(m.importe) < 0 ? -Number(m.importe) : 0),
      celda: (m) => (Number(m.importe) < 0 ? dinero(-Number(m.importe)) : null) },
    { clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, explica: GLOSARIO.saldoCaja, valor: (m) => Number(m.saldo), celda: (m) => <b>{dinero(m.saldo)}</b> },
    { clave: "acciones", titulo: "", sinBusqueda: true, celda: (m) => m.origen === "erp" ? (
      <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm(`¿Borrar «${m.concepto}» de ${dinero(Math.abs(Number(m.importe)))}?`)) borrar.mutate(m.id); }}
        className="p-1 rounded text-tenue hover:text-peligro hover:bg-fondo" aria-label="Borrar movimiento" title="Borrar (mal capturado)"><Trash2 className="h-4 w-4" /></button>
    ) : null },
  ];

  return (
    <Pagina titulo="Caja chica" descripcion="El efectivo de la oficina: cada entrada y salida con su saldo, y el arqueo cuando se cuenta."
      acciones={<Boton variante="secundario" onClick={() => setArqueo(true)}><Calculator className="h-4 w-4" /> Arqueo</Boton>}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Saldo" valor={dinero(saldo)} icono={Coins} tono={estado.tono} explica={GLOSARIO.saldoCaja} detalle={<span data-explain={GLOSARIO.topesCaja} data-explain-title="Mínimo y máximo">{estado.texto}</span>} />
        <Kpi titulo="Salidas del mes" valor={dineroCompacto(salidasMes)} icono={ArrowUpRight} tono="neutro" detalle={`${delMes.filter((m) => m.tipo === "salida").length} gastos`} />
        <Kpi titulo="Entradas del mes" valor={dineroCompacto(entradasMes)} icono={ArrowDownLeft} tono="info" detalle={`${delMes.filter((m) => m.tipo === "entrada").length} reposiciones`} />
        <Kpi titulo="Último arqueo" valor={ultimoArqueo ? fecha(ultimoArqueo.fecha) : "Nunca"} icono={ScanLine} tono={ultimoArqueo ? "neutro" : "aviso"} explica={GLOSARIO.arqueo}
          detalle={ultimoArqueo ? `${Number(ultimoArqueo.importe) < 0 ? "Faltaron" : "Sobraron"} ${dinero(Math.abs(Number(ultimoArqueo.importe)))}` : "Cuenta el efectivo y regístralo"} alClic={() => setArqueo(true)} />
      </div>

      <Captura />

      <TablaDatos filas={filas} columnas={columnas} cargando={datos.isLoading} error={datos.error} claveFila={(m) => String(m.id)}
        exportarComo="caja-chica" placeholder="Buscar concepto o persona…" limite={200}
        claseFila={(m) => (m.tipo === "arqueo" ? "bg-fondo" : undefined)}
        filtros={<Filtro valor={vista} alCambiar={setVista} opciones={[{ valor: "mes", texto: "Este mes", cuenta: delMes.length }, { valor: "todo", texto: movs.length >= 1000 ? "Últimos 1,000" : "Todo", cuenta: movs.length }]} />}
        vacio={{ icono: Coins, titulo: vista === "mes" ? "Nada este mes" : "Sin movimientos", texto: "Anota cada gasto en efectivo arriba (concepto y monto, Enter guarda) y cada reposición como entrada." }} />

      <Arqueo abierto={arqueo} saldo={saldo} alCerrar={() => setArqueo(false)} />
    </Pagina>
  );
}

/** Captura rápida: concepto, monto, Enter. Salida es lo normal (un gasto); entrada, la reposición. */
function Captura() {
  const vacio = { tipo: "salida" as "salida" | "entrada", monto: "", concepto: "", fecha: hoyISO(), notas: "" };
  const [f, setF] = useState(vacio);
  const monto = Number(f.monto) || 0;
  const guardar = useAccion(() => q(supabase.rpc("registrar_caja_chica", {
    p_tipo: f.tipo, p_monto: monto, p_concepto: f.concepto, p_fecha: f.fecha, p_notas: f.notas.trim() || null,
  })), { exito: f.tipo === "salida" ? "Gasto anotado" : "Entrada anotada", invalidar: INVALIDAR, alTerminar: () => setF({ ...vacio, tipo: f.tipo, fecha: f.fecha }) });
  function enviar(e: FormEvent) { e.preventDefault(); if (monto > 0 && f.concepto.trim()) guardar.mutate(undefined); }
  return (
    <Tarjeta className="p-4">
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[auto_1fr_9rem_10rem_auto] items-end">
        <div className="flex rounded-lg border border-borde p-0.5 h-10 self-end" role="radiogroup" aria-label="Tipo de movimiento">
          {(["salida", "entrada"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={f.tipo === t} onClick={() => setF({ ...f, tipo: t })}
              className={cn("px-3 rounded-md text-sm font-medium", f.tipo === t ? (t === "salida" ? "bg-peligro-suave text-peligro" : "bg-ok-suave text-ok") : "text-tenue hover:text-texto")}>
              {t === "salida" ? "Sale" : "Entra"}
            </button>
          ))}
        </div>
        <Campo etiqueta="Concepto">
          <Entrada value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} placeholder={f.tipo === "salida" ? "Garrafones de agua, papelería…" : "Reposición de caja"} required />
        </Campo>
        <Campo etiqueta="Monto">
          <Entrada type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className="cifra" required />
        </Campo>
        <Campo etiqueta="Fecha">
          <Entrada type="date" value={f.fecha} max={hoyISO()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
        </Campo>
        <Boton type="submit" cargando={guardar.isPending} disabled={monto <= 0 || !f.concepto.trim()}>Anotar</Boton>
      </form>
    </Tarjeta>
  );
}

function Arqueo({ abierto, saldo, alCerrar }: { abierto: boolean; saldo: number; alCerrar: () => void }) {
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const dif = useMemo(() => (contado === "" ? null : Math.round((Number(contado) - saldo) * 100) / 100), [contado, saldo]);
  const guardar = useAccion(() => q<number>(supabase.rpc("arqueo_caja_chica", { p_contado: Number(contado), p_nota: nota.trim() || null })), {
    exito: (d) => (Number(d) === 0 ? "Cuadra: arqueo sin diferencia" : `Arqueo registrado: ${Number(d) < 0 ? "faltante" : "sobrante"} de ${dinero(Math.abs(Number(d)))}`),
    invalidar: INVALIDAR, alTerminar: () => { setContado(""); setNota(""); alCerrar(); },
  });
  return (
    <Dialogo abierto={abierto} alCambiar={(v) => !v && alCerrar()} titulo="Arqueo de caja chica"
      descripcion="Cuenta el efectivo y escribe cuánto hay. Si no cuadra, la diferencia queda como movimiento."
      pie={<>
        <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" form="arqueo" cargando={guardar.isPending} disabled={contado === "" || Number(contado) < 0}>Registrar arqueo</Boton>
      </>}>
      <form id="arqueo" onSubmit={(e) => { e.preventDefault(); if (contado !== "") guardar.mutate(undefined); }} className="space-y-4">
        <Campo etiqueta="Efectivo contado" ayuda={`El sistema dice ${dinero(saldo)}.`}>
          <Entrada autoFocus type="number" step="0.01" min="0" value={contado} onChange={(e) => setContado(e.target.value)} className="cifra" required />
        </Campo>
        {dif != null && (
          <p className={cn("rounded-lg px-3 py-2 text-sm font-medium", dif === 0 ? "bg-ok-suave text-ok" : dif < 0 ? "bg-peligro-suave text-peligro" : "bg-info-suave text-info")}>
            {dif === 0 ? "Cuadra exacto." : `${dif < 0 ? "Faltan" : "Sobran"} ${dinero(Math.abs(dif))}.`}
          </p>
        )}
        {dif != null && dif !== 0 && (
          <Campo etiqueta="Nota (opcional)">
            <Entrada value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Qué pasó, si se sabe" />
          </Campo>
        )}
      </form>
    </Dialogo>
  );
}

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Cake, Plus, UserRound, UserX, Users } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Kpi } from "@/components/ui/kpi";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Seleccion } from "@/components/ui/campo";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { useSesion } from "@/lib/sesion";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { fecha, numero } from "@/lib/formato";
import {
  Avatar, TIPOS, antiguedad, mesesDeAntiguedad, useAusentesHoy, useCatalogosRrhh, useEmpleados, useVacaciones, type Empleado,
} from "./componentes/comun";
import { FichaEmpleado } from "./componentes/FichaEmpleado";

type VistaEstado = "activos" | "bajas" | "todos";

export default function Empleados() {
  const { puede } = useSesion();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [estado, setEstado] = useState<VistaEstado>("activos");
  const [depto, setDepto] = useState("");
  const abierto = params.get("empleado");
  const abrir = (id: string | null) => setParams(id ? { empleado: id } : {}, { replace: true });

  const empleados = useEmpleados();
  const vacaciones = useVacaciones();
  const ausentes = useAusentesHoy();
  const { deptos } = useCatalogosRrhh();
  const pendientes = useQuery({
    queryKey: ["incidencias", "pendientes", "cuenta"],
    queryFn: async () => {
      const { count, error } = await supabase.from("incidencias").select("id", { count: "exact", head: true }).eq("estado", "solicitada");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const usuarios = useQuery({
    queryKey: ["perfiles", "breves"],
    queryFn: () => q<{ id: string; nombre: string; correo: string; activo: boolean }[]>(supabase.from("perfiles").select("id, nombre, correo, activo").order("nombre")),
  });

  const saldo = useMemo(() => new Map((vacaciones.data ?? []).map((v) => [v.empleado_id, v])), [vacaciones.data]);
  const ausencia = useMemo(() => new Map((ausentes.data ?? []).map((a) => [a.empleado_id, a])), [ausentes.data]);
  const todos = empleados.data ?? [];
  const activos = todos.filter((e) => e.activo);
  const filas = todos.filter((e) => (estado === "todos" || (estado === "activos") === e.activo) && (!depto || String(e.departamento_id) === depto));

  const mesActual = new Date().getMonth();
  const cumpleanos = activos.filter((e) => e.fecha_nacimiento && new Date(e.fecha_nacimiento + "T12:00:00").getMonth() === mesActual)
    .sort((a, b) => Number(a.fecha_nacimiento!.slice(8)) - Number(b.fecha_nacimiento!.slice(8)));
  const promedio = activos.length ? activos.reduce((s, e) => s + mesesDeAntiguedad(e.fecha_ingreso), 0) / activos.length / 12 : 0;

  const columnas: Columna<Empleado>[] = [
    {
      clave: "nombre", titulo: "Nombre", valor: (e) => e.nombre,
      celda: (e) => (
        <div className="flex items-center gap-3 min-w-[220px]">
          <Avatar nombre={e.nombre} foto={e.foto_url} inactivo={!e.activo} />
          <div className="min-w-0">
            <p className="font-medium truncate">{e.nombre}</p>
            <p className="text-xs text-tenue truncate">{e.usuario ? e.usuario.correo : e.telefono ?? "Sin teléfono"}</p>
          </div>
        </div>
      ),
    },
    { clave: "numero", titulo: "Núm.", valor: (e) => e.numero, celda: (e) => <span className="cifra text-tenue">{e.numero ?? "—"}</span> },
    { clave: "puesto", titulo: "Puesto", valor: (e) => e.puesto },
    { clave: "departamento", titulo: "Departamento", valor: (e) => e.departamento?.nombre },
    {
      clave: "etapa", titulo: "Área de piso", valor: (e) => e.etapa?.nombre,
      celda: (e) => e.etapa ? (
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: e.etapa.color }} />{e.etapa.nombre}</span>
      ) : <span className="text-tenue">—</span>,
    },
    {
      clave: "antiguedad", titulo: "Antigüedad", valor: (e) => mesesDeAntiguedad(e.fecha_ingreso), sinBusqueda: true,
      celda: (e) => (
        <div className="whitespace-nowrap">
          <p>{antiguedad(e.fecha_ingreso, e.activo ? null : e.baja_en)}</p>
          <p className="text-xs text-tenue">desde {fecha(e.fecha_ingreso)}</p>
        </div>
      ),
    },
    {
      clave: "vacaciones", titulo: "Vacaciones", alinear: "der", sinBusqueda: true, valor: (e) => saldo.get(e.id)?.saldo ?? null,
      celda: (e) => {
        const v = saldo.get(e.id);
        if (!v) return <span className="text-tenue">—</span>;
        if (v.anios < 1) return <span className="text-xs text-tenue whitespace-nowrap" title="La LFT da vacaciones al cumplir el primer año">al cumplir 1 año</span>;
        return (
          <span className="whitespace-nowrap" title={`${numero(v.tomados)} tomados de ${v.dias_periodo} del periodo`}>
            <b className={v.saldo < 0 ? "text-peligro" : ""}>{numero(v.saldo)}</b>
            <span className="text-tenue text-xs"> de {v.dias_periodo} días</span>
          </span>
        );
      },
    },
    {
      clave: "estado", titulo: "Estado", sinBusqueda: true,
      valor: (e) => (!e.activo ? "Baja" : ausencia.get(e.id) ? TIPOS[ausencia.get(e.id)!.tipo].texto : "Activo"),
      celda: (e) => {
        if (!e.activo) return <Insignia tono="neutro">Baja {fecha(e.baja_en)}</Insignia>;
        const a = ausencia.get(e.id);
        if (a) return <Insignia tono={TIPOS[a.tipo].tono} punto>{TIPOS[a.tipo].texto} hasta {fecha(a.fin)}</Insignia>;
        return <Insignia tono="ok" punto>Activo</Insignia>;
      },
    },
  ];

  const nombresAusentes = (ausentes.data ?? []).map((a) => todos.find((e) => e.id === a.empleado_id)?.nombre.split(" ")[0]).filter(Boolean);

  return (
    <Pagina
      titulo="Personal"
      descripcion="Quién trabaja en Hegamex, en qué área y cuántas vacaciones le quedan."
      acciones={puede("rrhh", 2) && <Boton onClick={() => abrir("nuevo")}><Plus className="h-4 w-4" /> Nuevo empleado</Boton>}
    >
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Personal activo" valor={numero(activos.length)} icono={Users} tono="marca"
          detalle={`${activos.filter((e) => e.etapa_id).length} en piso · antigüedad promedio ${promedio.toFixed(1)} años`} />
        <Kpi titulo="Ausentes hoy" valor={numero(ausentes.data?.length ?? 0)} icono={UserX} tono={(ausentes.data?.length ?? 0) > 0 ? "aviso" : "ok"}
          detalle={nombresAusentes.length ? nombresAusentes.join(", ") : "Todos presentes"} alClic={() => ir("/rrhh/incidencias?vista=calendario")} />
        <Kpi titulo="Solicitudes por aprobar" valor={numero(pendientes.data ?? 0)} icono={CalendarClock} tono={(pendientes.data ?? 0) > 0 ? "aviso" : "neutro"}
          detalle="Vacaciones y permisos" alClic={() => ir("/rrhh/incidencias")} />
        <Kpi titulo="Cumpleaños del mes" valor={numero(cumpleanos.length)} icono={Cake} tono="info"
          detalle={cumpleanos.length ? cumpleanos.slice(0, 3).map((e) => `${e.nombre.split(" ")[0]} (${Number(e.fecha_nacimiento!.slice(8))})`).join(", ") + (cumpleanos.length > 3 ? "…" : "") : "Nadie este mes"} />
      </div>

      <TablaDatos
        filas={filas}
        columnas={columnas}
        cargando={empleados.isLoading}
        error={empleados.error}
        claveFila={(e) => e.id}
        alClicFila={(e) => abrir(e.id)}
        placeholder="Buscar por nombre, número, puesto o área…"
        exportarComo="personal"
        claseFila={(e) => (e.activo ? undefined : "opacity-70")}
        filtros={
          <div className="flex flex-wrap items-center gap-2">
            <Filtro<VistaEstado> valor={estado} alCambiar={setEstado} opciones={[
              { valor: "activos", texto: "Activos", cuenta: activos.length },
              { valor: "bajas", texto: "Bajas", cuenta: todos.length - activos.length },
              { valor: "todos", texto: "Todos" },
            ]} />
            <Seleccion className="h-8 w-auto text-xs" value={depto} onChange={(e) => setDepto(e.target.value)} aria-label="Departamento">
              <option value="">Todos los departamentos</option>
              {deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </Seleccion>
          </div>
        }
        vacio={{
          icono: UserRound,
          titulo: estado === "bajas" ? "No hay bajas registradas" : "Aún no hay personal capturado",
          texto: estado === "bajas" ? "Cuando alguien deje la empresa, dalo de baja desde su ficha con la fecha y el motivo." : "Da de alta a cada persona con su fecha de ingreso: con ella se calculan antigüedad y vacaciones.",
          accion: puede("rrhh", 2) && estado !== "bajas" ? <Boton onClick={() => abrir("nuevo")}><Plus className="h-4 w-4" /> Nuevo empleado</Boton> : undefined,
        }}
      />

      <FichaEmpleado
        id={abierto}
        empleados={todos}
        usuarios={usuarios.data ?? []}
        alCerrar={() => abrir(null)}
        alCrear={(id) => abrir(id)}
      />
    </Pagina>
  );
}

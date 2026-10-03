import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { TablaDatos, Filtro, type Columna } from "@/components/datos/TablaDatos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { dinero, fecha } from "@/lib/formato";
import { DialogoCliente } from "./componentes/dialogos";
import { haceCuanto, todas, type VCliente } from "./comun";
import { DuenoCliente, type Cartera } from "./componentes/Cartera";

/**
 * Directorio único de clientes: todos los vendedores ven que la cuenta existe
 * y de quién es (para no duplicarla ni pisarse), pero teléfonos, historia y
 * saldo solo el dueño, la gerencia y cobranza (eso lo decide la base).
 */
export default function Clientes() {
  const { perfil, puede } = useSesion();
  const esGerente = puede("ventas", 3);
  const ir = useNavigate();
  const [filtro, setFiltro] = useState<"mios" | "libres" | "todos">(esGerente ? "todos" : "mios");
  const [vendedor, setVendedor] = useState("todos");
  const [alta, setAlta] = useState(false);

  const lista = useQuery({
    queryKey: ["v_clientes"],
    queryFn: () => todas<VCliente>((a, b) => supabase.from("v_clientes").select("*").eq("activo", true).order("nombre").order("id").range(a, b)),
  });
  const cartera = useQuery({
    queryKey: ["v_cartera"], staleTime: 5 * 60_000,
    queryFn: () => todas<Cartera>((a, b) => supabase.from("v_cartera").select("cliente_id, vendedor_id, vendedor, ultima_venta, ultimo_seguimiento, vence_en, estado, dias_restantes").order("cliente_id").range(a, b)),
  });
  const porId = useMemo(() => new Map((cartera.data ?? []).map((c) => [c.cliente_id, c])), [cartera.data]);

  const filas = useMemo(() => {
    let r = lista.data ?? [];
    if (filtro === "mios") r = r.filter((c) => c.vendedor_id === perfil?.id);
    if (filtro === "libres") r = r.filter((c) => !c.vendedor_id);
    if (vendedor !== "todos") r = r.filter((c) => c.vendedor_id === vendedor);
    return r;
  }, [lista.data, filtro, vendedor, perfil?.id]);
  const vendedores = useMemo(() => {
    const m = new Map<string, string>();
    (lista.data ?? []).forEach((c) => c.vendedor_id && c.vendedor && m.set(c.vendedor_id, c.vendedor));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [lista.data]);
  const ultima = (c: VCliente) => {
    const k = porId.get(c.id)?.ultima_venta ?? null;
    return [c.ultima_compra, k].filter(Boolean).sort().pop() ?? null;
  };

  const columnas: Columna<VCliente>[] = [
    {
      clave: "nombre", titulo: "Cliente", valor: (c) => `${c.nombre} ${c.razon_social ?? ""} ${c.rfc ?? ""}`,
      celda: (c) => (
        <div className="min-w-[220px] max-w-[360px]">
          <p className="font-medium truncate">{c.nombre}{c.es_distribuidor && <Insignia tono="info" className="ml-2">distribuidor</Insignia>}</p>
          <p className="text-xs text-tenue truncate">{[c.razon_social !== c.nombre ? c.razon_social : null, c.rfc, c.giro].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    { clave: "ciudad", titulo: "Ciudad", valor: (c) => [c.ciudad, c.estado].filter(Boolean).join(", ") || null },
    {
      clave: "vendedor", titulo: "Vendedor dueño", valor: (c) => c.vendedor ?? "Libre",
      celda: (c) => <DuenoCliente cartera={porId.get(c.id)} vendedor={c.vendedor} mio={c.vendedor_id === perfil?.id} />,
    },
    {
      clave: "ultima", titulo: "Última compra", valor: (c) => ultima(c) ?? "",
      celda: (c) => { const u = ultima(c); return u ? <span title={fecha(u)}>{haceCuanto(u)}</span> : <span className="text-tenue">—</span>; },
    },
    { clave: "compras", titulo: "Compras 12 meses", alinear: "der", sinBusqueda: true, valor: (c) => Number(c.compras_12m), celda: (c) => Number(c.compras_12m) ? dinero(c.compras_12m) : <span className="text-tenue">—</span> },
    {
      clave: "saldo", titulo: "Saldo", alinear: "der", sinBusqueda: true, valor: (c) => Number(c.saldo),
      celda: (c) => Number(c.saldo) > 0.5 ? <span className="font-medium text-aviso">{dinero(c.saldo)}</span> : <span className="text-tenue">—</span>,
    },
  ];

  const cuenta = (f: (c: VCliente) => boolean) => (lista.data ?? []).filter(f).length;
  return (
    <Pagina titulo="Clientes" descripcion="Un solo directorio para todos los vendedores, con dueño y vigencia de cada cuenta."
      acciones={<Boton onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Nuevo cliente</Boton>}>
      <TablaDatos filas={filas} columnas={columnas} cargando={lista.isLoading} error={lista.error} claveFila={(c) => c.id}
        alClicFila={(c) => ir(`/ventas/clientes/${c.id}`)} exportarComo="clientes" placeholder="Nombre, razón social, RFC, ciudad…"
        filtros={
          <div className="flex flex-wrap items-center gap-2">
            <Filtro valor={filtro} alCambiar={setFiltro} opciones={[
              { valor: "mios", texto: "Mis clientes", cuenta: cuenta((c) => c.vendedor_id === perfil?.id) },
              { valor: "libres", texto: "Libres", cuenta: cuenta((c) => !c.vendedor_id) },
              { valor: "todos", texto: "Todos", cuenta: cuenta(() => true) },
            ]} />
            {esGerente && (
              <select className="campo h-8 w-auto pr-8 text-xs" value={vendedor} onChange={(e) => setVendedor(e.target.value)} aria-label="Vendedor">
                <option value="todos">Cualquier vendedor</option>
                {vendedores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            )}
          </div>
        }
        vacio={{ icono: Users, titulo: filtro === "mios" ? "Todavía no tienes clientes a tu nombre" : "Sin clientes",
          texto: "Da de alta uno con su nombre y un teléfono; lo demás se llena después.",
          accion: <Boton onClick={() => setAlta(true)}><Plus className="h-4 w-4" />Nuevo cliente</Boton> }} />
      <DialogoCliente abierto={alta} alCambiar={setAlta} alCrear={(c) => ir(`/ventas/clientes/${c.id}`)} />
    </Pagina>
  );
}

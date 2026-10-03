import { Link, useSearchParams } from "react-router-dom";
import { History } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { ConfigEmpresa } from "./componentes/ConfigEmpresa";
import { ConfigVentas } from "./componentes/ConfigVentas";
import { ConfigAlmacenes, ConfigTaller } from "./componentes/ConfigCatalogos";
import { ConfigTipoCambio } from "./componentes/ConfigTipoCambio";

const PESTANAS = [
  { valor: "empresa", texto: "Empresa" },
  { valor: "ventas", texto: "Ventas" },
  { valor: "almacenes", texto: "Almacenes" },
  { valor: "taller", texto: "Taller" },
  { valor: "tipo-cambio", texto: "Tipos de cambio" },
];

export default function Configuracion() {
  const [params, setParams] = useSearchParams();
  const pestana = params.get("seccion") ?? "empresa";
  return (
    <Pagina titulo="Configuración" descripcion="Datos de la empresa y catálogos que usan todas las pantallas."
      acciones={<Link to="/sistema/bitacora" className="inline-flex items-center gap-1.5 text-sm text-tenue hover:text-texto"><History className="h-4 w-4" /> Cada cambio queda en la bitácora</Link>}>
      <Pestanas value={pestana} onValueChange={(v) => setParams(v === "empresa" ? {} : { seccion: v }, { replace: true })}>
        <ListaPestanas opciones={PESTANAS} />
        <ContenidoPestana value="empresa" className="pt-4"><ConfigEmpresa /></ContenidoPestana>
        <ContenidoPestana value="ventas" className="pt-4"><ConfigVentas /></ContenidoPestana>
        <ContenidoPestana value="almacenes" className="pt-4"><ConfigAlmacenes /></ContenidoPestana>
        <ContenidoPestana value="taller" className="pt-4"><ConfigTaller /></ContenidoPestana>
        <ContenidoPestana value="tipo-cambio" className="pt-4"><ConfigTipoCambio /></ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

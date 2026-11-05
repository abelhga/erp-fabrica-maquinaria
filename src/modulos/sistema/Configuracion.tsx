import { Link, useSearchParams } from "react-router-dom";
import { History } from "lucide-react";
import { Pagina } from "@/components/layout/Shell";
import { Pestanas, ListaPestanas, ContenidoPestana } from "@/components/ui/pestanas";
import { ConfigEmpresa } from "./componentes/ConfigEmpresa";
import { ConfigVentas } from "./componentes/ConfigVentas";
import { ConfigAlmacenes, ConfigConsumibles, ConfigTaller } from "./componentes/ConfigCatalogos";
import { ConfigTipoCambio } from "./componentes/ConfigTipoCambio";
import { ConfigIntegraciones } from "./componentes/ConfigIntegraciones";
import { GLOSARIO } from "@/tutorial/glosario";

const PESTANAS = [
  { valor: "empresa", texto: "Empresa", explica: GLOSARIO.pestanaConfigEmpresa },
  { valor: "ventas", texto: "Ventas", explica: GLOSARIO.pestanaConfigVentas },
  { valor: "almacenes", texto: "Almacenes", explica: GLOSARIO.pestanaConfigAlmacenes },
  { valor: "taller", texto: "Taller", explica: GLOSARIO.pestanaConfigTaller },
  { valor: "tipo-cambio", texto: "Tipos de cambio", explica: GLOSARIO.pestanaConfigTipoCambio },
  { valor: "integraciones", texto: "Integraciones", explica: GLOSARIO.pestanaConfigIntegraciones },
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
        <ContenidoPestana value="almacenes" className="pt-4 space-y-4"><ConfigAlmacenes /><ConfigConsumibles /></ContenidoPestana>
        <ContenidoPestana value="taller" className="pt-4"><ConfigTaller /></ContenidoPestana>
        <ContenidoPestana value="tipo-cambio" className="pt-4"><ConfigTipoCambio /></ContenidoPestana>
        <ContenidoPestana value="integraciones" className="pt-4"><ConfigIntegraciones /></ContenidoPestana>
      </Pestanas>
    </Pagina>
  );
}

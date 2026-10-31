import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LogOut, Menu, Moon, Pin, PinOff, RotateCcw, Search, Sun, X } from "lucide-react";
import { MENU, INICIO, PENDIENTES, REVISION, CALENDARIO, SEMANA, ordenPorRol, type EntradaMenu } from "@/navegacion";
import { useMenuPersonal } from "@/lib/menuPersonal";
import { useRegresoDeGoogle } from "@/lib/correo";
import { GLOSARIO } from "@/tutorial/glosario";
import { useSesion, NOMBRE_ROL } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { elegirTema, recordarTemaEmpresa, temaInicial } from "@/lib/tema";
import { Logo } from "./Logo";
import { BuscadorGlobal } from "./BuscadorGlobal";
import { Asistente } from "@/components/asistente/Asistente";
import { Campana } from "@/components/avisos/Campana";
import { AvisoVerComo, BotonVerComo } from "./VerComo";
import { FranjaVistaPrevia } from "@/paginas/VistaPrevia";
import { BotonTutorial, Explicacion } from "@/tutorial/Explicacion";
import { CapaExplicacion } from "@/tutorial/CapaExplicacion";
import { ayudaDe } from "@/tutorial/pantallas";

function useTema() {
  const [oscuro, setOscuro] = useState(() => temaInicial() === "oscuro");
  // El de la empresa puede haber cambiado en Configuración: si esta persona no eligió uno, se sigue.
  const empresa = useQuery({
    queryKey: ["configuracion", "tema_por_defecto"], staleTime: 10 * 60_000,
    queryFn: () => q<{ valor: unknown }[]>(supabase.from("configuracion").select("valor").eq("clave", "tema_por_defecto")),
  });
  useEffect(() => {
    const v = empresa.data?.[0]?.valor;
    if (v === "oscuro" || v === "claro") setOscuro(recordarTemaEmpresa(v) === "oscuro");
  }, [empresa.data]);
  const cambiar = (v: boolean) => { elegirTema(v ? "oscuro" : "claro"); setOscuro(v); };
  return [oscuro, cambiar] as const;
}

export function Shell() {
  const { perfil, puede, salir, roles, vistaPrevia } = useSesion();
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [oscuro, setOscuro] = useTema();
  const { pathname } = useLocation();

  useEffect(() => setAbiertoMovil(false), [pathname]);
  useRegresoDeGoogle();
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscando(true); }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  // Lo que el rol no ve no entra; el orden sale del puesto (producción ve Producción primero) o
  // del que la persona eligió. Lo fijado va arriba, sin quitarlo de su sección.
  const menuPersonal = useMenuPersonal(perfil?.id);
  const { prefs } = menuPersonal;
  const visibles = MENU.map((s) => ({ ...s, entradas: s.entradas.filter((e) => puede(e.modulo, e.nivel ?? 1) && (!e.tambien || puede(e.tambien.modulo, e.tambien.nivel ?? 1))) }))
    .filter((s) => s.entradas.length);
  const porPuesto = ordenPorRol(roles);
  const orden = [...new Set([...(prefs.orden ?? []), ...porPuesto])];
  const secciones = [...visibles].sort((a, b) => orden.indexOf(a.titulo) - orden.indexOf(b.titulo));
  const ordenVisible = secciones.map((s) => s.titulo);
  const fijadas = prefs.fijadas.map((r) => visibles.flatMap((s) => s.entradas).find((e) => e.ruta === r)).filter((e): e is EntradaMenu => !!e);
  const conRutaActual = (entradas: EntradaMenu[]) => entradas.some((e) => pathname === e.ruta || pathname.startsWith(`${e.ruta}/`));

  const menu = (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-5">
      <div className="space-y-0.5">
        <ItemMenu ruta={INICIO.ruta} texto={INICIO.texto} Icono={INICIO.icono} />
        <ItemMenu ruta={PENDIENTES.ruta} texto={PENDIENTES.texto} Icono={PENDIENTES.icono} />
        <ItemMenu ruta={REVISION.ruta} texto={REVISION.texto} Icono={REVISION.icono} />
        <ItemMenu ruta={CALENDARIO.ruta} texto={CALENDARIO.texto} Icono={CALENDARIO.icono} />
        {puede(SEMANA.modulo, 1) && <ItemMenu ruta={SEMANA.ruta} texto={SEMANA.texto} Icono={SEMANA.icono} />}
      </div>
      {fijadas.length > 0 && (
        <div>
          <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-tenue/80" data-explain={GLOSARIO.menuFijadas} data-explain-title="Fijadas">Fijadas</p>
          <div className="space-y-0.5">
            {fijadas.map((e) => <ItemMenu key={e.ruta} ruta={e.ruta} texto={e.texto} Icono={e.icono} fijada alFijar={() => menuPersonal.fijar(e.ruta)} />)}
          </div>
        </div>
      )}
      {secciones.map((s, i) => {
        // Una sección colapsada se abre sola mientras estés en una de sus pantallas, para no perderte.
        const colapsada = prefs.colapsadas.includes(s.titulo) && !conRutaActual(s.entradas);
        return (
          <div key={s.titulo}>
            <div className="group/sec flex items-center gap-1 pr-1 mb-1">
              <button type="button" onClick={() => menuPersonal.colapsar(s.titulo)} aria-expanded={!colapsada}
                data-explain={GLOSARIO.menuPersonal} data-explain-title="Tu menú"
                className="flex-1 flex items-center gap-1 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-tenue/80 hover:text-texto">
                {s.titulo}
                <ChevronDown className={cn("h-3 w-3 transition-transform", colapsada && "-rotate-90")} />
              </button>
              <span className="flex opacity-0 group-hover/sec:opacity-100 focus-within:opacity-100 transition-opacity">
                <button type="button" disabled={i === 0} onClick={() => menuPersonal.mover(s.titulo, -1, ordenVisible)} aria-label={`Subir ${s.titulo}`}
                  className="p-0.5 rounded text-tenue hover:text-texto hover:bg-fondo disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={i === secciones.length - 1} onClick={() => menuPersonal.mover(s.titulo, 1, ordenVisible)} aria-label={`Bajar ${s.titulo}`}
                  className="p-0.5 rounded text-tenue hover:text-texto hover:bg-fondo disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
              </span>
            </div>
            {!colapsada && (
              <div className="space-y-0.5">
                {s.entradas.map((e) => <ItemMenu key={e.ruta} ruta={e.ruta} texto={e.texto} Icono={e.icono}
                  fijada={prefs.fijadas.includes(e.ruta)} alFijar={() => menuPersonal.fijar(e.ruta)} />)}
              </div>
            )}
          </div>
        );
      })}
      {menuPersonal.personalizado && (
        <button type="button" onClick={menuPersonal.restaurar}
          className="flex items-center gap-2 px-3 text-xs text-tenue hover:text-texto"><RotateCcw className="h-3.5 w-3.5" />Restaurar el menú de mi puesto</button>
      )}
    </nav>
  );

  return (
    <div className="h-full flex">
      {/* Menú lateral fijo en escritorio */}
      <aside className="no-imprimir hidden lg:flex w-64 shrink-0 flex-col border-r border-borde bg-superficie">
        <div className="h-16 flex items-center px-5"><Logo /></div>
        {menu}
      </aside>

      {/* Menú deslizable en celular */}
      {abiertoMovil && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 bg-superficie border-r border-borde flex flex-col">
            <div className="h-16 flex items-center justify-between px-5">
              <Logo />
              <button onClick={() => setAbiertoMovil(false)} aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
            </div>
            {menu}
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setAbiertoMovil(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <AvisoVerComo />
        <FranjaVistaPrevia />
        <header className="no-imprimir h-16 shrink-0 flex items-center gap-3 px-4 lg:px-8 border-b border-borde bg-superficie/80 backdrop-blur sticky top-0 z-30">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setAbiertoMovil(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <button
            onClick={() => setBuscando(true)}
            className="flex items-center gap-2 h-9 flex-1 min-w-0 max-w-md rounded-lg border border-borde bg-fondo px-3 text-sm text-tenue hover:border-marca/40"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Buscar cliente, equipo, componente, folio…</span>
            <kbd className="ml-auto hidden sm:inline text-[10px] border border-borde rounded px-1.5 py-0.5">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <BotonVerComo />
            <BotonTutorial />
            <Campana />
            <button onClick={() => setOscuro(!oscuro)} className="p-2 rounded-lg hover:bg-fondo text-tenue" aria-label="Cambiar tema">
              {oscuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-borde">
              <div className="h-8 w-8 rounded-full bg-marca text-white text-xs font-semibold flex items-center justify-center">
                {perfil?.iniciales || perfil?.nombre?.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium max-w-[160px] truncate">{perfil?.nombre}</p>
                <p className="text-[11px] text-tenue">{roles.map((r) => NOMBRE_ROL[r]).join(", ") || "sin rol"}</p>
              </div>
            </div>
            <button onClick={salir} className="p-2 rounded-lg hover:bg-fondo text-tenue" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <BuscadorGlobal abierto={buscando} alCambiar={setBuscando} />
      <CapaExplicacion />
      {/* En una vista previa el asistente no se usa (gastaría a nombre de la otra persona). */}
      {!vistaPrevia && <Asistente />}
    </div>
  );
}

function ItemMenu({ ruta, texto, Icono, fijada, alFijar }: {
  ruta: string; texto: string; Icono: React.ComponentType<{ className?: string }>; fijada?: boolean; alFijar?: () => void;
}) {
  const enlace = (
    <NavLink
      to={ruta}
      end={ruta === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive ? "bg-marca-suave text-marca-texto font-medium" : "text-texto/80 hover:bg-fondo hover:text-texto",
        )
      }
    >
      <Icono className="h-[18px] w-[18px] shrink-0" />
      {texto}
    </NavLink>
  );
  if (!alFijar) return enlace;
  // El alfiler aparece al pasar el mouse (o con el foco); fijada, se queda visible en la sección.
  return (
    <div className="group/item relative">
      {enlace}
      <button type="button" onClick={alFijar} aria-label={fijada ? `Quitar ${texto} de fijadas` : `Fijar ${texto} arriba`}
        title={fijada ? "Quitar de fijadas" : "Fijar arriba"}
        className={cn("absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-tenue hover:text-texto hover:bg-superficie transition-opacity",
          "opacity-0 group-hover/item:opacity-100 focus:opacity-100")}>
        {fijada ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/**
 * Encabezado estándar de cada página: título, contexto y acciones a la derecha. Con el modo
 * tutorial encendido, abajo del título va el texto de esta ruta (`tutorial/pantallas/`).
 */
export function Pagina({ titulo, descripcion, acciones, children, ancho = "max-w-7xl" }: {
  titulo: React.ReactNode; descripcion?: React.ReactNode; acciones?: React.ReactNode; children: React.ReactNode; ancho?: string;
}) {
  const { pathname } = useLocation();
  const ayuda = ayudaDe(pathname);
  return (
    // pb-24 abajo de escritorio: el botón flotante del asistente tapaba el último renglón de cada pantalla.
    <div className={cn("mx-auto px-4 lg:px-8 pt-6 pb-24 lg:pb-6 space-y-5", ancho)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descripcion && <p className="text-tenue mt-1">{descripcion}</p>}
        </div>
        {acciones && <div className="no-imprimir flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {ayuda && <Explicacion>{ayuda.map((p) => <p key={p}>{p}</p>)}</Explicacion>}
      {children}
    </div>
  );
}

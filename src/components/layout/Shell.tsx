import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import { MENU, INICIO } from "@/navegacion";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utilidades";
import { Logo } from "./Logo";
import { BuscadorGlobal } from "./BuscadorGlobal";

function useTema() {
  const [oscuro, setOscuro] = useState(() => {
    try { return localStorage.getItem("tema") === "oscuro"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", oscuro);
    try { localStorage.setItem("tema", oscuro ? "oscuro" : "claro"); } catch { /* modo privado */ }
  }, [oscuro]);
  return [oscuro, setOscuro] as const;
}

export function Shell() {
  const { perfil, puede, salir, roles } = useSesion();
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [oscuro, setOscuro] = useTema();
  const { pathname } = useLocation();

  useEffect(() => setAbiertoMovil(false), [pathname]);
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscando(true); }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  const secciones = MENU.map((s) => ({ ...s, entradas: s.entradas.filter((e) => puede(e.modulo, e.nivel ?? 1)) }))
    .filter((s) => s.entradas.length);

  const menu = (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-5">
      <ItemMenu ruta={INICIO.ruta} texto={INICIO.texto} Icono={INICIO.icono} />
      {secciones.map((s) => (
        <div key={s.titulo}>
          <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-tenue/80">{s.titulo}</p>
          <div className="space-y-0.5">
            {s.entradas.map((e) => <ItemMenu key={e.ruta} ruta={e.ruta} texto={e.texto} Icono={e.icono} />)}
          </div>
        </div>
      ))}
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
        <header className="no-imprimir h-16 shrink-0 flex items-center gap-3 px-4 lg:px-8 border-b border-borde bg-superficie/80 backdrop-blur sticky top-0 z-30">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setAbiertoMovil(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <button
            onClick={() => setBuscando(true)}
            className="flex items-center gap-2 h-9 w-full max-w-md rounded-lg border border-borde bg-fondo px-3 text-sm text-tenue hover:border-marca/40"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Buscar cliente, equipo, componente, folio…</span>
            <kbd className="ml-auto hidden sm:inline text-[10px] border border-borde rounded px-1.5 py-0.5">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setOscuro(!oscuro)} className="p-2 rounded-lg hover:bg-fondo text-tenue" aria-label="Cambiar tema">
              {oscuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-borde">
              <div className="h-8 w-8 rounded-full bg-marca text-white text-xs font-semibold flex items-center justify-center">
                {perfil?.iniciales || perfil?.nombre?.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium max-w-[160px] truncate">{perfil?.nombre}</p>
                <p className="text-[11px] text-tenue capitalize">{roles.map((r) => r.replace("_", " ")).join(", ") || "sin rol"}</p>
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
    </div>
  );
}

function ItemMenu({ ruta, texto, Icono }: { ruta: string; texto: string; Icono: React.ComponentType<{ className?: string }> }) {
  return (
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
}

/** Encabezado estándar de cada página: título, contexto y acciones a la derecha. */
export function Pagina({ titulo, descripcion, acciones, children, ancho = "max-w-7xl" }: {
  titulo: React.ReactNode; descripcion?: React.ReactNode; acciones?: React.ReactNode; children: React.ReactNode; ancho?: string;
}) {
  return (
    <div className={cn("mx-auto px-4 lg:px-8 py-6 space-y-5", ancho)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          {descripcion && <p className="text-tenue mt-1">{descripcion}</p>}
        </div>
        {acciones && <div className="no-imprimir flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {children}
    </div>
  );
}

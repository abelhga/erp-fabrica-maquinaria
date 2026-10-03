// La campana del encabezado: lo que le pasó a algo que te importa, en vivo.
// Los avisos los crea la base (disparadores); aquí solo se leen y se marcan leídos.
// Reemplaza el "ya llegó", "ya está tu equipo", "¿alguna respuesta?" del chat.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as P from "@radix-ui/react-popover";
import { toast } from "sonner";
import {
  Bell, CheckCheck, CheckCircle2, ClipboardList, Factory, FileText, Inbox, PackageCheck, Scale, ShoppingCart,
  TimerReset, UserRound, Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { q } from "@/lib/consultas";
import { useSesion } from "@/lib/sesion";
import { hace } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

interface Aviso { id: number; tipo: string; titulo: string; cuerpo: string | null; ruta: string | null; leido_en: string | null; creado_en: string }

function icono(tipo: string) {
  if (tipo.startsWith("oc_")) return PackageCheck;
  if (tipo.startsWith("op_")) return Factory;
  if (tipo.startsWith("ajuste_")) return Scale;
  if (tipo.startsWith("cotizacion_")) return FileText;
  if (tipo.startsWith("requisicion_")) return ClipboardList;
  if (tipo.startsWith("pedido_")) return ShoppingCart;
  if (tipo === "cobro") return Wallet;
  if (tipo.startsWith("incidencia_")) return UserRound;
  if (tipo === "pendiente_hecho") return CheckCircle2;
  if (tipo.endsWith("_vencido") || tipo.endsWith("_atorada")) return TimerReset;
  return Inbox;
}

export function Campana() {
  const { perfil } = useSesion();
  const ir = useNavigate();
  const qc = useQueryClient();
  const avisos = useQuery({
    queryKey: ["avisos"],
    enabled: !!perfil,
    queryFn: () => q<Aviso[]>(supabase.from("avisos").select("id, tipo, titulo, cuerpo, ruta, leido_en, creado_en")
      .order("creado_en", { ascending: false }).limit(40)),
    refetchInterval: 5 * 60_000,
  });

  // En vivo: un aviso nuevo aparece en la campana y como notificación breve.
  useEffect(() => {
    if (!perfil) return;
    const canal = supabase.channel(`avisos-${perfil.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "avisos", filter: `usuario_id=eq.${perfil.id}` }, (p) => {
        const a = p.new as Aviso;
        qc.invalidateQueries({ queryKey: ["avisos"] });
        toast(a.titulo, { description: a.cuerpo ?? undefined, action: a.ruta ? { label: "Ver", onClick: () => ir(a.ruta!) } : undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [perfil, qc, ir]);

  const sinLeer = (avisos.data ?? []).filter((a) => !a.leido_en).length;
  const marcar = async (ids: number[] | null) => {
    await supabase.rpc("marcar_avisos_leidos", { p_ids: ids });
    qc.invalidateQueries({ queryKey: ["avisos"] });
  };

  return (
    <P.Root>
      <P.Trigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-fondo text-tenue" aria-label={`Avisos${sinLeer ? `: ${sinLeer} sin leer` : ""}`} title="Avisos">
          <Bell className="h-5 w-5" />
          {sinLeer > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-peligro text-white text-[10px] font-semibold grid place-items-center cifra animate-entrar">
              {sinLeer > 99 ? "99+" : sinLeer}
            </span>
          )}
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-24px))] tarjeta shadow-xl overflow-hidden animate-entrar">
          <div className="flex items-center justify-between px-4 h-12 border-b border-borde">
            <p className="font-semibold text-sm">Avisos</p>
            {sinLeer > 0 && (
              <button onClick={() => marcar(null)} className="text-xs text-marca-texto inline-flex items-center gap-1 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" />Marcar todo como leído
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {(avisos.data ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-tenue">
                <Inbox className="h-6 w-6 mx-auto mb-2 opacity-60" />
                Aquí te llega lo que pase con tus pedidos, órdenes y pendientes, sin tener que preguntar.
              </div>
            )}
            {(avisos.data ?? []).map((a) => {
              const I = icono(a.tipo);
              return (
                <P.Close asChild key={a.id}>
                  <button onClick={() => { if (!a.leido_en) marcar([a.id]); if (a.ruta) ir(a.ruta); }}
                    className={cn("w-full text-left flex gap-3 px-4 py-3 border-b border-borde/60 hover:bg-fondo transition-colors", !a.leido_en && "bg-marca-suave/40")}>
                    <div className={cn("h-8 w-8 shrink-0 rounded-lg grid place-items-center", a.leido_en ? "bg-fondo text-tenue" : "bg-marca-suave text-marca-texto")}>
                      <I className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm leading-snug", !a.leido_en && "font-semibold")}>{a.titulo}</p>
                      {a.cuerpo && <p className="text-xs text-tenue mt-0.5 line-clamp-2">{a.cuerpo}</p>}
                      <p className="text-[11px] text-tenue mt-1">{hace(a.creado_en)}</p>
                    </div>
                    {!a.leido_en && <span className="h-2 w-2 rounded-full bg-marca mt-1.5 shrink-0" />}
                  </button>
                </P.Close>
              );
            })}
          </div>
          <P.Close asChild>
            <button onClick={() => ir("/pendientes")} className="w-full h-11 text-sm text-marca-texto font-medium hover:bg-fondo">Ver mis pendientes</button>
          </P.Close>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

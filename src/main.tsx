import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ProveedorSesion } from "./lib/sesion";
import { ProveedorTutorial } from "./tutorial/preferencia";
import { App } from "./App";
import { aplicarTema, temaInicial } from "./lib/tema";
// La fuente va dentro de la app: la TV del taller no debe depender de Google Fonts.
import "@fontsource-variable/inter";
import "./index.css";

// Aplica el tema guardado antes del primer pintado para que no parpadee.
aplicarTema(temaInicial());
// Igual el modo tutorial: sin esto, lo explicable se marcaba un instante después de pintar.
try { document.documentElement.setAttribute("data-tutorial", String(localStorage.getItem("tutorial") === "si")); } catch { /* sin almacenamiento */ }

const cliente = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProveedorSesion>
          <ProveedorTutorial>
            <App />
            <Toaster richColors position="top-right" closeButton />
          </ProveedorTutorial>
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

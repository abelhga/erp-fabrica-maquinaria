import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ProveedorSesion } from "./lib/sesion";
import { App } from "./App";
import "./index.css";

// Aplica el tema guardado antes del primer pintado para que no parpadee.
try { if (localStorage.getItem("tema") === "oscuro") document.documentElement.classList.add("dark"); } catch { /* sin almacenamiento */ }

const cliente = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProveedorSesion>
          <App />
          <Toaster richColors position="top-right" closeButton />
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

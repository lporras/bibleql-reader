import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { attachExternalLinkHandling } from "./lib/externalLinks";
import "./styles/global.scss";

const queryClient = new QueryClient();

// Outbound links go to the user's browser, never an in-app navigation —
// see lib/externalLinks.ts (was the Electron main process's job).
attachExternalLinkHandling();

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing in index.html");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
);

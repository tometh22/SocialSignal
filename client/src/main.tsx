import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

if (import.meta.env.PROD) {
  const observe = () => void import("./lib/web-vitals").then(module => module.observeWebVitals()).catch(() => {});
  if ("requestIdleCallback" in window) window.requestIdleCallback(observe);
  else setTimeout(observe, 1000);
}

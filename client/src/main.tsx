import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, defaultQueryFn } from "./lib/queryClient";
import App from "./App";
import "./index.css";
// Importar script especial para Victoria
import "./login-victoria.js";

// Set default query function for react-query
queryClient.setDefaultOptions({
  queries: {
    queryFn: defaultQueryFn,
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
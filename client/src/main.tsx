import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QuoteProvider } from "./context/quote-context";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <QuoteProvider>
      <App />
    </QuoteProvider>
  </QueryClientProvider>
);

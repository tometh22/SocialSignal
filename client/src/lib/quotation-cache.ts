import type { QueryClient } from "@tanstack/react-query";

/** Lists, groups and analytics must change together after archive/restore. */
export function invalidateQuotationPortfolio(client: QueryClient) {
  return client.invalidateQueries({ predicate: query => {
    const path = query.queryKey[0];
    return typeof path === "string" && (path.startsWith("/api/quotations") || path.startsWith("/api/quotation-"));
  } });
}

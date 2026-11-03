import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ user: { id: 1, permissions: ["quotations"] }, status: "pending" }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-online-status", () => ({ useOnlineStatus: () => true }));
vi.mock("wouter", () => ({ useLocation: () => ["/optimized-quote/100", vi.fn()], useRoute: () => [true, { id: "100" }], Link: ({ children, href }: { children: ReactNode; href: string }) => React.createElement("a", { href }, children) }));
vi.mock("@/context/optimized-quote-context", () => ({
  OptimizedQuoteProvider: ({ children }: { children: ReactNode }) => children,
  useOptimizedQuote: () => ({ currentStep: 1, quotationData: { id: 100, status: fixture.status, quotationNumber: "COT-100", project: { name: "Cotización QA" } } }),
}));
import { CommercialWorkflowCard } from "../client/src/components/quotation/commercial-workflow-card";
import OptimizedQuote from "../client/src/pages/optimized-quote";

function render(child: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, queryFn: async () => null } } });
  client.setQueryData(["/api/quotations/100/commercial-history"], {
    quotation: { createdBy: 1, revisionNumber: 2, lockVersion: 4 },
    variants: [], deliveries: [], events: [], revisions: [{ id: 20, revisionNumber: 2 }],
    approvals: [{ id: 1, revisionId: 20, requestedBy: 1, status: "pending", ruleLabel: "Revisión obligatoria" }],
  });
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, child));
}
const withdrawalButton = /<button\b[^>]*>(?:(?!<\/button>).)*Retirar solicitud y editar<\/button>/s;
afterEach(() => { vi.unstubAllGlobals(); fixture.user = { id: 1, permissions: ["quotations"] }; fixture.status = "pending"; });

describe("pending quotation editing", () => {
  it("offers withdrawal to the requester without offering self approval", () => {
    const html = render(React.createElement(CommercialWorkflowCard, { quotationId: 100, status: "pending" }));
    expect(html).toMatch(withdrawalButton);
    expect(html).toContain("Debe decidir otra persona autorizada");
    expect(html).not.toContain(">Aprobar</button>");
  });
  it("restricts withdrawal to the creator, requester or approvers", () => {
    fixture.user = { id: 4, permissions: ["quotations"] };
    expect(render(React.createElement(CommercialWorkflowCard, { quotationId: 100, status: "pending" }))).not.toMatch(withdrawalButton);
    fixture.user = { id: 2, permissions: ["quotations", "operations"] };
    expect(render(React.createElement(CommercialWorkflowCard, { quotationId: 100, status: "pending" }))).toMatch(withdrawalButton);
  });
  it("uses a new revision for a sent quote and does not expose withdrawal", () => {
    const html = render(React.createElement(CommercialWorkflowCard, { quotationId: 100, status: "sent" }));
    expect(html).toContain("Nueva revisión");
    expect(html).not.toMatch(withdrawalButton);
  });
  it("shows approval actions before allowing edits of a blocked quotation", () => {
    vi.stubGlobal("window", { location: { search: "" } });
    const html = render(React.createElement(OptimizedQuote, { quotationId: 100 }));
    expect(html).toContain("Esta cotización está bloqueada para edición");
    expect(html).toMatch(withdrawalButton);
    expect(html).not.toContain("Guardar borrador");
    expect(html).not.toContain("Solicitar aprobación</button>");
  });
});

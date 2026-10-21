import { describe, expect, it } from "vitest";
import { approvalRevisionIsCurrent, canDecideQuotationApproval, quotationApprovalGuidance } from "../shared/utils/quotation-approval";

describe("commercial approval preserves existing approval gates", () => {
  it("permits existing approvers and administrators, with no self approval", () => {
    for (const user of [
      { id: 2, permissions: ["operations"] }, { id: 2, permissions: ["quotations_approve"] },
      { id: 2, isAdmin: true }, { id: 2, role: "admin" },
    ]) {
      expect(canDecideQuotationApproval(user, 1)).toBe(true);
      expect(canDecideQuotationApproval(user, 2)).toBe(false);
    }
    expect(canDecideQuotationApproval({ id: 2, permissions: ["quotations", "task_manager"] }, 1)).toBe(false);
    expect(canDecideQuotationApproval(null, 1)).toBe(false);
  });
  it("rejects requests belonging to older or missing revisions", () => {
    expect(approvalRevisionIsCurrent({ revisionId: 10 }, { id: 11 })).toBe(false);
    expect(approvalRevisionIsCurrent({ revisionId: 10 }, undefined)).toBe(false);
    expect(approvalRevisionIsCurrent({ revisionId: 11 }, { id: 11 })).toBe(true);
  });
  it("explains internal approval, sending and the client's final decision separately", () => {
    expect(quotationApprovalGuidance("draft")).toContain("solicitá");
    expect(quotationApprovalGuidance("pending")).toContain("distinta");
    expect(quotationApprovalGuidance("internally-approved")).toContain("falta la aceptación");
    expect(quotationApprovalGuidance("viewed")).toContain("elegir una alternativa");
    expect(quotationApprovalGuidance("approved")).toContain("final registrada");
  });
});

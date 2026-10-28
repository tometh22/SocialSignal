import { describe, expect, it } from "vitest";
import { documentPreviewKind, localDocumentPath } from "../client/src/lib/private-document";

describe("private document viewer boundaries", () => {
  it("keeps document fetches on the app origin, including legacy relative paths", () => {
    expect(localDocumentPath("/api/me/invoices/1/files/0", "https://mind.epical.digital")).toBe("/api/me/invoices/1/files/0");
    expect(localDocumentPath("https://mind.epical.digital/uploads/qa.pdf?version=2", "https://mind.epical.digital")).toBe("/uploads/qa.pdf?version=2");
    for (const url of ["https://outside.example/qa.pdf", "//outside.example/qa.pdf", "javascript:alert(1)", "data:text/html,qa", "blob:https://mind.epical.digital/qa"]) {
      expect(() => localDocumentPath(url, "https://mind.epical.digital")).toThrow();
    }
  });
  it("never embeds HTML, SVG, office documents or an unknown MIME as active content", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/xhtml+xml", "application/javascript", "application/octet-stream", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""]) {
      expect(documentPreviewKind(mime)).toBe("download");
    }
    expect(documentPreviewKind("application/pdf")).toBe("pdf");
    expect(documentPreviewKind("image/png")).toBe("image");
    expect(documentPreviewKind("image/jpeg")).toBe("image");
    expect(documentPreviewKind("image/webp")).toBe("image");
    expect(documentPreviewKind("text/plain; charset=utf-8")).toBe("text");
  });
});

import { describe, expect, it, vi } from "vitest";
import { sanitizeInput } from "../server/input-sanitization";

function runSanitizer(body: unknown) {
  const req = { body, query: {}, params: {} } as any;
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  sanitizeInput(req, response, next);
  return { req, response, next };
}

describe("input sanitization", () => {
  it("accepts normal meeting-minute prose without stripping its structure", () => {
    const minute = "Definir mercados; seleccionar fuentes y revisar el presupuesto.\nSiguiente paso: validar el alcance.";
    const result = runSanitizer({ internalMinute: minute });

    expect(result.next).toHaveBeenCalledOnce();
    expect(result.req.body.internalMinute).toBe(minute);
    expect(result.response.status).not.toHaveBeenCalled();
  });

  it("rejects an unambiguous SQL payload", () => {
    const result = runSanitizer({ brief: "hola; SELECT * FROM users" });

    expect(result.next).not.toHaveBeenCalled();
    expect(result.response.status).toHaveBeenCalledWith(400);
  });
});

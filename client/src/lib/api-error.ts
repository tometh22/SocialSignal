export type ApiErrorDetail = {
  path?: Array<string | number>;
  message?: string;
  code?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ApiErrorDetail[];
  readonly payload: unknown;

  constructor(
    status: number,
    message: string,
    errors: ApiErrorDetail[] = [],
    payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.payload = payload;
  }
}

export function parseApiError(status: number, responseText: string): ApiError {
  let payload: any = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    return new ApiError(status, responseText || "Error desconocido");
  }
  const message = typeof payload?.message === "string"
    ? payload.message
    : responseText || "Error desconocido";
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  return new ApiError(status, message, errors, payload);
}

function pathLabel(path: Array<string | number> | undefined): string {
  if (!path?.length) return "";
  const labels = path.map((part, index) => {
    if (typeof part === "number") {
      return index > 0 && path[index - 1] === "teamMembers"
        ? `integrante ${part + 1}`
        : String(part);
    }
    const known: Record<string, string> = {
      teamMembers: "Equipo",
      personnelId: "persona",
      roleId: "rol",
      hours: "horas",
      rate: "tarifa",
      cost: "costo",
      exchangeRateAtQuote: "cotización",
    };
    return known[part] ?? part;
  });
  return labels.join(" · ");
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado.",
): string {
  if (error instanceof ApiError) {
    const detailLines = error.errors
      .map((detail) => {
        const label = pathLabel(detail.path);
        const message = detail.message?.trim();
        if (!message) return null;
        return label ? `${label}: ${message}` : message;
      })
      .filter((line): line is string => Boolean(line));
    if (detailLines.length > 0) {
      return `${error.message}. ${detailLines.join(" ")}`;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

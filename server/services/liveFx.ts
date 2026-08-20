export type LiveBlueRate = {
  source: "DolarAPI" | "DolarHoy";
  buy: number;
  sell: number;
  updatedAt: string | null;
  fetchedAt: string;
};

export const parseArgentineNumber = (value: string): number => Number(
  value.replace(/\$/g, "").replace(/\./g, "").replace(",", ".").trim(),
);

export const parseDolarHoyDate = (value: string): string | null => {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[4]) % 12;
  if (match[6].toUpperCase() === "PM") hour += 12;
  // Dólar Hoy publishes Buenos Aires local time (UTC-3).
  return new Date(Date.UTC(2000 + Number(match[3]), Number(match[2]) - 1, Number(match[1]), hour + 3, Number(match[5]))).toISOString();
};

export function parseDolarHoyBlueHtml(html: string, fetchedAt = new Date()): LiveBlueRate {
  const sectionStart = html.indexOf("Dólar Libre");
  const section = sectionStart >= 0 ? html.slice(sectionStart, sectionStart + 1_500) : html;
  const quote = section.match(/Compra<\/div>\s*<div class="value">\$([^<]+)<\/div>[\s\S]*?Venta<\/div>\s*<div class="value">\$([^<]+)<\/div>/);
  const update = html.match(/Actualizado por última vez:\s*([^<]+)/i);
  const buy = quote ? parseArgentineNumber(quote[1]) : NaN;
  const sell = quote ? parseArgentineNumber(quote[2]) : NaN;
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) {
    throw new Error("No se pudo interpretar la cotización publicada por DolarHoy");
  }
  return {
    source: "DolarHoy",
    buy,
    sell,
    updatedAt: update ? parseDolarHoyDate(update[1]) : null,
    fetchedAt: fetchedAt.toISOString(),
  };
}

async function fetchDolarApiBlue(): Promise<LiveBlueRate> {
  const response = await fetch("https://dolarapi.com/v1/dolares/blue", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`DolarAPI respondió ${response.status}`);
  const payload = (await response.json()) as {
    venta?: number;
    compra?: number;
    fechaActualizacion?: string;
  };
  const buy = Number(payload.compra);
  const sell = Number(payload.venta);
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) {
    throw new Error("DolarAPI devolvió una cotización inválida");
  }
  return {
    source: "DolarAPI",
    buy,
    sell,
    updatedAt: payload.fechaActualizacion ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchDolarHoyBlue(): Promise<LiveBlueRate> {
  const response = await fetch("https://dolarhoy.com/cotizaciondolarblue", {
    headers: {
      accept: "text/html",
      "user-agent": "SocialSignal-FX-Verification/1.0",
    },
  });
  if (!response.ok) throw new Error(`DolarHoy respondió ${response.status}`);
  return parseDolarHoyBlueHtml(await response.text());
}

export async function fetchLiveBlueRates() {
  const checkedAt = new Date();
  const [apiResult, dolarHoyResult] = await Promise.allSettled([
    fetchDolarApiBlue(),
    fetchDolarHoyBlue(),
  ]);
  const dolarApi = apiResult.status === "fulfilled" ? apiResult.value : null;
  const dolarHoy = dolarHoyResult.status === "fulfilled" ? dolarHoyResult.value : null;
  if (!dolarApi && !dolarHoy) {
    throw new Error("No se pudo consultar ninguna fuente de dólar en vivo");
  }

  const ageHours = (rate: LiveBlueRate | null) => rate?.updatedAt
    ? Math.max(0, (checkedAt.getTime() - new Date(rate.updatedAt).getTime()) / 3_600_000)
    : Number.POSITIVE_INFINITY;
  const apiAgeHours = ageHours(dolarApi);
  const dolarHoyAgeHours = ageHours(dolarHoy);
  const difference = dolarApi && dolarHoy ? Math.abs(dolarApi.sell - dolarHoy.sell) : null;
  const differencePercentage = difference != null && dolarApi
    ? (difference / dolarApi.sell) * 100
    : null;
  const bothFresh = apiAgeHours <= 36 && dolarHoyAgeHours <= 36;
  const withinTolerance = differencePercentage != null && differencePercentage <= 2;
  const status = !dolarApi || !dolarHoy
    ? "partial"
    : !bothFresh
      ? "stale-source"
      : withinTolerance
        ? "matched"
        : "discrepancy";
  const recommended = dolarApi && (apiAgeHours <= dolarHoyAgeHours || !dolarHoy)
    ? dolarApi
    : dolarHoy!;

  return {
    checkedAt: checkedAt.toISOString(),
    status,
    difference,
    differencePercentage,
    recommended,
    sources: {
      dolarApi: dolarApi ? { ...dolarApi, ageHours: apiAgeHours } : null,
      dolarHoy: dolarHoy ? { ...dolarHoy, ageHours: dolarHoyAgeHours } : null,
    },
    errors: {
      dolarApi: apiResult.status === "rejected" ? String(apiResult.reason?.message ?? apiResult.reason) : null,
      dolarHoy: dolarHoyResult.status === "rejected" ? String(dolarHoyResult.reason?.message ?? dolarHoyResult.reason) : null,
    },
  };
}

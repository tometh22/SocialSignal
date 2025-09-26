export const f = {
  usd: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  usdCompact: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }),
  
  // 🚀 DUAL CURRENCY FORMATTERS: Support for ARS and USD
  ars: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0, currencyDisplay: "code" }),
  arsCompact: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", notation: "compact", maximumFractionDigits: 0, currencyDisplay: "code" }),
  
  // 🚀 SMART CURRENCY FORMATTER: Automatically choose ARS or USD based on currency
  currency(amount: number | null | undefined, currency: "ARS" | "USD" | null | undefined, compact: boolean = false) {
    if (amount == null || Number.isNaN(amount)) return "N/A";
    
    if (currency === "ARS") {
      return compact ? this.arsCompact.format(amount) : this.ars.format(amount);
    } else {
      // Default to USD for null/undefined currency or explicit "USD"
      return compact ? this.usdCompact.format(amount) : this.usd.format(amount);
    }
  },
  
  pct(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return "N/A";
    // si te llega 0–1, se asume fracción; si te llega 0–100, se asume porcentaje
    const frac = v > 1 ? v / 100 : v;
    const decimals = frac >= 1 ? 0 : 1;
    return `${(frac * 100).toFixed(decimals)}%`;
  },
  hours(h: number | null | undefined) {
    if (!h) return "0h";
    return h >= 1000 ? `${(h / 1000).toFixed(2)}k h` : `${Math.round(h)}h`;
  },
  markupX(ratio: number | null | undefined) {
    if (!ratio || ratio <= 0) return "N/A";
    return `${ratio.toFixed(ratio >= 10 ? 1 : 2)}×`;
  },
};
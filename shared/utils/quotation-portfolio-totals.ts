type PortfolioQuotation = {
  totalAmount: number; quotationCurrency: string | null;
  exchangeRateAtQuote?: number | string | null; usdExchangeRate?: number | string | null;
};

/** Convert each quote using its own snapshot before summing either currency. */
export function quotationPortfolioTotals(quotes: PortfolioQuotation[], fallbackFx: number) {
  let ars = 0, usd = 0, missingFx = 0;
  for (const quote of quotes) {
    const amount = Number(quote.totalAmount) || 0;
    const fx = [quote.exchangeRateAtQuote, quote.usdExchangeRate, fallbackFx]
      .map(Number).find(value => Number.isFinite(value) && value > 0);
    if (quote.quotationCurrency === "USD") {
      usd += amount;
      if (fx) ars += amount * fx; else missingFx++;
    } else {
      ars += amount;
      if (fx) usd += amount / fx; else missingFx++;
    }
  }
  return { ars, usd, missingFx };
}

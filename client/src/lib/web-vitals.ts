/** No URL, identifiers, text or business data leaves the page through telemetry. */
export async function observeWebVitals() {
  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import("web-vitals");
  const report = ({ name, value }: { name: string; value: number }) => {
    void fetch("/api/telemetry/vitals", { method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, value }) }).catch(() => {});
  };
  [onCLS, onINP, onLCP, onFCP, onTTFB].forEach(observe => observe(report));
}

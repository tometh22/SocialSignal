export function readPushDeviceToken(header?: string): string | null {
  const value = header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("mind_push_device="))
    ?.slice("mind_push_device=".length);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function isPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return false;
    return (
      url.hostname === "fcm.googleapis.com" ||
      url.hostname === "web.push.apple.com" ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

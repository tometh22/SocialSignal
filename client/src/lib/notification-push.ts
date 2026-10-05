import { authFetch } from "@/lib/queryClient";

function decodeApplicationServerKey(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function supportsWebPush() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

export async function enableWebPush(): Promise<void> {
  if (!supportsWebPush()) throw new Error("Este navegador no admite notificaciones en segundo plano.");

  // Request permission before the first await so the browser can associate it with the user's click.
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("El navegador no habilitó las notificaciones. Revisá los permisos de este sitio.");

  const keyResponse = await authFetch("/api/notifications/push/public-key");
  if (!keyResponse.ok) throw new Error("No pudimos preparar las notificaciones en segundo plano.");
  const { publicKey } = await keyResponse.json() as { publicKey: string | null };
  if (!publicKey) throw new Error("Falta configurar Web Push en el servidor.");

  const registration = await navigator.serviceWorker.register("/service-worker.js");
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(publicKey),
    });
  }

  const response = await authFetch("/api/notifications/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error("No pudimos vincular este dispositivo con tu cuenta.");
  }
}

export async function disableWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await authFetch("/api/notifications/push/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, Link2, Loader2, ShieldCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, authFetchJson, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { civilDate, dateTime } from "./ui";

const endpoint = "/api/crm/pipeline/share-links";
type ShareLink = {
  id: number;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdBy: string | null;
};
const expiryOptions = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: null, label: "Sin vencimiento" },
] as const;

/**
 * Enlaces de solo lectura del pipeline abierto, para compartir sin cuenta en Mind.
 * El enlace completo se muestra una sola vez: el servidor guarda solo su hash.
 */
export function ShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [label, setLabel] = useState("Fede");
  const [expiry, setExpiry] = useState<number | null>(30);
  const [created, setCreated] = useState<{ url: string; label: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const links = useQuery<ShareLink[]>({
    queryKey: [endpoint],
    queryFn: () => authFetchJson(endpoint),
    enabled: open,
  });
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
    } catch (e) {
      setError((e as Error).message || "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };
  const create = () =>
    run(async () => {
      const r = await apiRequest(endpoint, "POST", {
        label: label.trim(),
        expiresInDays: expiry,
      });
      setCreated({ url: `${window.location.origin}${r.path}`, label: r.label });
      setCopied(false);
    });
  const revoke = (id: number) =>
    run(async () => {
      await apiRequest(`${endpoint}/${id}`, "DELETE");
      setConfirming(null);
    });
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("No se pudo copiar. Seleccioná el enlace y copialo a mano.");
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setCreated(null);
          setConfirming(null);
          setError("");
        }
      }}
    >
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-4 w-4 text-slate-500" />
            Compartir pipeline
          </DialogTitle>
          <DialogDescription>
            Un enlace de solo lectura con la cartera abierta actualizada. No
            requiere cuenta en Mind y no muestra notas, evidencia, fuentes,
            contactos ni facturación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          {created ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                Enlace para {created.label} listo
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  aria-label="Enlace de solo lectura"
                  value={created.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 bg-white font-mono text-xs"
                />
                <Button
                  className="h-9 shrink-0 gap-2"
                  onClick={() => copy(created.url)}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-emerald-800/80">
                Copialo ahora: por seguridad no se vuelve a mostrar. Si lo
                perdés, revocalo y creá otro.
              </p>
              <Button
                variant="ghost"
                className="h-8 px-2 text-sm"
                onClick={() => setCreated(null)}
              >
                Crear otro enlace
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (label.trim()) void create();
              }}
            >
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-slate-700">
                  Para quién es
                </span>
                <Input
                  value={label}
                  maxLength={80}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej.: Fede"
                  className="h-9"
                  required
                />
              </label>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-slate-700">
                  Vencimiento
                </legend>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {expiryOptions.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={expiry === o.value}
                      onClick={() => setExpiry(o.value)}
                      className={cn(
                        "h-8 rounded-lg border px-3 text-sm font-medium transition-colors",
                        expiry === o.value
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : "border-border bg-card text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Button
                type="submit"
                className="h-9 gap-2"
                disabled={busy || !label.trim()}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Crear enlace
              </Button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold">Enlaces activos</p>
            {links.isLoading ? (
              <div className="mt-3 h-10 animate-pulse rounded-lg bg-slate-100" />
            ) : !links.data?.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Todavía no hay enlaces activos.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border">
                {links.data.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.label}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>
                          {l.expiresAt
                            ? `Vence ${civilDate(l.expiresAt)}`
                            : "Sin vencimiento"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {l.viewCount
                            ? `${l.viewCount} ${l.viewCount === 1 ? "vista" : "vistas"} · última ${dateTime(l.lastViewedAt!)}`
                            : "Sin abrir"}
                        </span>
                      </p>
                    </div>
                    {confirming === l.id ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="destructive"
                          className="h-8 px-2.5 text-xs"
                          disabled={busy}
                          onClick={() => void revoke(l.id)}
                        >
                          Revocar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Cancelar"
                          onClick={() => setConfirming(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-8 shrink-0 px-2.5 text-xs"
                        onClick={() => setConfirming(l.id)}
                      >
                        Revocar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

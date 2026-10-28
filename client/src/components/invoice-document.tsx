import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/queryClient";
import { getApiErrorMessage, parseApiError } from "@/lib/api-error";
import { documentPreviewKind, localDocumentPath, type DocumentPreviewKind } from "@/lib/private-document";
import { InvoicePdfPreview } from "./invoice-pdf-preview";

type Document = { fileUrl: string; fileName: string };
type Loaded = { url: string; kind: DocumentPreviewKind; bytes: Uint8Array; text?: string };

export function InvoiceDocument({ document, label = "Ver factura" }: { document: Document; label?: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setLoaded(null); setError(null);
    void (async () => {
      try {
        const response = await authFetch(localDocumentPath(document.fileUrl, window.location.origin), { signal: controller.signal, cache: "no-store", redirect: "error" });
        if (!response.ok) throw parseApiError(response.status, await response.text());
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        const mime = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "application/octet-stream";
        const kind = documentPreviewKind(mime);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: kind === "download" ? "application/octet-stream" : mime }));
        setLoaded({ url: objectUrl, kind, bytes, ...(kind === "text" ? { text: new TextDecoder().decode(bytes) } : {}) });
      } catch (failure) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(failure, "No se pudo abrir el comprobante. Reintentá la carga."));
      }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, document.fileUrl, attempt]);

  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><FileText className="mr-2 h-4 w-4" />{label}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="min-w-0 pr-6"><DialogTitle>Comprobante</DialogTitle><DialogDescription className="break-words">{document.fileName}</DialogDescription></DialogHeader>
        {loaded && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm"><p className="text-muted-foreground">Revisá el comprobante o descargá el original.</p><Button asChild size="sm" variant="outline"><a href={loaded.url} download={document.fileName}><Download className="mr-2 h-4 w-4" />Descargar original</a></Button></div>}
        {!loaded && !error && <div role="status" className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Cargando comprobante…</div>}
        {error && <div role="alert" className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Reintentar</Button></div>}
        {loaded?.kind === "pdf" && <InvoicePdfPreview bytes={loaded.bytes} />}
        {loaded?.kind === "image" && <div className="min-h-0 flex-1 overflow-auto rounded-md bg-slate-100 p-2"><img src={loaded.url} alt={`Comprobante: ${document.fileName}`} className="mx-auto h-auto max-w-full" onError={() => setError("No se pudo mostrar la imagen. Podés descargar el original.")} /></div>}
        {loaded?.kind === "text" && <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-100 p-4 text-sm">{loaded.text}</pre>}
        {loaded?.kind === "download" && <p className="rounded-md border bg-muted/30 p-4 text-sm">Este formato no tiene vista previa. Usá Descargar original para revisarlo.</p>}
      </DialogContent>
    </Dialog>
  </>;
}

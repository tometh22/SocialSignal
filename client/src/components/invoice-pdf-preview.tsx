import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Render pages as pixels, without native PDF plugins, annotations or document scripting. */
export function InvoicePdfPreview({ bytes }: { bytes: Uint8Array }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(680);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const previousRender = useRef<RenderTask | null>(null);

  useEffect(() => {
    let disposed = false;
    let task: PDFDocumentLoadingTask | undefined;
    setPdf(null); setPageNumber(1); setError(null); setRendering(true);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        task = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false, stopAtErrors: true, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
        const document = await task.promise;
        if (!disposed) setPdf(document);
      } catch {
        if (!disposed) { setError("No se pudo mostrar este PDF. Podés descargar el original para revisarlo."); setRendering(false); }
      }
    })();
    return () => { disposed = true; void task?.destroy().catch(() => undefined); };
  }, [bytes]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, Math.floor(entries[0].contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let disposed = false;
    let task: RenderTask | undefined;
    setRendering(true); setError(null);
    void (async () => {
      try {
        await previousRender.current?.promise.catch(() => undefined);
        const page = await pdf.getPage(pageNumber);
        if (disposed || !canvas.current) return;
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(width / original.width, 1.5) * zoom });
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const element = canvas.current;
        element.width = Math.ceil(viewport.width * scale); element.height = Math.ceil(viewport.height * scale);
        element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
        task = page.render({ canvas: element, viewport, transform: scale === 1 ? undefined : [scale, 0, 0, scale, 0, 0] });
        previousRender.current = task;
        await task.promise;
      } catch (failure: any) {
        if (!disposed && failure?.name !== "RenderingCancelledException") setError("No se pudo renderizar esta página. Podés descargar el original para revisarlo.");
      } finally { if (!disposed) setRendering(false); }
    })();
    return () => { disposed = true; task?.cancel(); };
  }, [pdf, pageNumber, width, zoom]);

  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1"><Button size="icon" variant="outline" aria-label="Página anterior" disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span aria-live="polite" className="px-2">Página {pageNumber} de {pdf?.numPages ?? "…"}</span><Button size="icon" variant="outline" aria-label="Página siguiente" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber(value => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
      <div className="flex items-center gap-1"><Button size="icon" variant="outline" aria-label="Reducir PDF" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))}><ZoomOut className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="Ampliar PDF" disabled={zoom >= 2.5} onClick={() => setZoom(value => Math.min(2.5, value + 0.25))}><ZoomIn className="h-4 w-4" /></Button></div>
    </div>
    {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    <div ref={container} className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md bg-slate-100 p-2 sm:p-4">
      {rendering && <p role="status" className="mb-2 flex items-center justify-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Preparando página…</p>}
      <canvas ref={canvas} aria-label={`Página ${pageNumber} del comprobante`} className={`mx-auto bg-white shadow-sm ${error ? "hidden" : ""}`} />
    </div>
  </div>;
}

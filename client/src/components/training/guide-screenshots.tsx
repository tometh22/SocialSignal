import { useRef, useState } from "react";
import { ImageIcon, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TrainingScreenshot } from "@shared/training";

function ScreenshotImage({
  screenshot,
  expanded = false,
  originalSize = false,
}: {
  screenshot: TrainingScreenshot;
  expanded?: boolean;
  originalSize?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed)
    return (
      <div
        role="status"
        className="space-y-2 p-4 text-sm text-muted-foreground"
      >
        <p>
          No pudimos cargar la captura. Las instrucciones siguen disponibles.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Reintentar imagen
        </Button>
      </div>
    );
  return (
    <img
      src={`${screenshot.src}${attempt ? `?retry=${attempt}` : ""}`}
      alt={screenshot.alt}
      width={screenshot.width}
      height={screenshot.height}
      loading={expanded ? "eager" : "lazy"}
      decoding="async"
      className={
        !expanded
          ? "h-52 w-full bg-muted/20 object-contain"
          : originalSize
            ? "max-w-none"
            : "h-auto w-full"
      }
      onError={() => setFailed(true)}
    />
  );
}

export function GuideScreenshots({
  screenshots,
}: {
  screenshots: TrainingScreenshot[];
}) {
  const opener = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<TrainingScreenshot | null>(null);
  const [originalSize, setOriginalSize] = useState(false);
  if (!screenshots.length) return null;
  return (
    <section aria-labelledby="guide-screenshots">
      <h2 id="guide-screenshots" className="text-lg font-semibold">
        Referencia visual
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Capturas de la app con datos de ejemplo. Ampliá la imagen para ver los
        campos.
      </p>
      <div
        className={`mt-4 grid gap-4 ${screenshots.length > 1 ? "sm:grid-cols-2" : "max-w-xl"}`}
      >
        {screenshots.map((screenshot) => (
          <figure
            key={screenshot.id}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <ScreenshotImage screenshot={screenshot} />
            <figcaption className="space-y-2 border-t p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Paso {screenshot.step}
              </p>
              <p className="text-sm leading-relaxed">{screenshot.caption}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setOriginalSize(false);
                  setSelected(screenshot);
                }}
                aria-label={`Ampliar captura: ${screenshot.alt}`}
              >
                <Maximize2 className="mr-2 h-4 w-4" aria-hidden="true" />{" "}
                Ampliar captura
              </Button>
            </figcaption>
          </figure>
        ))}
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className="flex max-h-[95dvh] max-w-[95vw] flex-col gap-3 sm:max-w-[95vw]"
        >
          {selected && (
            <>
              <DialogHeader className="pr-6 text-left">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />{" "}
                  Paso {selected.step}: {selected.alt}
                </DialogTitle>
                <DialogDescription>{selected.caption}</DialogDescription>
              </DialogHeader>
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                aria-pressed={originalSize}
                onClick={() => setOriginalSize((value) => !value)}
              >
                {originalSize ? (
                  <ZoomOut className="mr-2 h-4 w-4" aria-hidden="true" />
                ) : (
                  <ZoomIn className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {originalSize ? "Ajustar a la pantalla" : "Ver tamaño original"}
              </Button>
              <div
                className="min-h-0 overflow-auto rounded-lg border"
                role="region"
                aria-label="Captura ampliada"
                tabIndex={0}
              >
                <ScreenshotImage
                  key={selected.id}
                  screenshot={selected}
                  expanded
                  originalSize={originalSize}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { PipelineWorkspace } from "@/pages/crm-pipeline";
import { cardBase } from "@/components/pipeline/ui";
import { cn } from "@/lib/utils";

/** El token viaja en el fragmento (#t=…): no se envía al servidor con la URL ni en el Referer. */
const readToken = () =>
  new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t") ?? "";

function Message({
  title,
  description,
  loading = false,
}: {
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
      <div className={cn(cardBase, "max-w-md p-8 text-center")}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

/**
 * Pipeline compartido sin sesión: valida el enlace (y cuenta la vista) y abre
 * el mismo pipeline de Mind en modo solo lectura, con sus pestañas.
 */
export default function PublicPipelinePage() {
  const [token] = useState(readToken);
  useEffect(() => {
    // Vista privada aunque se comparta: que no la indexen ni filtren el enlace.
    const tags = [
      ["robots", "noindex, nofollow"],
      ["referrer", "no-referrer"],
    ].map(([name, content]) => {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    const previous = document.title;
    document.title = "Pipeline comercial · Mind";
    return () => {
      tags.forEach((t) => t.remove());
      document.title = previous;
    };
  }, []);
  const link = useQuery<{ label: string; expiresAt: string | null }>({
    queryKey: ["/api/public/pipeline", "open", token],
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch("/api/public/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "omit",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.message ?? "No pudimos abrir el pipeline.");
      return body;
    },
  });

  if (!token)
    return (
      <Message
        title="Enlace incompleto"
        description="Abrí el enlace completo que te compartieron. Si el problema sigue, pedí uno nuevo."
      />
    );
  if (link.isLoading)
    return (
      <Message
        loading
        title="Abriendo el pipeline…"
        description="Preparando la cartera comercial actualizada."
      />
    );
  if (link.error || !link.data)
    return (
      <Message
        title="No pudimos abrir el pipeline"
        description={
          (link.error as Error)?.message ??
          "El enlace no existe, venció o fue revocado."
        }
      />
    );
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <PipelineWorkspace
          share={{
            token,
            label: link.data.label,
            expiresAt: link.data.expiresAt,
          }}
        />
        <p className="pt-6 text-center text-xs text-muted-foreground">
          Vista de solo lectura compartida desde Mind · Epical. Los importes y
          probabilidades figuran solo cuando están respaldados por evidencia.
        </p>
      </div>
    </div>
  );
}

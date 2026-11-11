import { canonicalTrainingId } from "@shared/training-policy";
import { useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideScreenshots } from "@/components/training/guide-screenshots";
import { useAuth } from "@/hooks/use-auth";
import { useTrainingCatalog } from "@/hooks/use-training";
import { authFetchJson } from "@/lib/queryClient";
import { ApiError } from "@/lib/api-error";
import {
  canAccessTraining,
  type TrainingLesson,
  type TrainingSaveResult,
} from "@shared/training";

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR");

function LoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border p-6">
      <p className="mb-3">
        No pudimos cargar la guía. Revisá tu conexión e intentá nuevamente.
      </p>
      <Button variant="outline" onClick={retry}>
        Reintentar
      </Button>
    </div>
  );
}

// Connection errors can retain cached instructions, but revocations cannot.
function accessRejected(error: Error | null): boolean {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

function RefreshWarning({
  visible,
  retry,
}: {
  visible: boolean;
  retry: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="mx-auto mb-4 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p>
        No pudimos actualizar las guías. Mostramos la última información
        disponible.
      </p>
      <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
        Reintentar actualización
      </Button>
    </div>
  );
}

export default function TrainingPage() {
  const [, params] = useRoute("/training/:lessonId");
  const catalog = useTrainingCatalog();
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  if (catalog.isLoading)
    return (
      <p role="status" className="p-6">
        Cargando guías…
      </p>
    );
  if (!catalog.data || accessRejected(catalog.error))
    return <LoadError retry={() => void catalog.refetch()} />;
  const lessons = catalog.data.lessons;
  if (params?.lessonId) {
    const canonicalId = canonicalTrainingId(params.lessonId);
    const summary = lessons.find((l) => l.id === canonicalId);
    if (summary && canonicalId !== params.lessonId) return <Redirect to={`/training/${canonicalId}`} replace />;
    return summary ? (
      <>
        <RefreshWarning
          visible={catalog.isError}
          retry={() => void catalog.refetch()}
        />
        <LessonView
          key={`${summary.id}:${summary.version}`}
          lessonId={summary.id}
          audience={catalog.data.audience}
        />
      </>
    ) : (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Guía no disponible</h1>
        <p>
          Esta guía fue retirada, está pendiente de validación o no está habilitada para tu cuenta. Consultá el catálogo para ver las guías disponibles.
        </p>
        <Button asChild variant="outline">
          <Link href="/training">Volver a Capacitación</Link>
        </Button>
      </div>
    );
  }
  const modules = Array.from(new Set(lessons.map((l) => l.module)));
  const visible = lessons.filter(
    (l) =>
      (module === "all" || l.module === module) &&
      normalizeSearch(`${l.title} ${l.description} ${l.module}`).includes(
        normalizeSearch(search),
      ),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <RefreshWarning
        visible={catalog.isError}
        retry={() => void catalog.refetch()}
      />
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" aria-hidden="true" /> Guías de uso
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Capacitación</h1>
        <p className="mt-2 text-muted-foreground">
          Instrucciones paso a paso para las funciones que tenés habilitadas.
          Consultá lo que necesitás y volvé a tu trabajo.
        </p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-10"
            aria-label="Buscar capacitación"
            placeholder="Buscar una tarea o función: horas, facturas, ausencias…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          aria-label="Filtrar por área"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        >
          <option value="all">Todas tus áreas</option>
          {modules.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {visible.length} guías disponibles
      </p>
      {!visible.length && (
        <div className="rounded-lg border p-6">
          <p>No encontramos guías con esos filtros.</p>
          <Button
            variant="link"
            className="px-0"
            onClick={() => {
              setSearch("");
              setModule("all");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      )}
      {modules.map((name) => {
        const items = visible.filter((l) => l.module === name);
        if (!items.length) return null;
        return (
          <section key={name} aria-label={name}>
            <h2 className="mb-3 text-lg font-semibold">{name}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((l) => (
                <Link
                  key={l.id}
                  href={`/training/${l.id}`}
                  className="group flex items-start justify-between gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-medium group-hover:underline">
                      {l.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {l.description}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{l.minutes} min de lectura</span>
                      {l.needsUpdate ? (
                        <span>Guía actualizada</span>
                      ) : l.progress.completedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="h-3 w-3" aria-hidden="true" /> Leída
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LessonView({
  lessonId,
  audience,
}: {
  lessonId: string;
  audience: Parameters<typeof canAccessTraining>[0];
}) {
  const { user } = useAuth();
  const query = useQuery<TrainingLesson>({
    queryKey: ["training", user?.id, "lesson", lessonId],
    queryFn: () =>
      authFetchJson(`/api/training/lessons/${encodeURIComponent(lessonId)}`),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  if (query.isLoading) return <p role="status">Cargando guía…</p>;
  if (!query.data || accessRejected(query.error))
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost">
          <Link href="/training">Volver a Capacitación</Link>
        </Button>
        <LoadError retry={() => void query.refetch()} />
      </div>
    );
  if (!canAccessTraining(audience, query.data.access))
    return <p>Esta guía ya no está disponible para tu cuenta.</p>;
  return (
    <>
      <RefreshWarning
        visible={query.isError}
        retry={() => void query.refetch()}
      />
      <Guide key={`${lessonId}:${query.data.version}`} lesson={query.data} />
    </>
  );
}

function Guide({ lesson }: { lesson: TrainingLesson }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      authFetchJson<TrainingSaveResult>(
        `/api/training/lessons/${lesson.id}/progress`,
        {
          method: "PUT",
          body: JSON.stringify({ version: lesson.version, step: "learn" }),
        },
      ),
    onSuccess: (result) => {
      void client.invalidateQueries({
        queryKey: ["training", user?.id, "catalog"],
      });
      client.setQueryData<TrainingLesson>(
        ["training", user?.id, "lesson", lesson.id],
        (old) => (old ? { ...old, progress: result.progress } : old),
      );
    },
  });
  const read = Boolean(
    lesson.progress.completedAt || save.data?.progress.completedAt,
  );
  return (
    <article className="mx-auto max-w-3xl space-y-6 pb-8">
      <Link
        href="/training"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Todas las guías
      </Link>
      <header>
        <p className="text-sm text-muted-foreground">
          {lesson.module} · {lesson.minutes} min de lectura
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {lesson.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{lesson.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {lesson.links.map((link) => (
            <Button
              asChild
              key={link.href}
              variant="outline"
              className="h-auto whitespace-normal text-left"
            >
              <Link href={link.href}>
                {link.label}
                <ArrowRight
                  className="ml-2 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </Button>
          ))}
        </div>
      </header>
      <section aria-labelledby="guide-instructions" className="border-t pt-6">
        <h2 id="guide-instructions" className="text-lg font-semibold">
          Paso a paso
        </h2>
        <ol className="mt-4 list-decimal space-y-4 pl-6 marker:font-semibold marker:text-muted-foreground">
          {lesson.instructions.map((instruction, i) => (
            <li key={i} className="pl-2 leading-relaxed">
              {instruction}
            </li>
          ))}
        </ol>
      </section>
      <GuideScreenshots screenshots={lesson.screenshots ?? []} />
      <section
        className="rounded-lg border bg-muted/30 p-4"
        aria-labelledby="guide-verification"
      >
        <h2 id="guide-verification" className="text-base font-semibold">
          Aclaraciones y situaciones frecuentes
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed">{[...new Set([lesson.verification, ...lesson.explanation])].map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
      </section>
      <section aria-labelledby="guide-example">
        <h2 id="guide-example" className="text-base font-semibold">
          Ejemplo
        </h2>
        <p className="mt-2 text-sm leading-relaxed">{lesson.example}</p>
      </section>
      <footer className="border-t pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={save.isPending || read}
            onClick={() => save.mutate()}
          >
            {save.isPending
              ? "Guardando…"
              : read
                ? "Guía leída"
                : save.isError
                  ? "Reintentar guardado"
                  : "Marcar como leída"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Opcional. Solo guarda tu referencia de lectura.
          </span>
        </div>
        {save.isSuccess && (
          <p role="status" className="mt-3 text-sm">
            Guía marcada como leída en tu cuenta.
          </p>
        )}
        {save.isError && (
          <div role="alert" className="mt-3 space-y-1 text-sm text-red-700">
            <p>
              No se pudo guardar la marca de lectura. Podés reintentar o seguir
              consultando las guías.
            </p>
            <p>{save.error.message}</p>
          </div>
        )}
      </footer>
    </article>
  );
}

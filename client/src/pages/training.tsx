import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  useTrainingCatalog,
  useDismissTrainingInvitation,
} from "@/hooks/use-training";
import { authFetchJson } from "@/lib/queryClient";
import { ApiError } from "@/lib/api-error";
import {
  canAccessTraining,
  TRAINING_STEPS,
  type TrainingAnswer,
  type TrainingExercise,
  type TrainingLesson,
  type TrainingSaveResult,
  type TrainingStep,
} from "@shared/training";

const stepLabels: Record<TrainingStep, string> = {
  learn: "Aprendé",
  practice: "Practicá",
  check: "Comprobá",
};
const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR");

function LoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border p-6">
      <p className="mb-3">
        No pudimos cargar la capacitación. Revisá tu conexión e intentá
        nuevamente.
      </p>
      <Button variant="outline" onClick={retry}>
        Reintentar
      </Button>
    </div>
  );
}

// Cached content may survive a connection/server error, but never an explicit
// authentication, authorization or availability rejection from the server.
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
      className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p>
        No pudimos actualizar la capacitación. Conservamos tu respuesta en esta
        pantalla.
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
  const dismiss = useDismissTrainingInvitation();
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  if (catalog.isLoading)
    return (
      <p role="status" className="p-6">
        Cargando tu capacitación…
      </p>
    );
  if (!catalog.data || accessRejected(catalog.error))
    return <LoadError retry={() => void catalog.refetch()} />;
  const lessons = catalog.data.lessons;
  if (params?.lessonId) {
    const summary = lessons.find((l) => l.id === params.lessonId);
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
        <h1 className="text-2xl font-semibold">Lección no disponible</h1>
        <p>
          Esta lección no está disponible para tu cuenta o tus permisos
          cambiaron.
        </p>
        <Button asChild>
          <Link href="/training">Volver a Capacitación</Link>
        </Button>
      </div>
    );
  }
  const complete = lessons.filter((l) => l.progress.completedAt).length;
  const continuing =
    lessons.find((l) => !l.progress.completedAt && l.progress.updatedAt) ??
    lessons.find((l) => !l.progress.completedAt);
  const modules = Array.from(new Set(lessons.map((l) => l.module)));
  const visible = lessons.filter(
    (l) =>
      (module === "all" || l.module === module) &&
      normalizeSearch(`${l.title} ${l.description} ${l.module}`).includes(
        normalizeSearch(search),
      ),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8">
      <RefreshWarning
        visible={catalog.isError}
        retry={() => void catalog.refetch()}
      />
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <GraduationCap className="h-5 w-5" /> APRENDÉ CON MIND
        </div>
        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Capacitación
            </h1>
            <p className="mt-3 text-muted-foreground">
              Tu recorrido para trabajar con confianza. Explicaciones cortas,
              ejemplos y práctica, según las funciones que tenés habilitadas.
            </p>
            {continuing ? (
              <Button asChild className="mt-5 gap-2">
                <Link href={`/training/${continuing.id}`}>
                  Continuar aprendiendo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <p className="mt-5 font-medium text-emerald-700">
                Completaste tu recorrido. Podés repetir cualquier lección.
              </p>
            )}
          </div>
          <div className="w-full rounded-2xl border bg-white/80 p-5 md:w-64">
            <p className="text-sm text-muted-foreground">Tu avance personal</p>
            <p className="mt-1 text-3xl font-semibold">
              {complete}
              <span className="text-lg font-normal text-muted-foreground">
                {" "}
                / {lessons.length} lecciones
              </span>
            </p>
            <progress
              className="mt-3 h-2 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-indigo-100 [&::-webkit-progress-value]:bg-indigo-600 [&::-moz-progress-bar]:bg-indigo-600"
              max={Math.max(1, lessons.length)}
              value={complete}
              aria-label="Lecciones completadas"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Se guarda en tu cuenta para seguir desde otro dispositivo.
            </p>
          </div>
        </div>
        {!catalog.data.invitationDismissed && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-indigo-100 pt-4">
            <p className="text-xs text-muted-foreground">
              Siempre podés volver desde el menú o la ayuda.
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate()}
            >
              No volver a mostrar la invitación
            </Button>
            {dismiss.isError && (
              <span role="alert" className="text-sm text-red-700">
                No se guardó. Intentá nuevamente.
              </span>
            )}
          </div>
        )}
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-10"
            aria-label="Buscar capacitación"
            placeholder="¿Qué querés aprender? Buscá tareas, horas, facturas…"
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
        {visible.length} lecciones disponibles · Prácticas con datos ficticios
      </p>
      {!visible.length && (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p>No encontramos lecciones con esos filtros.</p>
          <Button
            variant="link"
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((l) => (
                <Card key={l.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-5 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {l.minutes} min
                      </span>
                      {l.progress.completedAt ? (
                        <Badge variant="secondary" className="text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Completada
                        </Badge>
                      ) : l.needsUpdate ? (
                        <Badge variant="secondary">
                          Actualización disponible
                        </Badge>
                      ) : l.progress.updatedAt ? (
                        <Badge variant="secondary">En curso</Badge>
                      ) : (
                        <span>Por descubrir</span>
                      )}
                    </div>
                    <h3 className="mt-3 font-semibold">{l.title}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">
                      {l.description}
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {l.progress.completedSteps.length} de 3 pasos
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-3 w-full justify-between"
                    >
                      <Link href={`/training/${l.id}`}>
                        {l.progress.completedAt
                          ? "Repasar lección"
                          : l.progress.updatedAt
                            ? "Continuar lección"
                            : "Empezar lección"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
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
  if (query.isLoading) return <p role="status">Cargando lección…</p>;
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
    return <p>Esta lección ya no está disponible para tu cuenta.</p>;
  return (
    <>
      <RefreshWarning
        visible={query.isError}
        retry={() => void query.refetch()}
      />
      <LessonPlayer
        key={`${lessonId}:${query.data.version}`}
        lesson={query.data}
      />
    </>
  );
}

function LessonPlayer({ lesson }: { lesson: TrainingLesson }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [step, setStep] = useState<TrainingStep>(
    () =>
      TRAINING_STEPS.find((s) => !lesson.progress.completedSteps.includes(s)) ??
      "learn",
  );
  const [answers, setAnswers] = useState(lesson.progress.answers);
  const [progress, setProgress] = useState(lesson.progress);
  const [feedback, setFeedback] = useState<
    TrainingSaveResult["feedback"] | null
  >(null);
  const [dirty, setDirty] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const save = useMutation({
    mutationFn: (input: { step: TrainingStep; answer?: TrainingAnswer }) =>
      authFetchJson<TrainingSaveResult>(
        `/api/training/lessons/${lesson.id}/progress`,
        {
          method: "PUT",
          body: JSON.stringify({ version: lesson.version, ...input }),
        },
      ),
    onSuccess: (result) => {
      setProgress(result.progress);
      setFeedback(result.feedback);
      setDirty(false);
      void client.invalidateQueries({
        queryKey: ["training", user?.id, "catalog"],
      });
      client.setQueryData<TrainingLesson>(
        ["training", user?.id, "lesson", lesson.id],
        (old) => (old ? { ...old, progress: result.progress } : old),
      );
    },
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const changeStep = (next: TrainingStep) => {
    setStep(next);
    setFeedback(null);
    save.reset();
    setDirty(false);
  };
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const answer = step === "learn" ? undefined : answers[step];
  const exercise = step === "learn" ? null : lesson[step];
  const currentIndex = TRAINING_STEPS.indexOf(step);
  const blockedNavigation = save.isPending || dirty || save.isError;
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <Button asChild variant="ghost" className="pl-0">
        <Link
          href="/training"
          onClick={(event) => {
            if (blockedNavigation) event.preventDefault();
          }}
          aria-disabled={blockedNavigation}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Todas las lecciones
        </Link>
      </Button>
      <div>
        <p className="text-sm font-medium text-indigo-700">
          {lesson.module} · {lesson.minutes} min
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {lesson.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{lesson.description}</p>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Práctica con datos ficticios. Tus respuestas no modifican proyectos,
        horas ni facturas reales.
      </div>
      <ol aria-label="Pasos de la lección" className="grid grid-cols-3 gap-2">
        {TRAINING_STEPS.map((s, i) => (
          <li key={s}>
            <button
              className={`flex w-full flex-wrap items-center justify-center gap-1 rounded-xl border px-2 py-3 text-sm ${s === step ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "bg-white text-muted-foreground"}`}
              aria-current={s === step ? "step" : undefined}
              disabled={blockedNavigation}
              onClick={() => changeStep(s)}
            >
              {progress.completedSteps.includes(s) ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <span>{i + 1}.</span>
              )}
              {stepLabels[s]}
            </button>
          </li>
        ))}
      </ol>
      <Card>
        <CardContent className="space-y-5 p-5 sm:p-7">
          <h2
            ref={heading}
            tabIndex={-1}
            className="flex items-center gap-2 text-xl font-semibold outline-none"
          >
            <BookOpen className="h-5 w-5 text-indigo-600" />
            {stepLabels[step]}
          </h2>
          {step === "learn" ? (
            <>
              <div className="space-y-4 leading-relaxed">
                {lesson.explanation.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="mb-2 font-semibold">Un ejemplo</h3>
                <p className="text-sm leading-relaxed">{lesson.example}</p>
              </div>
            </>
          ) : (
            exercise && (
              <Exercise
                key={step}
                exercise={exercise}
                value={answer}
                disabled={save.isPending}
                onChange={(value) => {
                  setAnswers((old) => ({ ...old, [step]: value }));
                  setFeedback(null);
                  setDirty(true);
                  save.reset();
                }}
              />
            )
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  step,
                  ...(step === "learn"
                    ? {}
                    : {
                        answer:
                          answer ??
                          (exercise?.kind === "order"
                            ? exercise.items.map((i) => i.id)
                            : ""),
                      }),
                })
              }
            >
              {save.isPending
                ? "Guardando…"
                : save.isError
                  ? "Reintentar guardado"
                  : step === "learn"
                    ? "Guardar explicación como leída"
                    : "Comprobar respuesta"}
            </Button>
            {dirty && (
              <span className="text-sm text-amber-800">
                Respuesta pendiente de guardar
              </span>
            )}
          </div>
          {save.isError && (
            <div
              role="alert"
              className="space-y-2 rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              <p>
                No se pudo guardar tu avance. Tu respuesta sigue en esta
                pantalla.
              </p>
              <p>{save.error.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnswers(progress.answers);
                  setDirty(false);
                  save.reset();
                }}
              >
                Descartar respuesta pendiente
              </Button>
            </div>
          )}
          {feedback && (
            <div
              role="status"
              className={`rounded-xl p-4 text-sm ${feedback.correct ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
            >
              <p className="font-semibold">
                {feedback.correct
                  ? "¡Bien! Avance guardado."
                  : "Revisemos la respuesta. Podés intentarlo nuevamente."}
              </p>
              <p className="mt-1">{feedback.explanation}</p>
            </div>
          )}
          <div className="flex justify-between border-t pt-4">
            <Button
              variant="ghost"
              disabled={currentIndex === 0 || blockedNavigation}
              onClick={() => changeStep(TRAINING_STEPS[currentIndex - 1])}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            {currentIndex < 2 && (
              <Button
                variant="outline"
                disabled={
                  !progress.completedSteps.includes(step) ||
                  blockedNavigation ||
                  feedback?.correct === false
                }
                onClick={() => changeStep(TRAINING_STEPS[currentIndex + 1])}
              >
                Siguiente
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {progress.completedAt && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-900">
            <CheckCircle2 className="h-5 w-5" />
            Lección completada
          </h2>
          <p className="mt-2 text-sm text-emerald-900">
            Tu avance está guardado. Repetir la lección conserva este logro.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild disabled={blockedNavigation}>
              <Link
                href="/training"
                onClick={(e) => {
                  if (blockedNavigation) e.preventDefault();
                }}
              >
                Seguir aprendiendo
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={blockedNavigation}
              onClick={() => {
                setAnswers({});
                changeStep("learn");
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Repetir lección
            </Button>
          </div>
        </section>
      )}
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">En la app</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Estos enlaces abren tus pantallas de trabajo reales.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {lesson.links.map((link) => (
            <Button
              asChild
              key={link.href}
              variant="link"
              className="h-auto whitespace-normal px-0 text-left"
            >
              <Link
                href={link.href}
                onClick={(event) => {
                  if (blockedNavigation) event.preventDefault();
                }}
                aria-disabled={blockedNavigation}
              >
                {link.label}
                <ArrowRight className="ml-1 h-4 w-4 shrink-0" />
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Exercise({
  exercise,
  value,
  onChange,
  disabled,
}: {
  exercise: TrainingExercise;
  value?: TrainingAnswer;
  onChange: (answer: TrainingAnswer) => void;
  disabled: boolean;
}) {
  if (exercise.kind === "choice")
    return (
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="mb-3 font-medium">{exercise.prompt}</legend>
        {exercise.options.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${value === option.id ? "border-indigo-500 bg-indigo-50" : ""}`}
          >
            <input
              className="mt-1 accent-indigo-600"
              type="radio"
              name="training-answer"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  if (exercise.kind === "form") {
    const fields =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-3 font-medium">{exercise.prompt}</legend>
        {exercise.fields.map((field) => (
          <div key={field.id}>
            <label
              htmlFor={`training-${field.id}`}
              className="mb-1 block text-sm font-medium"
            >
              {field.label}
            </label>
            <Input
              id={`training-${field.id}`}
              type={field.type === "number" ? "text" : field.type}
              inputMode={field.type === "number" ? "decimal" : undefined}
              autoComplete="off"
              placeholder={field.placeholder}
              value={fields[field.id] ?? ""}
              onChange={(e) =>
                onChange({ ...fields, [field.id]: e.target.value })
              }
            />
          </div>
        ))}
      </fieldset>
    );
  }
  const ids = Array.isArray(value) ? value : exercise.items.map((i) => i.id);
  const move = (index: number, delta: number) => {
    const result = [...ids];
    [result[index], result[index + delta]] = [
      result[index + delta],
      result[index],
    ];
    onChange(result);
  };
  return (
    <div className="space-y-3">
      <p className="font-medium">{exercise.prompt}</p>
      <p className="text-sm text-muted-foreground">
        Usá las flechas para ordenar los pasos.
      </p>
      <ol className="space-y-2">
        {ids.map((id, index) => (
          <li
            key={id}
            className="flex items-center gap-2 rounded-xl border p-3"
          >
            <span className="text-sm text-muted-foreground">{index + 1}.</span>
            <span className="flex-1 text-sm">
              {exercise.items.find((i) => i.id === id)?.label}
            </span>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled || index === 0}
              aria-label={`Subir paso ${index + 1}`}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={disabled || index === ids.length - 1}
              aria-label={`Bajar paso ${index + 1}`}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}

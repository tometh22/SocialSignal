import {
  Router,
  type Express,
  type Request,
  type RequestHandler,
} from "express";
import type { Pool } from "pg";
import path from "node:path";
import { trainingScreenshots } from "./content/training-media";
import { z } from "zod";
import { trainingLessons, publicLesson } from "./content/training-catalog";
import {
  canAccessTraining,
  emptyTrainingProgress,
  TRAINING_STEPS,
  type TrainingAudience,
  type TrainingProgress,
} from "../shared/training";

// Version 2 guides only record an optional read marker. No quiz payloads or
// client-selected ownership/completion flags are accepted.
export const trainingSubmissionSchema = z
  .object({
    version: z.number().int().positive(),
    step: z.literal("learn"),
  })
  .strict();

type ProgressRow = {
  lesson_id: string;
  version: number;
  state: Pick<TrainingProgress, "completedSteps" | "answers">;
  completed_at: Date | null;
  updated_at: Date;
};
function progressOf(row?: ProgressRow): TrainingProgress {
  return row
    ? {
        ...row.state,
        completedAt: row.completed_at?.toISOString() ?? null,
        updatedAt: row.updated_at.toISOString(),
      }
    : emptyTrainingProgress();
}

export function registerTrainingRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
) {
  const router = Router();
  router.use(requireAuth);
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const route = (
    method: "get" | "put",
    path: string,
    handler: RequestHandler,
  ) => {
    router[method](path, (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    });
  };
  async function audienceFor(req: Request): Promise<TrainingAudience> {
    const user = req.user!;
    const audience: TrainingAudience = {
      role: user.role,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
    };
    if (user.role === "external_provider") {
      const result = await pool.query<{ enabled: boolean }>(
        `SELECT EXISTS (
        SELECT 1 FROM external_providers p
        JOIN provider_project_access a ON a.provider_id=p.id
        JOIN active_projects project ON project.id=a.project_id
        WHERE p.user_id=$1 AND p.active AND p.personnel_id IS NOT NULL AND a.can_log_hours
          AND NOT COALESCE(project.is_finished, FALSE) AND project.closed_at IS NULL
      ) AS enabled`,
        [user.id],
      );
      audience.providerCanLogHours = result.rows[0].enabled;
    }
    return audience;
  }
  route("get", "/", async (req, res) => {
    const audience = await audienceFor(req);
    const [progress, preferences] = await Promise.all([
      pool.query<ProgressRow>(
        "SELECT * FROM training_progress WHERE user_id=$1",
        [req.user!.id],
      ),
      pool.query(
        "SELECT invitation_dismissed_at FROM training_preferences WHERE user_id=$1",
        [req.user!.id],
      ),
    ]);
    const lessons = trainingLessons
      .filter((l) => canAccessTraining(audience, l.access))
      .map((l) => {
        const current = progress.rows.find(
          (p) => p.lesson_id === l.id && p.version === l.version,
        );
        return {
          id: l.id,
          version: l.version,
          title: l.title,
          module: l.module,
          description: l.description,
          minutes: l.minutes,
          access: l.access,
          progress: progressOf(current),
          needsUpdate:
            !current?.completed_at &&
            progress.rows.some(
              (p) =>
                p.lesson_id === l.id && p.version < l.version && p.completed_at,
            ),
        };
      });
    res.json({
      audience,
      lessons,
      invitationDismissed: Boolean(
        preferences.rows[0]?.invitation_dismissed_at,
      ),
    });
  });
  route("put", "/invitation", async (req, res) => {
    if (
      !z
        .object({ dismissed: z.literal(true) })
        .strict()
        .safeParse(req.body).success
    ) {
      res.status(400).json({ message: "Solicitud inválida" });
      return;
    }
    await pool.query(
      `INSERT INTO training_preferences(user_id, invitation_dismissed_at) VALUES($1, NOW())
      ON CONFLICT(user_id) DO UPDATE SET invitation_dismissed_at=COALESCE(training_preferences.invitation_dismissed_at, EXCLUDED.invitation_dismissed_at)`,
      [req.user!.id],
    );
    res.json({ invitationDismissed: true });
  });
  route("get", "/lessons/:lessonId/media/:mediaId", async (req, res, next) => {
    const lesson = trainingLessons.find(
      (item) => item.id === req.params.lessonId,
    );
    if (!lesson || !canAccessTraining(await audienceFor(req), lesson.access)) {
      res.status(404).json({ message: "Captura no disponible." });
      return;
    }
    const screenshot = trainingScreenshots[lesson.id]?.find(
      (item) => item.id === req.params.mediaId,
    );
    if (!screenshot) {
      res.status(404).json({ message: "Captura no disponible." });
      return;
    }
    // Only authored filenames can reach sendFile. Never interpolate request paths.
    const root = path.resolve(
      import.meta.dirname,
      process.env.NODE_ENV === "production"
        ? "training-media"
        : "content/training-media",
    );
    res.sendFile(
      screenshot.fileName,
      { root, cacheControl: false, dotfiles: "deny" },
      (error) => {
        if (!error) return;
        if (
          !res.headersSent &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          res.status(404).json({ message: "Captura no disponible." });
          return;
        }
        next(error);
      },
    );
  });
  route("get", "/lessons/:lessonId", async (req, res) => {
    const lesson = trainingLessons.find((l) => l.id === req.params.lessonId);
    if (!lesson || !canAccessTraining(await audienceFor(req), lesson.access)) {
      res
        .status(404)
        .json({ message: "Esta guía no está disponible para tu cuenta." });
      return;
    }
    const progress = await pool.query<ProgressRow>(
      "SELECT * FROM training_progress WHERE user_id=$1 AND lesson_id=$2",
      [req.user!.id, lesson.id],
    );
    const current = progress.rows.find((p) => p.version === lesson.version);
    res.json({
      ...publicLesson(lesson),
      progress: progressOf(current),
      needsUpdate:
        !current?.completed_at &&
        progress.rows.some((p) => p.version < lesson.version && p.completed_at),
    });
  });
  route("put", "/lessons/:lessonId/progress", async (req, res) => {
    const lesson = trainingLessons.find((l) => l.id === req.params.lessonId);
    if (!lesson || !canAccessTraining(await audienceFor(req), lesson.access)) {
      res
        .status(404)
        .json({ message: "Esta guía no está disponible para tu cuenta." });
      return;
    }
    const parsed = trainingSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Revisá los datos de la solicitud." });
      return;
    }
    if (parsed.data.version !== lesson.version) {
      res.status(409).json({
        message:
          "La guía se actualizó. Volvé a abrirla para consultar la versión vigente.",
      });
      return;
    }
    const { step } = parsed.data;
    const feedback = { correct: true, explanation: "Guía marcada como leída." };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO training_progress(user_id,lesson_id,version) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [req.user!.id, lesson.id, lesson.version],
      );
      const {
        rows: [row],
      } = await client.query<ProgressRow>(
        "SELECT * FROM training_progress WHERE user_id=$1 AND lesson_id=$2 AND version=$3 FOR UPDATE",
        [req.user!.id, lesson.id, lesson.version],
      );
      const completedSteps = TRAINING_STEPS.filter(
        (s) =>
          row.state.completedSteps.includes(s) ||
          (s === step && feedback.correct),
      );
      const state = {
        completedSteps,
        answers: row.state.answers,
      };
      const result = await client.query<ProgressRow>(
        `UPDATE training_progress SET state=$4::jsonb, updated_at=NOW(),
        completed_at=COALESCE(completed_at, CASE WHEN $5 THEN NOW() ELSE NULL END)
        WHERE user_id=$1 AND lesson_id=$2 AND version=$3 RETURNING *`,
        [
          req.user!.id,
          lesson.id,
          lesson.version,
          JSON.stringify(state),
          completedSteps.includes("learn"),
        ],
      );
      await client.query("COMMIT");
      res.json({ progress: progressOf(result.rows[0]), feedback });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  app.use("/api/training", router);
}

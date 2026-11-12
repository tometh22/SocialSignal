import { createHash, randomBytes } from "node:crypto";
import { Router, type Express, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { pool } from "../db";
import { requirePermission } from "../middleware/requirePermission";
import { canSeeQuotations } from "./access";
import {
  applyFilters,
  audit,
  currentRows,
  listRows,
  pipelineFilters,
  transaction,
} from "./routes";
import {
  executiveSummary,
  localDay,
  periodSchema,
  summarize,
} from "../../shared/pipeline";
import {
  createShareLinkSchema,
  isSharedUniverse,
  publicRow,
  publicShareRequestSchema,
  shareTokenHeader,
  shareTokenSchema,
} from "../../shared/pipeline-share";

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const notFound = () =>
  Object.assign(new Error("El enlace no existe, venció o fue revocado."), {
    status: 404,
  });
const noStore: RequestHandler = (_req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  });
  next();
};
// El enlace público expone toda la cartera abierta: solo puede emitirlo quien ya la ve completa.
const requireFullPipeline: RequestHandler = (req: any, res, next) =>
  canSeeQuotations(req.user)
    ? next()
    : res.status(403).json({
        message:
          "Necesitás acceso a cotizaciones para compartir la cartera completa.",
      });
const linkColumns = `l.id, l.label, l.created_at AS "createdAt", l.expires_at AS "expiresAt",
  l.revoked_at AS "revokedAt", l.last_viewed_at AS "lastViewedAt", l.view_count AS "viewCount",
  concat_ws(' ', u.first_name, u.last_name) AS "createdBy"`;

export function registerPipelineShareRoutes(
  app: Express,
  requireAuth: RequestHandler,
) {
  const wrap =
    (fn: (req: any, res: any) => Promise<any>): RequestHandler =>
    (req, res) => {
      void fn(req, res).catch((e) => {
        if (!e.status) console.error("Pipeline share:", e.message);
        res.status(e.status ?? (e.name === "ZodError" ? 400 : 500)).json({
          message: e.status
            ? e.message
            : e.name === "ZodError"
              ? "Datos inválidos"
              : "No se pudo procesar el enlace",
        });
      });
    };

  const admin = Router();
  admin.use(
    requireAuth,
    requirePermission("crm"),
    requireFullPipeline,
    noStore,
  );
  admin.get(
    "/",
    wrap(async (_req, res) => {
      const { rows } = await pool.query(
        `SELECT ${linkColumns} FROM pipeline_share_links l LEFT JOIN users u ON u.id=l.created_by
         WHERE l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > NOW())
         ORDER BY l.id DESC LIMIT 50`,
      );
      res.json(rows);
    }),
  );
  admin.post(
    "/",
    wrap(async (req, res) => {
      const body = createShareLinkSchema.parse(req.body);
      const token = randomBytes(32).toString("hex");
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86_400_000)
        : null;
      const link = await transaction(async (c) => {
        const r = await c.query(
          `INSERT INTO pipeline_share_links(label, token_hash, created_by, expires_at)
           VALUES($1,$2,$3,$4) RETURNING id, label, created_at AS "createdAt", expires_at AS "expiresAt"`,
          [body.label, digest(token), req.user.id, expiresAt],
        );
        await audit(
          c,
          req.user.id,
          "enlace público",
          `Enlace de solo lectura para ${body.label}`,
          { label: body.label, expiresAt },
        );
        return r.rows[0];
      });
      // El token viaja en el fragmento: no llega a los logs de acceso ni al Referer.
      res
        .status(201)
        .json({ ...link, path: `/pipeline/compartido#t=${token}` });
    }),
  );
  admin.delete(
    "/:id",
    wrap(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      await transaction(async (c) => {
        const r = await c.query(
          "UPDATE pipeline_share_links SET revoked_at=NOW(), revoked_by=$2 WHERE id=$1 AND revoked_at IS NULL RETURNING label",
          [id, req.user.id],
        );
        if (!r.rowCount) throw notFound();
        await audit(
          c,
          req.user.id,
          "enlace público",
          `Enlace revocado: ${r.rows[0].label}`,
          { label: r.rows[0].label },
        );
      });
      res.status(204).end();
    }),
  );
  app.use("/api/crm/pipeline/share-links", admin);

  // Abrir el enlace: valida y cuenta una vista. Límite bajo contra fuerza bruta.
  const openLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Demasiados intentos. Volvé a intentar en unos minutos.",
    },
  });
  // Navegar las pestañas hace varias consultas por clic: límite más amplio.
  const dataLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 900,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Demasiadas consultas. Volvé a intentar en unos minutos.",
    },
  });
  const activeLink = async (token: unknown) => {
    const parsed = shareTokenSchema.safeParse(token);
    if (!parsed.success) throw notFound();
    const { rows } = await pool.query(
      `SELECT id, label, expires_at FROM pipeline_share_links
       WHERE token_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
      [digest(parsed.data)],
    );
    if (!rows[0]) throw notFound();
    return rows[0] as { id: number; label: string; expires_at: Date | null };
  };
  // POST para que el token no quede en la URL registrada por el servidor.
  app.post(
    "/api/public/pipeline",
    noStore,
    openLimit,
    wrap(async (req, res) => {
      const parsed = publicShareRequestSchema.safeParse(req.body);
      if (!parsed.success) throw notFound();
      const link = await activeLink(parsed.data.token);
      await pool.query(
        "UPDATE pipeline_share_links SET view_count=view_count+1, last_viewed_at=NOW() WHERE id=$1",
        [link.id],
      );
      res.json({
        label: link.label,
        expiresAt: link.expires_at
          ? new Date(link.expires_at).toISOString()
          : null,
      });
    }),
  );

  const shared = Router();
  shared.use(noStore, dataLimit, (req: any, res, next) => {
    void activeLink(req.get(shareTokenHeader))
      .then(() => next())
      .catch(() =>
        res
          .status(404)
          .json({ message: "El enlace no existe, venció o fue revocado." }),
      );
  });
  // La cartera vigente, siempre (sin cortes guardados) y solo el pipeline comercial.
  const selection = async (req: any) => {
    const f = pipelineFilters.parse({ ...req.query, snapshotId: undefined });
    const threshold = Number(
      (await pool.query("SELECT threshold FROM pipeline_settings WHERE id=1"))
        .rows[0]?.threshold ?? 50,
    );
    const at = new Date().toISOString();
    return {
      f,
      at,
      threshold,
      // Sin contacto: la búsqueda pública no puede usarse para inferirlo.
      rows: applyFilters(
        (await currentRows())
          .filter(isSharedUniverse)
          .map((r) => ({ ...r, contact: null })),
        f,
      ),
    };
  };
  shared.get(
    "/summary",
    wrap(async (req, res) => {
      const s = await selection(req);
      res.json(summarize(s.rows, localDay(new Date(s.at)), s.threshold));
    }),
  );
  for (const endpoint of ["/opportunities", "/alerts"])
    shared.get(
      endpoint,
      wrap(async (req, res) => {
        const s = await selection(req);
        const list = listRows(
          s.rows,
          s.f,
          s.at,
          s.threshold,
          endpoint === "/alerts",
        );
        res.json({ ...list, rows: list.rows.map(publicRow) });
      }),
    );
  shared.get(
    "/executive-summary",
    wrap(async (req, res) => {
      const s = await selection(req);
      const period = req.query.period
        ? periodSchema.parse(req.query.period)
        : localDay().slice(0, 7);
      // El Status es el texto pensado para compartir: incluye las decisiones del
      // período, nunca información financiera ni del corte interno.
      const decisions = (
        await pool.query(
          "SELECT reason FROM pipeline_log WHERE period=$1 AND kind='decisión' ORDER BY id",
          [period],
        )
      ).rows.map((r) => r.reason);
      res.json({
        text: executiveSummary(
          s.rows,
          period,
          s.at,
          s.threshold,
          "Pendiente",
          decisions,
        ),
      });
    }),
  );
  app.use("/api/public/pipeline", shared);
}

import { z } from "zod";

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  beforeId: z.coerce.number().int().positive().optional(),
});

/** Explicit opt-in keeps existing integration contracts intact during migration. */
export function readPage(query: Record<string, unknown>) {
  return query.limit !== undefined ? pageSchema.parse(query) : null;
}

export function cursorPage<T extends { id: number }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

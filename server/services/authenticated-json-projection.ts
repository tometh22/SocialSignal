import type { Request, Response } from "express";

/** Authentication can run in a later route guard. Inspect its result at send time. */
export function authenticatedJsonProjection(
  req: Request,
  res: Response,
  shouldProject: (request: Request) => boolean,
  project: (body: unknown) => unknown,
) {
  const sendJson = res.json.bind(res);
  res.json = ((body?: unknown) => sendJson(shouldProject(req) ? project(body) : body)) as typeof res.json;
}

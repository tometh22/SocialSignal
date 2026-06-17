// routes/project.ts
//
// La ruta GET /api/projects/:id/complete-data se movió a `completeDataHandler`
// (server/routes/complete-data.ts) y se registra en routes/index.ts y routes.ts.
// El handler que vivía aquí quedó como ruta duplicada y fue eliminado.
//
// Se conserva el export `projectRouter` (router vacío) para no romper imports
// existentes hasta que se limpie por completo.

import { Router } from 'express';

const router = Router();

export { router as projectRouter };

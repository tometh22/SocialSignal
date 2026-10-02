import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const routes = fs.readFileSync(new URL('../server/routes.ts', import.meta.url), 'utf8');
describe('recoverable project archives', () => {
  it('excludes archived projects from the unlogged-task reminders while retaining real hour history', () => {
    const start = routes.indexOf('const tasksWithoutHoursResult =');
    const reminders = routes.slice(start, routes.indexOf('res.json({', start));
    expect(reminders).toContain("AND ap.status NOT IN ('voided', 'cancelled')");
    const totals = routes.slice(routes.indexOf('const projectHoursResult ='), start);
    expect(totals).not.toContain("ap.status NOT IN ('voided', 'cancelled')");
  });
  for (const route of ['/api/tasks', '/api/tasks/my-tasks', '/api/tasks/team-calendar']) {
    it(`excludes voided and cancelled projects from ${route}`, () => {
      const start = routes.indexOf(`app.get("${route}",`);
      const body = routes.slice(start, routes.indexOf('\n  });', start));
      expect(body).toContain("WHERE status NOT IN ('voided', 'cancelled')");
      expect(body).toContain(route.includes('my-tasks') ? '[assignmentConditions, archivedProjectFilter]' : 'if (!projectId) conditions.push(archivedProjectFilter)');
    });
  }
});

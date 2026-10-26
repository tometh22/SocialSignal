import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { approvedAbsenceRanges, countWorkdays } from "../shared/utils/available-hours";
import { upcomingBirthdays } from "../shared/utils/birthdays";
import { assignCalendarLanes } from "../shared/utils/calendar-lanes";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Feedback 9-10 — horas disponibles", () => {
  const holidays = new Set(["2026-10-12"]);

  it("cuenta días hábiles de octubre 2026 descontando el feriado", () => {
    expect(countWorkdays("2026-10-01", "2026-10-31", holidays).workdays).toBe(21);
  });

  it("sólo resta ausencias aprobadas de la persona, no las de otros ni las no aprobadas", () => {
    const absences = [
      { personnelId: 7, startDate: "2026-10-05", endDate: "2026-10-06", status: "approved" },
      { personnelId: 7, startDate: "2026-10-13", endDate: "2026-10-14", status: "pending" },
      { personnelId: 7, startDate: "2026-10-19", endDate: "2026-10-20", status: "rejected" },
      { personnelId: 7, startDate: "2026-10-21", endDate: "2026-10-22", status: "cancelled" },
      { personnelId: 9, startDate: "2026-10-26", endDate: "2026-10-30", status: "approved" },
    ];
    const ranges = approvedAbsenceRanges(absences, 7);
    expect(ranges).toEqual([{ start: "2026-10-05", end: "2026-10-06" }]);
    const { workdays, absentWorkdays } = countWorkdays("2026-10-01", "2026-10-31", holidays, ranges);
    expect(absentWorkdays).toBe(2);
    expect((workdays - absentWorkdays) * 6).toBe(114);
  });

  it("incluye el último día del rango y no cuenta fines de semana ni feriados como ausencia", () => {
    const { workdays, absentWorkdays } = countWorkdays("2026-10-09", "2026-10-13", holidays, [{ start: "2026-10-09", end: "2026-10-13" }]);
    expect(workdays).toBe(2); // vie 9 y mar 13
    expect(absentWorkdays).toBe(2);
  });

  it("el endpoint legacy filtra por personnelId y el panel usa el helper", () => {
    expect(source("server/routes.ts")).toMatch(/req\.query\.personnelId[\s\S]{0,200}row\.personnelId === personnelId/);
    expect(source("client/src/pages/hours-dashboard.tsx")).toContain("approvedAbsenceRanges(absencesData, Number(selectedPersonnelId))");
  });
});

describe("Feedback 9-10 — Inicio y cumpleaños", () => {
  it("devuelve los próximos cumpleaños aunque falten más de 30 días", () => {
    const today = new Date(2026, 9, 14);
    const list = upcomingBirthdays([
      { name: "A", month: 9, day: 21 }, { name: "B", month: 12, day: 1 }, { name: "C", month: 1, day: 5 }, { name: "D", month: 5, day: 2 },
    ], today, 366);
    expect(list.slice(0, 3).map((e) => e.name)).toEqual(["B", "C", "D"]);
  });

  it("Inicio muestra 3 cumpleaños sin horizonte de 30 días", () => {
    const home = source("client/src/pages/home-dashboard.tsx");
    expect(home).toContain("upcomingBirthdays(teamBirthdays, new Date(), 366).slice(0, 3)");
    expect(home).not.toContain("new Date(), 30)");
  });
});

describe("Feedback 9-10 — calendarios, tareas y capacidad", () => {
  it("el calendario repite el título en cada día en lugar de dibujar barras", () => {
    const calendar = source("client/src/components/tasks/TaskCalendarView.tsx");
    expect(calendar).not.toContain("getRangeInfo");
    expect(calendar).not.toContain("roundLeft");
  });

  it("los íconos de asignación y fecha no dependen del hover y las completadas se arrastran", () => {
    const list = source("client/src/components/tasks/ProjectTaskList.tsx");
    expect(list).not.toContain("text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-accent");
    expect(list).toContain('data-testid="task-assign-empty"');
    const completed = list.slice(list.indexOf("completedTasks.map(t => `task:${t.id}`)"));
    expect(completed.slice(0, 600)).toContain("<SortableTaskRow");
  });

  it("Capacidad contrae proyectos y deja la estimación junto a la tarea", () => {
    const capacity = source("client/src/pages/capacity-dashboard.tsx");
    expect(capacity).toContain('data-testid="capacity-project-toggle"');
    expect(capacity).toContain("collapsedProjects");
    expect(capacity).not.toContain('className="flex-1 truncate text-foreground">{t.title}');
  });
});

describe("Feedback 9-10 — ausencias", () => {
  it("la solicitud conserva el estado de planificación elegido", () => {
    const routes = source("server/routes.ts");
    expect(routes).toContain('status: "pending", planningStatus: data.planningStatus');
    expect(routes).not.toContain('status: "pending", planningStatus: "tentative"');
    expect(source("client/src/pages/personnel-absences.tsx")).toContain('data-testid="absence-planning-status"');
  });

  it("la tabla de saldos muestra las columnas pedidas", () => {
    const page = source("client/src/pages/personnel-absences.tsx");
    for (const header of ["Vac. cupo/año", "Vac. traslado", "Vac. adelanto", "Días Epical cupo", "Usados vacaciones", "Usados días Epical", "Disponible total", "Disponible vacaciones", "Disponible Epical", "Enfermedad", "Otros"]) {
      expect(page).toContain(`>${header}</th>`);
    }
  });
});

describe("Feedback 9-10 — solo cumpleaños", () => {
  it("la tabla es aditiva y la migración se ejecuta al iniciar", () => {
    const sql = source("migrations/0084_birthday_entries.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS birthday_entries");
    expect(sql).not.toMatch(/\bDROP\b|DELETE FROM|ALTER TABLE personnel/i);
    expect(source("server/migrations/birthday-entries.ts")).toContain("CREATE TABLE IF NOT EXISTS birthday_entries");
    expect(source("server/index.ts")).toContain("birthdayEntriesMigrationSql");
  });

  it("el CRUD exige permiso admin y /api/birthdays suma los cumpleaños sueltos sin exponer el año", () => {
    const routes = source("server/routes.ts");
    for (const verb of ["get", "post", "delete"]) {
      expect(routes).toMatch(new RegExp(`app\\.${verb}\\("/api/birthday-entries[^"]*", requireAuth, requirePermission\\("admin"\\)`));
    }
    expect(routes).toContain("from(birthdayEntries)");
    expect(routes).toMatch(/birthdays\.push\(\{ name: row\.name, \.\.\.parsed \}\)/);
  });

  it("Configuración > Personal ofrece la sección Solo cumpleaños", () => {
    expect(source("client/src/pages/admin-fixed.tsx")).toContain("<BirthdayOnlyEntries />");
    expect(source("client/src/components/admin/birthday-only-entries.tsx")).toContain("Solo cumpleaños");
  });
});

describe("Feedback 9-10 — filas estables en calendarios", () => {
  const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

  it("una tarea de varios días conserva la misma fila aunque otras empiecen o terminen", () => {
    const lanes = assignCalendarLanes([
      { id: 1, startDate: "2026-10-12", dueDate: "2026-10-16" },
      { id: 2, startDate: "2026-10-13", dueDate: "2026-10-13" },
      { id: 3, startDate: "2026-10-14", dueDate: "2026-10-18" },
      { id: 4, startDate: "2026-10-15", dueDate: "2026-10-15" },
    ], week);
    expect(lanes.get(1)).toBe(0);
    expect(lanes.get(2)).toBe(1);
    expect(lanes.get(3)).toBe(1); // reutiliza la fila liberada por la tarea 2
    expect(lanes.get(4)).toBe(2);
  });

  it("las tareas que vienen de la semana anterior toman primero las filas bajas", () => {
    const lanes = assignCalendarLanes([
      { id: 10, startDate: "2026-10-12", dueDate: "2026-10-12" },
      { id: 11, startDate: "2026-10-05", dueDate: "2026-10-14" },
    ], week);
    expect(lanes.get(11)).toBe(0);
    expect(lanes.get(10)).toBe(1);
  });

  it("ignora tareas fuera de la semana o sin fecha y usa la única fecha disponible", () => {
    const lanes = assignCalendarLanes([
      { id: 1, startDate: "2026-09-01", dueDate: "2026-09-02" },
      { id: 2 },
      { id: 3, dueDate: "2026-10-16" },
    ], week);
    expect([...lanes.keys()]).toEqual([3]);
  });

  it("el calendario usa los carriles y mantiene alto fijo por fila", () => {
    const calendar = source("client/src/components/tasks/TaskCalendarView.tsx");
    expect(calendar).toContain("assignCalendarLanes(dated");
    expect(calendar).toContain('className="h-[24px]"');
    expect(calendar).toContain("overflow.shift()");
  });
});

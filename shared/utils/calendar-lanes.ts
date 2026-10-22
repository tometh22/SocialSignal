export type LaneTask = { id: number; startDate?: string | null; dueDate?: string | null };

const key = (value?: string | null) => (value ? value.slice(0, 10) : null);

/**
 * Asigna a cada tarea una fila ("carril") fija dentro de una semana de 7 días (`YYYY-MM-DD`),
 * de modo que una tarea de varios días ocupe la misma fila de lunes a domingo y no salte de
 * posición entre un día y otro. Las que vienen de semanas anteriores (inicio más temprano)
 * toman primero los carriles más bajos para que la continuidad se mantenga entre semanas.
 */
export function assignCalendarLanes(tasks: LaneTask[], weekDays: string[]): Map<number, number> {
  const spans = tasks.flatMap((task) => {
    const start = key(task.startDate) ?? key(task.dueDate);
    const end = key(task.dueDate) ?? key(task.startDate);
    if (!start || !end) return [];
    const covered = weekDays.flatMap((day, index) => (day >= start && day <= end ? [index] : []));
    if (!covered.length) return [];
    return [{ id: task.id, start, startIdx: covered[0], endIdx: covered[covered.length - 1] }];
  });
  spans.sort((a, b) => a.startIdx - b.startIdx || a.start.localeCompare(b.start) || (b.endIdx - b.startIdx) - (a.endIdx - a.startIdx) || a.id - b.id);

  const laneEnds: number[] = [];
  const lanes = new Map<number, number>();
  for (const span of spans) {
    let lane = laneEnds.findIndex((end) => end < span.startIdx);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = span.endIdx;
    lanes.set(span.id, lane);
  }
  return lanes;
}

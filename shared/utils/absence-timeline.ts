const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
export function absenceTimelineRange(year: number, month: number | null = null) {
  const from = `${year}-${String(month ?? 1).padStart(2, "0")}-01`;
  const end = month == null ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1));
  const to = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
  return { from, to, days: dayNumber(to) - dayNumber(from) + 1 };
}
export function absenceTimelineBars<T extends { startDate: string; endDate: string }>(rows: T[], range: ReturnType<typeof absenceTimelineRange>) {
  const lanes: number[] = [];
  return [...rows].filter(row => row.startDate <= range.to && row.endDate >= range.from).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate)).map(row => {
    const start = dayNumber(row.startDate < range.from ? range.from : row.startDate);
    const end = dayNumber(row.endDate > range.to ? range.to : row.endDate);
    let lane = lanes.findIndex(last => last < start);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = end;
    return { row, lane, left: (start - dayNumber(range.from)) / range.days * 100, width: (end - start + 1) / range.days * 100 };
  });
}

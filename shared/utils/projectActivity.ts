export function isProjectCreatedRecently(
  createdAt: string | null | undefined,
  selectedMonth: string,
  maxMonths = 2,
): boolean {
  if (!createdAt || !/^\d{4}-\d{2}/.test(createdAt) || !/^\d{4}-\d{2}$/.test(selectedMonth)) {
    return false;
  }
  const createdMonth = createdAt.substring(0, 7);
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const [createdYear, createdMonthNumber] = createdMonth.split("-").map(Number);
  const monthDistance =
    (selectedYear - createdYear) * 12 + (selectedMonthNumber - createdMonthNumber);
  return monthDistance >= 0 && monthDistance <= maxMonths;
}

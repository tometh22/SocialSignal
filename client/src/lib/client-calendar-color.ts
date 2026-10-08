const PALETTE = [
  "bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  "bg-violet-100 border-violet-500 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
  "bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  "bg-orange-100 border-orange-500 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  "bg-pink-100 border-pink-500 text-pink-900 dark:bg-pink-950 dark:text-pink-100",
  "bg-teal-100 border-teal-500 text-teal-900 dark:bg-teal-950 dark:text-teal-100",
  "bg-indigo-100 border-indigo-500 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100",
  "bg-amber-100 border-amber-500 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
];
export function clientCalendarColor(clientId?: number | null): string {
  return clientId == null ? "bg-slate-100 border-slate-400 text-slate-800 dark:bg-slate-900 dark:text-slate-100" : PALETTE[Math.abs(clientId) % PALETTE.length];
}

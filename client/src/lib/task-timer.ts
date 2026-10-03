import { roundToMinute } from "./task-hours";
export const TIMER_STORAGE_KEY = "epical_active_timer";
export const TIMER_CHANGE_EVENT = "epical:task-timer-change";
export interface TimerData { taskId: number; taskTitle: string; personnelId: number | null; startTime: string }

export function getStoredTimer(): TimerData | null {
  try {
    const data = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) ?? "null");
    return data && Number.isSafeInteger(data.taskId) && data.taskId > 0 && typeof data.taskTitle === "string"
      && (data.personnelId == null || Number.isSafeInteger(data.personnelId) && data.personnelId > 0)
      && typeof data.startTime === "string" && Number.isFinite(new Date(data.startTime).getTime()) ? data : null;
  } catch { return null; }
}

export function writeStoredTimer(data: TimerData | null) {
  if (data) localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(data));
  else localStorage.removeItem(TIMER_STORAGE_KEY);
  // 'storage' fires in other tabs only. Notify all hook instances here too.
  window.dispatchEvent(new Event(TIMER_CHANGE_EVENT));
}

export function calcElapsed(startTime: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000)) || 0;
}

export const timerHours = (seconds: number) => roundToMinute(seconds / 3600);

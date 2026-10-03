import { useState, useEffect, useCallback } from "react";

import { TIMER_STORAGE_KEY as STORAGE_KEY, TIMER_CHANGE_EVENT, getStoredTimer, writeStoredTimer, calcElapsed, timerHours, type TimerData } from "@/lib/task-timer";

interface UseActiveTimerReturn {
  isRunning: boolean;
  activeTaskId: number | null;
  elapsedSeconds: number;
  timerData: Omit<TimerData, "startTime"> | null;
  startTimer: (taskId: number, taskTitle: string, personnelId: number | null) => void;
  stopTimer: () => { hours: number; taskId: number; personnelId: number | null; taskTitle: string } | null;
  cancelTimer: () => void;
}

export function useActiveTimer({ trackElapsed = true }: { trackElapsed?: boolean } = {}): UseActiveTimerReturn {
  const [timerData, setTimerData] = useState<TimerData | null>(() => getStoredTimer());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const stored = getStoredTimer();
    return stored ? calcElapsed(stored.startTime) : 0;
  });

  useEffect(() => {
    if (!timerData) {
      setElapsedSeconds(0);
      return;
    }
    if (!trackElapsed) return;
    const id = setInterval(() => {
      setElapsedSeconds(calcElapsed(timerData.startTime));
    }, 1000);
    return () => clearInterval(id);
  }, [timerData, trackElapsed]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const next = getStoredTimer();
        setTimerData(next);
        setElapsedSeconds(next ? calcElapsed(next.startTime) : 0);
      }
    };
    const onLocalChange = () => { const next = getStoredTimer(); setTimerData(next); setElapsedSeconds(next ? calcElapsed(next.startTime) : 0); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(TIMER_CHANGE_EVENT, onLocalChange);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(TIMER_CHANGE_EVENT, onLocalChange); };
  }, []);

  const startTimer = useCallback((taskId: number, taskTitle: string, personnelId: number | null) => {
    const data: TimerData = {
      taskId,
      taskTitle,
      personnelId,
      startTime: new Date().toISOString(),
    };
    writeStoredTimer(data);
    setTimerData(data);
    setElapsedSeconds(0);
  }, []);

  const stopTimer = useCallback(() => {
    const stored = getStoredTimer();
    if (!stored) return null;
    const elapsed = calcElapsed(stored.startTime);
    const hours = timerHours(elapsed);
    writeStoredTimer(null);
    setTimerData(null);
    setElapsedSeconds(0);
    return { hours, taskId: stored.taskId, personnelId: stored.personnelId, taskTitle: stored.taskTitle };
  }, []);

  const cancelTimer = useCallback(() => {
    writeStoredTimer(null);
    setTimerData(null);
    setElapsedSeconds(0);
  }, []);

  return {
    isRunning: !!timerData,
    activeTaskId: timerData?.taskId ?? null,
    elapsedSeconds,
    timerData: timerData
      ? { taskId: timerData.taskId, taskTitle: timerData.taskTitle, personnelId: timerData.personnelId }
      : null,
    startTimer,
    stopTimer,
    cancelTimer,
  };
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

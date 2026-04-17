import { createContext, useContext } from "react";
import type { ReviewRoomDetail } from "@/lib/review-api";

export type ReviewRoomContextValue = {
  roomId: number;
  room: ReviewRoomDetail | null;
  myRole: 'owner' | 'editor';
  isOwner: boolean;
  canEdit: boolean;
};

export const ReviewRoomContext = createContext<ReviewRoomContextValue | null>(null);

export function useReviewRoom(): ReviewRoomContextValue {
  const ctx = useContext(ReviewRoomContext);
  if (!ctx) throw new Error("useReviewRoom debe usarse dentro de un ReviewRoomProvider");
  return ctx;
}

export function useMaybeReviewRoom(): ReviewRoomContextValue | null {
  return useContext(ReviewRoomContext);
}

const LS_KEY = 'lastReviewRoomId';
export function getLastReviewRoomId(): number | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? parseInt(v, 10) || null : null;
  } catch { return null; }
}
export function setLastReviewRoomId(id: number) {
  try { localStorage.setItem(LS_KEY, String(id)); } catch {}
}

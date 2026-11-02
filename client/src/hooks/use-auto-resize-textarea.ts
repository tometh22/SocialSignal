import { useEffect, useRef } from "react";

// Grow to fit until the user explicitly chooses a height with the resize handle.
export function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  enabled: boolean = true,
  maxPx: number = 320,
  resetKey?: string,
) {
  const lastAutoSize = useRef<{ element: HTMLTextAreaElement; height: string; key?: string } | null>(null);
  useEffect(() => {
    if (!enabled) { lastAutoSize.current = null; return; }
    const el = ref.current;
    if (!el) return;
    const previous = lastAutoSize.current;
    // Native resizing changes the inline height. Keep that choice while typing.
    if (previous?.element === el && previous.key === resetKey && el.style.height !== previous.height) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = 'auto';
    lastAutoSize.current = { element: el, height: el.style.height, key: resetKey };
  }, [ref, value, enabled, maxPx, resetKey]);
}


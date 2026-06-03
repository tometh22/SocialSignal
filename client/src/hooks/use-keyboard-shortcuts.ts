import { useEffect } from "react";

type ShortcutMap = {
  [key: string]: (e: KeyboardEvent) => void;
};

/**
 * Registers global keyboard shortcuts.
 * Key format: "ctrl+k", "meta+k", "escape", etc.
 * Skips when focus is inside an input/textarea/select/contenteditable.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, options?: { allowInInputs?: boolean }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!options?.allowInInputs) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        const isEditable = (e.target as HTMLElement)?.isContentEditable;
        if (tag === "input" || tag === "textarea" || tag === "select" || isEditable) return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("ctrl");
      if (e.metaKey) parts.push("meta");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      parts.push(e.key.toLowerCase());

      const chord = parts.join("+");

      if (shortcuts[chord]) {
        shortcuts[chord](e);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, options?.allowInInputs]);
}

export type StatusSource = { title: string; text: string; projectId?: number; path: string };
export const statusProjectDraftKey = "review:project-draft";

export function statusSourcePath(text: string | null | undefined) {
  return /^Status: (\/review\/\d+\?item=[pc]_\d+)$/m.exec(text ?? "")?.[1];
}

export function loadStatusProjectDraft(): StatusSource | null {
  if (!new URLSearchParams(window.location.search).has("fromStatus")) return null;
  try {
    const draft = JSON.parse(sessionStorage.getItem(statusProjectDraftKey) ?? "null");
    return typeof draft?.title === "string" && typeof draft.text === "string" && typeof draft.path === "string"
      && statusSourcePath(`Status: ${draft.path}`) === draft.path ? draft : null;
  } catch {
    return null;
  }
}

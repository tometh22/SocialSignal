export const TASK_PROJECT_ROLES = ["owner", "pm", "analyst", "datatech", "setup", "member"] as const;
export const isTaskProjectManager = (role: string | null | undefined) => role === "owner" || role === "pm";

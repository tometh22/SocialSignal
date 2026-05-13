export const TASK_STATUS_CONFIG = {
  todo:        { label: "Por hacer",   color: "bg-gray-100 text-gray-700 border-gray-200",       dot: "bg-gray-400",    icon: "Circle" },
  in_progress: { label: "En curso",    color: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500",    icon: "Timer" },
  in_review:   { label: "En revisión", color: "bg-violet-50 text-violet-700 border-violet-200",   dot: "bg-violet-500",  icon: "Eye" },
  blocked:     { label: "Bloqueado",   color: "bg-orange-50 text-orange-700 border-orange-200",   dot: "bg-orange-500",  icon: "OctagonAlert" },
  done:        { label: "Completada",  color: "bg-green-50 text-green-700 border-green-200",      dot: "bg-green-500",   icon: "CheckCircle2" },
  cancelled:   { label: "Cancelada",   color: "bg-red-50 text-red-500 border-red-200",            dot: "bg-red-400",     icon: "X" },
} as const;

export type TaskStatus = keyof typeof TASK_STATUS_CONFIG;

export const BOARD_STATUS_COLUMNS: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

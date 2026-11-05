export const TRAINING_SECTIONS = [
  "crm",
  "quotations",
  "projects",
  "status",
  "dashboard",
  "finance",
  "admin",
  "operations",
  "task_manager",
] as const;
export type TrainingSection = (typeof TRAINING_SECTIONS)[number];
export type TrainingAudience = {
  role?: string | null;
  isAdmin?: boolean | null;
  permissions?: readonly string[] | null;
  providerCanLogHours?: boolean;
};
export type TrainingAccess = {
  audience: "authenticated" | "internal" | "provider";
  any?: readonly TrainingSection[];
  all?: readonly TrainingSection[];
  providerCanLogHours?: boolean;
};

/** Same section semantics as usePermissions, with provider isolation first. */
export function canAccessTraining(
  user: TrainingAudience | null | undefined,
  access: TrainingAccess,
): boolean {
  if (!user) return false;
  const provider = user.role === "external_provider";
  if (access.audience === "provider")
    return (
      provider &&
      (!access.providerCanLogHours || user.providerCanLogHours === true)
    );
  if (access.audience === "authenticated") return true;
  if (provider) return false;
  const admin = user.isAdmin === true || user.role === "admin";
  const has = (section: TrainingSection) =>
    admin || Boolean(user.permissions?.includes(section));
  return (
    (!access.any || access.any.some(has)) &&
    (!access.all || access.all.every(has))
  );
}

export type TrainingExercise =
  | { kind: "choice"; prompt: string; options: { id: string; label: string }[] }
  | { kind: "order"; prompt: string; items: { id: string; label: string }[] }
  | {
      kind: "form";
      prompt: string;
      fields: {
        id: string;
        label: string;
        type: "text" | "number" | "date";
        placeholder?: string;
      }[];
    };
export type TrainingAnswer = string | string[] | Record<string, string>;
export const TRAINING_STEPS = ["learn", "practice", "check"] as const;
export type TrainingStep = (typeof TRAINING_STEPS)[number];
export type TrainingProgress = {
  completedSteps: TrainingStep[];
  answers: Partial<Record<TrainingStep, TrainingAnswer>>;
  completedAt: string | null;
  updatedAt: string | null;
};
export type TrainingLessonSummary = {
  id: string;
  version: number;
  module: string;
  title: string;
  description: string;
  minutes: number;
  access: TrainingAccess;
  progress: TrainingProgress;
  needsUpdate: boolean;
};
export type TrainingLesson = TrainingLessonSummary & {
  explanation: string[];
  example: string;
  practice: TrainingExercise;
  check: TrainingExercise;
  links: { label: string; href: string }[];
};
export type TrainingCatalog = {
  audience: TrainingAudience;
  invitationDismissed: boolean;
  lessons: TrainingLessonSummary[];
};
export type TrainingSaveResult = {
  progress: TrainingProgress;
  feedback: { correct: boolean; explanation: string };
};
export function emptyTrainingProgress(): TrainingProgress {
  return {
    completedSteps: [],
    answers: {},
    completedAt: null,
    updatedAt: null,
  };
}

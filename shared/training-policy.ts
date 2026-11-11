/** Old guide URLs remain meaningful without reintroducing retired navigation. */
export const TRAINING_ALIASES: Readonly<Record<string, string>> = {
  "finanzas-proyecto": "cartera",
  entregables: "cartera",
};
export function canonicalTrainingId(id: string): string {
  return Object.prototype.hasOwnProperty.call(TRAINING_ALIASES, id) ? TRAINING_ALIASES[id] : id;
}
export function isPublishedTrainingGuide(lesson: { id: string; module: string }): boolean {
  return lesson.module !== "Finanzas" && !["objetivos", "tarifas-servicios"].includes(lesson.id)
    && canonicalTrainingId(lesson.id) === lesson.id;
}

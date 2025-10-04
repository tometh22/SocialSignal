export function canonicalizeKey(x: string): string {
  return (x || "").trim().toLowerCase();
}

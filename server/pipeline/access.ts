import type { Opportunity } from "../../shared/pipeline";
export function canSeeQuotations(user: any) {
  return (
    user?.isAdmin === true ||
    user?.role === "admin" ||
    user?.permissions?.includes("quotations")
  );
}
export function visibleRows(rows: Opportunity[], user: any) {
  return canSeeQuotations(user)
    ? rows
    : rows.filter(
        (r) =>
          !r.quotationId &&
          !r.quotationGroupId &&
          !r.sources.some((s) => s.kind === "quotation"),
      );
}

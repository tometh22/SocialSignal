export function absenceNotificationDestination(audience: "operations" | "person") {
  return audience === "operations" ? "/operations/absences" : "/absences";
}

export function settlementReviewDestination(period: string) {
  return `/operations/monthly-closing?period=${encodeURIComponent(period)}`;
}

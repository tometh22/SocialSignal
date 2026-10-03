import { estimateBlueprintWorkload, workloadForBillingPeriod, type BlueprintDefinition } from '../quotation-professional';
import { resolveQuotationBlueprintRole } from './personnel-classification';
type ScopeRole = { id: number; name: string; roleLevel?: string | null; area?: string | null; isActive?: boolean };
type ScopeMember = { roleId: number; hours: number; rate: number; roleName?: string };
export function quotationTeamForScope<T extends ScopeMember>(scope: BlueprintDefinition, team: T[], roles: ScopeRole[]): T[] {
  const workload = workloadForBillingPeriod(scope, estimateBlueprintWorkload(scope));
  const targets = new Map<number, number>();
  for (const [key, hours] of Object.entries(workload.byRole)) {
    const role = resolveQuotationBlueprintRole(key, roles, scope.roleProfiles[key]);
    if (role) targets.set(role.id, (targets.get(role.id) ?? 0) + hours);
  }
  const hoursByIndex = new Map<number, number>();
  for (const roleId of new Set(team.map(member => member.roleId))) {
    const peers = team.map((member, index) => ({ member, index })).filter(item => item.member.roleId === roleId);
    const target = targets.get(roleId) ?? 0;
    const base = peers.reduce((sum, item) => sum + item.member.hours, 0);
    let remaining = target;
    peers.forEach(({ member, index }, position) => {
      const hours = position === peers.length - 1 ? remaining : Math.min(remaining, Math.round(target * (base > 0 ? member.hours / base : 1 / peers.length) * 2) / 2);
      hoursByIndex.set(index, hours); remaining -= hours;
    });
  }
  return team.map((member, index) => ({ ...member, hours: hoursByIndex.get(index) ?? 0, cost: (hoursByIndex.get(index) ?? 0) * member.rate }));
}

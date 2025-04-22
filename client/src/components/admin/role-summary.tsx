import { useQuery } from "@tanstack/react-query";
import { TemplateRoleAssignment, Role } from "@shared/schema";

interface RoleSummaryProps {
  templateId: number;
  showCosts?: boolean;
}

export function RoleSummary({ templateId, showCosts = false }: RoleSummaryProps) {
  const { data: templateRoleAssignments, isLoading } = useQuery<(TemplateRoleAssignment & { role: Role })[]>({
    queryKey: [`/api/template-roles/${templateId}/with-roles`],
    enabled: !!templateId,
  });
  
  if (isLoading) {
    return <div className="text-xs text-slate-500">Cargando equipo...</div>;
  }
  
  if (!templateRoleAssignments || templateRoleAssignments.length === 0) {
    return <div className="text-xs text-slate-500">Sin roles asignados</div>;
  }
  
  // Agrupar roles por tipo
  const roleGroups: Record<string, { count: number, totalHours: number, totalCost: number }> = {};
  
  templateRoleAssignments.forEach(assignment => {
    const roleName = assignment.role.name;
    const hours = parseFloat(assignment.hours);
    const cost = hours * assignment.role.defaultRate;
    
    if (!roleGroups[roleName]) {
      roleGroups[roleName] = { count: 0, totalHours: 0, totalCost: 0 };
    }
    
    roleGroups[roleName].count++;
    roleGroups[roleName].totalHours += hours;
    roleGroups[roleName].totalCost += cost;
  });
  
  // Calcular el costo total de todos los roles
  const totalCost = Object.values(roleGroups).reduce((sum, group) => sum + group.totalCost, 0);
  
  return (
    <div className="space-y-1">
      {Object.entries(roleGroups).map(([roleName, info]) => (
        <div key={roleName} className="text-slate-600 flex justify-between">
          <span>
            {roleName} {info.count > 1 ? `(x${info.count})` : ""}: {info.totalHours} hrs
          </span>
          {showCosts && <span className="font-medium">${info.totalCost.toFixed(2)}</span>}
        </div>
      ))}
      {Object.keys(roleGroups).length > 0 && showCosts && (
        <div className="text-sm font-medium border-t pt-1 flex justify-between">
          <span>Total equipo:</span>
          <span>${totalCost.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
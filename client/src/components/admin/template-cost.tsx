import { useQuery } from "@tanstack/react-query";
import { TemplateRoleAssignment, Role } from "@shared/schema";

interface TemplateCostProps {
  templateId: number;
  platformCost: number;
  deviationPercentage: number;
}

export function TemplateCost({ templateId, platformCost, deviationPercentage }: TemplateCostProps) {
  const { data: assignments, isLoading } = useQuery<(TemplateRoleAssignment & { role: Role })[]>({
    queryKey: [`/api/template-roles/${templateId}/with-roles`],
    enabled: !!templateId,
  });

  if (isLoading) {
    return <div className="font-medium">Calculando...</div>;
  }

  if (!assignments || assignments.length === 0) {
    // Si no hay roles asignados, solo mostramos el costo de plataformas y desvío
    const total = platformCost * (1 + ((deviationPercentage || 0) / 100));
    return <div className="font-medium">${total.toFixed(2)}</div>;
  }

  // Calcular costo del personal
  const personnelCost = assignments.reduce(
    (sum, assignment) => sum + (parseFloat(assignment.hours) * assignment.role.defaultRate),
    0
  );

  // Calcular costo total con plataformas y desvío
  const subtotal = personnelCost + (platformCost || 0);
  const total = subtotal * (1 + ((deviationPercentage || 0) / 100));

  return <div className="font-medium">${total.toFixed(2)}</div>;
}
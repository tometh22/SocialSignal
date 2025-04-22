import { useQuoteContext } from "@/context/quote-context";
import { TeamMember } from "@/context/quote-context";
import { useQuery } from "@tanstack/react-query";
import { Personnel, Role } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

interface CostBreakdownProps {
  teamMembers: TeamMember[];
  showComplexity?: boolean;
}

export default function CostBreakdown({ teamMembers, showComplexity = false }: CostBreakdownProps) {
  const {
    baseCost,
    complexityAdjustment,
    markupAmount,
    totalAmount,
    platformCost,
    deviationPercentage
  } = useQuoteContext();

  // Get personnel and roles info
  const { data: allPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Helper functions to get names
  const getPersonnelName = (personnelId: number | null) => {
    if (!personnelId || !allPersonnel) return "No asignado";
    const person = allPersonnel.find(p => p.id === personnelId);
    return person ? person.name : "No asignado";
  };

  const getRoleName = (roleId: number) => {
    if (!roles) return "Rol Desconocido";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Rol Desconocido";
  };

  return (
    <div className="bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-neutral-800">
          {showComplexity ? "Desglose de Costos Actualizado" : "Estimación Preliminar de Costos"}
        </h3>
        {showComplexity && (
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success bg-opacity-10 text-success">
              Actualizado
            </span>
          </div>
        )}
      </div>

      {teamMembers.length > 0 && (
        <div className="mb-6">
          <h4 className="text-base font-medium text-neutral-700 mb-3">Desglose de Costos del Equipo</h4>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Rol</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Miembro del Equipo</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Tarifa</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Horas</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Costo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-2 text-sm text-neutral-900">
                      {getRoleName(member.roleId)}
                    </td>
                    <td className="px-4 py-2 text-sm text-neutral-900">
                      {getPersonnelName(member.personnelId)}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-neutral-900">
                      ${member.rate.toFixed(2)}/hr
                    </td>
                    <td className="px-4 py-2 text-sm text-neutral-900">
                      {member.hours}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-neutral-900">
                      ${member.cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-50">
                  <td colSpan={4} className="px-4 py-2 text-sm font-medium text-neutral-900">Costo Base Total</td>
                  <td className="px-4 py-2 text-sm font-mono font-medium text-neutral-900">
                    ${baseCost.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-neutral-100 rounded-lg">
          <div className="text-sm text-neutral-600 mb-1">Costo Base</div>
          <div className="text-2xl font-mono font-medium">{formatCurrency(baseCost)}</div>
        </div>
        
        {showComplexity && complexityAdjustment > 0 && (
          <div className="p-4 bg-neutral-100 rounded-lg">
            <div className="text-sm text-neutral-600 mb-1">Ajuste por Complejidad</div>
            <div className="text-2xl font-mono font-medium">{formatCurrency(complexityAdjustment)}</div>
            <div className="text-xs text-neutral-500 mt-1">
              +{(complexityAdjustment / baseCost * 100).toFixed(0)}% por factores
            </div>
          </div>
        )}
        
        {showComplexity && platformCost > 0 && (
          <div className="p-4 bg-neutral-100 rounded-lg">
            <div className="text-sm text-neutral-600 mb-1">Costo de Plataformas</div>
            <div className="text-2xl font-mono font-medium">{formatCurrency(platformCost)}</div>
          </div>
        )}
        
        <div className="p-4 bg-neutral-100 rounded-lg">
          <div className="text-sm text-neutral-600 mb-1">Margen Estándar (2×)</div>
          <div className="text-2xl font-mono font-medium">{formatCurrency(markupAmount)}</div>
        </div>
        
        {showComplexity && deviationPercentage > 0 && (
          <div className="p-4 bg-neutral-100 rounded-lg">
            <div className="text-sm text-neutral-600 mb-1">Ajuste por Desvío</div>
            <div className="text-2xl font-mono font-medium">
              {formatCurrency((baseCost + complexityAdjustment + markupAmount + platformCost) * (deviationPercentage / 100))}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              +{deviationPercentage}% desvío aplicado
            </div>
          </div>
        )}
        
        <div className="p-4 bg-primary bg-opacity-10 rounded-lg border border-primary md:col-span-1">
          <div className="text-sm text-primary mb-1">
            {showComplexity ? "Cotización Total" : "Cotización Preliminar Total"}
          </div>
          <div className="text-2xl font-mono font-medium text-primary">{formatCurrency(totalAmount)}</div>
        </div>
      </div>
    </div>
  );
}

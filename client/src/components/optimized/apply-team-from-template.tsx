import React, { useState } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TeamMember } from '@/models/quote';
import { Users, AlertCircle, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Esta función agregará el equipo desde una plantilla específica
export const ApplyTeamFromWarnerTemplate: React.FC = () => {
  const {
    loadRoles,
    loadPersonnel,
    availableRoles,
    availablePersonnel,
    quotationData,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
  } = useOptimizedQuote();

  const [isApplying, setIsApplying] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Definir el equipo según las imágenes proporcionadas
  const templateTeam = [
    { 
      role: "Account Director", 
      dedication: 50, // 50% = 0.5 FTE
      count: 1 
    },
    { 
      role: "Project Manager Lead", 
      dedication: 100, // 100% = 1 FTE
      count: 1 
    },
    { 
      role: "Senior Analysts", 
      dedication: 100, // 100% = 1 FTE
      count: 3 
    },
    { 
      role: "Semi Senior Analysts", 
      dedication: 100, // 100% = 1 FTE
      count: 2 
    },
    { 
      role: "Tech Leads", 
      dedication: 75, // 75% = 0.75 FTE
      count: 2 
    },
    { 
      role: "Data Specialists", 
      dedication: 75, // 75% = 0.75 FTE
      count: 2 
    },
    { 
      role: "Designer", 
      dedication: 50, // 50% = 0.5 FTE
      count: 1 
    }
  ];

  // Mapeo de nombres a ID de roles en el sistema
  const roleMapping: { [key: string]: number } = {
    "Account Director": 20,            // Account Director
    "Project Manager Lead": 12,        // Lead Project Manager
    "Senior Analysts": 9,              // Analista Senior
    "Semi Senior Analysts": 11,        // Analista Semi Senior
    "Tech Leads": 16,                  // Operations Lead
    "Data Specialists": 10,            // Data Specialist
    "Designer": 18                     // Diseñador/a
  };

  // Convertir dedicación a horas (considerando que 1 FTE = 160 horas)
  const getFTEHours = (dedication: number): number => {
    return Math.round((dedication / 100) * 160);
  };

  // Aplicar la plantilla de equipo
  const applyTemplate = async () => {
    try {
      setIsApplying(true);
      setError(null);

      // Cargar roles y personal si es necesario
      if (!availableRoles.length) {
        await loadRoles();
      }
      if (!availablePersonnel.length) {
        await loadPersonnel();
      }

      // Primero limpiar cualquier miembro del equipo existente
      if (quotationData.teamMembers) {
        [...quotationData.teamMembers].forEach(member => {
          removeTeamMember(member.id);
        });
      }

      // Luego agregar los miembros nuevos del template
      for (const teamMember of templateTeam) {
        const roleId = roleMapping[teamMember.role];
        if (!roleId) {
          console.warn(`No se encontró equivalente para el rol "${teamMember.role}"`);
          continue;
        }

        // Buscar información del rol
        const roleInfo = availableRoles.find(r => r.id === roleId);
        if (!roleInfo) {
          console.warn(`No se encontró información para el rol ID ${roleId}`);
          continue;
        }

        // Agregar la cantidad especificada de este rol
        for (let i = 0; i < teamMember.count; i++) {
          // Buscar personal disponible para este rol (si hay)
          const matchingPersonnel = availablePersonnel.filter(p => p.roleId === roleId);
          
          // Crear nuevo miembro del equipo
          const member: TeamMember = {
            id: uuidv4(),
            roleId: roleId,
            personnelId: null, // Asignación por rol, no por persona específica
            hours: getFTEHours(teamMember.dedication),
            rate: roleInfo.defaultRate || 0,
            cost: 0 // Se calculará automáticamente
          };
          
          // Calcular el costo
          member.cost = member.hours * member.rate;
          
          // Agregar al equipo
          addTeamMember(member);
        }
      }

      setIsApplied(true);
      
      // Mostrar el éxito por 3 segundos, luego resetear
      setTimeout(() => {
        setIsApplied(false);
      }, 3000);
    } catch (err) {
      console.error("Error al aplicar plantilla:", err);
      setError("Error al aplicar la plantilla de equipo");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Users className="mr-2 h-5 w-5" />
          Aplicar Plantilla de Equipo
        </CardTitle>
        <CardDescription>
          Aplicar un equipo predefinido para este proyecto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Esta plantilla incluye:
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {templateTeam.map((item, idx) => (
                <li key={idx}>
                  {item.count} {item.role} ({item.dedication}% dedicación)
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end mt-4">
            <Button
              onClick={applyTemplate}
              disabled={isApplying || isApplied}
              className="w-full sm:w-auto"
            >
              {isApplied ? (
                <CheckCircle className="mr-2 h-4 w-4" />
              ) : (
                <Users className="mr-2 h-4 w-4" />
              )}
              {isApplied ? "¡Aplicado!" : "Aplicar Plantilla"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
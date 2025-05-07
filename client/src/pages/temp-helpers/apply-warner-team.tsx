import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle, Users, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Estructura de miembro del equipo
type TeamMember = {
  quotationId: number;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
};

// Estructura para la definición de roles en la plantilla
type TemplateRole = {
  roleName: string;
  roleId: number;
  dedication: number; // porcentaje
  count: number;     // cantidad de este rol
};

const WarnerTeamTemplate: React.FC = () => {
  const [, setLocation] = useLocation();
  const [quotationId, setQuotationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentTab, setCurrentTab] = useState('info');
  const [quotationData, setQuotationData] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);

  // Obtener ID de la cotización de la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (id && !isNaN(parseInt(id))) {
      setQuotationId(parseInt(id));
    } else {
      setError('ID de cotización no válido');
    }
  }, []);

  // Cargar datos necesarios cuando tenemos el ID
  useEffect(() => {
    if (quotationId) {
      loadData();
    }
  }, [quotationId]);

  // Cargar datos de cotización, roles y personal
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar cotización
      const quotationResponse = await apiRequest('GET', `/api/quotations/${quotationId}`);
      const quotationData = await quotationResponse.json();
      setQuotationData(quotationData);
      
      // Cargar roles
      const rolesResponse = await apiRequest('GET', '/api/roles');
      const rolesData = await rolesResponse.json();
      setRoles(rolesData);
      
      // Cargar personal
      const personnelResponse = await apiRequest('GET', '/api/personnel');
      const personnelData = await personnelResponse.json();
      setPersonnel(personnelData);
      
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos necesarios');
    } finally {
      setLoading(false);
    }
  };

  // Definir la plantilla de equipo
  const templateRoles: TemplateRole[] = [
    { roleName: "Account Director", roleId: 20, dedication: 50, count: 1 },
    { roleName: "Project Manager Lead", roleId: 12, dedication: 100, count: 1 },
    { roleName: "Senior Analysts", roleId: 9, dedication: 100, count: 3 },
    { roleName: "Semi Senior Analysts", roleId: 11, dedication: 100, count: 2 },
    { roleName: "Tech Leads", roleId: 16, dedication: 75, count: 2 },
    { roleName: "Data Specialists", roleId: 10, dedication: 75, count: 2 },
    { roleName: "Designer", roleId: 18, dedication: 50, count: 1 }
  ];

  // Convertir dedicación a horas (1 FTE = 160 horas)
  const getDedicationHours = (dedication: number): number => {
    return Math.round((dedication / 100) * 160);
  };

  // Obtener tasa predeterminada para un rol
  const getDefaultRateForRole = (roleId: number): number => {
    const role = roles.find(r => r.id === roleId);
    return role?.default_rate || 15; // Valor por defecto si no se encuentra
  };

  // Aplicar la plantilla
  const applyTemplate = async () => {
    if (!quotationId) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Eliminar los miembros existentes (si los hay)
      const teamResponse = await apiRequest('GET', `/api/quotation-team/${quotationId}`);
      const existingTeam = await teamResponse.json();

      if (existingTeam && existingTeam.length > 0) {
        for (const member of existingTeam) {
          await apiRequest('DELETE', `/api/quotation-team/${member.id}`);
        }
      }

      // 2. Crear nuevos miembros según la plantilla
      const newTeamMembers: TeamMember[] = [];

      for (const templateRole of templateRoles) {
        const { roleId, dedication, count } = templateRole;
        const hours = getDedicationHours(dedication);
        const rate = getDefaultRateForRole(roleId);

        // Crear 'count' miembros para este rol
        for (let i = 0; i < count; i++) {
          newTeamMembers.push({
            quotationId,
            roleId,
            personnelId: null, // Asignación por rol, no por persona específica
            hours,
            rate
          });
        }
      }

      // 3. Insertar los nuevos miembros del equipo
      for (const member of newTeamMembers) {
        await apiRequest('POST', '/api/quotation-team', member);
      }

      setSuccess(true);
      setCurrentTab('success');

    } catch (err) {
      console.error('Error al aplicar plantilla:', err);
      setError('Error al aplicar la plantilla de equipo');
    } finally {
      setLoading(false);
    }
  };

  // Volver a la página de cotización
  const goToQuotation = () => {
    if (quotationId) {
      setLocation(`/optimized-quote/${quotationId}`);
    } else {
      setLocation('/manage-quotes');
    }
  };

  if (loading && !quotationData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando datos...</span>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Button 
        variant="ghost" 
        onClick={() => setLocation('/manage-quotes')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver a Cotizaciones
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Aplicar Plantilla de Equipo Warner
          </CardTitle>
          <CardDescription>
            {quotationData ? (
              <span>Cotización: <strong>{quotationData.projectName}</strong></span>
            ) : (
              'Cargando información de la cotización...'
            )}
          </CardDescription>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="info">Información</TabsTrigger>
              <TabsTrigger value="preview">Vista Previa</TabsTrigger>
              <TabsTrigger value="success" disabled={!success}>Resultado</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info">
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta herramienta aplicará un equipo predefinido a la cotización actual.
                    Se reemplazará cualquier configuración de equipo existente.
                  </AlertDescription>
                </Alert>
                
                <div className="bg-secondary/20 p-4 rounded-md">
                  <h3 className="font-medium mb-2">La plantilla incluye:</h3>
                  <ul className="space-y-2">
                    {templateRoles.map((role, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm">
                        <span>{role.count}× {role.roleName}</span>
                        <span className="font-medium">{role.dedication}% dedicación</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="preview">
              <div className="border rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary/20">
                    <tr>
                      <th className="text-left py-2 px-3">Rol</th>
                      <th className="text-center py-2 px-3">Cantidad</th>
                      <th className="text-center py-2 px-3">Dedicación</th>
                      <th className="text-right py-2 px-3">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateRoles.map((role, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2 px-3">{role.roleName}</td>
                        <td className="text-center py-2 px-3">{role.count}</td>
                        <td className="text-center py-2 px-3">{role.dedication}%</td>
                        <td className="text-right py-2 px-3">{getDedicationHours(role.dedication)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/10">
                    <tr>
                      <td className="py-2 px-3 font-medium">Total</td>
                      <td className="text-center py-2 px-3 font-medium">
                        {templateRoles.reduce((sum, role) => sum + role.count, 0)}
                      </td>
                      <td className="text-center py-2 px-3"></td>
                      <td className="text-right py-2 px-3 font-medium">
                        {templateRoles.reduce((sum, role) => sum + (getDedicationHours(role.dedication) * role.count), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TabsContent>
            
            <TabsContent value="success">
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">¡Plantilla Aplicada!</h2>
                <p className="text-muted-foreground mb-6">
                  El equipo ha sido configurado correctamente para esta cotización.
                </p>
                <Button onClick={goToQuotation}>
                  Continuar con la Cotización
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={goToQuotation}>
            Cancelar
          </Button>
          <Button 
            onClick={applyTemplate}
            disabled={loading || success}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Aplicar Plantilla
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default WarnerTeamTemplate;
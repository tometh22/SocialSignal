import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, DollarSign, Clock, Save, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Personnel {
  id: number;
  name: string;
  email: string;
  hourlyRate: number;
  profilePicture?: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  defaultRate: number;
}

interface QuotationTeamMember {
  id: number;
  quotationId: number;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
  roleName: string;
  roleDescription: string;
  personnelName?: string;
}

interface ProjectTeamConfigurationProps {
  quotationId: number;
  quotationName: string;
  onConfigurationComplete: (teamConfiguration: TeamConfiguration[]) => void;
  onCancel: () => void;
}

interface TeamConfiguration {
  roleId: number;
  roleName: string;
  personnelId: number;
  personnelName: string;
  hours: number;
  rate: number;
  cost: number;
}

export default function ProjectTeamConfiguration({ 
  quotationId, 
  quotationName, 
  onConfigurationComplete, 
  onCancel 
}: ProjectTeamConfigurationProps) {
  const { toast } = useToast();
  const [teamConfigurations, setTeamConfigurations] = useState<TeamConfiguration[]>([]);
  const [isValid, setIsValid] = useState(false);

  // Fetch quotation team members
  const { data: quotationTeam = [], isLoading: loadingTeam } = useQuery<QuotationTeamMember[]>({
    queryKey: [`/api/quotation-team/${quotationId}`],
    enabled: !!quotationId,
  });

  // Fetch available personnel
  const { data: personnel = [], isLoading: loadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
  });

  // Initialize team configurations when quotation team loads
  useEffect(() => {
    if (quotationTeam.length > 0) {
      const initialConfigurations = quotationTeam
        .filter(member => member.personnelId === null) // Only role-only members
        .map(member => ({
          roleId: member.roleId,
          roleName: member.roleName,
          personnelId: 0, // Unassigned
          personnelName: '',
          hours: member.hours,
          rate: member.rate,
          cost: member.cost,
        }));
      
      setTeamConfigurations(initialConfigurations);
    }
  }, [quotationTeam]);

  // Validate configuration
  useEffect(() => {
    const allAssigned = teamConfigurations.every(config => 
      config.personnelId > 0 && config.hours > 0 && config.rate > 0
    );
    setIsValid(allAssigned);
  }, [teamConfigurations]);

  const updateConfiguration = (index: number, field: keyof TeamConfiguration, value: any) => {
    setTeamConfigurations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // If personnel changed, update name and rate
      if (field === 'personnelId') {
        const selectedPerson = personnel.find(p => p.id === value);
        if (selectedPerson) {
          updated[index].personnelName = selectedPerson.name;
          updated[index].rate = selectedPerson.hourlyRate;
          updated[index].cost = updated[index].hours * selectedPerson.hourlyRate;
        }
      }
      
      // If hours or rate changed, recalculate cost
      if (field === 'hours' || field === 'rate') {
        updated[index].cost = (updated[index].hours || 0) * (updated[index].rate || 0);
      }
      
      return updated;
    });
  };

  const handleSave = () => {
    if (!isValid) {
      toast({
        title: "Configuración incompleta",
        description: "Debes asignar personal a todos los roles y configurar horas y tarifas.",
        variant: "destructive",
      });
      return;
    }

    onConfigurationComplete(teamConfigurations);
  };

  // Check if quotation has only role-based assignments
  const hasOnlyRoles = quotationTeam.every(member => member.personnelId === null);
  
  if (!hasOnlyRoles) {
    // Quotation already has personnel assigned, no configuration needed
    return null;
  }

  if (loadingTeam || loadingPersonnel) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Cargando configuración del equipo...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (teamConfigurations.length === 0) {
    // No role-only members found
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Configuración de Equipo del Proyecto
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {quotationName}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Asignación de Personal Requerida</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Esta cotización fue creada solo con roles. Para crear el proyecto, necesitas asignar personal específico a cada rol y ajustar las tarifas si es necesario.
            </p>
          </div>

          <div className="space-y-4">
            {teamConfigurations.map((config, index) => (
              <Card key={config.roleId} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Rol
                      </label>
                      <div className="p-2 bg-gray-50 rounded border">
                        <p className="font-medium text-sm">{config.roleName}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Asignar Personal *
                      </label>
                      <Select
                        value={config.personnelId.toString()}
                        onValueChange={(value) => updateConfiguration(index, 'personnelId', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar persona" />
                        </SelectTrigger>
                        <SelectContent>
                          {personnel.map((person) => (
                            <SelectItem key={person.id} value={person.id.toString()}>
                              <div className="flex items-center gap-2">
                                <span>{person.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  ${person.hourlyRate}/h
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Horas Estimadas *
                      </label>
                      <Input
                        type="number"
                        value={config.hours}
                        onChange={(e) => updateConfiguration(index, 'hours', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.5"
                        className="text-center"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Tarifa ($/hora) *
                      </label>
                      <Input
                        type="number"
                        value={config.rate}
                        onChange={(e) => updateConfiguration(index, 'rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.1"
                        className="text-center"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Costo Total:</span>
                      <span className="font-semibold text-lg">
                        ${config.cost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isValid ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Configuración completa</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600">Completa todos los campos</span>
                  </>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={!isValid}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Crear Proyecto
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
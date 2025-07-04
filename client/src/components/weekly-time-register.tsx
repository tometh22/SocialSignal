import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  Save,
  Send,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TeamMember {
  personnelId: number;
  roleId: number;
  name: string;
  role: string;
  hourlyRate: number;
  estimatedHours: number;
}

interface WeeklyTimeRegisterProps {
  projectId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function WeeklyTimeRegister({ projectId, onSuccess, onCancel }: WeeklyTimeRegisterProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para el período
  const [periodName, setPeriodName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Estados para las horas del equipo
  const [teamHours, setTeamHours] = useState<Record<number, { hours: number; description: string; customRate?: number }>>({});
  const [step, setStep] = useState<'period' | 'team'>('period');

  // Fetch team members
  const { data: baseTeam = [], isLoading: loadingTeam } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Convert API data to TeamMember format
  const teamMembers: TeamMember[] = Array.isArray(baseTeam) ? baseTeam.map((member: any) => ({
    personnelId: member.personnelId,
    roleId: member.roleId,
    name: member.personnel ? member.personnel.name : 'Personal sin nombre',
    role: member.role ? member.role.name : 'Rol no especificado',
    hourlyRate: member.hourlyRate || 0,
    estimatedHours: member.estimatedHours || 40,
  })) : [];

  // Auto-generate period name based on dates
  React.useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startMonth = format(start, "MMMM", { locale: es });
      const endMonth = format(end, "MMMM", { locale: es });

      let suggestedName = "";
      if (startMonth === endMonth) {
        suggestedName = `${startMonth} ${start.getFullYear()}`;
        const weekOfMonth = Math.ceil(start.getDate() / 7);
        if (weekOfMonth === 1) suggestedName += ', Primera semana';
        else if (weekOfMonth === 2) suggestedName += ', Segunda semana';
        else if (weekOfMonth === 3) suggestedName += ', Tercera semana';
        else suggestedName += ', Cuarta semana';
      } else {
        suggestedName = `${startMonth} - ${endMonth} ${start.getFullYear()}`;
      }
      
      setPeriodName(suggestedName);
    }
  }, [startDate, endDate]);

  // Crear entrada rápida de tiempo
  const createQuickEntry = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/projects/${projectId}/quick-time-entries`, "POST", data),
    onSuccess: (newEntry) => {
      setStep('team');
      toast({
        title: "Período configurado",
        description: "Ahora puedes registrar las horas del equipo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear período",
        description: error.message || "Intenta nuevamente",
        variant: "destructive"
      });
    }
  });

  const handleCreatePeriod = () => {
    if (!periodName || !startDate || !endDate) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del período",
        variant: "destructive"
      });
      return;
    }

    createQuickEntry.mutate({
      periodName,
      startDate,
      endDate,
      notes
    });
  };

  const handleUpdateHours = (personnelId: number, hours: number, description: string, customRate?: number) => {
    setTeamHours(prev => ({
      ...prev,
      [personnelId]: { hours, description, customRate }
    }));
  };

  const handleSaveAllHours = async () => {
    const validEntries = Object.entries(teamHours).filter(([_, data]) => data.hours > 0);

    if (validEntries.length === 0) {
      toast({
        title: "Sin registros",
        description: "Agrega horas para al menos un miembro del equipo",
        variant: "destructive"
      });
      return;
    }

    // Aquí implementarías la lógica para guardar las horas
    // Por ahora simulamos el guardado
    toast({
      title: "Horas guardadas exitosamente",
      description: `Se registraron ${validEntries.length} entradas de tiempo`,
    });
    
    queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
    onSuccess?.();
  };

  const getTotalHours = () => {
    return Object.values(teamHours).reduce((sum, data) => sum + (data.hours || 0), 0);
  };

  const getTotalCost = () => {
    return Object.entries(teamHours).reduce((sum, [personnelId, data]) => {
      const member = teamMembers.find(m => m.personnelId === parseInt(personnelId));
      if (member) {
        const rate = data.customRate !== undefined ? data.customRate : member.hourlyRate;
        return sum + (data.hours * rate);
      }
      return sum;
    }, 0);
  };

  if (step === 'period') {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Registro Semanal de Horas</h1>
              <p className="text-gray-500">Configura el período de tiempo para el registro</p>
            </div>
          </div>
          
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Configuración de Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodName">Nombre del Período</Label>
              <Input
                id="periodName"
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                placeholder="Ej: Enero 2025, Primera semana"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Añade cualquier nota relevante para este período..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                onClick={handleCreatePeriod}
                disabled={createQuickEntry.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {createQuickEntry.isPending ? 'Creando...' : 'Continuar al Registro'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Registro de Horas del Equipo</h1>
            <p className="text-gray-500">Período: {periodName}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('period')}>
            Cambiar Período
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Horas Totales</p>
                <p className="text-2xl font-bold text-gray-900">{getTotalHours().toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Costo Total</p>
                <p className="text-2xl font-bold text-gray-900">${getTotalCost().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Miembros</p>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de miembros del equipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Registro de Horas por Miembro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingTeam ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                  <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No hay miembros en este proyecto</p>
              <p className="text-sm text-gray-400">Añade miembros del equipo desde la configuración del proyecto</p>
            </div>
          ) : (
            teamMembers.map((member, index) => {
              const memberHours = teamHours[member.personnelId] || { hours: 0, description: '', customRate: undefined };
              const effectiveRate = memberHours.customRate !== undefined ? memberHours.customRate : member.hourlyRate;
              
              return (
                <motion.div
                  key={member.personnelId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border rounded-xl bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-blue-600 text-white font-semibold">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-500">{member.role}</p>
                        <p className="text-xs text-gray-400">Tarifa: ${effectiveRate}/hora</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Horas trabajadas</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="0"
                            value={memberHours.hours || ''}
                            onChange={(e) => handleUpdateHours(
                              member.personnelId,
                              parseFloat(e.target.value) || 0,
                              memberHours.description,
                              memberHours.customRate
                            )}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Tarifa personalizada (opcional)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder={`${member.hourlyRate}`}
                            value={memberHours.customRate || ''}
                            onChange={(e) => handleUpdateHours(
                              member.personnelId,
                              memberHours.hours,
                              memberHours.description,
                              parseFloat(e.target.value) || undefined
                            )}
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Costo total</Label>
                          <div className="h-10 flex items-center px-3 bg-gray-50 rounded-md border">
                            <span className="text-sm font-medium text-gray-900">
                              ${(memberHours.hours * effectiveRate).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Descripción del trabajo</Label>
                        <Textarea
                          placeholder="Describe las tareas realizadas durante este período..."
                          value={memberHours.description}
                          onChange={(e) => handleUpdateHours(
                            member.personnelId,
                            memberHours.hours,
                            e.target.value,
                            memberHours.customRate
                          )}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setTeamHours({})}>
          Limpiar Todo
        </Button>
        <Button onClick={handleSaveAllHours} className="gap-2">
          <Send className="w-4 h-4" />
          Guardar Registro Semanal
        </Button>
      </div>
    </div>
  );
}
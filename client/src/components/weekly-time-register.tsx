
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Calendar, Clock, Save, X, Plus, Trash2, AlertCircle, CheckCircle2, Users, DollarSign, Send, Timer } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { motion } from 'framer-motion';

interface TimeEntry {
  id?: number;
  personnelId: number;
  roleId: number;
  date: string;
  hours: number;
  description: string;
  isNew?: boolean;
}

interface WeeklyTimeRegisterProps {
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function WeeklyTimeRegister({ projectId, onSuccess, onCancel }: WeeklyTimeRegisterProps) {
  const [step, setStep] = useState<'period' | 'register'>('period');
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Lunes como primer día
  });

  const [startDate, setStartDate] = useState(() => format(selectedWeek, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(addDays(selectedWeek, 6), 'yyyy-MM-dd'));
  const [periodName, setPeriodName] = useState('');
  const [notes, setNotes] = useState('');
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [teamHours, setTeamHours] = useState<Record<number, { hours: number; description: string; customRate?: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Clave para localStorage específica del proyecto
  const storageKey = `weekly-time-register-${projectId}`;

  // Función para guardar en localStorage
  const saveToStorage = () => {
    const data = {
      selectedWeek: selectedWeek.toISOString(),
      periodName,
      notes,
      timeEntries,
      teamHours,
      startDate,
      endDate,
      timestamp: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
    console.log('📁 Datos guardados automáticamente');
  };

  // Función para cargar desde localStorage
  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Solo cargar si es reciente (menos de 1 hora)
        if (Date.now() - data.timestamp < 3600000) {
          setSelectedWeek(new Date(data.selectedWeek));
          setPeriodName(data.periodName || '');
          setNotes(data.notes || '');
          setTimeEntries(data.timeEntries || []);
          setTeamHours(data.teamHours || {});
          setStartDate(data.startDate || format(selectedWeek, 'yyyy-MM-dd'));
          setEndDate(data.endDate || format(addDays(selectedWeek, 6), 'yyyy-MM-dd'));
          setHasUnsavedChanges(true);
          toast({
            title: "📋 Datos recuperados",
            description: "Se han restaurado los datos del registro anterior",
          });
          return true;
        }
      }
    } catch (error) {
      console.error('Error cargando datos guardados:', error);
    }
    return false;
  };

  // Función para limpiar localStorage
  const clearStorage = () => {
    localStorage.removeItem(storageKey);
    setHasUnsavedChanges(false);
  };

  // Cargar equipo base del proyecto
  const { data: baseTeam, isLoading: loadingTeam } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Obtener personal disponible
  const { data: personnel } = useQuery({
    queryKey: ['/api/personnel'],
  });

  // Obtener miembros del equipo
  const teamMembers = Array.isArray(baseTeam) ? baseTeam : [];

  // Cargar datos guardados al montar el componente
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Autoguardado cuando cambian los datos
  useEffect(() => {
    if (periodName || notes || timeEntries.length > 0 || Object.keys(teamHours).length > 0) {
      setHasUnsavedChanges(true);
      const timeoutId = setTimeout(() => {
        saveToStorage();
      }, 2000); // Guardar después de 2 segundos de inactividad

      return () => clearTimeout(timeoutId);
    }
  }, [periodName, notes, timeEntries, teamHours, selectedWeek, startDate, endDate]);

  // Limpiar al desmontar si los datos fueron enviados exitosamente
  useEffect(() => {
    return () => {
      // Solo limpiar si no hay cambios sin guardar o si se está cerrando después de enviar
      if (!hasUnsavedChanges) {
        clearStorage();
      }
    };
  }, [hasUnsavedChanges]);

  const handleCreatePeriod = () => {
    if (!periodName.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingresa un nombre para el período",
        variant: "destructive"
      });
      return;
    }
    setStep('register');
  };

  const handleUpdateHours = (personnelId: number, hours: number, description: string, customRate?: number) => {
    setTeamHours(prev => ({
      ...prev,
      [personnelId]: { hours, description, customRate }
    }));
    setHasUnsavedChanges(true);
  };

  const getTotalHours = () => {
    return Object.values(teamHours).reduce((sum, member) => sum + (member.hours || 0), 0);
  };

  const getTotalCost = () => {
    if (!Array.isArray(teamMembers)) return 0;
    
    return teamMembers.reduce((sum, member) => {
      if (!member || typeof member !== 'object' || !member.personnelId) return sum;
      
      const memberData = teamHours[member.personnelId];
      if (!memberData || !memberData.hours) return sum;
      
      const rate = memberData.customRate !== undefined ? memberData.customRate : (member.hourlyRate || 0);
      return sum + (memberData.hours * rate);
    }, 0);
  };

  const updateTimeEntry = (index: number, field: keyof TimeEntry, value: any) => {
    const updated = [...timeEntries];
    updated[index] = { ...updated[index], [field]: value };
    setTimeEntries(updated);
    setHasUnsavedChanges(true);
  };

  const removeTimeEntry = (index: number) => {
    const updated = timeEntries.filter((_, i) => i !== index);
    setTimeEntries(updated);
    setHasUnsavedChanges(true);
  };

  const addTimeEntry = () => {
    if (!baseTeam || baseTeam.length === 0) {
      toast({
        title: "No hay equipo base",
        description: "Configura primero el equipo base del proyecto",
        variant: "destructive"
      });
      return;
    }

    const firstMember = baseTeam[0];
    const newEntry: TimeEntry = {
      personnelId: firstMember.personnelId,
      roleId: firstMember.roleId,
      date: startDate,
      hours: 0,
      description: '',
      isNew: true
    };

    setTimeEntries([...timeEntries, newEntry]);
    setHasUnsavedChanges(true);
  };

  const createTimeEntry = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Error al crear el registro de tiempo');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
    }
  });

  const handleSaveAllHours = async () => {
    setIsSubmitting(true);
    
    try {
      const entries = teamMembers
        .map(member => {
          const memberData = teamHours[member.personnelId];
          if (!memberData || !memberData.hours) return null;
          
          return {
            projectId,
            personnelId: member.personnelId,
            roleId: member.roleId,
            hours: memberData.hours,
            description: memberData.description || '',
            date: startDate,
            periodName,
            notes
          };
        })
        .filter(Boolean);

      if (entries.length === 0) {
        toast({
          title: "No hay horas para registrar",
          description: "Ingresa las horas trabajadas para al menos un miembro del equipo",
          variant: "destructive"
        });
        return;
      }

      // Crear todas las entradas
      await Promise.all(entries.map(entry => createTimeEntry.mutateAsync(entry)));

      toast({
        title: "✅ Registro completado",
        description: `Se registraron ${entries.length} entradas de tiempo`,
      });

      // Limpiar datos guardados después del envío exitoso
      clearStorage();

      // Invalidar consultas relacionadas
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/active-projects/${projectId}`] });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo completar el registro",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Configuración de Período
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="ml-2 text-orange-600 border-orange-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Autoguardado
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    if (window.confirm('Tienes cambios sin enviar. ¿Estás seguro de cerrar?')) {
                      onCancel();
                    }
                  } else {
                    onCancel();
                  }
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Configura el período de tiempo para el registro
              {hasUnsavedChanges && (
                <span className="text-orange-600 ml-2">• Los datos se guardan automáticamente</span>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodName">Nombre del Período</Label>
              <Input
                type="text"
                value={periodName}
                onChange={(e) => {
                  setPeriodName(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="Ej. Enero 2025, Primera semana"
                className="flex-1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="Añade cualquier nota relevante para este período..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                onClick={handleCreatePeriod}
                className="gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Continuar al Registro
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

      {/* Tabla compacta de miembros del equipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Registro de Horas por Miembro
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingTeam ? (
            <div className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div className="flex-1 h-4 bg-gray-300 rounded"></div>
                    <div className="w-20 h-4 bg-gray-300 rounded"></div>
                    <div className="w-20 h-4 bg-gray-300 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No hay miembros en este proyecto</p>
              <p className="text-sm text-gray-400">Añade miembros del equipo desde la configuración del proyecto</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">Miembro</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">Horas</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">Tarifa</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">Costo</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-900">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(teamMembers || []).filter(member => member && member.personnelId && typeof member === 'object').map((member, index) => {
                    const memberHours = teamHours[member.personnelId] || { hours: 0, description: '', customRate: undefined };
                    const effectiveRate = memberHours.customRate !== undefined ? memberHours.customRate : (member.hourlyRate || 0);

                    return (
                      <motion.tr
                        key={member.personnelId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                                {member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{member.name || 'Sin nombre'}</div>
                              <div className="text-xs text-gray-500">{member.role || 'Sin rol'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
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
                            className="w-20 h-8 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
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
                            className="w-20 h-8 text-sm"
                          />
                          <div className="text-xs text-gray-400 mt-1">
                            ${effectiveRate}/h
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm">
                            ${(memberHours.hours * effectiveRate).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            placeholder="Descripción del trabajo..."
                            value={memberHours.description}
                            onChange={(e) => handleUpdateHours(
                              member.personnelId,
                              memberHours.hours,
                              e.target.value,
                              memberHours.customRate
                            )}
                            className="min-w-[200px] h-8 text-sm"
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setTeamHours({})}>
          Limpiar Todo
        </Button>
        <Button 
          onClick={handleSaveAllHours} 
          disabled={isSubmitting}
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? 'Guardando...' : 'Guardar Registro Semanal'}
        </Button>
      </div>
    </div>
  );
}

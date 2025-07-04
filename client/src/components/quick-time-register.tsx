
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Square, 
  Users, 
  DollarSign, 
  Timer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Edit3,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Target,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  hourlyRate: number;
  hoursWorked: number;
  targetHours: number;
  isTracking: boolean;
  lastActivity?: string;
  efficiency: number;
}

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  memberId: string;
}

interface QuickTimeRegisterProps {
  projectId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function QuickTimeRegister({ projectId, onSuccess, onCancel }: QuickTimeRegisterProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('2025, Primera quincena marzo');
  const [startDate, setStartDate] = useState('04/01/2025');
  const [endDate, setEndDate] = useState('04/01/2025');
  const [showTeam, setShowTeam] = useState(true);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [newHours, setNewHours] = useState<{ [key: string]: string }>({});

  // Fetch actual team members from the project
  const { data: baseTeam = [], isLoading: loadingTeam } = useQuery({
    queryKey: [`/api/projects/${projectId}/base-team`],
    enabled: !!projectId,
  });

  // Convert API data to TeamMember format
  const teamMembers: TeamMember[] = Array.isArray(baseTeam) ? baseTeam.map((member: any) => ({
    id: member.personnelId.toString(),
    name: member.personnel ? `${member.personnel.firstName} ${member.personnel.lastName}` : 'Personal sin nombre',
    role: member.role ? member.role.name : 'Rol no especificado',
    avatar: member.personnel?.avatar || '/api/placeholder/32/32',
    hourlyRate: member.hourlyRate || 0,
    hoursWorked: 0, // This would come from time entries
    targetHours: member.hours || 40,
    isTracking: false,
    lastActivity: 'Sin actividad reciente',
    efficiency: 90 // This could be calculated from performance data
  })) : [];

  const [trackingStates, setTrackingStates] = useState<{ [key: string]: boolean }>({});
  const [hoursWorked, setHoursWorked] = useState<{ [key: string]: number }>({});

  const totalHours = teamMembers.reduce((sum, member) => sum + (hoursWorked[member.id] || 0), 0);
  const totalCost = teamMembers.reduce((sum, member) => sum + ((hoursWorked[member.id] || 0) * member.hourlyRate), 0);
  const averageEfficiency = teamMembers.reduce((sum, member) => sum + member.efficiency, 0) / (teamMembers.length || 1);

  const handleStartTracking = (memberId: string) => {
    setTrackingStates(prev => ({ ...prev, [memberId]: true }));
  };

  const handleStopTracking = (memberId: string) => {
    setTrackingStates(prev => ({ ...prev, [memberId]: false }));
  };

  const handleEditHours = (memberId: string) => {
    setEditingMember(memberId);
    const currentHours = hoursWorked[memberId] || 0;
    setNewHours(prev => ({ ...prev, [memberId]: currentHours.toString() }));
  };

  const handleSaveHours = (memberId: string) => {
    const hours = parseFloat(newHours[memberId] || '0');
    setHoursWorked(prev => ({ ...prev, [memberId]: hours }));
    setEditingMember(null);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 70) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 90) return { color: 'bg-green-100 text-green-800', icon: <Zap className="w-3 h-3" /> };
    if (efficiency >= 80) return { color: 'bg-blue-100 text-blue-800', icon: <Target className="w-3 h-3" /> };
    if (efficiency >= 70) return { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="w-3 h-3" /> };
    return { color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3 h-3" /> };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header mejorado */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Registro Rápido de Horas</h1>
            <p className="text-gray-500">Gestiona el tiempo de tu equipo de forma inteligente</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant={showTeam ? "default" : "outline"}
            onClick={() => setShowTeam(!showTeam)}
            className="gap-2"
          >
            {showTeam ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showTeam ? 'Ocultar Equipo' : 'Mostrar Equipo'}
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Horas Totales</p>
                <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Costo Total</p>
                <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Miembros Activos</p>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.filter(m => m.isTracking).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Eficiencia Promedio</p>
                <p className="text-2xl font-bold text-gray-900">{averageEfficiency.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Configuración de Período */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
              Configuración de Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period" className="text-sm font-medium">Período</Label>
                <Input
                  id="period"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ej: Enero 2025, Primera quincena marzo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm font-medium">Fecha Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate.split('/').reverse().join('-')}
                  onChange={(e) => setStartDate(e.target.value.split('-').reverse().join('/'))}
                  className="bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm font-medium">Fecha Fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate.split('/').reverse().join('-')}
                  onChange={(e) => setEndDate(e.target.value.split('-').reverse().join('/'))}
                  className="bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Registro de Horas del Equipo */}
      <AnimatePresence>
        {showTeam && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-white shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Timer className="w-5 h-5 text-blue-600" />
                    Registro de Horas del Equipo
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {teamMembers.length} miembros
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  Configura las horas y tarifas para cada miembro del equipo
                </p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {loadingTeam ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No hay miembros en este proyecto</p>
                    <p className="text-sm text-gray-400">Añade miembros del equipo desde la pestaña de configuración del proyecto</p>
                  </div>
                ) : (
                  teamMembers.map((member, index) => {
                  const currentHours = hoursWorked[member.id] || 0;
                  const isTracking = trackingStates[member.id] || false;
                  const progress = (currentHours / member.targetHours) * 100;
                  const efficiencyBadge = getEfficiencyBadge(member.efficiency);
                  
                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        isTracking 
                          ? 'bg-blue-50 border-blue-200 shadow-md' 
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-12 h-12 ring-2 ring-white shadow-sm">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="bg-blue-600 text-white font-semibold">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{member.name}</h3>
                              <Badge className={`text-xs ${efficiencyBadge.color} gap-1`}>
                                {efficiencyBadge.icon}
                                {member.efficiency}%
                              </Badge>
                              {isTracking && (
                                <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  En vivo
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{member.role}</p>
                            <p className="text-xs text-gray-400">Última actividad: {member.lastActivity}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Progress y horas */}
                          <div className="text-right space-y-2 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {editingMember === member.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={newHours[member.id] || ''}
                                    onChange={(e) => setNewHours(prev => ({
                                      ...prev,
                                      [member.id]: e.target.value
                                    }))}
                                    className="w-16 h-8 text-xs"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveHours(member.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Save className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">
                                    {currentHours.toFixed(1)}
                                  </span>
                                  <span className="text-gray-500 text-sm">
                                    / {member.targetHours}h
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditHours(member.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-1">
                              <Progress 
                                value={Math.min(progress, 100)} 
                                className="h-2"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{progress.toFixed(0)}%</span>
                                <span>${(currentHours * member.hourlyRate).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Tarifa por hora */}
                          <div className="text-center min-w-[80px]">
                            <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              {member.hourlyRate.toFixed(1)}
                            </div>
                            <p className="text-xs text-gray-500">por hora</p>
                          </div>

                          {/* Controles de tracking */}
                          <div className="flex gap-2">
                            {isTracking ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStopTracking(member.id)}
                                className="gap-2 bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                              >
                                <Square className="w-4 h-4" />
                                Detener
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartTracking(member.id)}
                                className="gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                              >
                                <Play className="w-4 h-4" />
                                Iniciar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resumen Final */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Resumen del Período</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-blue-100 text-sm">Total de Horas</p>
                    <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm">Costo Total</p>
                    <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm">Eficiencia Promedio</p>
                    <p className="text-2xl font-bold">{averageEfficiency.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  className="bg-white text-blue-600 hover:bg-blue-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reiniciar
                </Button>
                <Button 
                  variant="secondary" 
                  className="bg-blue-500 text-white hover:bg-blue-400 border-blue-400"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Guardar Período
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

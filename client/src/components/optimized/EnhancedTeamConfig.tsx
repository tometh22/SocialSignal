import React, { useState, useEffect, useRef } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Personnel, Role } from '@shared/schema';
import { parseDecimalInput } from '@/lib/number-utils';
import { useCurrency } from '@/hooks/use-currency';
import {
  Clock,
  UserPlus,
  Users,
  Edit,
  Check,
  X,
  Trash2,
  GripVertical,
  Plus,
  Calculator,
  Star,
  User,
  DollarSign,
  Info
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface DragDropTeamMember {
  id: string;
  roleId: number;
  personnelId: number | null;
  hours: number;
  rate: number;
  cost: number;
}

// Meses históricos de salarios disponibles (más reciente → más antiguo).
// Se mantiene sincronizado con HISTORICAL_MONTHS_DESC en optimized-quote-context.
const SALARY_MONTH_OPTIONS: { value: string; label: string }[] = [
  { value: 'dec2026', label: 'Dic 2026' }, { value: 'nov2026', label: 'Nov 2026' },
  { value: 'oct2026', label: 'Oct 2026' }, { value: 'sep2026', label: 'Sep 2026' },
  { value: 'aug2026', label: 'Ago 2026' }, { value: 'jul2026', label: 'Jul 2026' },
  { value: 'jun2026', label: 'Jun 2026' }, { value: 'may2026', label: 'May 2026' },
  { value: 'apr2026', label: 'Abr 2026' }, { value: 'mar2026', label: 'Mar 2026' },
  { value: 'feb2026', label: 'Feb 2026' }, { value: 'jan2026', label: 'Ene 2026' },
  { value: 'dec2025', label: 'Dic 2025' }, { value: 'nov2025', label: 'Nov 2025' },
  { value: 'oct2025', label: 'Oct 2025' }, { value: 'sep2025', label: 'Sep 2025' },
  { value: 'aug2025', label: 'Ago 2025' }, { value: 'jul2025', label: 'Jul 2025' },
  { value: 'jun2025', label: 'Jun 2025' }, { value: 'may2025', label: 'May 2025' },
  { value: 'apr2025', label: 'Abr 2025' }, { value: 'mar2025', label: 'Mar 2025' },
  { value: 'feb2025', label: 'Feb 2025' }, { value: 'jan2025', label: 'Ene 2025' },
];
const SALARY_MONTH_AUTO = '__auto__';

const RATE_PROJECTION_OPTIONS: { value: 'current' | 'annual_avg'; label: string; description: string }[] = [
  {
    value: 'current',
    label: 'Foto del mes seleccionado',
    description: 'Usa el valor hora real del mes elegido (Admin → Personal).',
  },
  {
    value: 'annual_avg',
    label: 'Promedio anual estimado',
    description: 'Promedia las tarifas estimadas del año — ideal para proyectos largos.',
  },
];

const EnhancedTeamConfig: React.FC = () => {
  const { exchangeRate } = useCurrency();
  const {
    quotationData,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    updateTeamMembers,
    loadRoles,
    loadPersonnel,
    availableRoles,
    availablePersonnel,
    recommendedRoleIds,
    getPersonnelRate,
    getResolvedSalaryMonth,
    updateSalaryMonth,
    updateInflation
  } = useOptimizedQuote();

  // Estados para la nueva UI
  const [draggedMembers, setDraggedMembers] = useState<DragDropTeamMember[]>([]);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  // Estados para agregar miembros rápidamente
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [quickPersonnelMode, setQuickPersonnelMode] = useState(false);
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [selectedQuickRoles, setSelectedQuickRoles] = useState<Set<number>>(new Set());
  const [selectedQuickPersonnel, setSelectedQuickPersonnel] = useState<Set<number>>(new Set());



  // Estados para edición inline
  const [editValues, setEditValues] = useState<Record<string, {hours: number, rate: number}>>({});
  // Estados temporales para edición que permiten strings vacías
  const [tempEditValues, setTempEditValues] = useState<Record<string, {hours: string, rate: string}>>({});

  const currency = quotationData.quotationCurrency || 'ARS';
  const currencyLabel = currency === 'USD' ? 'USD' : 'ARS';
  const formatQuotedAmount = (amount: number) => amount.toLocaleString(currency === 'USD' ? 'en-US' : 'es-AR', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  });

  const getCorrectRate = (person: Personnel, role?: Role): number => {
    const rate = getPersonnelRate(person.id, currency);
    if (rate && rate > 0) return rate;
    // A selected person without a historical rate must remain unresolved so
    // the UI can surface the missing data; a role/default fallback would make
    // the quotation look valid while costing it with an invented value.
    return 0;
  };

  const isReferenceConversion = (person: Personnel) => {
    if (currency !== "ARS") return false;
    const rates = ((person as any).historicalRates ?? []) as any[];
    return rates.some((rate) => Number(rate.hourlyRateUSD) > 0) &&
      !rates.some((rate) => Number(rate.hourlyRateARS) > 0);
  };

  const isReferenceConversionMissingFx = (person: Personnel) => {
    if (!isReferenceConversion(person)) return false;
    const rates = ((person as any).historicalRates ?? []) as any[];
    return !(exchangeRate > 0) &&
      !rates.some((rate) => Number(rate.hourlyRateUSD) > 0 && Number(rate.exchangeRate) > 0);
  };

  // Sincronizar con el contexto
  useEffect(() => {
    const members: DragDropTeamMember[] = quotationData.teamMembers.map(member => ({
      id: member.id,
      roleId: member.roleId,
      personnelId: member.personnelId,
      hours: member.hours,
      rate: member.rate,
      cost: member.cost
    }));
    setDraggedMembers(members);
  }, [quotationData.teamMembers]);

  // Cargar datos iniciales
  useEffect(() => {
    loadRoles();
    loadPersonnel();
  }, [loadRoles, loadPersonnel]);

  // Obtener información del rol
  const getRoleInfo = (roleId: number) => {
    return availableRoles.find(role => role.id === roleId);
  };

  // Obtener información del personal
  const getPersonnelInfo = (personnelId: number | null) => {
    if (!personnelId) return null;
    return availablePersonnel.find(person => person.id === personnelId);
  };

  // Manejar reordenamiento drag & drop
  const handleReorder = (newOrder: DragDropTeamMember[]) => {
    setDraggedMembers(newOrder);
    // Actualizar el contexto con el nuevo orden
    const reorderedMembers = newOrder.map(member => ({
      id: member.id,
      roleId: member.roleId,
      personnelId: member.personnelId,
      hours: member.hours,
      rate: member.rate,
      cost: member.cost
    }));
    updateTeamMembers(reorderedMembers);
  };

  // Agregar miembro rápido (solo rol)
  // const handleQuickAdd = (roleId: number) => {
  //   const role = getRoleInfo(roleId);
  //   if (role) {
  //     const hours = 40;
  //     const rate = role.defaultRate || 50;
  //     addTeamMember({
  //       roleId,
  //       personnelId: null,
  //       hours,
  //       rate,
  //       cost: 0 // Will be recalculated by the context
  //     });
  //   }
  //   setQuickAddMode(false);
  // };

  // Función para manejar el toggle de selección rápida de roles
  const handleQuickRoleToggle = (roleId: number) => {
    setSelectedQuickRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  // Función para agregar los roles seleccionados
  const handleQuickAddSelected = () => {
    selectedQuickRoles.forEach(roleId => {
      const role = getRoleInfo(roleId);
      if (role) {
        const hours = 40;
        const rate = currency === 'USD' 
          ? ((role as any).defaultRateUsd || 50)
          : (role.defaultRate || 5000);
        addTeamMember({
          roleId,
          personnelId: null,
          hours,
          rate,
          cost: 0 // Will be recalculated by the context
        });
      }
    });
    setQuickAddMode(false);
    setSelectedQuickRoles(new Set());
  };

  // Función para manejar el toggle de selección rápida de personal
  const handleQuickPersonnelToggle = (personnelId: number) => {
    setSelectedQuickPersonnel(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personnelId)) {
        newSet.delete(personnelId);
      } else {
        newSet.add(personnelId);
      }
      return newSet;
    });
  };

  // Función para agregar el personal seleccionado
  const handleQuickAddSelectedPersonnel = () => {
    selectedQuickPersonnel.forEach(personnelId => {
      const person = getPersonnelInfo(personnelId);
      if (person) {
        // If personnel has specific roles, try to find an appropriate one
        // For now, we'll use a default role or let user select
        const defaultRole = availableRoles.find(role => role.id === 1) || availableRoles[0]; // Default to first role
        if (defaultRole) {
          const hours = 40;
          const rate = getCorrectRate(person, defaultRole);
          addTeamMember({
            roleId: defaultRole.id,
            personnelId: personnelId,
            hours,
            rate,
            cost: 0 // Will be recalculated by the context
          });
        }
      }
    });
    setQuickPersonnelMode(false);
    setSelectedQuickPersonnel(new Set());
  };




  // Iniciar edición
  const startEditing = (memberId: string, currentHours: number, currentRate: number) => {
    setEditingMember(memberId);
    setEditValues(prev => ({
      ...prev,
      [memberId]: { hours: currentHours, rate: currentRate }
    }));
    // Inicializar valores temporales como strings
    setTempEditValues(prev => ({
      ...prev,
      [memberId]: { 
        hours: String(currentHours), 
        rate: String(currentRate) 
      }
    }));
  };

  // Guardar edición
  const saveEdit = (memberId: string) => {
    const tempValues = tempEditValues[memberId];
    if (tempValues) {
      const hours = tempValues.hours === '' ? 0 : parseInt(tempValues.hours) || 0;
      const rate = tempValues.rate === '' ? 0 : parseFloat(tempValues.rate) || 0;
      
      updateTeamMember(memberId, { hours, rate });
    }
    setEditingMember(null);
  };

  // Cancelar edición
  const cancelEdit = () => {
    setEditingMember(null);
    setEditValues({});
  };

  // Calcular totales
  const totalCost = draggedMembers.reduce((sum, member) => sum + member.cost, 0);
  const totalHours = draggedMembers.reduce((sum, member) => sum + member.hours, 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-xl">
                <Users className="mr-3 h-6 w-6 text-primary" />
                Configuración del Equipo
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Define los roles y personal que trabajarán en este proyecto
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{draggedMembers.length}</div>
              <div className="text-xs text-muted-foreground">miembros</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total horas:</span>
              <span className="font-bold text-blue-600">{totalHours}h</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calculator className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Costo total:</span>
              <span className="font-bold text-green-600">
                ${formatQuotedAmount(totalCost)} {currencyLabel}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Promedio/hora:</span>
              <span className="font-bold text-purple-600">
                ${formatQuotedAmount(totalHours > 0 ? totalCost / totalHours : 0)} {currencyLabel}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mes de salarios a considerar */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="py-3 px-4 flex flex-col md:flex-row md:items-center md:justify-center gap-4">
          <div className="text-center md:max-w-xl">
            <Label className="text-sm font-medium text-amber-900">Mes de salarios a considerar</Label>
            <p className="text-xs text-amber-700">
              Se usará como tarifa por defecto al agregar personas. Podés ajustar manualmente cada fila después.
            </p>
          </div>
          <div className="flex w-full flex-col items-center gap-1 md:w-64">
            <Select
              value={quotationData.salaryMonth ?? SALARY_MONTH_AUTO}
              onValueChange={(value) => updateSalaryMonth(value === SALARY_MONTH_AUTO ? null : value)}
            >
              <SelectTrigger className="w-full bg-white [&>span]:w-full [&>span]:text-center">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SALARY_MONTH_AUTO}>Más reciente disponible</SelectItem>
                {SALARY_MONTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!quotationData.salaryMonth && (
              <span className="text-xs text-amber-700 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Usando:&nbsp;
                <span className="font-medium">{
                  SALARY_MONTH_OPTIONS.find(o => o.value === getResolvedSalaryMonth())?.label
                  ?? getResolvedSalaryMonth()
                  ?? '—'
                }</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fuente del valor hora */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="py-3 px-4 flex flex-col md:flex-row md:items-center md:justify-center gap-4">
          <div className="text-center md:max-w-xl">
            <Label className="text-sm font-medium text-blue-900">Fuente del valor hora</Label>
            <p className="text-xs text-blue-700">
              Elegí la foto mensual o el promedio anual para esta cotización.
            </p>
          </div>
          <div className="flex w-full flex-col items-center gap-1 md:w-64">
            <Select
              value={quotationData.inflation.rateProjectionMode ?? 'current'}
              onValueChange={(v) => updateInflation({ rateProjectionMode: v as any })}
            >
              <SelectTrigger className="w-full bg-white [&>span]:w-full [&>span]:text-center">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATE_PROJECTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-center text-[11px] leading-snug text-blue-700">
              {RATE_PROJECTION_OPTIONS.find(
                (opt) => opt.value === (quotationData.inflation.rateProjectionMode ?? 'current')
              )?.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setQuickAddMode(!quickAddMode)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar por Rol
        </Button>
        <Button
          onClick={() => setQuickPersonnelMode(!quickPersonnelMode)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Agregar Personas
        </Button>
      </div>

      {/* Modo de agregado rápido */}
        {quickAddMode && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-blue-900">Selecciona roles para agregar rápidamente:</h4>
                <p className="text-xs text-blue-600 mt-1">
                  {selectedQuickRoles.size > 0 
                    ? `${selectedQuickRoles.size} rol${selectedQuickRoles.size > 1 ? 'es' : ''} seleccionado${selectedQuickRoles.size > 1 ? 's' : ''}`
                    : 'Haz clic en los roles que deseas agregar'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {selectedQuickRoles.size > 0 && (
                  <Button 
                    size="sm"
                    onClick={handleQuickAddSelected}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                  >
                    Agregar {selectedQuickRoles.size} rol{selectedQuickRoles.size > 1 ? 'es' : ''}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setQuickAddMode(false);
                    setSelectedQuickRoles(new Set());
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {availableRoles.map(role => {
                const isSelected = selectedQuickRoles.has(role.id);
                const isAlreadyInTeam = quotationData.teamMembers.some(member => member.roleId === role.id);

                return (
                  <Button
                    key={role.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickRoleToggle(role.id)}
                    disabled={isAlreadyInTeam}
                    className={`text-xs p-2 h-auto text-left justify-start transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : isAlreadyInTeam
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-100 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center w-full">
                      <div className="flex-grow">
                        <div className="font-medium">{role.name}</div>
                        <div className={`${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                          ${formatQuotedAmount(currency === 'USD' ? ((role as any).defaultRateUsd || 0) : role.defaultRate)} {currencyLabel}/h
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-2 text-white">✓</div>
                      )}
                      {isAlreadyInTeam && (
                        <div className="ml-2 text-gray-400 text-xs">Ya agregado</div>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

      {/* Modo de agregado rápido de personal */}
        {quickPersonnelMode && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-green-900">Selecciona personas para agregar rápidamente:</h4>
                <p className="text-xs text-green-600 mt-1">
                  {selectedQuickPersonnel.size > 0 
                    ? `${selectedQuickPersonnel.size} persona${selectedQuickPersonnel.size > 1 ? 's' : ''} seleccionada${selectedQuickPersonnel.size > 1 ? 's' : ''}`
                    : 'Haz clic en las personas que deseas agregar'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {selectedQuickPersonnel.size > 0 && (
                  <Button 
                    size="sm"
                    onClick={handleQuickAddSelectedPersonnel}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                  >
                    Agregar {selectedQuickPersonnel.size} persona{selectedQuickPersonnel.size > 1 ? 's' : ''}
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setQuickPersonnelMode(false);
                    setSelectedQuickPersonnel(new Set());
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {availablePersonnel.map(person => {
                const isSelected = selectedQuickPersonnel.has(person.id);
                const isAlreadyInTeam = quotationData.teamMembers.some(member => member.personnelId === person.id);

                return (
                  <Button
                    key={person.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickPersonnelToggle(person.id)}
                    disabled={isAlreadyInTeam}
                    className={`text-xs p-2 h-auto text-left justify-start transition-all ${
                      isSelected 
                        ? 'bg-green-600 text-white border-green-600' 
                        : isAlreadyInTeam
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white hover:bg-green-100 border-green-200'
                    }`}
                  >
                    <div className="flex items-center w-full">
                      <div className="flex-grow min-w-0">
                        <div className="font-medium flex items-center gap-1 flex-wrap">
                          <span className="truncate">{person.name}</span>
                          {(person as any).billingCurrency === 'USD' && (
                            <span className={`text-[10px] px-1 py-0 rounded font-semibold flex-shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>USD</span>
                          )}
                          {(person as any).billingCurrency === 'mixed' && (
                            <span className={`text-[10px] px-1 py-0 rounded font-semibold flex-shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700'}`}>MIX</span>
                          )}
                        </div>
                        <div className={`${isSelected ? 'text-green-200' : 'text-gray-500'}`}>
                          {getPersonnelRate(person.id, currency) > 0
                            ? `$${formatQuotedAmount(getPersonnelRate(person.id, currency))} ${currencyLabel}/h`
                            : "Sin tarifa histórica"}
                          {isReferenceConversion(person) && !isReferenceConversionMissingFx(person) && <span className="ml-1 text-[10px]">(ref. USD→ARS)</span>}
                          {isReferenceConversionMissingFx(person) && <span className="ml-1 text-[10px] text-amber-600">(falta tipo de cambio)</span>}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="ml-2 text-white">✓</div>
                      )}
                      {isAlreadyInTeam && (
                        <div className="ml-2 text-gray-400 text-xs">Ya agregado</div>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}



      {/* Lista de miembros con drag & drop */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Equipo del Proyecto</h3>
          {draggedMembers.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              Arrastra para reordenar
            </Badge>
          )}
        </div>

        <AnimatePresence>
          {draggedMembers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                No hay miembros en el equipo
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Utiliza el formulario anterior para añadir miembros al equipo del proyecto
              </p>
            </motion.div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={draggedMembers} 
              onReorder={handleReorder}
              className="space-y-3"
            >
              {draggedMembers.map((member) => {
                const role = getRoleInfo(member.roleId);
                const personnel = getPersonnelInfo(member.personnelId);
                const isEditing = editingMember === member.id;

                return (
                  <Reorder.Item 
                    key={member.id} 
                    value={member}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="hover:shadow-md transition-all border-l-4 border-l-primary/30">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[auto_minmax(12rem,1fr)_minmax(18rem,auto)_auto]">
                            {/* Drag handle */}
                            <div className="flex-shrink-0">
                              <GripVertical className="h-5 w-5 text-gray-400" />
                            </div>

                            {/* Role info */}
                            <div className="min-w-0 text-center">
                              <div className="mb-1 flex items-center justify-center space-x-2">
                                <Badge variant="outline" className="font-medium">
                                  {(() => {
                                    const foundRole = availableRoles.find(r => r.id === member.roleId);
                                    console.log('🏷️ Role lookup:', { 
                                      roleId: member.roleId, 
                                      availableRolesCount: availableRoles.length,
                                      foundRole: foundRole?.name,
                                      allRoles: availableRoles.map(r => ({ id: r.id, name: r.name }))
                                    });
                                    return foundRole?.name || `Rol ${member.roleId}`;
                                  })()}
                                </Badge>
                                {recommendedRoleIds.includes(member.roleId) && (
                                  <Star className="h-3 w-3 text-yellow-500" />
                                )}
                              </div>
                              <div className="flex items-center justify-center space-x-1 text-sm text-gray-600">
                                <User className="h-3 w-3" />
                                <span>{(() => {
                                  if (!member.personnelId) return 'Sin asignar';
                                  const foundPerson = availablePersonnel.find(p => p.id === member.personnelId);
                                  return foundPerson?.name || `Personal ${member.personnelId}`;
                                })()}</span>
                                {(() => {
                                  const p = availablePersonnel.find(p => p.id === member.personnelId);
                                  const bc = (p as any)?.billingCurrency;
                                  if (!p) return null;
                                  return <>
                                    {bc === 'USD' && <span className="text-[10px] px-1 rounded bg-green-100 text-green-700 font-semibold">USD</span>}
                                    {bc === 'mixed' && <span className="text-[10px] px-1 rounded bg-yellow-100 text-yellow-700 font-semibold">MIX</span>}
                                    {isReferenceConversion(p) && !isReferenceConversionMissingFx(p) && <span className="text-[10px] px-1 rounded bg-blue-100 text-blue-700 font-semibold">ref. USD→ARS</span>}
                                    {isReferenceConversionMissingFx(p) && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700 font-semibold">sin FX</span>}
                                  </>;
                                })()}
                              </div>
                            </div>

                            {/* Hours and rate - editable */}
                            <div className="flex items-center space-x-4">
                              {isEditing ? (
                                <>
                                  <div className="flex items-center space-x-2">
                                    <Input
                                      type="number"
                                      value={tempEditValues[member.id]?.hours !== undefined ? tempEditValues[member.id].hours : member.hours}
                                      onChange={(e) => setTempEditValues(prev => ({
                                        ...prev,
                                        [member.id]: {
                                          ...prev[member.id],
                                          hours: e.target.value
                                        }
                                      }))}
                                      className="w-16 h-8 text-xs"
                                    />
                                    <span className="text-xs text-gray-500">h</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={tempEditValues[member.id]?.rate !== undefined ? tempEditValues[member.id].rate : member.rate}
                                      onChange={(e) => setTempEditValues(prev => ({
                                        ...prev,
                                        [member.id]: {
                                          ...prev[member.id],
                                          rate: e.target.value
                                        }
                                      }))}
                                      className="w-20 h-8 text-xs"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-center">
                                    <div className="font-medium text-sm">{member.hours}h</div>
                                    <div className="text-xs text-gray-500">horas</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-sm">
                                      ${formatQuotedAmount(member.rate)}
                                    </div>
                                    <div className="text-xs text-gray-500">{currencyLabel}/hora</div>
                                  </div>
                                </>
                              )}

                              {/* Cost */}
                              <div className="text-center">
                                <div className="font-bold text-lg text-primary">
                                  ${(() => {
                                    if (!isEditing) {
                                      return formatQuotedAmount(member.hours * member.rate);
                                    }

                                    const tempValues = tempEditValues[member.id];
                                    if (!tempValues) {
                                      return formatQuotedAmount(member.hours * member.rate);
                                    }

                                    const hours = tempValues.hours === '' ? member.hours : parseFloat(tempValues.hours) || 0;
                                    const rate = tempValues.rate === '' ? member.rate : parseFloat(tempValues.rate) || 0;

                                    return formatQuotedAmount(hours * rate);
                                  })()}
                                </div>
                                <div className="text-xs text-gray-500">total</div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-1">
                              {isEditing ? (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => saveEdit(member.id)}
                                    className="h-8 w-8 p-0 group"
                                  >
                                    <Check className="h-4 w-4 text-green-600 group-hover:text-white" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0 group"
                                  >
                                    <X className="h-4 w-4 text-red-600 group-hover:text-white" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => startEditing(member.id, member.hours, member.rate)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => removeTeamMember(member.id)}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EnhancedTeamConfig;

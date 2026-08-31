import React, { useState, useEffect, useRef } from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizePersonnelRole } from '@shared/utils/personnel-classification';
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
  Info,
  Search,
  ArrowUp,
  ArrowDown
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

type EnhancedTeamConfigProps = {
  validationMessage?: string;
};

const EnhancedTeamConfig: React.FC<EnhancedTeamConfigProps> = ({ validationMessage }) => {
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
  const [roleSearch, setRoleSearch] = useState('');
  const [personnelSearch, setPersonnelSearch] = useState('');



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
        const defaultRole = availableRoles.find(role => role.id === person.roleId);
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
  const normalizedRoleSearch = roleSearch.trim().toLocaleLowerCase('es');
  const normalizedPersonnelSearch = personnelSearch.trim().toLocaleLowerCase('es');
  const filteredRoles = availableRoles.filter((role) => role.name.toLocaleLowerCase('es').includes(normalizedRoleSearch));
  const filteredPersonnel = availablePersonnel.filter((person) =>
    person.name.toLocaleLowerCase('es').includes(normalizedPersonnelSearch) ||
    (person.currentRole || '').toLocaleLowerCase('es').includes(normalizedPersonnelSearch),
  );

  const moveMember = (memberId: string, direction: -1 | 1) => {
    const index = draggedMembers.findIndex((member) => member.id === memberId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draggedMembers.length) return;
    const reordered = [...draggedMembers];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    handleReorder(reordered);
  };

  /**
   * Candidatos para un puesto, ordenados por afinidad con el rol cotizado.
   * "Lead PM" mapea al nivel 4 Lead, así que quienes tienen ese nivel aparecen
   * primero. No se filtra en duro: un puesto sin nadie del nivel dejaría el
   * selector vacío y bloquearía el armado del equipo.
   */
  const candidatesForMember = (member: DragDropTeamMember) => {
    const taken = new Set(
      quotationData.teamMembers
        .filter((teamMember) => teamMember.personnelId && teamMember.id !== member.id)
        .map((teamMember) => teamMember.personnelId),
    );
    const available = availablePersonnel.filter((person) => !taken.has(person.id));
    const targetLevel = normalizePersonnelRole(getRoleInfo(member.roleId)?.name);
    if (!targetLevel) return { matching: [], others: available };
    return {
      matching: available.filter((person) => normalizePersonnelRole((person as any).currentRole) === targetLevel),
      others: available.filter((person) => normalizePersonnelRole((person as any).currentRole) !== targetLevel),
      targetLevel,
    };
  };

  const assignPersonnel = (member: DragDropTeamMember, value: string) => {
    const personnelId = Number(value);
    const person = availablePersonnel.find((candidate) => candidate.id === personnelId);
    if (!person) return;
    const role = getRoleInfo(member.roleId);
    const rate = getCorrectRate(person, role);
    updateTeamMember(member.id, {
      personnelId,
      rate,
      cost: Number(member.hours || 0) * rate,
    });
  };

  return (
    <div id="team-config" className="space-y-6" tabIndex={-1}>
      {validationMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {validationMessage}
        </div>
      )}
      {(availableRoles.length === 0 || availablePersonnel.length === 0) && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>No hay {availableRoles.length === 0 && availablePersonnel.length === 0 ? 'roles ni personas' : availableRoles.length === 0 ? 'roles' : 'personas'} disponibles en el catálogo.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => { loadRoles(); loadPersonnel(); }}>
            Volver a cargar
          </Button>
        </div>
      )}

      {/* Header con estadísticas */}
      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                <Users className="h-5 w-5 text-indigo-600" />
                Configuración del equipo
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Definí los roles y las personas que trabajarán en este proyecto
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums text-slate-950">{draggedMembers.length}</div>
              <div className="text-xs text-slate-500">miembros</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TeamMetric icon={Clock} label="Total horas" value={`${totalHours.toFixed(2)} h`} />
            <TeamMetric icon={Calculator} label="Costo total" value={`$${formatQuotedAmount(totalCost)} ${currencyLabel}`} />
            <TeamMetric
              icon={DollarSign}
              label="Promedio/hora"
              value={`$${formatQuotedAmount(totalHours > 0 ? totalCost / totalHours : 0)} ${currencyLabel}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mes de salarios a considerar */}
      <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-center">
        <div className="text-center md:max-w-xl">
          <Label className="text-sm font-medium text-amber-900">Mes de salarios a considerar</Label>
          <p className="mt-1 text-xs text-amber-700">
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
            <span className="flex items-center gap-1 text-xs text-amber-700">
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
      </div>

      {/* Fuente del valor hora */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-center">
        <div className="text-center md:max-w-xl">
          <Label className="text-sm font-medium text-slate-900">Fuente del valor hora</Label>
          <p className="mt-1 text-xs text-slate-500">
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
          <p className="text-center text-[11px] leading-snug text-slate-500">
            {RATE_PROJECTION_OPTIONS.find(
              (opt) => opt.value === (quotationData.inflation.rateProjectionMode ?? 'current')
            )?.description}
          </p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setQuickAddMode(!quickAddMode)}
          aria-expanded={quickAddMode}
          aria-controls="quick-role-picker"
          variant="outline"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar por rol
        </Button>
        <Button
          onClick={() => setQuickPersonnelMode(!quickPersonnelMode)}
          aria-expanded={quickPersonnelMode}
          aria-controls="quick-personnel-picker"
          variant="outline"
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Agregar personas
        </Button>
      </div>

      {/* Modo de agregado rápido */}
      {quickAddMode && (
        <div id="quick-role-picker" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-950">Seleccioná los roles que querés agregar</h4>
              <p className="mt-1 text-xs text-slate-500">
                {selectedQuickRoles.size > 0
                  ? `${selectedQuickRoles.size} rol${selectedQuickRoles.size > 1 ? 'es' : ''} seleccionado${selectedQuickRoles.size > 1 ? 's' : ''}`
                  : 'Elegí uno o más roles de la lista'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {selectedQuickRoles.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleQuickAddSelected}
                >
                  Agregar {selectedQuickRoles.size} rol{selectedQuickRoles.size > 1 ? 'es' : ''}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuickAddMode(false);
                  setSelectedQuickRoles(new Set());
                }}
                aria-label="Cerrar selector de roles"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Buscar rol..." className="bg-white pl-9" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRoles.map(role => {
              const isSelected = selectedQuickRoles.has(role.id);
              const isAlreadyInTeam = quotationData.teamMembers.some(member => member.roleId === role.id);

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleQuickRoleToggle(role.id)}
                  disabled={isAlreadyInTeam}
                  className={`rounded-lg border p-2 text-left text-xs transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                      : isAlreadyInTeam
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="flex w-full items-center">
                    <div className="flex-grow">
                      <div className={`font-medium ${isAlreadyInTeam ? 'text-slate-400' : 'text-slate-950'}`}>{role.name}</div>
                      <div className={isAlreadyInTeam ? 'text-slate-400' : 'text-slate-500'}>
                        ${formatQuotedAmount(currency === 'USD' ? ((role as any).defaultRateUsd || 0) : role.defaultRate)} {currencyLabel}/h
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="ml-2 h-4 w-4 flex-shrink-0 text-indigo-600" />
                    )}
                    {isAlreadyInTeam && (
                      <div className="ml-2 flex-shrink-0 text-xs text-slate-400">Ya agregado</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modo de agregado rápido de personal */}
      {quickPersonnelMode && (
        <div id="quick-personnel-picker" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-950">Seleccioná las personas que querés agregar</h4>
              <p className="mt-1 text-xs text-slate-500">
                {selectedQuickPersonnel.size > 0
                  ? `${selectedQuickPersonnel.size} persona${selectedQuickPersonnel.size > 1 ? 's' : ''} seleccionada${selectedQuickPersonnel.size > 1 ? 's' : ''}`
                  : 'Elegí una o más personas de la lista'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {selectedQuickPersonnel.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleQuickAddSelectedPersonnel}
                >
                  Agregar {selectedQuickPersonnel.size} persona{selectedQuickPersonnel.size > 1 ? 's' : ''}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuickPersonnelMode(false);
                  setSelectedQuickPersonnel(new Set());
                }}
                aria-label="Cerrar selector de personas"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={personnelSearch} onChange={(event) => setPersonnelSearch(event.target.value)} placeholder="Buscar persona o rol..." className="bg-white pl-9" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPersonnel.map(person => {
              const isSelected = selectedQuickPersonnel.has(person.id);
              const isAlreadyInTeam = quotationData.teamMembers.some(member => member.personnelId === person.id);

              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => handleQuickPersonnelToggle(person.id)}
                  disabled={isAlreadyInTeam}
                  className={`rounded-lg border p-2 text-left text-xs transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                      : isAlreadyInTeam
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="flex w-full items-center">
                    <div className="min-w-0 flex-grow">
                      <div className={`flex flex-wrap items-center gap-1 font-medium ${isAlreadyInTeam ? 'text-slate-400' : 'text-slate-950'}`}>
                        <span className="truncate">{person.name}</span>
                        {(person as any).billingCurrency === 'USD' && (
                          <span className="flex-shrink-0 rounded bg-indigo-100 px-1 py-0 text-[10px] font-semibold text-indigo-700">USD</span>
                        )}
                        {(person as any).billingCurrency === 'mixed' && (
                          <span className="flex-shrink-0 rounded bg-amber-100 px-1 py-0 text-[10px] font-semibold text-amber-700">MIX</span>
                        )}
                      </div>
                      <div className={isAlreadyInTeam ? 'text-slate-400' : 'text-slate-500'}>
                        {getPersonnelRate(person.id, currency) > 0
                          ? `$${formatQuotedAmount(getPersonnelRate(person.id, currency))} ${currencyLabel}/h`
                          : "Sin tarifa histórica"}
                        {isReferenceConversion(person) && !isReferenceConversionMissingFx(person) && <span className="ml-1 text-[10px]">(ref. USD→ARS)</span>}
                        {isReferenceConversionMissingFx(person) && <span className="ml-1 text-[10px] text-amber-600">(falta tipo de cambio)</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="ml-2 h-4 w-4 flex-shrink-0 text-indigo-600" />
                    )}
                    {isAlreadyInTeam && (
                      <div className="ml-2 flex-shrink-0 text-xs text-slate-400">Ya agregado</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de miembros con drag & drop */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950">Equipo del proyecto</h3>
          {draggedMembers.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              Arrastrá o usá las flechas para reordenar
            </Badge>
          )}
        </div>

        <AnimatePresence>
          {draggedMembers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center"
            >
              <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-sm text-slate-500">
                No hay miembros en el equipo
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Usá los botones de arriba para agregar integrantes al proyecto
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
                      <Card className={`shadow-none transition-colors ${isEditing ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200'}`}>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[auto_minmax(12rem,1fr)_minmax(18rem,auto)_auto]">
                            {/* Drag handle */}
                            <div className="flex-shrink-0">
                              <GripVertical aria-hidden="true" className="h-5 w-5 text-slate-400" />
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
                                  <Star className="h-3 w-3 text-amber-500" />
                                )}
                              </div>
                              <div className="flex items-center justify-center space-x-1 text-sm text-slate-600">
                                <User className="h-3 w-3 flex-shrink-0" />
                                {!member.personnelId ? (
                                  <Select onValueChange={(value) => assignPersonnel(member, value)}>
                                    <SelectTrigger
                                      className="h-8 w-[190px] border-amber-300 bg-amber-50 text-xs text-amber-900"
                                      aria-label={`Asignar persona al rol ${role?.name || member.roleId}`}
                                    >
                                      <SelectValue placeholder="Asignar persona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const { matching, others, targetLevel } = candidatesForMember(member);
                                        return (
                                          <>
                                            {matching.length > 0 && (
                                              <SelectGroup>
                                                <SelectLabel className="text-[11px] text-emerald-700">{targetLevel} · perfil del rol</SelectLabel>
                                                {matching.map((candidate) => (
                                                  <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.name}</SelectItem>
                                                ))}
                                              </SelectGroup>
                                            )}
                                            {others.length > 0 && (
                                              <SelectGroup>
                                                {matching.length > 0 && <SelectLabel className="text-[11px] text-slate-500">Otros perfiles</SelectLabel>}
                                                {others.map((candidate) => (
                                                  <SelectItem key={candidate.id} value={String(candidate.id)}>
                                                    {candidate.name}
                                                    {(candidate as any).currentRole ? ` · ${(candidate as any).currentRole}` : ''}
                                                  </SelectItem>
                                                ))}
                                              </SelectGroup>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span>{availablePersonnel.find(p => p.id === member.personnelId)?.name || `Personal ${member.personnelId}`}</span>
                                )}
                                {(() => {
                                  const p = availablePersonnel.find(p => p.id === member.personnelId);
                                  const bc = (p as any)?.billingCurrency;
                                  if (!p) return null;
                                  return <>
                                    {bc === 'USD' && <span className="text-[10px] px-1 rounded bg-indigo-100 text-indigo-700 font-semibold">USD</span>}
                                    {bc === 'mixed' && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700 font-semibold">MIX</span>}
                                    {isReferenceConversion(p) && !isReferenceConversionMissingFx(p) && <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-700 font-semibold">ref. USD→ARS</span>}
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
                                      aria-label={`Horas de ${personnel?.name || role?.name || 'integrante'}`}
                                      value={tempEditValues[member.id]?.hours !== undefined ? tempEditValues[member.id].hours : member.hours}
                                      onChange={(e) => setTempEditValues(prev => ({
                                        ...prev,
                                        [member.id]: {
                                          ...prev[member.id],
                                          hours: e.target.value
                                        }
                                      }))}
                                      className="h-8 w-16 text-xs"
                                    />
                                    <span className="text-xs text-slate-500">h</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs">$</span>
                                    <Input
                                      type="number"
                                      aria-label={`Tarifa por hora de ${personnel?.name || role?.name || 'integrante'}`}
                                      step="0.01"
                                      value={tempEditValues[member.id]?.rate !== undefined ? tempEditValues[member.id].rate : member.rate}
                                      onChange={(e) => setTempEditValues(prev => ({
                                        ...prev,
                                        [member.id]: {
                                          ...prev[member.id],
                                          rate: e.target.value
                                        }
                                      }))}
                                      className="h-8 w-20 text-xs"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-slate-950">{member.hours}h</div>
                                    <div className="text-xs text-slate-500">horas</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-sm font-medium text-slate-950">
                                      ${formatQuotedAmount(member.rate)}
                                    </div>
                                    <div className="text-xs text-slate-500">{currencyLabel}/hora</div>
                                  </div>
                                </>
                              )}

                              {/* Cost */}
                              <div className="text-center">
                                <div className="text-lg font-semibold tabular-nums text-indigo-600">
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
                                <div className="text-xs text-slate-500">total</div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => moveMember(member.id, -1)}
                                disabled={draggedMembers[0]?.id === member.id}
                                className="h-8 w-8 p-0"
                                aria-label={`Subir ${personnel?.name || role?.name || 'integrante'}`}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => moveMember(member.id, 1)}
                                disabled={draggedMembers[draggedMembers.length - 1]?.id === member.id}
                                className="h-8 w-8 p-0"
                                aria-label={`Bajar ${personnel?.name || role?.name || 'integrante'}`}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => saveEdit(member.id)}
                                    className="h-8 w-8 p-0 group"
                                    aria-label="Guardar cambios del integrante"
                                  >
                                    <Check className="h-4 w-4 text-emerald-600 group-hover:text-white" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0 group"
                                    aria-label="Cancelar edición del integrante"
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
                                    aria-label={`Editar ${personnel?.name || role?.name || 'integrante'}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeTeamMember(member.id)}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                    aria-label={`Eliminar ${personnel?.name || role?.name || 'integrante'}`}
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

function TeamMetric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <strong className="mt-1 block text-lg tabular-nums text-slate-950">{value}</strong>
    </div>
  );
}

export default EnhancedTeamConfig;

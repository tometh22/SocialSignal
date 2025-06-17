import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, CalendarDays, Clock, User, DollarSign, Calculator, Info } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface CostTimeEntryFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CostTimeEntryForm({ projectId, open, onOpenChange }: CostTimeEntryFormProps) {
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("");
  const [entryType, setEntryType] = useState<"hours" | "cost">("hours");
  const [hours, setHours] = useState<string>("");
  const [totalCost, setTotalCost] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDateRange, setIsDateRange] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personnel = [] } = useQuery({
    queryKey: ["/api/personnel"],
  });

  const personnelArray = Array.isArray(personnel) ? personnel as any[] : [];
  const selectedPerson = personnelArray.find((p: any) => p.id.toString() === selectedPersonnel);
  const currentHourlyRate = selectedPerson?.hourlyRate || 0;

  // Manejadores para cálculos en tiempo real
  const handleHoursChange = (value: string) => {
    setHours(value);

    if (entryType === "hours" && value && currentHourlyRate > 0) {
      const numHours = parseFloat(value) || 0;
      const calculatedCost = numHours * currentHourlyRate;
      setTotalCost(calculatedCost.toFixed(2));
    }
  };

  const handleCostChange = (value: string) => {
    setTotalCost(value);

    if (entryType === "cost" && value && currentHourlyRate > 0) {
      const numCost = parseFloat(value) || 0;
      const calculatedHours = numCost / currentHourlyRate;
      // Asegurar que las horas calculadas sean razonables (máximo 744 horas por mes)
      const reasonableHours = Math.min(calculatedHours, 744);
      setHours(reasonableHours.toFixed(2));
    }
  };

  // Efecto para limpiar campos cuando cambia el tipo de entrada
  useEffect(() => {
    if (entryType === "hours") {
      setTotalCost("");
    } else {
      setHours("");
    }
  }, [entryType]);

  const createTimeEntry = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/time-entries", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Registro creado exitosamente",
        description: entryType === "hours" 
          ? "Las horas y costos se han registrado correctamente" 
          : "Los costos y horas se han registrado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al crear registro",
        description: error.message || "Ocurrió un error inesperado",
      });
    },
  });

  const resetForm = () => {
    setSelectedPersonnel("");
    setHours("");
    setTotalCost("");
    setDescription("");
    setDate(new Date());
    setStartDate(new Date());
    setEndDate(new Date());
    setIsDateRange(false);
    setEntryType("hours");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPersonnel) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Por favor selecciona el personal",
      });
      return;
    }

    // Validar fechas según el tipo seleccionado
    if (!isDateRange && !date) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Por favor selecciona una fecha",
      });
      return;
    }

    if (isDateRange && (!startDate || !endDate)) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Por favor selecciona las fechas de inicio y fin",
      });
      return;
    }

    const finalHours = parseFloat(hours) || 0;
    const finalCost = parseFloat(totalCost) || 0;

    if (finalHours <= 0 || finalCost <= 0) {
      toast({
        variant: "destructive",
        title: "Valores inválidos",
        description: "Las horas y el costo deben ser mayores a cero",
      });
      return;
    }

    // Crear entrada usando la fecha principal o la fecha de inicio si es un rango
    const entryDate = isDateRange ? startDate! : date!;

    // Crear descripción del período automática
    let periodDescription = "";
    if (isDateRange && startDate && endDate) {
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      periodDescription = `${format(startDate, "dd/MM/yyyy", { locale: es })} - ${format(endDate, "dd/MM/yyyy", { locale: es })} (${daysDiff} días)`;
    }

    createTimeEntry.mutate({
      projectId: parseInt(projectId),
      personnelId: parseInt(selectedPersonnel),
      hours: finalHours,
      totalCost: finalCost,
      hourlyRateAtTime: currentHourlyRate,
      entryType,
      description: description,
      date: entryDate.toISOString(),
      isDateRange: isDateRange,
      startDate: isDateRange ? startDate!.toISOString() : undefined,
      endDate: isDateRange ? endDate!.toISOString() : undefined,
      periodDescription: periodDescription || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 border-0 shadow-2xl backdrop-blur-sm">
        <DialogHeader className="pb-8 border-b border-slate-200/50">
          <DialogTitle className="flex items-center gap-4 text-2xl font-bold">
            <div className="p-3 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Calculator className="h-7 w-7 text-white" />
            </div>
            <span className="bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
              Registrar Costos y Tiempo
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 pt-2">
          {/* Selector de Persona */}
          <div className="space-y-4">
            <Label className="flex items-center gap-3 text-lg font-semibold text-slate-700">
              <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg shadow-md">
                <User className="h-5 w-5 text-white" />
              </div>
              Miembro del Equipo *
            </Label>
            <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
              <SelectTrigger className="h-14 bg-white/80 border-2 border-slate-200 hover:border-emerald-300 focus:border-emerald-400 shadow-sm backdrop-blur-sm transition-all duration-200">
                <SelectValue placeholder="Seleccionar persona..." />
              </SelectTrigger>
              <SelectContent>
                {personnelArray.map((person: any) => (
                  <SelectItem key={person.id} value={person.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{person.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        ${person.hourlyRate}/h
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Método de Registro */}
          <div className="space-y-6">
            <Label className="flex items-center gap-3 text-lg font-semibold text-slate-700">
              <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg shadow-md">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              Método de Registro
            </Label>
            <RadioGroup value={entryType} onValueChange={(value) => setEntryType(value as "hours" | "cost")} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cn(
                "relative p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer group",
                entryType === "hours" 
                  ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg ring-2 ring-blue-200" 
                  : "border-slate-200 bg-white/70 hover:border-slate-300 hover:shadow-md"
              )}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="hours" id="hours" className="text-blue-600" />
                  <Label htmlFor="hours" className="flex items-center gap-3 cursor-pointer font-medium">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      entryType === "hours" ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600"
                    )}>
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold">Registrar por Horas Trabajadas</div>
                      <div className="text-sm text-slate-500">Ingresa las horas y se calcula el costo</div>
                    </div>
                  </Label>
                </div>
              </div>
              <div className={cn(
                "relative p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer group",
                entryType === "cost" 
                  ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg ring-2 ring-emerald-200" 
                  : "border-slate-200 bg-white/70 hover:border-slate-300 hover:shadow-md"
              )}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="cost" id="cost" className="text-emerald-600" />
                  <Label htmlFor="cost" className="flex items-center gap-3 cursor-pointer font-medium">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      entryType === "cost" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                    )}>
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold">Registrar por Costo Total</div>
                      <div className="text-sm text-slate-500">Ingresa el costo y se calculan las horas</div>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Campo Principal de Entrada */}
          <div className="space-y-6">
            {entryType === "hours" ? (
              <div className="space-y-4">
                <Label className="flex items-center gap-3 text-lg font-semibold text-slate-700">
                  <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-md">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  Horas Trabajadas *
                </Label>
                <div className="relative">
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="8.0"
                    value={hours}
                    onChange={(e) => handleHoursChange(e.target.value)}
                    className="h-16 text-2xl font-semibold text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 focus:border-blue-400 shadow-sm backdrop-blur-sm"
                  />
                  <div className="absolute -bottom-8 left-0 text-sm text-slate-500">
                    {selectedPerson && hours && `💰 Costo calculado: $${(parseFloat(hours) * currentHourlyRate).toFixed(2)}`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Label className="flex items-center gap-3 text-lg font-semibold text-slate-700">
                  <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg shadow-md">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  Costo Total *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-5 h-6 w-6 text-emerald-500 z-10" />
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="400.00"
                    value={totalCost}
                    onChange={(e) => handleCostChange(e.target.value)}
                    className="h-16 text-2xl font-semibold text-center pl-12 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 focus:border-emerald-400 shadow-sm backdrop-blur-sm"
                  />
                  <div className="absolute -bottom-8 left-0 text-sm text-slate-500">
                    {selectedPerson && totalCost && `⏱️ Horas calculadas: ${(parseFloat(totalCost) / currentHourlyRate).toFixed(2)}h`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cálculo en Tiempo Real */}
          {selectedPerson && (
            <div className="p-6 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/70 border-2 border-slate-200/60 rounded-2xl shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">Cálculo en Tiempo Real</span>
                {(hours || totalCost) && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {entryType === "hours" ? "Costo calculado" : "Horas calculadas"}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-white rounded-lg border">
                  <div className="text-xs text-gray-500 mb-1">Valor Hora</div>
                  <div className="text-lg font-bold text-gray-900">${currentHourlyRate}</div>
                  <div className="text-xs text-gray-400">por hora</div>
                </div>

                <div className="text-center p-3 bg-white rounded-lg border">
                  <div className="text-xs text-gray-500 mb-1">Horas</div>
                  <div className={`text-lg font-bold transition-colors ${
                    entryType === "hours" ? "text-blue-600" : "text-emerald-600"
                  }`}>
                    {hours || "0.00"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {entryType === "hours" ? "ingresado" : "calculado"}
                  </div>
                </div>

                <div className="text-center p-3 bg-white rounded-lg border">
                  <div className="text-xs text-gray-500 mb-1">Costo</div>
                  <div className={`text-lg font-bold transition-colors ${
                    entryType === "cost" ? "text-blue-600" : "text-emerald-600"
                  }`}>
                    ${totalCost || "0.00"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {entryType === "cost" ? "ingresado" : "calculado"}
                  </div>
                </div>
              </div>

              {(hours && totalCost && parseFloat(hours) > 0) && (
                <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-100 to-emerald-100 rounded-lg text-sm">
                  <span className="font-semibold text-blue-700">{hours}h</span>
                  <span className="text-gray-600">×</span>
                  <span className="text-gray-700">${currentHourlyRate}/h</span>
                  <span className="text-gray-600">=</span>
                  <span className="font-bold text-emerald-700">${totalCost}</span>
                </div>
              )}
            </div>
          )}

          {/* Período de Trabajo */}
          <div className="space-y-6">
            <Label className="flex items-center gap-3 text-lg font-semibold text-slate-700">
              <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg shadow-md">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              Período de Trabajo *
            </Label>

            {/* Selector de tipo de período con mejor diseño */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setIsDateRange(false)}
                className={cn(
                  "group relative p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden",
                  !isDateRange 
                    ? "border-purple-400 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 text-purple-700 shadow-lg ring-2 ring-purple-200" 
                    : "border-slate-200 bg-white/70 hover:border-slate-300 hover:shadow-md text-slate-600"
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    !isDateRange ? "bg-purple-500 text-white shadow-md" : "bg-slate-200 text-slate-600"
                  )}>
                    <CalendarIcon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg">Fecha única</div>
                    <div className="text-sm opacity-70">Un día específico</div>
                  </div>
                </div>
                {!isDateRange && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsDateRange(true)}
                className={cn(
                  "group relative p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden",
                  isDateRange 
                    ? "border-purple-400 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 text-purple-700 shadow-lg ring-2 ring-purple-200" 
                    : "border-slate-200 bg-white/70 hover:border-slate-300 hover:shadow-md text-slate-600"
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-xl transition-all duration-300",
                    isDateRange ? "bg-purple-500 text-white shadow-md" : "bg-slate-200 text-slate-600"
                  )}>
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg">Período</div>
                    <div className="text-sm opacity-70">Rango de fechas</div>
                  </div>
                </div>
                {isDateRange && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </button>
            </div>

            {!isDateRange ? (
              /* Fecha única */
              <div className="space-y-4 mb-6">
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <Label className="text-sm font-medium text-blue-900 mb-3 block">
                    Seleccionar fecha
                  </Label>
                  <Input
                    type="date"
                    value={date ? format(date, "yyyy-MM-dd") : ""}
                    onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)}
                    className="w-full h-12 text-lg border-blue-300 focus:border-blue-500 relative z-10"
                  />
                  {date && (
                    <div className="mt-3 text-sm text-blue-700 font-medium">
                      📅 {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Rango de fechas */
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-emerald-900">
                        📅 Fecha de inicio
                      </Label>
                      <Input
                        type="date"
                        value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                        onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-full h-11 border-emerald-300 focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-emerald-900">
                        📅 Fecha de fin
                      </Label>
                      <Input
                        type="date"
                        value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                        onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-full h-11 border-emerald-300 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Vista previa del período */}
                  {startDate && endDate && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
                      <div className="text-sm font-medium text-emerald-800 mb-1">
                        📊 Período seleccionado
                      </div>
                      <div className="text-emerald-700">
                        {format(startDate, "dd/MM/yyyy", { locale: es })} → {format(endDate, "dd/MM/yyyy", { locale: es })}
                      </div>
                      <div className="text-xs text-emerald-600 mt-1">
                        ⏱️ {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} días
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones rápidos organizados */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">Períodos rápidos:</div>
                  
                  {/* Períodos mensuales */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mensual</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          setStartDate(firstDay);
                          setEndDate(lastDay);
                        }}
                        className="text-xs h-8"
                      >
                        🗓️ Este mes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                          setStartDate(firstDay);
                          setEndDate(lastDay);
                        }}
                        className="text-xs h-8"
                      >
                        ⬅️ Mes pasado
                      </Button>
                    </div>
                  </div>

                  {/* Períodos semanales y quincenales */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Semanal y Quincenal</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const currentDay = now.getDay();
                          const firstDayOfWeek = new Date(now);
                          firstDayOfWeek.setDate(now.getDate() - currentDay + (currentDay === 0 ? -6 : 1));
                          const lastDayOfWeek = new Date(firstDayOfWeek);
                          lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
                          setStartDate(firstDayOfWeek);
                          setEndDate(lastDayOfWeek);
                        }}
                        className="text-xs h-8"
                      >
                        📅 Esta semana
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const currentDay = now.getDay();
                          const firstDayOfLastWeek = new Date(now);
                          firstDayOfLastWeek.setDate(now.getDate() - currentDay + (currentDay === 0 ? -6 : 1) - 7);
                          const lastDayOfLastWeek = new Date(firstDayOfLastWeek);
                          lastDayOfLastWeek.setDate(firstDayOfLastWeek.getDate() + 6);
                          setStartDate(firstDayOfLastWeek);
                          setEndDate(lastDayOfLastWeek);
                        }}
                        className="text-xs h-8"
                      >
                        ⬅️ Sem. pasada
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                          const lastDay = new Date(now.getFullYear(), now.getMonth(), 15);
                          setStartDate(firstDay);
                          setEndDate(lastDay);
                        }}
                        className="text-xs h-8"
                      >
                        1️⃣ 1ra quincena
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          const firstDay = new Date(now.getFullYear(), now.getMonth(), 16);
                          setStartDate(firstDay);
                          setEndDate(lastDay);
                        }}
                        className="text-xs h-8"
                      >
                        2️⃣ 2da quincena
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción del Trabajo</Label>
            <Textarea
              id="description"
              placeholder="Describe las actividades realizadas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="min-h-[80px]"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={createTimeEntry.isPending}
            >
              {createTimeEntry.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
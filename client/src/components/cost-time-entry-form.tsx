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

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Selector de Persona */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <User className="h-4 w-4 text-emerald-600" />
              Miembro del Equipo *
            </Label>
            <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
              <SelectTrigger className="h-10 bg-white border border-slate-300 hover:border-emerald-400 focus:border-emerald-500">
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
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="h-4 w-4 text-amber-600" />
              Método de Registro
            </Label>
            <RadioGroup value={entryType} onValueChange={(value) => setEntryType(value as "hours" | "cost")} className="grid grid-cols-2 gap-3">
              <div className={cn(
                "relative p-3 rounded-lg border-2 transition-all cursor-pointer",
                entryType === "hours" 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hours" id="hours" />
                  <Label htmlFor="hours" className="flex items-center gap-2 cursor-pointer text-sm">
                    <Clock className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Por Horas</div>
                    </div>
                  </Label>
                </div>
              </div>
              <div className={cn(
                "relative p-3 rounded-lg border-2 transition-all cursor-pointer",
                entryType === "cost" 
                  ? "border-emerald-500 bg-emerald-50" 
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cost" id="cost" />
                  <Label htmlFor="cost" className="flex items-center gap-2 cursor-pointer text-sm">
                    <DollarSign className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Por Costo</div>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Campo Principal de Entrada */}
          <div className="space-y-3">
            {entryType === "hours" ? (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock className="h-4 w-4 text-blue-600" />
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
                    className="h-10 text-right bg-white border border-slate-300 focus:border-blue-500"
                  />
                  {selectedPerson && hours && (
                    <div className="mt-1 text-xs text-slate-500">
                      Costo calculado: ${(parseFloat(hours) * currentHourlyRate).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Costo Total *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="400.00"
                    value={totalCost}
                    onChange={(e) => handleCostChange(e.target.value)}
                    className="h-10 text-right pl-8 bg-white border border-slate-300 focus:border-emerald-500"
                  />
                  {selectedPerson && totalCost && (
                    <div className="mt-1 text-xs text-slate-500">
                      Horas calculadas: {(parseFloat(totalCost) / currentHourlyRate).toFixed(2)}h
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>



          {/* Período de Trabajo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <CalendarDays className="h-4 w-4 text-purple-600" />
              Período de Trabajo *
            </Label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsDateRange(false)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  !isDateRange 
                    ? "border-purple-500 bg-purple-50 text-purple-700" 
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium text-sm">Fecha única</div>
                  <div className="text-xs opacity-70">Un día específico</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsDateRange(true)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  isDateRange 
                    ? "border-purple-500 bg-purple-50 text-purple-700" 
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                )}
              >
                <CalendarDays className="h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium text-sm">Período</div>
                  <div className="text-xs opacity-70">Rango de fechas</div>
                </div>
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
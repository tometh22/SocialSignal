import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    
    // Agregar descripción del período si es un rango
    let finalDescription = description;
    if (isDateRange && startDate && endDate) {
      const periodDescription = `Período: ${format(startDate, "dd/MM/yyyy", { locale: es })} - ${format(endDate, "dd/MM/yyyy", { locale: es })}`;
      finalDescription = finalDescription ? `${periodDescription}\n${description}` : periodDescription;
    }

    createTimeEntry.mutate({
      projectId: parseInt(projectId),
      personnelId: parseInt(selectedPersonnel),
      hours: finalHours,
      totalCost: finalCost,
      hourlyRateAtTime: currentHourlyRate,
      entryType,
      description: finalDescription,
      date: entryDate.toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Registrar Costos y Tiempo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selector de Persona */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Miembro del Equipo *
            </Label>
            <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
              <SelectTrigger>
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
            <Label>Método de Registro</Label>
            <RadioGroup value={entryType} onValueChange={(value) => setEntryType(value as "hours" | "cost")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hours" id="hours" />
                <Label htmlFor="hours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Registrar por Horas Trabajadas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cost" id="cost" />
                <Label htmlFor="cost" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Registrar por Costo Total
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Campo Principal de Entrada */}
          {entryType === "hours" ? (
            <div className="space-y-2">
              <Label htmlFor="hours">Horas Trabajadas *</Label>
              <Input
                id="hours"
                type="number"
                step="0.25"
                min="0"
                placeholder="8.0"
                value={hours}
                onChange={(e) => handleHoursChange(e.target.value)}
                className="text-lg"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="cost">Costo Total *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="400.00"
                  value={totalCost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  className="pl-9 text-lg"
                />
              </div>
            </div>
          )}

          {/* Cálculo en Tiempo Real */}
          {selectedPerson && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg">
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
          <div className="space-y-3">
            <Label>Período de Trabajo *</Label>
            
            {/* Selector de tipo de período */}
            <RadioGroup value={isDateRange ? "range" : "single"} onValueChange={(value) => setIsDateRange(value === "range")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single-date" />
                <Label htmlFor="single-date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Un día específico
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="range" id="date-range" />
                <Label htmlFor="date-range" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Período (ej: todo enero)
                </Label>
              </div>
            </RadioGroup>

            {!isDateRange ? (
              /* Fecha única */
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : (
              /* Rango de fechas */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Fecha de inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM", { locale: es }) : "Inicio"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div>
                  <Label className="text-xs text-gray-600">Fecha de fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM", { locale: es }) : "Fin"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Botones rápidos para períodos comunes */}
            {isDateRange && (
              <div className="flex flex-wrap gap-2">
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
                  className="text-xs"
                >
                  Este mes
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
                  className="text-xs"
                >
                  Mes pasado
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(2025, 0, 1); // Enero 2025
                    const lastDay = new Date(2025, 0, 31);
                    setStartDate(firstDay);
                    setEndDate(lastDay);
                  }}
                  className="text-xs"
                >
                  Enero 2025
                </Button>
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
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
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
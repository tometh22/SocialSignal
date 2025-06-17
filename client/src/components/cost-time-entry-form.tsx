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
import { Calendar as CalendarIcon, Clock, User, DollarSign, Calculator, Info } from "lucide-react";
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personnel = [] } = useQuery({
    queryKey: ["/api/personnel"],
  });

  const personnelArray = Array.isArray(personnel) ? personnel as any[] : [];
  const selectedPerson = personnelArray.find((p: any) => p.id.toString() === selectedPersonnel);
  const currentHourlyRate = selectedPerson?.hourlyRate || 0;

  // Cálculos bidireccionales
  useEffect(() => {
    if (!selectedPerson) return;

    if (entryType === "hours" && hours) {
      // Calcular costo basado en horas
      const calculatedCost = parseFloat(hours) * currentHourlyRate;
      setTotalCost(calculatedCost.toFixed(2));
    } else if (entryType === "cost" && totalCost) {
      // Calcular horas basado en costo
      const calculatedHours = parseFloat(totalCost) / currentHourlyRate;
      setHours(calculatedHours.toFixed(2));
    }
  }, [entryType, hours, totalCost, selectedPerson, currentHourlyRate]);

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
    setEntryType("hours");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPersonnel || !date) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios",
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

    createTimeEntry.mutate({
      projectId: parseInt(projectId),
      personnelId: parseInt(selectedPersonnel),
      hours: finalHours,
      totalCost: finalCost,
      hourlyRateAtTime: currentHourlyRate,
      entryType,
      description,
      date: date.toISOString(),
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
                onChange={(e) => setHours(e.target.value)}
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
                  onChange={(e) => setTotalCost(e.target.value)}
                  className="pl-9 text-lg"
                />
              </div>
            </div>
          )}

          {/* Cálculo Automático Mostrado */}
          {selectedPerson && (hours || totalCost) && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Cálculo Automático</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">Persona:</span>
                  <span className="font-medium text-blue-900">{selectedPerson.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">Valor hora actual:</span>
                  <span className="font-medium text-blue-900">${currentHourlyRate}/h</span>
                </div>
                <div className="border-t border-blue-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Horas:</span>
                    <span className="font-bold text-blue-900">{hours || "0"}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Costo total:</span>
                    <span className="font-bold text-blue-900">${totalCost || "0"}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 text-xs text-blue-600 bg-blue-100 p-2 rounded">
                {entryType === "hours" 
                  ? `${hours}h × $${currentHourlyRate}/h = $${totalCost}`
                  : `$${totalCost} ÷ $${currentHourlyRate}/h = ${hours}h`
                }
              </div>
            </div>
          )}

          {/* Fecha */}
          <div className="space-y-2">
            <Label>Fecha de Trabajo *</Label>
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
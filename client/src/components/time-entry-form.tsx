import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, User, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TimeEntryFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TimeEntryForm({ projectId, open, onOpenChange }: TimeEntryFormProps) {
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personnel = [] } = useQuery({
    queryKey: ["/api/personnel"],
    queryFn: () => fetch("/api/personnel").then(res => res.json()),
  });

  const createTimeEntry = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Error al registrar horas");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Horas registradas",
        description: "Las horas se han registrado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron registrar las horas",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedPersonnel("");
    setHours("");
    setDescription("");
    setStartDate(new Date());
    setEndDate(new Date());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPersonnel || !hours || !startDate || !endDate) {
      toast({
        title: "Campos incompletos",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    const selectedPerson = personnel.find((p: any) => p.id.toString() === selectedPersonnel);
    
    createTimeEntry.mutate({
      projectId: parseInt(projectId),
      personnelId: parseInt(selectedPersonnel),
      hours: parseFloat(hours),
      description,
      date: startDate.toISOString().split('T')[0], // Solo la fecha
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hourlyRate: selectedPerson?.hourlyRate || 0,
    });
  };

  const selectedPerson = personnel.find((p: any) => p.id.toString() === selectedPersonnel);
  const totalCost = selectedPerson && hours ? (parseFloat(hours) * selectedPerson.hourlyRate).toFixed(2) : "0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Registrar Horas de Trabajo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selección de Personal */}
          <div className="space-y-2">
            <Label htmlFor="personnel" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Miembro del Equipo
            </Label>
            <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar persona..." />
              </SelectTrigger>
              <SelectContent>
                {personnel.map((person: any) => (
                  <SelectItem key={person.id} value={person.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="font-medium">{person.name}</div>
                        <div className="text-xs text-gray-600">{person.roleName}</div>
                      </div>
                      <div className="text-sm font-medium text-blue-600 ml-4">
                        ${person.hourlyRate}/h
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horas Trabajadas */}
          <div className="space-y-2">
            <Label htmlFor="hours">Horas Trabajadas</Label>
            <Input
              id="hours"
              type="number"
              step="0.1"
              placeholder="8.0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          {/* Fecha de Inicio */}
          <div className="space-y-2">
            <Label>Fecha de Inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar fecha"}
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

          {/* Fecha de Fin */}
          <div className="space-y-2">
            <Label>Fecha de Fin</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar fecha"}
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

          {/* Resumen de Costo */}
          {selectedPerson && hours && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Costo Total</span>
                </div>
                <span className="text-lg font-bold text-blue-600">${totalCost}</span>
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {hours}h × ${selectedPerson.hourlyRate}/h = ${totalCost}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-4">
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
              {createTimeEntry.isPending ? "Guardando..." : "Registrar Horas"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
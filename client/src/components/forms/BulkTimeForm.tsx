import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "../../lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Users, Calculator, Save } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { roundToQuarterHour } from "@shared/utils/num";

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface BulkTimeFormProps {
  personnel: Personnel[];
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  updateLocalEntries: (entries: any[]) => void;
}

interface BulkEntryData {
  personnelId: number;
  hours: number;
  description: string;
  billable: boolean;
}

const bulkTimeSchema = z.object({
  date: z.date(),
  description: z.string().min(1, "La descripción es requerida"),
  entries: z.array(z.object({
    personnelId: z.number(),
    hours: z.number().min(0, "Las horas deben ser positivas").max(500, "Máximo 500 horas"),
    billable: z.boolean()
  }))
});

type BulkTimeFormData = z.infer<typeof bulkTimeSchema>;

export default function BulkTimeForm({ 
  personnel, 
  projectId, 
  onSuccess, 
  onCancel,
  updateLocalEntries 
}: BulkTimeFormProps) {
  const [entries, setEntries] = useState<BulkEntryData[]>(() => 
    personnel.map(person => ({
      personnelId: person.id,
      hours: 0,
      description: "",
      billable: true
    }))
  );
  
  const [globalDate, setGlobalDate] = useState<Date>(new Date());
  const [globalDescription, setGlobalDescription] = useState("");
  const [globalBillable, setGlobalBillable] = useState(true);

  const form = useForm<BulkTimeFormData>({
    resolver: zodResolver(bulkTimeSchema),
    defaultValues: {
      date: new Date(),
      description: "",
      entries: []
    }
  });

  const createBulkTimeEntriesMutation = useMutation({
    mutationFn: async (data: BulkTimeFormData) => {
      const validEntries = data.entries.filter(entry => entry.hours > 0);
      
      if (validEntries.length === 0) {
        throw new Error("Debe agregar horas para al menos una persona");
      }

      const requests = validEntries.map(entry => 
        apiRequest("/api/time-entries", {
          method: "POST",
          body: {
            projectId,
            personnelId: entry.personnelId,
            componentId: null,
            date: format(data.date, "yyyy-MM-dd"),
            hours: entry.hours,
            description: data.description,
            billable: entry.billable
          }
        })
      );

      return Promise.all(requests);
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      updateLocalEntries(results);
      toast({
        title: "Éxito",
        description: `Se crearon ${results.length} registros de tiempo exitosamente.`
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron crear los registros de tiempo",
        variant: "destructive"
      });
    }
  });

  const updateEntry = (personnelId: number, field: keyof BulkEntryData, value: any) => {
    setEntries(prev => prev.map(entry => 
      entry.personnelId === personnelId 
        ? { ...entry, [field]: value }
        : entry
    ));
  };

  const applyGlobalSettings = () => {
    setEntries(prev => prev.map(entry => ({
      ...entry,
      description: globalDescription,
      billable: globalBillable
    })));
  };

  const getTotalHours = () => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  };

  const getTotalCost = () => {
    return entries.reduce((sum, entry) => {
      const person = personnel.find(p => p.id === entry.personnelId);
      return sum + (entry.hours * (person?.hourlyRate || 0));
    }, 0);
  };

  const handleSubmit = () => {
    const validEntries = entries.filter(entry => entry.hours > 0);
    
    if (validEntries.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar horas para al menos una persona",
        variant: "destructive"
      });
      return;
    }

    if (!globalDescription.trim()) {
      toast({
        title: "Error",
        description: "La descripción es requerida",
        variant: "destructive"
      });
      return;
    }

    createBulkTimeEntriesMutation.mutate({
      date: globalDate,
      description: globalDescription,
      entries: validEntries
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuración global */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Configuración Global</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fecha */}
          <div>
            <Label htmlFor="date">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !globalDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {globalDate ? format(globalDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={globalDate}
                  onSelect={(date) => date && setGlobalDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Facturable */}
          <div>
            <Label htmlFor="billable">Tipo por defecto</Label>
            <div className="flex items-center space-x-2 mt-2">
              <Switch
                id="billable"
                checked={globalBillable}
                onCheckedChange={setGlobalBillable}
              />
              <Label htmlFor="billable" className="text-sm">
                {globalBillable ? "Facturable" : "No facturable"}
              </Label>
            </div>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            placeholder="Descripción del trabajo realizado..."
            value={globalDescription}
            onChange={(e) => setGlobalDescription(e.target.value)}
            className="mt-1"
          />
        </div>

        <Button
          onClick={applyGlobalSettings}
          variant="outline"
          className="w-full"
        >
          Aplicar configuración a todas las personas
        </Button>
      </div>

      {/* Tabla de personal */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Personal del Proyecto</h3>
          <p className="text-sm text-gray-600">Ingresa las horas trabajadas por cada persona</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">Persona</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">Tarifa/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">Horas</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">Costo</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {personnel.map((person) => {
                const entry = entries.find(e => e.personnelId === person.id);
                if (!entry) return null;

                const cost = entry.hours * person.hourlyRate;
                
                return (
                  <tr key={person.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{person.name}</div>
                      <div className="text-sm text-gray-500">ID: {person.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">${person.hourlyRate.toFixed(2)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.25"
                        value={entry.hours}
                        onChange={(e) => updateEntry(person.id, 'hours', parseFloat(e.target.value) || 0)}
                        onBlur={(e) => {
                          const raw = parseFloat(e.target.value) || 0;
                          const rounded = roundToQuarterHour(raw);
                          if (rounded !== raw) updateEntry(person.id, 'hours', rounded);
                        }}
                        className="w-24"
                        placeholder="0"
                        title="Bloques de 15 minutos (0.25h)"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        ${cost.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={entry.billable}
                        onCheckedChange={(checked) => updateEntry(person.id, 'billable', checked)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={entry.description}
                        onChange={(e) => updateEntry(person.id, 'description', e.target.value)}
                        placeholder="Descripción específica..."
                        className="w-48"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Resumen</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{getTotalHours().toFixed(1)}h</div>
            <div className="text-sm text-gray-600">Total Horas</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">${getTotalCost().toFixed(2)}</div>
            <div className="text-sm text-gray-600">Costo Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {entries.filter(e => e.hours > 0).length}
            </div>
            <div className="text-sm text-gray-600">Personas</div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createBulkTimeEntriesMutation.isPending || getTotalHours() === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {createBulkTimeEntriesMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear {entries.filter(e => e.hours > 0).length} Registros
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
import React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Save, Edit3, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import ComponentSelector from "@/components/project/component-selector";

interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface TimeEntry {
  id: number;
  projectId: number;
  personnelId: number;
  componentId: number | null;
  date: string;
  hours: number;
  description: string | null;
  approved: boolean;
  approvedBy: number | null;
  approvedDate: string | null;
  billable: boolean;
  createdAt: string;
}

interface EditTimeFormProps {
  entry: TimeEntry;
  personnel: Personnel[];
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  updateLocalEntries: (entry: TimeEntry) => void;
}

const editTimeSchema = z.object({
  personnelId: z.number().min(1, "Selecciona una persona"),
  date: z.date({ required_error: "Selecciona una fecha" }),
  hours: z.number().min(0.1, "Mínimo 0.1 horas").max(500, "Máximo 500 horas (para registros de período)"),
  description: z.string().optional(),
  billable: z.boolean().default(true),
  componentId: z.number().nullable().optional(),
});

type EditTimeFormData = z.infer<typeof editTimeSchema>;

export default function EditTimeForm({ 
  entry, 
  personnel, 
  projectId, 
  onSuccess, 
  onCancel,
  updateLocalEntries 
}: EditTimeFormProps) {
  const form = useForm<EditTimeFormData>({
    resolver: zodResolver(editTimeSchema),
    defaultValues: {
      personnelId: entry.personnelId,
      date: new Date(entry.date),
      hours: entry.hours,
      description: entry.description || "",
      billable: entry.billable,
      componentId: entry.componentId,
    },
  });

  const selectedPersonnel = personnel.find(p => p.id === form.watch('personnelId'));
  const calculatedCost = selectedPersonnel ? form.watch('hours') * selectedPersonnel.hourlyRate : 0;

  const updateTimeEntryMutation = useMutation({
    mutationFn: async (data: EditTimeFormData) => {
      return apiRequest(`/api/time-entries/${entry.id}`, {
        method: "PATCH",
        body: {
          personnelId: data.personnelId,
          date: format(data.date, "yyyy-MM-dd"),
          hours: data.hours,
          description: data.description,
          billable: data.billable,
          componentId: data.componentId,
        }
      });
    },
    onSuccess: (updatedEntry) => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      updateLocalEntries(updatedEntry);
      toast({
        title: "✅ Registro actualizado",
        description: "El registro se ha actualizado correctamente."
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo actualizar el registro",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: EditTimeFormData) => {
    updateTimeEntryMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header con información del registro */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Edit3 className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Editando Registro #{entry.id}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Creado:</span>
            <span className="ml-2 font-medium">{format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</span>
          </div>
          <div>
            <span className="text-gray-600">Estado:</span>
            <Badge variant={entry.approved ? "success" : "secondary"} className="ml-2">
              {entry.approved ? "Aprobado" : "Pendiente"}
            </Badge>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Persona */}
        <div>
          <Label htmlFor="personnelId">Persona</Label>
          <Select
            value={form.watch('personnelId')?.toString()}
            onValueChange={(value) => form.setValue('personnelId', parseInt(value))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Seleccionar persona" />
            </SelectTrigger>
            <SelectContent>
              {personnel.map((person) => (
                <SelectItem key={person.id} value={person.id.toString()}>
                  <div className="flex items-center justify-between w-full">
                    <span>{person.name}</span>
                    <Badge variant="outline" className="ml-2">
                      ${person.hourlyRate}/h
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.personnelId && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.personnelId.message}</p>
          )}
        </div>

        {/* Fecha */}
        <div>
          <Label htmlFor="date">Fecha</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !form.watch('date') && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch('date') ? format(form.watch('date'), "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch('date')}
                onSelect={(date) => date && form.setValue('date', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {form.formState.errors.date && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.date.message}</p>
          )}
        </div>

        {/* Horas y tipo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="hours">Horas</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="24"
                className="pl-8"
                {...form.register('hours', { valueAsNumber: true })}
              />
              <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            {form.formState.errors.hours && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.hours.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="billable">Tipo</Label>
            <div className="flex items-center space-x-3 mt-2">
              <Switch
                id="billable"
                checked={form.watch('billable')}
                onCheckedChange={(checked) => form.setValue('billable', checked)}
              />
              <Label htmlFor="billable" className="text-sm font-medium">
                {form.watch('billable') ? (
                  <span className="text-green-700">Facturable</span>
                ) : (
                  <span className="text-amber-700">No facturable</span>
                )}
              </Label>
            </div>
          </div>
        </div>

        {/* Costo calculado */}
        {selectedPersonnel && (
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Costo calculado: ${calculatedCost.toFixed(2)}
              </span>
              <span className="text-xs text-green-600">
                ({form.watch('hours')}h × ${selectedPersonnel.hourlyRate}/h)
              </span>
            </div>
          </div>
        )}

        {/* Componente */}
        <div>
          <Label htmlFor="componentId">Componente (opcional)</Label>
          <div className="mt-1">
            <ComponentSelector
              projectId={projectId}
              value={form.watch('componentId') || null}
              onChange={(value) => form.setValue('componentId', value)}
              disabled={updateTimeEntryMutation.isPending}
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            placeholder="Descripción del trabajo realizado..."
            className="mt-1"
            {...form.register('description')}
          />
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={updateTimeEntryMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateTimeEntryMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Actualizar Registro
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
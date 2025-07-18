
import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "../lib/queryClient";
import ComponentSelector from "@/components/project/component-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarIcon, 
  Loader2, 
  ArrowLeft, 
  Plus,
  Trash2,
  Clock,
  Search,
  Filter,
  MoreHorizontal,
  User,
  Users,
  DollarSign,
  Timer,
  Edit3,
  Calendar as CalendarIconLucide
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import BulkTimeForm from "@/components/forms/BulkTimeForm";
import EditTimeForm from "@/components/forms/EditTimeForm";

// Interfaces
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

// Schema del formulario
const formSchema = z.object({
  personnelId: z.number({
    required_error: "Selecciona una persona",
  }),
  date: z.date({
    required_error: "Selecciona una fecha",
  }),
  hours: z.number({
    required_error: "Ingresa las horas",
  }).min(0.5, "Mínimo 0.5 horas").max(24, "Máximo 24 horas"),
  description: z.string().optional(),
  billable: z.boolean().default(true),
  componentId: z.number().nullable().optional(),
});

// Componente de Avatar optimizado
const PersonAvatar: React.FC<{ name: string; className?: string }> = ({ name, className = "h-6 w-6" }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

// Formulario de registro compacto
const CompactTimeForm: React.FC<{
  personnel: Personnel[] | undefined;
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  updateLocalEntries: (entry: TimeEntry) => void;
}> = ({ personnel, projectId, onSuccess, onCancel, updateLocalEntries }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      hours: 8,
      billable: true,
      componentId: null,
    },
  });

  const createTimeEntryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Obtener la tarifa horaria de la persona seleccionada
      const selectedPerson = personnel?.find(p => p.id === data.personnelId);
      const hourlyRate = selectedPerson?.hourlyRate || 10; // Default mínimo
      const totalCost = data.hours * hourlyRate;
      
      return apiRequest("/api/time-entries", "POST", {
        ...data,
        projectId,
        date: data.date.toISOString(),
        // Agregar campos requeridos
        totalCost,
        hourlyRateAtTime: hourlyRate,
        entryType: 'hours' as const,
      });
    },
    onMutate: async (data: z.infer<typeof formSchema>) => {
      // Crear un registro temporal para animación optimista con ID único pero más pequeño
      const tempId = Date.now(); // ID temporal basado en timestamp
      const tempEntry: TimeEntry = {
        id: tempId,
        projectId,
        personnelId: data.personnelId,
        componentId: data.componentId || null,
        date: data.date.toISOString(),
        hours: data.hours,
        description: data.description || null,
        approved: false,
        approvedBy: null,
        approvedDate: null,
        billable: data.billable,
        createdAt: new Date().toISOString(),
      };

      // Agregar inmediatamente a la lista local
      updateLocalEntries(tempEntry);
      
      // También actualizar el cache de React Query
      queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
        return [tempEntry, ...oldData];
      });

      return { tempEntry };
    },
    onSuccess: (newEntry, variables, context) => {
      // Reemplazar el registro temporal con el real inmediatamente
      queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
        return oldData.map(entry => 
          entry.id === context?.tempEntry.id ? newEntry : entry
        );
      });

      setLocalTimeEntries(prev => 
        prev.map(entry => 
          entry.id === context?.tempEntry.id ? newEntry : entry
        )
      );

      // Invalidar cache inmediatamente para refrescar datos
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });

      toast({
        title: "✅ Tiempo registrado",
        description: "El registro se ha creado exitosamente",
      });

      form.reset({
        date: new Date(),
        hours: 8,
        billable: true,
        componentId: null,
      });

      // Cerrar el modal automáticamente después del éxito
      onSuccess();
    },
    onError: (error: any, variables, context) => {
      // En caso de error, remover el registro temporal
      if (context?.tempEntry) {
        queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
          return oldData.filter(entry => entry.id !== context.tempEntry.id);
        });

        setLocalTimeEntries(prev => 
          prev.filter(entry => entry.id !== context.tempEntry.id)
        );
      }

      toast({
        title: "❌ Error",
        description: error.message || "No se pudo crear el registro",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTimeEntryMutation.mutate(data);
  };

  const isPending = createTimeEntryMutation.isPending;

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Línea 1: Persona y Calendario en una sola línea */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="personnelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Persona</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {personnel?.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={p.name} className="h-5 w-5" />
                            <span className="text-sm">{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-9 justify-start text-left font-normal text-sm",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIconLucide className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Fecha</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Línea 2: Horas y Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Horas</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="24"
                        className="h-9 pl-8 text-sm"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Tipo</FormLabel>
                  <div className="flex items-center h-9 space-x-2 px-3 border rounded-md">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="scale-75"
                      />
                    </FormControl>
                    <div className="text-xs">
                      {field.value ? (
                        <span className="text-green-700 font-medium">Facturable</span>
                      ) : (
                        <span className="text-amber-700 font-medium">No facturable</span>
                      )}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Línea 3: Componente */}
          <FormField
            control={form.control}
            name="componentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Componente (opcional)</FormLabel>
                <FormControl>
                  <ComponentSelector
                    projectId={projectId}
                    value={field.value || null}
                    onChange={field.onChange}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Línea 4: Descripción */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea 
                    className="resize-none h-16 text-sm" 
                    placeholder="Describe el trabajo realizado..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onCancel} size="sm">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} size="sm">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </div>
  );
};

// Componente principal
const TimeEntries: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();

  let projectId: number = 0;

  if (params.projectId) {
    projectId = parseInt(params.projectId);
  } else if (window.location.pathname.includes('/active-projects/')) {
    const match = window.location.pathname.match(/\/active-projects\/(\d+)\/time-entries/);
    if (match && match[1]) {
      projectId = parseInt(match[1]);
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<TimeEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "billable" | "non-billable">("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [localTimeEntries, setLocalTimeEntries] = useState<TimeEntry[]>([]);

  const updateLocalEntries = (entry: TimeEntry) => {
    setLocalTimeEntries(prev => [...prev, entry]);
  };

  const openEditDialog = (entry: TimeEntry) => {
    setEntryToEdit(entry);
    setEditDialogOpen(true);
  };

  // Queries
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: projectId > 0
  });

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: projectId > 0
  });

  useEffect(() => {
    if (timeEntries) {
      setLocalTimeEntries(timeEntries);
    }
  }, [timeEntries]);

  const { data: personnel } = useQuery({
    queryKey: ['/api/personnel'],
  });

  // Mutación para eliminar
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return apiRequest(`/api/time-entries/${entryId}`, "DELETE");
    },
    onMutate: async (entryId: number) => {
      // Agregar animación de salida antes de remover
      const element = document.querySelector(`[data-entry-id="${entryId}"]`) as HTMLElement;
      if (element) {
        element.style.transition = 'all 300ms ease-out';
        element.style.transform = 'translateX(100%)';
        element.style.opacity = '0';
        
        // Esperar que termine la animación antes de remover del estado
        setTimeout(() => {
          setLocalTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
          
          // También actualizar el cache de React Query
          queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
            return oldData.filter(entry => entry.id !== entryId);
          });
        }, 300);
      } else {
        // Fallback si no se encuentra el elemento
        setLocalTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
        
        queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
          return oldData.filter(entry => entry.id !== entryId);
        });
      }
    },
    onSuccess: () => {
      // Invalidar cache para asegurar sincronización
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "✅ Registro eliminado",
        description: "El registro se ha eliminado correctamente"
      });
    },
    onError: (error: any, entryId: number) => {
      // En caso de error, restaurar el elemento (rollback)
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo eliminar el registro",
        variant: "destructive"
      });
    }
  });

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete);
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  // Función para obtener rango de fechas según filtro
  const getDateRange = (filter: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);
    
    switch (filter) {
      case "this-month":
        return {
          start: new Date(year, month, 1),
          end: new Date(year, month + 1, 0)
        };
      case "last-month":
        return {
          start: new Date(year, month - 1, 1),
          end: new Date(year, month, 0)
        };
      case "this-quarter":
        return {
          start: new Date(year, quarter * 3, 1),
          end: new Date(year, quarter * 3 + 3, 0)
        };
      case "last-quarter":
        const lastQuarter = quarter === 0 ? 3 : quarter - 1;
        const lastQuarterYear = quarter === 0 ? year - 1 : year;
        return {
          start: new Date(lastQuarterYear, lastQuarter * 3, 1),
          end: new Date(lastQuarterYear, lastQuarter * 3 + 3, 0)
        };
      case "this-semester":
        const semester = Math.floor(month / 6);
        return {
          start: new Date(year, semester * 6, 1),
          end: new Date(year, semester * 6 + 6, 0)
        };
      case "last-semester":
        const lastSemester = Math.floor(month / 6) === 0 ? 1 : 0;
        const lastSemesterYear = Math.floor(month / 6) === 0 ? year - 1 : year;
        return {
          start: new Date(lastSemesterYear, lastSemester * 6, 1),
          end: new Date(lastSemesterYear, lastSemester * 6 + 6, 0)
        };
      case "this-year":
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31)
        };
      case "q1":
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 2, 31)
        };
      case "q2":
        return {
          start: new Date(year, 3, 1),
          end: new Date(year, 5, 30)
        };
      case "q3":
        return {
          start: new Date(year, 6, 1),
          end: new Date(year, 8, 30)
        };
      case "q4":
        return {
          start: new Date(year, 9, 1),
          end: new Date(year, 11, 31)
        };
      case "january":
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 0, 31)
        };
      case "february":
        return {
          start: new Date(year, 1, 1),
          end: new Date(year, 1, 28 + (year % 4 === 0 ? 1 : 0))
        };
      case "march":
        return {
          start: new Date(year, 2, 1),
          end: new Date(year, 2, 31)
        };
      case "april":
        return {
          start: new Date(year, 3, 1),
          end: new Date(year, 3, 30)
        };
      case "may":
        return {
          start: new Date(year, 4, 1),
          end: new Date(year, 4, 31)
        };
      case "june":
        return {
          start: new Date(year, 5, 1),
          end: new Date(year, 5, 30)
        };
      case "july":
        return {
          start: new Date(year, 6, 1),
          end: new Date(year, 6, 31)
        };
      case "august":
        return {
          start: new Date(year, 7, 1),
          end: new Date(year, 7, 31)
        };
      case "september":
        return {
          start: new Date(year, 8, 1),
          end: new Date(year, 8, 30)
        };
      case "october":
        return {
          start: new Date(year, 9, 1),
          end: new Date(year, 9, 31)
        };
      case "november":
        return {
          start: new Date(year, 10, 1),
          end: new Date(year, 10, 30)
        };
      case "december":
        return {
          start: new Date(year, 11, 1),
          end: new Date(year, 11, 31)
        };
      default:
        return null;
    }
  };

  // Filtrado de entradas con filtros profesionales
  const filteredEntries = localTimeEntries
    ? localTimeEntries.filter(entry => {
        // Filtro por tipo
        if (filterType === "billable" && !entry.billable) return false;
        if (filterType === "non-billable" && entry.billable) return false;

        // Filtro por fecha
        if (dateFilter !== "all") {
          const range = getDateRange(dateFilter);
          if (range) {
            const entryDate = new Date(entry.date);
            if (entryDate < range.start || entryDate > range.end) return false;
          }
        }

        // Filtro por búsqueda
        if (search) {
          const person = personnel?.find(p => p.id === entry.personnelId);
          const personName = person?.name?.toLowerCase() || "";
          const description = entry.description?.toLowerCase() || "";
          const searchLower = search.toLowerCase();

          return personName.includes(searchLower) || 
                 description.includes(searchLower) || 
                 format(new Date(entry.date), "dd/MM/yyyy").includes(searchLower);
        }

        return true;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  // Opciones de filtro profesionales con todos los meses
  const dateFilterOptions = [
    { value: "all", label: "Todos los períodos", group: "General" },
    { value: "this-month", label: "Este mes", group: "General" },
    { value: "last-month", label: "Mes pasado", group: "General" },
    { value: "this-quarter", label: "Este trimestre", group: "General" },
    { value: "last-quarter", label: "Trimestre pasado", group: "General" },
    { value: "this-semester", label: "Este semestre", group: "General" },
    { value: "last-semester", label: "Semestre pasado", group: "General" },
    { value: "this-year", label: "Este año", group: "General" },
    { value: "q1", label: "Q1 (Ene-Mar)", group: "Trimestres" },
    { value: "q2", label: "Q2 (Abr-Jun)", group: "Trimestres" },
    { value: "q3", label: "Q3 (Jul-Sep)", group: "Trimestres" },
    { value: "q4", label: "Q4 (Oct-Dic)", group: "Trimestres" },
    { value: "january", label: "Enero", group: "Meses" },
    { value: "february", label: "Febrero", group: "Meses" },
    { value: "march", label: "Marzo", group: "Meses" },
    { value: "april", label: "Abril", group: "Meses" },
    { value: "may", label: "Mayo", group: "Meses" },
    { value: "june", label: "Junio", group: "Meses" },
    { value: "july", label: "Julio", group: "Meses" },
    { value: "august", label: "Agosto", group: "Meses" },
    { value: "september", label: "Septiembre", group: "Meses" },
    { value: "october", label: "Octubre", group: "Meses" },
    { value: "november", label: "Noviembre", group: "Meses" },
    { value: "december", label: "Diciembre", group: "Meses" }
  ];

  // Estadísticas rápidas
  const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, entry) => sum + entry.hours, 0);

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Proyecto no encontrado</CardTitle>
            <CardDescription>
              No se ha especificado un proyecto válido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/active-projects")} className="w-full">
              Ver Proyectos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {projectLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header profesional */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(`/active-projects/${projectId}?tab=time-management`)}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al proyecto
                  </Button>
                  <div className="h-8 w-px bg-gray-300" />
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Registro de Horas
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                      {project?.quotation?.projectName || "Proyecto"} • {project?.quotation?.clientName || "Cliente"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Registro
                  </Button>
                  <Button 
                    onClick={() => setBulkDialogOpen(true)} 
                    variant="outline" 
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Registro Masivo
                  </Button>
                </div>
              </div>
            </div>

            {/* Panel de estadísticas y controles profesional */}
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Estadísticas */}
              <div className="border-b border-gray-200 p-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
                    <div className="text-sm text-gray-500 mt-1">Total Horas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-600">{billableHours.toFixed(1)}h</div>
                    <div className="text-sm text-gray-500 mt-1">Facturables</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-600">{(totalHours - billableHours).toFixed(1)}h</div>
                    <div className="text-sm text-gray-500 mt-1">No Facturables</div>
                  </div>
                </div>
              </div>

              {/* Controles de filtro */}
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar por persona, descripción..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 w-64 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <Select value={dateFilter} onValueChange={(value) => setDateFilter(value)}>
                      <SelectTrigger className="w-48 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <CalendarIconLucide className="mr-2 h-4 w-4 text-gray-400" />
                        <SelectValue placeholder="Seleccionar período" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Agrupar opciones por categoría */}
                        {["General", "Trimestres", "Meses"].map(group => (
                          <div key={group}>
                            <div className="px-2 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
                              {group}
                            </div>
                            {dateFilterOptions
                              .filter(option => option.group === group)
                              .map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                      <SelectTrigger className="w-40 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <Filter className="mr-2 h-4 w-4 text-gray-400" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="billable">Facturables</SelectItem>
                        <SelectItem value="non-billable">No facturables</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-gray-500">
                      {filteredEntries.length} registro{filteredEntries.length !== 1 ? 's' : ''}
                    </span>
                    {dateFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {dateFilterOptions.find(opt => opt.value === dateFilter)?.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de registros profesional */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Registros de Tiempo
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Gestiona y visualiza todos los registros de tiempo del proyecto
                </p>
              </div>
              
              <div className="overflow-hidden">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Timer className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay registros</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                      {search || dateFilter !== "all" ? 
                        "No se encontraron registros con los filtros aplicados. Intenta ajustar los criterios de búsqueda." : 
                        "Aún no hay registros de tiempo para este proyecto. Comienza creando tu primer registro."
                      }
                    </p>
                    <Button 
                      onClick={() => setDialogOpen(true)} 
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Crear primer registro
                    </Button>
                  </div>
                ) : (
                  // Vista de tabla profesional
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-6 py-4 font-medium text-sm text-gray-700">Persona</th>
                          <th className="text-left px-6 py-4 font-medium text-sm text-gray-700">Fecha</th>
                          <th className="text-left px-6 py-4 font-medium text-sm text-gray-700">Horas</th>
                          <th className="text-left px-6 py-4 font-medium text-sm text-gray-700">Tipo</th>
                          <th className="text-left px-6 py-4 font-medium text-sm text-gray-700">Descripción</th>
                          <th className="text-right px-6 py-4 font-medium text-sm text-gray-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredEntries.map((entry) => {
                          const person = personnel?.find(p => p.id === entry.personnelId);
                          // Detectar registros temporales: ID basado en timestamp (Date.now()) o sin approvedDate
                          const isTemporary = entry.id > 1000000000000 || !entry.approvedDate;
                          
                          return (
                            <tr 
                              key={entry.id}
                              data-entry-id={entry.id}
                              className={cn(
                                "hover:bg-gray-50 transition-colors duration-150",
                                isTemporary && "opacity-70 bg-blue-50"
                              )}
                            >
                              {/* Persona */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <PersonAvatar name={person?.name || "Usuario"} className="h-9 w-9" />
                                  <div>
                                    <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                                      {person?.name}
                                      {isTemporary && (
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {person?.roleId ? `Rol ID: ${person.roleId}` : 'Personal'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Fecha */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {format(new Date(entry.date), "dd/MM/yyyy", { locale: es })}
                                </div>
                                <div className="text-xs text-gray-500 capitalize">
                                  {format(new Date(entry.date), "EEEE", { locale: es })}
                                </div>
                              </td>

                              {/* Horas */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-lg font-bold text-blue-600">
                                  {entry.hours}h
                                </div>
                              </td>

                              {/* Tipo */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                {entry.billable ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Facturable
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                    No facturable
                                  </Badge>
                                )}
                              </td>

                              {/* Descripción */}
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {entry.description ? (
                                    <div className="truncate" title={entry.description}>
                                      {entry.description}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic">Sin descripción</span>
                                  )}
                                </div>
                              </td>

                              {/* Acciones */}
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      disabled={isTemporary}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onClick={() => openEditDialog(entry)}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Edit3 className="mr-2 h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setEntryToDelete(entry.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Diálogo de nuevo registro */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>📝 Nuevo Registro de Horas</DialogTitle>
                  <DialogDescription>
                    Registra el tiempo trabajado en el proyecto
                  </DialogDescription>
                </DialogHeader>
                <CompactTimeForm
                  personnel={personnel}
                  projectId={projectId}
                  onSuccess={() => setDialogOpen(false)}
                  onCancel={() => setDialogOpen(false)}
                  updateLocalEntries={updateLocalEntries}
                />
              </DialogContent>
            </Dialog>

            {/* Diálogo de registro masivo */}
            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Registro Masivo de Horas
                  </DialogTitle>
                  <DialogDescription>
                    Registra horas para múltiples personas del equipo de forma simultánea
                  </DialogDescription>
                </DialogHeader>
                <BulkTimeForm
                  personnel={personnel || []}
                  projectId={projectId}
                  onSuccess={() => setBulkDialogOpen(false)}
                  onCancel={() => setBulkDialogOpen(false)}
                  updateLocalEntries={(entries) => {
                    // Actualizar con múltiples entradas
                    entries.forEach(entry => updateLocalEntries(entry));
                  }}
                />
              </DialogContent>
            </Dialog>

            {/* Diálogo de confirmación para eliminar */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar eliminación</DialogTitle>
                  <DialogDescription>
                    ¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDelete}
                    disabled={deleteTimeEntryMutation.isPending}
                  >
                    {deleteTimeEntryMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Eliminar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Diálogo de edición */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-blue-600" />
                    Editar Registro de Tiempo
                  </DialogTitle>
                  <DialogDescription>
                    Modifica los detalles del registro de tiempo seleccionado
                  </DialogDescription>
                </DialogHeader>
                {entryToEdit && (
                  <EditTimeForm
                    entry={entryToEdit}
                    personnel={personnel || []}
                    projectId={projectId}
                    onSuccess={() => {
                      setEditDialogOpen(false);
                      setEntryToEdit(null);
                    }}
                    onCancel={() => {
                      setEditDialogOpen(false);
                      setEntryToEdit(null);
                    }}
                    updateLocalEntries={(updatedEntry) => {
                      setLocalTimeEntries(prev => 
                        prev.map(entry => 
                          entry.id === updatedEntry.id ? updatedEntry : entry
                        )
                      );
                    }}
                  />
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
};

export default TimeEntries;

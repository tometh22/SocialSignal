
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
  DollarSign,
  Timer,
  Calendar as CalendarIconLucide
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
      // Crear un registro temporal para animación optimista
      const selectedPerson = personnel?.find(p => p.id === data.personnelId);
      const tempId = Math.floor(Math.random() * 1000000) + 999999999; // ID temporal más corto
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
      // Reemplazar el registro temporal con el real
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

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      }, 100);

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "billable" | "non-billable">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [localTimeEntries, setLocalTimeEntries] = useState<TimeEntry[]>([]);

  const updateLocalEntries = (entry: TimeEntry) => {
    setLocalTimeEntries(prev => [...prev, entry]);
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

  // Filtrado de entradas
  const filteredEntries = localTimeEntries
    ? localTimeEntries.filter(entry => {
        // Filtro por tipo
        if (filterType === "billable" && !entry.billable) return false;
        if (filterType === "non-billable" && entry.billable) return false;

        // Filtro por mes
        if (monthFilter !== "all") {
          const entryMonth = format(new Date(entry.date), "yyyy-MM");
          if (entryMonth !== monthFilter) return false;
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

  // Agrupar por mes para estadísticas
  const entriesByMonth = filteredEntries.reduce((acc, entry) => {
    const month = format(new Date(entry.date), "yyyy-MM");
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(entry);
    return acc;
  }, {} as { [key: string]: typeof filteredEntries });

  // Obtener meses disponibles para el filtro
  const availableMonths = Object.keys(entriesByMonth).sort().reverse();

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {projectLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header compacto */}
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(`/active-projects/${projectId}?tab=time-management`)}
                  className="mb-3 text-muted-foreground hover:text-white hover:bg-blue-600"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al proyecto
                </Button>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    ⏱️ Registro de Horas
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {project?.quotation?.projectName || "Proyecto"}
                  </p>
                </div>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-5 w-5" />
                Nuevo Registro
              </Button>
            </div>

            {/* Panel de estadísticas y controles */}
            <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  {/* Estadísticas compactas */}
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{totalHours}h</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{billableHours}h</div>
                      <div className="text-xs text-muted-foreground">Facturables</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{totalHours - billableHours}h</div>
                      <div className="text-xs text-muted-foreground">No facturables</div>
                    </div>
                  </div>

                  {/* Controles de búsqueda y filtro */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-48 h-9"
                      />
                    </div>

                    <Select value={monthFilter} onValueChange={(value) => setMonthFilter(value)}>
                      <SelectTrigger className="w-36 h-9">
                        <CalendarIconLucide className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Mes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {availableMonths.map(month => (
                          <SelectItem key={month} value={month}>
                            {format(new Date(month + '-01'), 'MMM yyyy', { locale: es })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                      <SelectTrigger className="w-36 h-9">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="billable">Facturables</SelectItem>
                        <SelectItem value="non-billable">No facturables</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de registros compacta */}
            <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-xl">Registros ({filteredEntries.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-16">
                    <Timer className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No hay registros</h3>
                    <p className="text-muted-foreground mb-6">
                      {search ? "No se encontraron registros con esos criterios." : "Aún no hay registros de tiempo para este proyecto."}
                    </p>
                    <Button onClick={() => setDialogOpen(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear primer registro
                    </Button>
                  </div>
                ) : (
                  // Vista de tabla profesional
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50/50 border-b">
                        <tr>
                          <th className="text-left p-4 font-medium text-sm text-gray-700">Persona</th>
                          <th className="text-left p-4 font-medium text-sm text-gray-700">Fecha</th>
                          <th className="text-left p-4 font-medium text-sm text-gray-700">Horas</th>
                          <th className="text-left p-4 font-medium text-sm text-gray-700">Tipo</th>
                          <th className="text-left p-4 font-medium text-sm text-gray-700">Descripción</th>
                          <th className="text-right p-4 font-medium text-sm text-gray-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEntries.map((entry) => {
                          const person = personnel?.find(p => p.id === entry.personnelId);
                          const isTemporary = entry.id > 999999999; // Detectar registros temporales
                          
                          return (
                            <tr 
                              key={entry.id}
                              data-entry-id={entry.id}
                              className={cn(
                                "hover:bg-gray-50/50 transition-all duration-300 ease-in-out",
                                "animate-in slide-in-from-top-2 fade-in-50",
                                isTemporary && "opacity-70 bg-blue-50/30"
                              )}
                              style={{
                                animationDelay: '0ms',
                                animationDuration: '300ms'
                              }}
                            >
                              {/* Persona */}
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <PersonAvatar name={person?.name || "Usuario"} className="h-8 w-8" />
                                  <div>
                                    <div className="font-medium text-sm flex items-center gap-2">
                                      {person?.name}
                                      {isTemporary && (
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {person?.roleId ? `ID: ${person.roleId}` : ''}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Fecha */}
                              <td className="p-4">
                                <div className="text-sm font-medium">
                                  {format(new Date(entry.date), "dd/MM/yyyy", { locale: es })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(entry.date), "EEEE", { locale: es })}
                                </div>
                              </td>

                              {/* Horas */}
                              <td className="p-4">
                                <div className="text-lg font-bold text-blue-600">
                                  {entry.hours}h
                                </div>
                              </td>

                              {/* Tipo */}
                              <td className="p-4">
                                {entry.billable ? (
                                  <Badge variant="default" className="text-xs">
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Facturable
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    No facturable
                                  </Badge>
                                )}
                              </td>

                              {/* Descripción */}
                              <td className="p-4">
                                <div className="text-sm text-gray-700 max-w-xs">
                                  {entry.description ? (
                                    <div className="truncate" title={entry.description}>
                                      {entry.description}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic">Sin descripción</span>
                                  )}
                                </div>
                              </td>

                              {/* Acciones */}
                              <td className="p-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" disabled={isTemporary}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setEntryToDelete(entry.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="text-red-600"
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
              </CardContent>
            </Card>

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
          </>
        )}
      </div>
    </div>
  );
};

export default TimeEntries;

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "../lib/queryClient";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import ComponentSelector from "@/components/project/component-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CalendarIcon, 
  Loader2, 
  ArrowLeft, 
  PlusCircle, 
  Trash2,
  Clock,
  ClipboardList,
  Calendar as CalendarSquare,
  BarChart3,
  Briefcase,
  DollarSign,
  FolderKanban,
  MoreHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, isSameMonth, parse, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

// Interfaces de datos
interface Personnel {
  id: number;
  name: string;
  roleId: number;
  hourlyRate: number;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
  defaultHourlyRate: number;
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

// Esquema del formulario
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

// Componentes personalizados
const PersonAvatar: React.FC<{ name: string }> = ({ name }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="bg-primary/10 text-primary text-xs">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

const DaySummary: React.FC<{
  date: Date;
  entries: TimeEntry[];
  personnel: Personnel[] | undefined;
  projectComponents?: {id: number; name: string; projectId: number}[] | undefined;
}> = ({ date, entries, personnel, projectComponents }) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayEntries = entries.filter(
    (entry) => entry.date.substring(0, 10) === dateStr
  );
  const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);

  if (dayEntries.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          {format(date, "EEEE dd 'de' MMMM", { locale: es })}
        </h4>
        <Badge variant="outline" className="font-normal">
          {totalHours} {totalHours === 1 ? "hora" : "horas"}
        </Badge>
      </div>
      <div className="space-y-2">
        {dayEntries.map((entry) => {
          const person = personnel?.find((p) => p.id === entry.personnelId);
          const component = projectComponents?.find(c => c.id === entry.componentId);
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between bg-muted/30 p-2 rounded-md"
            >
              <div className="flex items-center space-x-2">
                <PersonAvatar name={person?.name || "Usuario"} />
                <div>
                  <div className="font-medium text-sm">{person?.name}</div>
                  <div className="flex items-center gap-2">
                    {component && (
                      <Badge variant="secondary" className="h-5 text-xs mr-1">
                        {component.name}
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {entry.description || "Sin descripción"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm font-medium">{entry.hours} h</div>
                {!entry.billable && (
                  <Badge variant="outline" className="h-5 text-xs">
                    No facturable
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Función para formatear fecha legible
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return format(date, "dd 'de' MMM", { locale: es });
};

const TimeRegistrationForm: React.FC<{
  personnel: Personnel[] | undefined;
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  isLoading: boolean;
  updateLocalEntries: (entry: TimeEntry) => void;
}> = ({ personnel, projectId, onSuccess, onCancel, isLoading, updateLocalEntries }) => {
  // Configuración del formulario
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      hours: 1,
      billable: true,
      componentId: null,
    },
  });

  // Mutación para crear entrada de tiempo
  const createTimeEntryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Convertir fecha a formato ISO String para que el servidor la procese correctamente
      return apiRequest("/api/time-entries", "POST", {
        ...data,
        projectId,
        date: data.date.toISOString(),
      });
    },
    onSuccess: (newEntry) => {
      // Actualizar el estado local directamente para mostrar inmediatamente
      updateLocalEntries(newEntry);
      
      // Actualizamos la caché de forma optimista
      queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
        return [...oldData, newEntry];
      });
      
      // Forzamos una recarga completa de los datos
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      }, 300);
      
      toast({
        title: "Tiempo registrado",
        description: "El registro de horas ha sido creado con éxito",
      });
      
      form.reset({
        date: new Date(),
        hours: 1,
        billable: true,
        componentId: null,
      });
      
      // Cerramos el diálogo después de procesar todo
      onSuccess();
    },
    onError: (error: any) => {
      console.error("Error creating time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al crear el registro",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTimeEntryMutation.mutate(data);
  };

  const isPending = createTimeEntryMutation.isPending || isLoading;

  // Obtener la semana actual como rango preseleccionado
  const weekStart = startOfWeek(new Date(), { locale: es });
  const weekEnd = endOfWeek(new Date(), { locale: es });
  const defaultWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="personnelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecciona una persona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {personnel?.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} className="py-3">
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={p.name} />
                            <span>{p.name}</span>
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
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={
                            "w-full h-11 pl-3 text-left font-normal flex justify-between items-center"
                          }
                        >
                          {field.value ? (
                            <span>
                              {format(field.value, "EEEE, dd MMM yyyy", { locale: es })}
                            </span>
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="bg-muted/30 p-2 border-b flex items-center justify-center">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Esta semana
                        </Button>
                      </div>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={es}
                        className="rounded-md border"
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horas trabajadas</FormLabel>
                  <div className="flex flex-col space-y-2">
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="24"
                          className="h-11 pl-8"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <Clock className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billable"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Tipo de horas</FormLabel>
                  <div className="flex items-center h-11 space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {field.value ? "Facturable" : "No facturable"}
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {field.value
                          ? "Estas horas se facturarán al cliente"
                          : "Estas horas son para uso interno"}
                      </FormDescription>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Selector de componente */}
          <FormField
            control={form.control}
            name="componentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Componente (opcional)</FormLabel>
                <div className="relative">
                  <FormControl>
                    <ComponentSelector
                      projectId={projectId}
                      value={field.value || null}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                </div>
                <FormDescription className="text-xs">
                  Selecciona un componente específico para este registro de horas
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea 
                    className="resize-none h-[100px]" 
                    placeholder="Describe brevemente el trabajo realizado..."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Horas
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

const TimeEntries: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  
  // Manejar ambos patrones de URL:
  // 1. /time-entries/project/:projectId
  // 2. /active-projects/:projectId/time-entries
  let projectId: number = 0;
  
  if (params.projectId) {
    projectId = parseInt(params.projectId);
  } else if (window.location.pathname.includes('/active-projects/')) {
    // Extraer el ID del proyecto de la URL utilizando una expresión regular
    const match = window.location.pathname.match(/\/active-projects\/(\d+)\/time-entries/);
    if (match && match[1]) {
      projectId = parseInt(match[1]);
    }
  }
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarView, setCalendarView] = useState<"day" | "week" | "fortnight" | "month">("month");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Estado local para actualización en tiempo real
  const [localTimeEntries, setLocalTimeEntries] = useState<TimeEntry[]>([]);
  
  // Función para actualizar estado local, pasada a componentes hijos
  const updateLocalEntries = (entry: TimeEntry) => {
    setLocalTimeEntries(prev => [...prev, entry]);
  };

  // Obtener datos del proyecto
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: projectId > 0
  });

  // Obtener datos de entradas de tiempo
  const { data: timeEntries, isLoading } = useQuery({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: projectId > 0
  });

  useEffect(() => {
    if (timeEntries) {
      setLocalTimeEntries(timeEntries);
    }
  }, [timeEntries]);

  // Obtener datos de personal
  const { data: personnel } = useQuery({
    queryKey: ['/api/personnel'],
  });
  
  // Obtener datos de roles
  const { data: roles } = useQuery({
    queryKey: ['/api/roles'],
  });
  
  // Obtener componentes del proyecto
  const { data: projectComponents } = useQuery({
    queryKey: ['/api/project-components', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/project-components/${projectId}`);
      return response.json();
    },
    enabled: projectId > 0,
  });

  // Mutación para eliminar registro de tiempo
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return apiRequest(`/api/time-entries/${entryId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "Registro eliminado",
        description: "El registro de horas ha sido eliminado con éxito"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al eliminar el registro",
        variant: "destructive"
      });
    }
  });
  
  const getRoleNameById = (roleId: number): string => {
    if (!roles) return "Rol Desconocido";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Rol Desconocido";
  };

  // Confirmación para eliminar un registro
  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete);
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  // Filtrar entradas según criterios
  const filteredEntries = localTimeEntries
    ? localTimeEntries.filter(entry => {
        // Filtro por tipo (facturable/no facturable)
        if (activeTab === "billable" && !entry.billable) return false;
        if (activeTab === "non-billable" && entry.billable) return false;
        
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
      })
    : [];

  // Funciones auxiliares para la fecha
  const startOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  };

  const endOfDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
  };

  const startOfWeek = (date: Date): Date => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que la semana empiece el lunes
    return startOfDay(new Date(date.setDate(diff)));
  };

  const endOfWeek = (date: Date): Date => {
    const startDate = startOfWeek(new Date(date));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return endOfDay(endDate);
  };

  const startOfFortnight = (date: Date): Date => {
    const day = date.getDate();
    // Primera quincena: días 1-15, Segunda quincena: días 16-fin de mes
    const newDate = new Date(date);
    newDate.setDate(day <= 15 ? 1 : 16);
    return startOfDay(newDate);
  };

  const endOfFortnight = (date: Date): Date => {
    const day = date.getDate();
    const newDate = new Date(date);
    if (day <= 15) {
      // Fin de la primera quincena es el día 15
      newDate.setDate(15);
    } else {
      // Fin de la segunda quincena es el último día del mes
      newDate.setMonth(newDate.getMonth() + 1);
      newDate.setDate(0);
    }
    return endOfDay(newDate);
  };

  const startOfMonth = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setDate(1);
    return startOfDay(newDate);
  };

  const endOfMonth = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + 1);
    newDate.setDate(0);
    return endOfDay(newDate);
  };

  // Filtrar entradas según el período seleccionado
  const getEntriesForPeriod = (): TimeEntry[] => {
    if (!filteredEntries || filteredEntries.length === 0) return [];
    
    switch (calendarView) {
      case "day":
        return filteredEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= startOfDay(selectedDate) && entryDate <= endOfDay(selectedDate);
        });
      
      case "week":
        return filteredEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= startOfWeek(selectedDate) && entryDate <= endOfWeek(selectedDate);
        });
      
      case "fortnight":
        return filteredEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= startOfFortnight(selectedDate) && entryDate <= endOfFortnight(selectedDate);
        });
      
      case "month":
      default:
        return filteredEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= startOfMonth(selectedDate) && entryDate <= endOfMonth(selectedDate);
        });
    }
  };

  // Agrupar entradas por fecha para la vista de calendario
  const groupEntriesByDate = () => {
    const grouped = new Map<string, TimeEntry[]>();
    const entriesForPeriod = getEntriesForPeriod();
    
    if (entriesForPeriod.length > 0) {
      entriesForPeriod.forEach(entry => {
        // Obtener solo la fecha (sin hora)
        const dateStr = entry.date.split('T')[0];
        
        if (!grouped.has(dateStr)) {
          grouped.set(dateStr, []);
        }
        
        grouped.get(dateStr)?.push(entry);
      });
    }
    
    return grouped;
  };

  // Si no se encuentra el ID del proyecto, mostrar mensaje de error
  if (!projectId) {
    return (
      <div className="container max-w-6xl mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Proyecto no encontrado</CardTitle>
            <CardDescription>
              No se ha especificado un proyecto válido para registrar horas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Por favor, selecciona un proyecto activo desde el panel de proyectos.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setLocation("/active-projects")}>
              Ver todos los proyectos
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6">
      {projectLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={() => setLocation("/active-projects")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Proyectos
            </Button>
            
            <div className="mb-6 bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-6 md:flex md:items-center md:justify-between">
                <div className="mb-4 md:mb-0">
                  <h1 className="text-2xl font-bold tracking-tight mb-1">Registro de Horas</h1>
                  <p className="text-muted-foreground flex items-center">
                    <Briefcase className="h-4 w-4 mr-1.5 text-primary/70" />
                    <span>Proyecto: <span className="font-medium text-foreground">{project?.quotation?.projectName || "Sin nombre"}</span></span>
                  </p>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <Button 
                    variant="outline" 
                    className="h-9 px-3 border-muted-foreground/20 hover:bg-muted/20" 
                    onClick={() => setLocation(`/project-summary/${projectId}`)}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Ver resumen
                  </Button>
                  <Button 
                    className="h-9 px-4" 
                    onClick={() => setDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Registrar Horas
                  </Button>
                </div>
              </div>
              
              <CardContent>
                <div className="flex flex-wrap gap-3 mb-4">
                  {/* Barra de acciones principal */}
                  <div className="flex justify-between w-full bg-card rounded-md border shadow-sm p-2">
                    <div className="flex items-center gap-3">
                      <div className="relative w-[260px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Buscar registros..."
                          className="pl-9 h-9"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      
                      <div className="flex h-9 border rounded-md p-0.5 bg-muted/5">
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          className="h-full rounded-r-none"
                          onClick={() => setViewMode("list")}
                        >
                          <ClipboardList className="h-4 w-4 mr-1" />
                          Lista
                        </Button>
                        <Button
                          variant={viewMode === "calendar" ? "default" : "ghost"}
                          size="sm"
                          className="h-full rounded-l-none"
                          onClick={() => setViewMode("calendar")}
                        >
                          <CalendarSquare className="h-4 w-4 mr-1" />
                          Calendario
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Tabs 
                        defaultValue="all" 
                        className="h-9" 
                        value={activeTab} 
                        onValueChange={setActiveTab}
                      >
                        <TabsList className="h-9 bg-muted/5">
                          <TabsTrigger value="all" className="px-3 h-7">Todos</TabsTrigger>
                          <TabsTrigger value="billable" className="px-3 h-7">Facturables</TabsTrigger>
                          <TabsTrigger value="non-billable" className="px-3 h-7">No Facturables</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                  
                  {/* Controles de vista de calendario, solo visibles cuando calendario está activo */}
                  {viewMode === "calendar" && (
                    <div className="w-full flex flex-col md:flex-row gap-3">
                      {/* Control de vista de período */}
                      <div className="flex-none">
                        <div className="flex items-center border rounded-md overflow-hidden">
                          <div className="text-xs font-medium text-muted-foreground px-3 py-2 border-r bg-muted/5">
                            Vista:
                          </div>
                          <div className="flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-9 rounded-none px-3 ${calendarView === "day" ? "bg-primary/10 text-primary" : ""}`}
                              onClick={() => setCalendarView("day")}
                            >
                              Día
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-9 rounded-none px-3 ${calendarView === "week" ? "bg-primary/10 text-primary" : ""}`}
                              onClick={() => setCalendarView("week")}
                            >
                              Semana
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-9 rounded-none px-3 ${calendarView === "fortnight" ? "bg-primary/10 text-primary" : ""}`}
                              onClick={() => setCalendarView("fortnight")}
                            >
                              Quincena
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-9 rounded-none px-3 ${calendarView === "month" ? "bg-primary/10 text-primary" : ""}`}
                              onClick={() => setCalendarView("month")}
                            >
                              Mes
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Navegador de períodos */}
                      <div className="flex-grow">
                        <div className="flex items-center h-full border rounded-md p-2 bg-card">
                          <div className="flex items-center">
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-7 w-7 mr-2 rounded-full"
                              onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            
                            <span className="font-medium text-base">
                              {format(selectedDate, "MMMM yyyy", { locale: es })}
                            </span>
                            
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-7 w-7 ml-2 rounded-full"
                              onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="ml-auto flex items-center gap-2">
                            <div className="text-xs text-muted-foreground mr-2">
                              {calendarView === "day" ? format(selectedDate, "EEEE dd", { locale: es }) : ""}
                              {calendarView === "week" ? `Semana ${format(startOfWeek(selectedDate), "dd")} - ${format(endOfWeek(selectedDate), "dd")}` : ""}
                              {calendarView === "fortnight" ? `${selectedDate.getDate() <= 15 ? "1ª" : "2ª"} quincena` : ""}
                              {calendarView === "month" ? "Mes completo" : ""}
                            </div>
                            
                            <Badge variant="outline" className="h-6">
                              {getEntriesForPeriod().length} {getEntriesForPeriod().length === 1 ? "registro" : "registros"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-16 border rounded-md">
                    <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay registros de tiempo</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {search 
                        ? "No se encontraron registros que coincidan con tu búsqueda."
                        : activeTab !== "all"
                          ? `No hay registros de horas en la categoría seleccionada.`
                          : "No se han registrado horas para este proyecto todavía."}
                    </p>
                    <Button
                      className="mt-6"
                      onClick={() => setDialogOpen(true)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Registrar Horas
                    </Button>
                  </div>
                ) : viewMode === "list" ? (
                  <div 
                    className="border rounded-md" 
                    style={{
                      height: "450px",
                      maxHeight: "70vh",
                      position: "relative",
                      overflowY: "auto",
                      marginBottom: "120px" // Espacio adicional después del contenedor
                    }}
                  >
                    <div style={{ paddingBottom: "150px" }}> {/* Espacio adicional dentro del contenedor */}
                      <Table className="w-full" style={{ tableLayout: "fixed" }}>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Personal</TableHead>
                            <TableHead>Horas</TableHead>
                            <TableHead className="hidden md:table-cell">Descripción</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntries.map((entry) => {
                            const person = personnel?.find(p => p.id === entry.personnelId);
                            return (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span>{formatDate(entry.date)}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(entry.date), "EEEE", { locale: es })}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <PersonAvatar name={person?.name || "Usuario"} />
                                    <div>
                                      <div className="font-medium">{person?.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {getRoleNameById(person?.roleId || 0)}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center">
                                    <span className="font-medium">{entry.hours}</span>
                                    {!entry.billable ? (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        No facturable
                                      </Badge>
                                    ) : (
                                      <Badge className="ml-2 text-xs bg-green-100 text-green-800 hover:bg-green-200">
                                        Facturable
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate hidden md:table-cell">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="cursor-help">
                                        <span className="truncate block max-w-[250px]">
                                          {entry.description || "-"}
                                        </span>
                                      </TooltipTrigger>
                                      {entry.description && (
                                        <TooltipContent className="max-w-[300px] p-4">
                                          <p>{entry.description}</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell>
                                  {entry.billable ? (
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-green-600" />
                                      <span className="text-sm">Facturable</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-amber-600" />
                                      <span className="text-sm">No facturable</span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Opciones</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          setEntryToDelete(entry.id);
                                          setDeleteDialogOpen(true);
                                        }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar registro
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  // Vista de calendario tipo grid
                  <div 
                    className="border rounded-md"
                    style={{
                      maxHeight: "70vh",
                      position: "relative",
                      overflowY: "auto",
                      marginBottom: "20px"
                    }}
                  >
                    {/* Vista de calendario semanal */}
                    <div className="p-4">
                      {calendarView === "month" ? (
                        <div>
                          {/* Cabecera con los días de la semana - Estilo mejorado */}
                          <div className="grid grid-cols-7 gap-0 mb-2 border-b pb-2 bg-muted/5">
                            {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((dayName, idx) => (
                              <div 
                                key={idx} 
                                className="text-center text-xs font-semibold py-2 text-muted-foreground"
                              >
                                {dayName}
                              </div>
                            ))}
                          </div>
                          
                          {/* Rejilla del calendario - Estilo mejorado */}
                          <div className="grid grid-cols-7 gap-[1px] bg-muted/10 rounded-md overflow-hidden">
                            {/* Generación dinámica de los días del mes */}
                            {(() => {
                              const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                              const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                              
                              // Ajustar el día de inicio (0=domingo, 1=lunes, etc.) para que comience en lunes
                              let startDay = firstDayOfMonth.getDay() - 1;
                              if (startDay === -1) startDay = 6; // Si es domingo (0), ajustar a 6
                              
                              const totalDays = lastDayOfMonth.getDate();
                              const totalCells = Math.ceil((totalDays + startDay) / 7) * 7;
                              
                              const days = [];
                              
                              // Mapeo de entradas por fecha para rápida búsqueda
                              const entriesByDate = new Map<string, TimeEntry[]>();
                              
                              filteredEntries.forEach(entry => {
                                const dateStr = entry.date.split('T')[0];
                                if (!entriesByDate.has(dateStr)) {
                                  entriesByDate.set(dateStr, []);
                                }
                                entriesByDate.get(dateStr)?.push(entry);
                              });
                              
                              const isToday = (date: Date) => {
                                const today = new Date();
                                return date.getDate() === today.getDate() && 
                                       date.getMonth() === today.getMonth() && 
                                       date.getFullYear() === today.getFullYear();
                              };
                              
                              // Generar celdas para el calendario
                              for (let i = 0; i < totalCells; i++) {
                                const dayNumber = i - startDay + 1;
                                const isCurrentMonth = dayNumber > 0 && dayNumber <= totalDays;
                                
                                if (isCurrentMonth) {
                                  const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNumber);
                                  const dateStr = format(currentDate, "yyyy-MM-dd");
                                  const entries = entriesByDate.get(dateStr) || [];
                                  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
                                  const today = isToday(currentDate);
                                  
                                  days.push(
                                    <div 
                                      key={i} 
                                      className={`min-h-[100px] bg-white ${
                                        today ? 'ring-2 ring-primary/20 ring-inset' : ''
                                      }`}
                                    >
                                      <div className="flex justify-between items-center p-1 border-b">
                                        <span className={`text-sm font-medium flex items-center justify-center ${
                                          today ? 'text-primary' : 'text-gray-700'
                                        }`}>
                                          <span className={`h-6 w-6 flex items-center justify-center rounded-full ${
                                            today ? 'bg-primary text-white' : ''
                                          }`}>
                                            {dayNumber}
                                          </span>
                                        </span>
                                        {entries.length > 0 && (
                                          <Badge variant="outline" className="text-xs h-5">
                                            {totalHours}h
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {/* Mostrar entradas para este día - Estilo mejorado */}
                                      <div className="p-1">
                                        {entries.slice(0, 3).map(entry => {
                                          const person = personnel?.find(p => p.id === entry.personnelId);
                                          return (
                                            <div 
                                              key={entry.id} 
                                              className={`
                                                text-xs mb-1 py-1 px-1.5 rounded flex items-center gap-1.5 overflow-hidden
                                                ${entry.billable 
                                                  ? 'bg-green-50 border-l-[3px] border-green-400 text-green-700' 
                                                  : 'bg-amber-50 border-l-[3px] border-amber-400 text-amber-700'
                                                }
                                              `}
                                              title={`${person?.name || 'Usuario'} - ${entry.hours}h - ${entry.description || 'Sin descripción'}`}
                                            >
                                              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-current" />
                                              <span className="truncate font-medium">{person?.name || 'Usuario'}</span>
                                              <span className="ml-auto font-semibold">{entry.hours}h</span>
                                            </div>
                                          );
                                        })}
                                        
                                        {entries.length > 3 && (
                                          <div className="text-xs text-center py-0.5 px-1 bg-muted/5 rounded text-muted-foreground">
                                            + {entries.length - 3} más
                                          </div>
                                        )}
                                        
                                        {entries.length === 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full h-6 text-xs text-muted-foreground opacity-0 hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                              const dateObj = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNumber);
                                              setDialogOpen(true);
                                            }}
                                          >
                                            <PlusCircle className="h-3 w-3 mr-1" />
                                            Agregar
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // Días fuera del mes actual - Estilo mejorado
                                  days.push(
                                    <div key={i} className="min-h-[100px] bg-gray-50/50" />
                                  );
                                }
                              }
                              
                              return days;
                            })()}
                          </div>
                        </div>
                      ) : (
                        // Vista agrupada para otras vistas (día, semana, quincena)
                        <div className="space-y-6">
                          <h3 className="font-medium text-sm mb-3">Registros Agrupados por Fecha</h3>
                          {groupEntriesByDate().size > 0 ? (
                            Array.from(groupEntriesByDate().entries())
                              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                              .map(([dateStr, entries]) => (
                                <div key={dateStr} className="border rounded-md overflow-hidden">
                                  <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
                                    <h4 className="text-sm font-semibold text-primary">
                                      {format(new Date(dateStr), "EEEE dd 'de' MMMM yyyy", { locale: es })}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      <Badge variant="outline" className="font-normal">
                                        {entries.reduce((sum, entry) => sum + entry.hours, 0)} 
                                        {entries.reduce((sum, entry) => sum + entry.hours, 0) === 1 ? " hora" : " horas"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="divide-y">
                                    {entries.map((entry) => {
                                      const person = personnel?.find(p => p.id === entry.personnelId);
                                      return (
                                        <div 
                                          key={entry.id} 
                                          className="flex items-center justify-between p-2.5 hover:bg-muted/10"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <div className="relative">
                                              <PersonAvatar name={person?.name || "Usuario"} />
                                              {entry.billable ? (
                                                <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" title="Facturable" />
                                              ) : (
                                                <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-500 border-2 border-background" title="No Facturable" />
                                              )}
                                            </div>
                                            <div>
                                              <div className="font-medium text-sm flex items-center">
                                                {person?.name}
                                                <span className="text-xs text-muted-foreground ml-2">({getRoleNameById(person?.roleId || 0)})</span>
                                              </div>
                                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {entry.description || "Sin descripción"}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-3">
                                            <Badge variant={entry.billable ? "default" : "outline"} className="font-medium">
                                              {entry.hours} h
                                            </Badge>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0 opacity-70 hover:opacity-100"
                                              onClick={() => {
                                                setEntryToDelete(entry.id);
                                                setDeleteDialogOpen(true);
                                              }}
                                            >
                                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center py-10 text-muted-foreground">
                              No hay registros para mostrar en el período seleccionado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
          </div>

          {/* Diálogo de nuevo registro de tiempo */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo Registro de Horas</DialogTitle>
                <DialogDescription>
                  Registra el tiempo trabajado en el proyecto
                </DialogDescription>
              </DialogHeader>
              <TimeRegistrationForm
                personnel={personnel}
                projectId={projectId}
                onSuccess={() => {
                  setTimeout(() => {
                    setDialogOpen(false);
                  }, 300);
                }}
                onCancel={() => setDialogOpen(false)}
                isLoading={isLoading}
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
                  ¿Estás seguro de que deseas eliminar este registro de horas?
                  Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
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
  );
};

export default TimeEntries;
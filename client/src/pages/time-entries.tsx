import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { queryClient, apiRequest } from "../lib/queryClient";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { 
  CalendarIcon, 
  Loader2, 
  ArrowLeft, 
  PlusCircle, 
  Trash2,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  Filter,
  ClipboardList,
  Calendar as CalendarSquare,
  BarChart3,
  Clock3,
  DollarSign,
  FolderKanban,
  MoreHorizontal,
  Timer,
  UserCircle2,
  UserCheck,
  Users2,
  AlertCircle,
  FileText,
  ExternalLink,
  Search,
  ClipboardCheck
} from "lucide-react";
import { format, parseISO, differenceInDays, isAfter, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

interface ActiveProject {
  id: number;
  quotationId: number;
  status: string;
  startDate: string;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  trackingFrequency: string;
  notes: string | null;
  quotation: {
    id: number;
    projectName: string;
    clientId: number;
    totalAmount: number;
    status: string;
    projectType: string;
  };
}

interface TimeEntry {
  id: number;
  projectId: number;
  personnelId: number;
  date: string;
  hours: number;
  description: string | null;
  approved: boolean;
  approvedBy: number | null;
  approvedDate: string | null;
  billable: boolean;
  createdAt: string;
}

interface Client {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
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
});

// Componentes personalizados
const ProjectStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500 hover:bg-green-600">Activo</Badge>;
    case "completed":
      return <Badge className="bg-blue-500 hover:bg-blue-600">Completado</Badge>;
    case "cancelled":
      return <Badge className="bg-red-500 hover:bg-red-600">Cancelado</Badge>;
    case "on-hold":
      return <Badge className="bg-amber-500 hover:bg-amber-600">En Pausa</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

// Este componente ha sido eliminado de la aplicación ya que no se necesita más la funcionalidad de aprobación

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
}> = ({ date, entries, personnel }) => {
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
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between bg-muted/30 p-2 rounded-md"
            >
              <div className="flex items-center space-x-2">
                <PersonAvatar name={person?.name || "Usuario"} />
                <div>
                  <div className="font-medium text-sm">{person?.name}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {entry.description || "Sin descripción"}
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

const TimeRegistrationForm: React.FC<{
  personnel: Personnel[] | undefined;
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  isLoading: boolean;
}> = ({ personnel, projectId, onSuccess, onCancel, isLoading }) => {
  // Configuración del formulario
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      hours: 1,
      billable: true,
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
      console.log("Añadiendo nueva entrada inmediatamente:", newEntry);
      
      // Actualizamos la caché de forma optimista
      queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
        console.log("Actualizando caché con nueva entrada:", newEntry);
        return [...oldData, newEntry];
      });
      
      // Forzamos una recarga completa de los datos para asegurar sincronización
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      }, 100);
      
      toast({
        title: "Tiempo registrado",
        description: "El registro de horas ha sido creado con éxito",
      });
      
      form.reset({
        date: new Date(),
        hours: 1,
        billable: true,
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

                    {/* Presets para móvil */}
                    <div className="md:hidden flex items-center justify-start">
                      <span className="text-xs text-muted-foreground mr-2">Presets:</span>
                      <div className="flex gap-1">
                        {[0.5, 1, 2, 4, 8].map((value) => (
                          <Button
                            key={value}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 w-7 text-xs font-normal p-0"
                            onClick={() => field.onChange(value)}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Presets para desktop */}
                    <div className="hidden md:flex items-center border rounded bg-muted/40 px-3 h-11 space-x-2 text-sm">
                      <span className="text-muted-foreground">Presets:</span>
                      <div className="flex gap-1">
                        {[0.5, 1, 2, 4, 8].map((value) => (
                          <Button
                            key={value}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-8 text-xs font-normal"
                            onClick={() => field.onChange(value)}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
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
                  <div className="flex items-center space-x-4 h-11">
                    <Select
                      onValueChange={(value) => field.onChange(value === "billable")}
                      defaultValue={field.value ? "billable" : "non-billable"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de horas" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="billable">
                          <div className="flex items-center">
                            <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                            <span>Facturable</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="non-billable">
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4 text-amber-600" />
                            <span>No facturable</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormDescription className="text-xs mt-1">
                    <strong>Facturable:</strong> Horas que se cobran al cliente.
                    <br />
                    <strong>No facturable:</strong> Trabajo interno que no se cobra al cliente.
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción del trabajo realizado</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe las tareas realizadas, resultados o cualquier información relevante..."
                    className="min-h-[100px] resize-none"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  Esta información ayudará al equipo a entender el contexto de las horas registradas.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="min-w-[120px]">
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
        </div>
      </form>
    </Form>
  );
};

// Componente principal
const TimeEntries: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = parseInt(params.projectId || "0");
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  


  // Obtener proyecto activo
  const { data: project, isLoading: isLoadingProject } = useQuery<ActiveProject>({
    queryKey: ["/api/active-projects", projectId],
    enabled: !!projectId,
  });

  // Obtener personal
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Obtener roles
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Obtener clientes
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Obtener registros de tiempo
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: [`/api/time-entries/project/${projectId}`],
    enabled: !!projectId,
  });

  // Filtrar entradas según pestaña activa y búsqueda
  const filteredEntries = React.useMemo(() => {
    // Usar los registros de tiempo del servidor
    const entries = timeEntries || [];
    
    let filtered = entries;
    
    // Filtrar por pestaña
    switch (activeTab) {
      case "billable":
        filtered = filtered.filter(entry => entry.billable);
        break;
      case "non-billable":
        filtered = filtered.filter(entry => !entry.billable);
        break;
      // El caso "all" no necesita filtro
    }
    
    // Filtrar por búsqueda
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(entry => {
        const personName = personnel?.find(p => p.id === entry.personnelId)?.name?.toLowerCase() || "";
        const description = entry.description?.toLowerCase() || "";
        return personName.includes(searchLower) || description.includes(searchLower);
      });
    }
    
    // Ordenar por fecha (más reciente primero)
    return [...filtered].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [timeEntries, activeTab, search, personnel]);

  // Mutación para eliminar entrada de tiempo
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/time-entries/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "Registro eliminado",
        description: "El registro de horas ha sido eliminado con éxito",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Error deleting time entry:", error);
      toast({
        title: "Error al eliminar",
        description: error.message || "Ha ocurrido un error al eliminar el registro",
        variant: "destructive",
      });
    },
  });

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete);
    }
  };

  // Funciones de utilidad
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy", { locale: es });
  };

  const getTotalHours = () => {
    if (!filteredEntries) return 0;
    return filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
  };

  const getTotalBillableHours = () => {
    if (!filteredEntries) return 0;
    return filteredEntries
      .filter(entry => entry.billable)
      .reduce((sum, entry) => sum + entry.hours, 0);
  };

  // Calcular progreso del proyecto
  const calculateProjectProgress = () => {
    if (!project || !project.startDate) return 0;
    
    const start = new Date(project.startDate);
    const end = project.expectedEndDate ? new Date(project.expectedEndDate) : addDays(start, 30);
    const today = new Date();
    
    if (isAfter(today, end)) return 100;
    
    const totalDays = differenceInDays(end, start) || 1;
    const daysElapsed = differenceInDays(today, start);
    
    return Math.min(Math.round((daysElapsed / totalDays) * 100), 100);
  };

  // Agrupar entradas por fecha para la vista calendario
  const groupEntriesByDate = () => {
    if (!timeEntries) return new Map();
    
    const grouped = new Map<string, TimeEntry[]>();
    
    filteredEntries.forEach(entry => {
      const dateKey = entry.date.substring(0, 10); // YYYY-MM-DD
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    });
    
    return grouped;
  };

  // Estado de carga
  const isLoading = 
    isLoadingProject || 
    isLoadingPersonnel || 
    isLoadingTimeEntries || 
    deleteTimeEntryMutation.isPending;

  const getRoleNameById = (roleId: number) => {
    return roles?.find(role => role.id === roleId)?.name || "Rol desconocido";
  };

  const getClientNameById = (clientId: number) => {
    return clients?.find(client => client.id === clientId)?.name || "Cliente desconocido";
  };

  // Manejo de errores
  if (!projectId) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-[400px]">
          <Card className="w-[600px]">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
              <CardTitle>Error de navegación</CardTitle>
              <CardDescription>
                No se ha especificado un proyecto válido para el registro de horas.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Button onClick={() => setLocation("/active-projects")}>
                Ver Proyectos Activos
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Componente principal
  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Proyectos
        </Button>
        <h1 className="text-3xl font-bold ml-4">Registro de Horas</h1>
      </div>

      {isLoadingProject ? (
        <div className="flex justify-center items-center h-[300px]">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando datos del proyecto...</p>
          </div>
        </div>
      ) : !project ? (
        <Card>
          <CardHeader className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Proyecto no encontrado</CardTitle>
            <CardDescription>
              El proyecto especificado no existe o no está disponible en el sistema.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setLocation("/active-projects")}>
              Ver todos los proyectos
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="bg-primary/5 border-b">
              <div className="flex flex-wrap md:flex-nowrap items-start md:items-center justify-between p-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">
                      {project.quotation && project.quotation.projectName 
                        ? project.quotation.projectName 
                        : "Proyecto sin nombre"}
                    </h2>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="text-muted-foreground">
                    <span className="inline-flex items-center">
                      <Users2 className="h-4 w-4 mr-1" />
                      Cliente: {project.quotation && project.quotation.clientId 
                        ? getClientNameById(project.quotation.clientId) 
                        : "Sin cliente asignado"}
                    </span>
                    <span className="mx-2">|</span>
                    <span className="inline-flex items-center">
                      <FolderKanban className="h-4 w-4 mr-1" />
                      Tipo: {project.quotation && project.quotation.projectType 
                        ? project.quotation.projectType.toUpperCase() 
                        : "No especificado"}
                    </span>
                  </div>
                </div>
                <div className="flex mt-4 md:mt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2"
                    onClick={() => setLocation(`/project-summary/${project.id}`)}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Ver análisis
                  </Button>
                  <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Registrar Horas
                  </Button>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Progreso del Proyecto</h3>
                    <div className="space-y-2">
                      <Progress value={calculateProjectProgress()} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Inicio: {formatDate(project.startDate)}</span>
                        <span>Fin: {formatDate(project.expectedEndDate)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-8">
                    <div>
                      <h3 className="text-sm font-medium mb-1">Seguimiento</h3>
                      <div className="flex items-center text-sm">
                        <CalendarSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="capitalize">{project.trackingFrequency}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Presupuesto</h3>
                      <div className="flex items-center text-sm">
                        <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>
                          ${project.quotation && typeof project.quotation.totalAmount === 'number' 
                            ? project.quotation.totalAmount.toFixed(2) 
                            : "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {project.notes && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Notas</h3>
                      <p className="text-sm text-muted-foreground">
                        {project.notes}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Resumen de horas</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs text-muted-foreground mb-1">Total Horas</h4>
                          <p className="text-2xl font-bold">{getTotalHours().toFixed(1)}</p>
                        </div>
                        <Timer className="h-8 w-8 text-primary/70" />
                      </div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-xs text-muted-foreground mb-1">Horas Facturables</h4>
                          <p className="text-2xl font-bold">{getTotalBillableHours().toFixed(1)}</p>
                        </div>
                        <DollarSign className="h-8 w-8 text-green-500/70" />
                      </div>
                    </div>
                    
                    {timeEntries && (
                      <>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-xs text-muted-foreground mb-1">Total Registros</h4>
                              <p className="text-2xl font-bold">
                                {timeEntries.length}
                              </p>
                            </div>
                            <ClipboardCheck className="h-8 w-8 text-blue-500/70" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Card className="flex-1">
              <CardHeader className="py-4 px-6">
                <Tabs
                  defaultValue="all"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">Registros de tiempo</h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => setViewMode("list")}
                      >
                        <ClipboardList className="h-4 w-4" />
                        <span className="sr-only">Vista Lista</span>
                      </Button>
                      <Button
                        variant={viewMode === "calendar" ? "default" : "outline"}
                        size="sm"
                        className="h-8"
                        onClick={() => setViewMode("calendar")}
                      >
                        <CalendarSquare className="h-4 w-4" />
                        <span className="sr-only">Vista Calendario</span>
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <TabsList className="grid grid-cols-3 w-full md:w-auto">
                      <TabsTrigger value="all">Todos</TabsTrigger>
                      <TabsTrigger value="billable">Facturables</TabsTrigger>
                      <TabsTrigger value="non-billable">No Facturables</TabsTrigger>
                    </TabsList>
                    <div className="hidden md:flex items-center relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Buscar en registros..."
                        className="w-[280px] pl-9 h-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="md:hidden relative mb-4">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar en registros..."
                      className="w-full pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingTimeEntries ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-[300px] text-center px-4">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium">No hay registros de horas</h3>
                    <p className="text-muted-foreground mt-2 max-w-md">
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
                  <div className="overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
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
                ) : (
                  <div className="p-6 space-y-6">
                    <ScrollArea className="h-[600px] pr-4">
                      {groupEntriesByDate().size > 0 ? (
                        Array.from(groupEntriesByDate().entries())
                          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                          .map(([dateStr, entries]) => (
                            <DaySummary
                              key={dateStr}
                              date={new Date(dateStr)}
                              entries={entries}
                              personnel={personnel}
                            />
                          ))
                      ) : (
                        <div className="text-center py-10 text-muted-foreground">
                          No hay registros para mostrar en el calendario
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Diálogo de nuevo registro de tiempo */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo Registro de Horas</DialogTitle>
                <DialogDescription>
                  Registra el tiempo trabajado en el proyecto {project.quotation?.projectName || "seleccionado"}
                </DialogDescription>
              </DialogHeader>
              <TimeRegistrationForm
                personnel={personnel}
                projectId={projectId}
                onSuccess={() => {
                  // Retrasamos un poco el cierre del diálogo para asegurar que se muestre el registro
                  setTimeout(() => {
                    setDialogOpen(false);
                  }, 300);
                }}
                onCancel={() => setDialogOpen(false)}
                isLoading={isLoading}
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
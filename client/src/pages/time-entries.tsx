import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  DollarSign,
  FolderKanban,
  MoreHorizontal,
  Search
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
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
  const [search, setSearch] = useState("");
  
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

  // Agrupar entradas por fecha para la vista de calendario
  const groupEntriesByDate = () => {
    const grouped = new Map<string, TimeEntry[]>();
    
    if (filteredEntries) {
      filteredEntries.forEach(entry => {
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
            
            <Card>
              <CardHeader>
                <div className="flex flex-wrap justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">Registro de Horas</CardTitle>
                    <CardDescription>
                      Proyecto: {project?.quotation?.projectName || "Sin nombre"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setLocation(`/project-summary/${projectId}`)}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Ver resumen
                    </Button>
                    <Button size="sm" onClick={() => setDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Registrar Horas
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex-1 max-w-[300px]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Buscar registros..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Tabs defaultValue="all" className="w-[400px]" value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="all">Todos</TabsTrigger>
                        <TabsTrigger value="billable">Facturables</TabsTrigger>
                        <TabsTrigger value="non-billable">No Facturables</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="flex border rounded-md p-0.5 h-9">
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        className="h-full rounded-r-none"
                        onClick={() => setViewMode("list")}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "calendar" ? "default" : "outline"}
                        size="sm"
                        className="h-full rounded-l-none"
                        onClick={() => setViewMode("calendar")}
                      >
                        <CalendarSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                  // Vista de calendario mejorada
                  <div 
                    className="border rounded-md p-4" 
                    style={{
                      height: "450px",
                      maxHeight: "70vh",
                      position: "relative",
                      overflowY: "auto",
                      marginBottom: "120px"
                    }}
                  >
                    {/* Agrupación por semana para la vista de calendario */}
                    <div className="pb-6">
                      <h3 className="font-medium text-sm mb-3">Vista Calendario - Registros Agrupados por Fecha</h3>
                      <div className="space-y-6">
                        {groupEntriesByDate().size > 0 ? (
                          Array.from(groupEntriesByDate().entries())
                            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                            .map(([dateStr, entries]) => (
                              <div key={dateStr} className="border rounded-md p-3 bg-muted/20">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-primary">
                                    {format(new Date(dateStr), "EEEE dd 'de' MMMM yyyy", { locale: es })}
                                  </h4>
                                  <Badge variant="outline" className="font-normal">
                                    {entries.reduce((sum, entry) => sum + entry.hours, 0)} 
                                    {entries.reduce((sum, entry) => sum + entry.hours, 0) === 1 ? " hora" : " horas"}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  {entries.map((entry) => {
                                    const person = personnel?.find(p => p.id === entry.personnelId);
                                    return (
                                      <div 
                                        key={entry.id} 
                                        className="flex items-center justify-between bg-background p-2 rounded-md"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <PersonAvatar name={person?.name || "Usuario"} />
                                          <div>
                                            <div className="font-medium text-sm">{person?.name}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                              {entry.description || "Sin descripción"}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                          <Badge variant="outline" className="font-medium">
                                            {entry.hours} h
                                          </Badge>
                                          {!entry.billable && (
                                            <Badge variant="secondary" className="h-5 text-xs">
                                              No facturable
                                            </Badge>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0"
                                            onClick={() => handleDeleteEntry(entry.id)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
                            No hay registros para mostrar en el calendario
                          </div>
                        )}
                      </div>
                    </div>
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
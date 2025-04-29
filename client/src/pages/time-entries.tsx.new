import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInDays, isAfter, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { DatePicker } from "@/components/ui/date-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar,
  MoreVertical,
  Plus,
  PlusCircle,
  Loader2,
  FileSpreadsheet,
  List,
  XCircle,
  CheckCircle,
  Clock,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Interfaces
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

// Componente DaySummary
const DaySummary = ({
  date,
  entries,
  personnel,
  onEditEntry,
  onDeleteEntry,
}: {
  date: Date;
  entries: TimeEntry[];
  personnel: Personnel[];
  onEditEntry?: (entry: TimeEntry) => void;
  onDeleteEntry?: (entry: TimeEntry) => void;
}) => {
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const formattedDate = format(date, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es,
  });

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium capitalize">{formattedDate}</h3>
        <div className="text-sm font-medium">
          Total: {totalHours} {totalHours === 1 ? "hora" : "horas"}
        </div>
      </div>
      <div className="space-y-3">
        {entries.map((entry) => {
          const person = personnel.find((p) => p.id === entry.personnelId);
          return (
            <div
              key={entry.id}
              className="p-3 border rounded-md bg-card relative"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium mb-1">{person?.name}</div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {entry.hours} {entry.hours === 1 ? "hora" : "horas"}
                    {entry.billable && (
                      <span className="ml-2 text-green-600 font-medium">
                        (Facturable)
                      </span>
                    )}
                  </div>
                  {entry.description && (
                    <div className="text-sm mt-2">{entry.description}</div>
                  )}
                </div>
                <div className="flex space-x-1">
                  {entry.approved ? (
                    <div className="text-green-600 flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aprobado
                    </div>
                  ) : (
                    <div className="text-amber-600 flex items-center text-sm">
                      <Clock className="h-4 w-4 mr-1" />
                      Pendiente
                    </div>
                  )}
                  {onEditEntry && onDeleteEntry && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditEntry(entry)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeleteEntry(entry)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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

// Componente de formulario de registro de tiempo
const TimeRegistrationForm: React.FC<{
  personnel: Personnel[] | undefined;
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
  isLoading: boolean;
  updateLocalEntries: (entry: TimeEntry) => void;
}> = ({ personnel, projectId, onSuccess, onCancel, isLoading, updateLocalEntries }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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
      return apiRequest("/api/time-entries", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          projectId,
          date: data.date.toISOString(),
        }),
      });
    },
    onSuccess: (newEntry) => {
      console.log("Añadiendo nueva entrada inmediatamente:", newEntry);
      
      // IMPORTANTE: Actualizar el estado local directamente para mostrar inmediatamente
      updateLocalEntries(newEntry);
      
      // Actualizamos la caché de forma optimista
      queryClient.setQueryData(["/api/time-entries", projectId], (oldData: TimeEntry[] = []) => {
        console.log("Actualizando caché con nueva entrada:", newEntry);
        return [...oldData, newEntry];
      });
      
      // Forzamos una recarga completa de los datos para asegurar sincronización total
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/time-entries", projectId] });
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
                      {personnel?.map((person) => (
                        <SelectItem key={person.id} value={person.id.toString()}>
                          {person.name}
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
                  <Controller
                    name="date"
                    control={form.control}
                    render={({ field }) => (
                      <div className="grid gap-2">
                        <Button
                          id="date"
                          variant={"outline"}
                          className={`w-full justify-start text-left font-normal h-11 ${
                            !field.value && "text-muted-foreground"
                          }`}
                          onClick={() => {}}
                          type="button"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Selecciona una fecha</span>
                          )}
                        </Button>
                      </div>
                    )}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horas</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Número de horas"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-end space-x-2 mt-8">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Facturable</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Descripción del trabajo realizado"
                    className="resize-none"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Form>
  );
};

// Componente principal
const TimeEntries = () => {
  const { projectId } = useParams();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados locales
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);
  const [localTimeEntries, setLocalTimeEntries] = useState<TimeEntry[]>([]);

  // Queries
  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ["/api/projects", projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: ["/api/clients", project?.quotation?.clientId],
    queryFn: () =>
      apiRequest(`/api/clients/${project?.quotation?.clientId}`),
    enabled: !!project?.quotation?.clientId,
  });

  const { data: timeEntries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["/api/time-entries", projectId],
    queryFn: () => apiRequest(`/api/time-entries?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const { data: personnel = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ["/api/personnel"],
    queryFn: () => apiRequest("/api/personnel"),
  });

  // Mutations
  const deleteTimeEntryMutation = useMutation({
    mutationFn: (entryId: number) =>
      apiRequest(`/api/time-entries/${entryId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({
        title: "Registro eliminado",
        description: "El registro de horas ha sido eliminado correctamente.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/time-entries", projectId],
      });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          "No se pudo eliminar el registro. Por favor, intente nuevamente.",
        variant: "destructive",
      });
      console.error("Error al eliminar el registro:", error);
    },
  });

  // Effect para actualizar entradas locales cuando cambian las entradas del servidor
  useEffect(() => {
    if (timeEntries.length > 0) {
      setLocalTimeEntries(timeEntries);
    }
  }, [timeEntries]);

  // Funciones
  const isLoading =
    isLoadingProject || isLoadingEntries || isLoadingPersonnel;

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete.id);
    }
  };

  const handleEditEntry = (entry: TimeEntry) => {
    // TODO: Implementar edición de entradas
    toast({
      title: "Función en desarrollo",
      description: "La edición de registros estará disponible próximamente.",
    });
  };

  const handleDeleteEntry = (entry: TimeEntry) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const updateLocalEntries = (entry: TimeEntry) => {
    setLocalTimeEntries((prev) => [...prev, entry]);
  };

  // Agrupación de entradas por fecha
  const groupEntriesByDate = () => {
    const entriesMap = new Map<string, TimeEntry[]>();
    
    localTimeEntries.forEach((entry) => {
      const dateStr = entry.date.split("T")[0];
      if (!entriesMap.has(dateStr)) {
        entriesMap.set(dateStr, []);
      }
      entriesMap.get(dateStr)?.push(entry);
    });
    
    return entriesMap;
  };

  // Calcular el total de horas del proyecto
  const totalHours = localTimeEntries.reduce(
    (sum, entry) => sum + entry.hours,
    0
  );

  // Calcular el total de horas por persona
  const hoursByPerson = localTimeEntries.reduce((acc, entry) => {
    const personnelId = entry.personnelId;
    acc[personnelId] = (acc[personnelId] || 0) + entry.hours;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="container py-6 max-w-7xl">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/active-projects")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  Registro de Horas: {project?.quotation?.projectName}
                </h1>
                <p className="text-muted-foreground">
                  Cliente: {client?.name || "Cargando..."}
                </p>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Registro
            </Button>
          </div>

          <div className="grid gap-6 mb-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Horas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalHours} {totalHours === 1 ? "hora" : "horas"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Personal Involucrado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(hoursByPerson).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Estado del Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {project?.status}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 mb-8 md:grid-cols-4">
            <Card className="md:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle>Registro de Tiempo</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={viewMode === "calendar" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("calendar")}
                      className="h-8"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Vista Calendario
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="h-8"
                    >
                      <List className="mr-2 h-4 w-4" />
                      Vista Lista
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === "list" ? (
                  // Vista de lista con scroll
                  <div className="border rounded-md overflow-auto" style={{ maxHeight: "700px" }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Personal</TableHead>
                            <TableHead>Horas</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[80px]">Acciones</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localTimeEntries.map((entry) => {
                          const person = personnel.find(
                            (p) => p.id === entry.personnelId
                          );
                          return (
                            <TableRow key={entry.id}>
                              <TableCell>
                                {format(new Date(entry.date), "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell>{person?.name}</TableCell>
                              <TableCell>
                                {entry.hours}{" "}
                                {entry.billable && (
                                  <span className="text-xs text-green-600 font-medium">
                                    (Facturable)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {entry.description || "-"}
                              </TableCell>
                              <TableCell>
                                {entry.approved ? (
                                  <div className="flex items-center text-green-600">
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    <span>Aprobado</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center text-amber-600">
                                    <Clock className="mr-1 h-4 w-4" />
                                    <span>Pendiente</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                    >
                                      <span className="sr-only">
                                        Abrir menú
                                      </span>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleEditEntry(entry)}
                                    >
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteEntry(entry)}
                                    >
                                      Eliminar
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
                  // Vista de calendario con scroll
                  <div className="p-6 space-y-6">
                    <ScrollArea className="h-[650px] pr-4">
                      {groupEntriesByDate().size > 0 ? (
                        Array.from(groupEntriesByDate().entries())
                          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                          .map(([dateStr, entries]) => (
                            <DaySummary
                              key={dateStr}
                              date={new Date(dateStr)}
                              entries={entries}
                              personnel={personnel}
                              onEditEntry={handleEditEntry}
                              onDeleteEntry={handleDeleteEntry}
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
                  Registra el tiempo trabajado en el proyecto {project?.quotation?.projectName || "seleccionado"}
                </DialogDescription>
              </DialogHeader>
              <TimeRegistrationForm
                personnel={personnel}
                projectId={Number(projectId)}
                onSuccess={() => {
                  // Retrasamos un poco el cierre del diálogo para asegurar que se muestre el registro
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
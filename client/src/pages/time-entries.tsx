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
  PlusCircle, 
  Trash2,
  Clock,
  Search,
  Filter,
  MoreHorizontal,
  User,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
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
const PersonAvatar: React.FC<{ name: string; className?: string }> = ({ name, className = "h-8 w-8" }) => {
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

// Formulario de registro simplificado
const TimeRegistrationForm: React.FC<{
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
      return apiRequest("/api/time-entries", "POST", {
        ...data,
        projectId,
        date: data.date.toISOString(),
      });
    },
    onSuccess: (newEntry) => {
      updateLocalEntries(newEntry);
      queryClient.setQueryData([`/api/time-entries/project/${projectId}`], (oldData: TimeEntry[] = []) => {
        return [...oldData, newEntry];
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      }, 300);

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

      onSuccess();
    },
    onError: (error: any) => {
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Fila 1: Persona y Fecha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="personnelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Persona</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecciona una persona" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {personnel?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()} className="py-2">
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={p.name} className="h-6 w-6" />
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
              <FormItem>
                <FormLabel className="text-sm font-medium">Fecha</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-10 justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(field.value, "EEEE, dd 'de' MMMM yyyy", { locale: es })
                        ) : (
                          <span>Seleccionar fecha</span>
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

        {/* Fila 2: Horas y Tipo */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Horas</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      className="h-10 pl-8"
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
                <FormLabel className="text-sm font-medium">Tipo</FormLabel>
                <div className="flex items-center h-10 space-x-2 px-3 border rounded-md">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="text-sm">
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

        {/* Componente */}
        <FormField
          control={form.control}
          name="componentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Componente (opcional)</FormLabel>
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

        {/* Descripción */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Descripción (opcional)</FormLabel>
              <FormControl>
                <Textarea 
                  className="resize-none h-20" 
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/project/${projectId}`] });
      toast({
        title: "✅ Registro eliminado",
        description: "El registro se ha eliminado correctamente"
      });
    },
    onError: (error: any) => {
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
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {projectLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/active-projects")}
                  className="mb-2"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
                <h1 className="text-2xl font-bold">Registro de Horas</h1>
                <p className="text-sm text-muted-foreground">
                  {project?.quotation?.projectName || "Proyecto"}
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)} size="lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                Registrar Horas
              </Button>
            </div>

            {/* Estadísticas y controles */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Estadísticas */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{totalHours}</div>
                      <div className="text-xs text-muted-foreground">Total horas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{billableHours}</div>
                      <div className="text-xs text-muted-foreground">Facturables</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{totalHours - billableHours}</div>
                      <div className="text-xs text-muted-foreground">No facturables</div>
                    </div>
                  </div>

                  {/* Controles */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar registros..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>

                    <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                      <SelectTrigger className="w-40">
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

            {/* Lista de registros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Registros de Tiempo ({filteredEntries.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No hay registros</h3>
                    <p className="text-muted-foreground mb-4">
                      {search ? "No se encontraron registros con esos criterios." : "Aún no hay registros de tiempo para este proyecto."}
                    </p>
                    <Button onClick={() => setDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Crear primer registro
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredEntries.map((entry) => {
                      const person = personnel?.find(p => p.id === entry.personnelId);
                      return (
                        <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <PersonAvatar name={person?.name || "Usuario"} />
                            <div>
                              <div className="font-medium">{person?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(entry.date), "EEEE, dd 'de' MMMM", { locale: es })}
                              </div>
                              {entry.description && (
                                <div className="text-sm text-muted-foreground truncate max-w-md">
                                  {entry.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-bold text-lg">{entry.hours}h</div>
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
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Diálogo de nuevo registro */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-2xl">
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
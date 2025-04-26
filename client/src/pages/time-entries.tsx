import React, { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarIcon, 
  Loader2, 
  ArrowLeft, 
  PlusCircle, 
  Trash2,
  CheckCircle2,
  Clock,
  X
} from "lucide-react";
import { format } from "date-fns";
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

interface ActiveProject {
  id: number;
  quotationId: number;
  status: string;
  startDate: string;
  expectedEndDate: string | null;
  trackingFrequency: string;
  notes: string | null;
  quotation: {
    id: number;
    projectName: string;
    clientId: number;
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

// Componente principal
const TimeEntries: React.FC = () => {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = parseInt(params.projectId || "0");
  
  const [activeTab, setActiveTab] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [entryToApprove, setEntryToApprove] = useState<number | null>(null);

  // Obtener proyecto activo
  const { data: project, isLoading: isLoadingProject } = useQuery<ActiveProject>({
    queryKey: ["/api/active-projects", projectId],
    enabled: !!projectId,
  });

  // Obtener personal
  const { data: personnel, isLoading: isLoadingPersonnel } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  // Obtener registros de tiempo
  const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries/project", projectId],
    enabled: !!projectId,
  });

  // Filtrar entradas según pestaña activa
  const filteredEntries = React.useMemo(() => {
    if (!timeEntries) return [];
    
    switch (activeTab) {
      case "pending":
        return timeEntries.filter(entry => !entry.approved);
      case "approved":
        return timeEntries.filter(entry => entry.approved);
      case "billable":
        return timeEntries.filter(entry => entry.billable);
      case "non-billable":
        return timeEntries.filter(entry => !entry.billable);
      default:
        return timeEntries;
    }
  }, [timeEntries, activeTab]);

  // Configurar formulario
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
      return apiRequest("/api/time-entries", "POST", {
        ...data,
        projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/project", projectId] });
      toast({
        title: "Registro de horas creado",
        description: "El registro de horas ha sido creado con éxito",
      });
      form.reset({
        date: new Date(),
        hours: 1,
        billable: true,
      });
      setDialogOpen(false);
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

  // Mutación para eliminar entrada de tiempo
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/time-entries/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/project", projectId] });
      toast({
        title: "Registro eliminado",
        description: "El registro de horas ha sido eliminado con éxito",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Error deleting time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al eliminar el registro",
        variant: "destructive",
      });
    },
  });

  // Mutación para aprobar entrada de tiempo
  const approveTimeEntryMutation = useMutation({
    mutationFn: async ({ id, approverId }: { id: number; approverId: number }) => {
      return apiRequest(`/api/time-entries/${id}/approve`, "POST", { approverId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/project", projectId] });
      toast({
        title: "Registro aprobado",
        description: "El registro de horas ha sido aprobado con éxito",
      });
      setApproveDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Error approving time entry:", error);
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al aprobar el registro",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createTimeEntryMutation.mutate(data);
  };

  const handleDeleteEntry = (id: number) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (entryToDelete) {
      deleteTimeEntryMutation.mutate(entryToDelete);
    }
  };

  const handleApproveEntry = (id: number) => {
    setEntryToApprove(id);
    setApproveDialogOpen(true);
  };

  const confirmApprove = (approverId: number) => {
    if (entryToApprove) {
      approveTimeEntryMutation.mutate({ id: entryToApprove, approverId });
    }
  };

  // Formatear fecha
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

  const isLoading = 
    isLoadingProject || 
    isLoadingPersonnel || 
    isLoadingTimeEntries || 
    createTimeEntryMutation.isPending ||
    deleteTimeEntryMutation.isPending ||
    approveTimeEntryMutation.isPending;

  if (!projectId) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-[400px]">
          <Card className="w-[600px]">
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>No se ha especificado un proyecto</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => setLocation("/active-projects")}>
                Ver Proyectos
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => setLocation("/active-projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Proyectos
        </Button>
        <h1 className="text-3xl font-bold ml-4">Registro de Horas</h1>
      </div>

      {isLoadingProject ? (
        <div className="flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !project ? (
        <Card>
          <CardHeader>
            <CardTitle>Proyecto no encontrado</CardTitle>
            <CardDescription>
              El proyecto especificado no existe o no está disponible.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setLocation("/active-projects")}>
              Ver todos los proyectos
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{project.quotation.projectName}</CardTitle>
              <CardDescription>
                Proyecto ID: {project.id} | Estado: {project.status}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Fecha de inicio</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(project.startDate)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Fecha de finalización esperada</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(project.expectedEndDate)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Frecuencia de seguimiento</h3>
                  <p className="text-sm text-muted-foreground">
                    {project.trackingFrequency}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between border-t pt-6">
              <div>
                <span className="text-sm font-medium">Total horas registradas:</span>{" "}
                <span className="font-bold">{getTotalHours().toFixed(1)}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({getTotalBillableHours().toFixed(1)} horas facturables)
                </span>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Registrar Horas
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuevo Registro de Horas</DialogTitle>
                    <DialogDescription>
                      Registra las horas trabajadas en el proyecto.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="personnelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Personal</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              defaultValue={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una persona" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {personnel?.map((p) => (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name}
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
                                      "w-full pl-3 text-left font-normal flex justify-between items-center"
                                    }
                                  >
                                    {field.value ? (
                                      format(field.value, "dd MMM yyyy", { locale: es })
                                    ) : (
                                      <span>Seleccionar fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  locale={es}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horas</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.5"
                                min="0.5"
                                max="24"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Ingresa la cantidad de horas trabajadas (mínimo 0.5, máximo 24).
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
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe el trabajo realizado..."
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription>
                              Opcional. Describe el trabajo realizado.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="billable"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Facturable</FormLabel>
                              <FormDescription>
                                Marca esta opción si las horas son facturables al cliente.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Guardar
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="px-6 pt-6 pb-0">
              <Tabs
                defaultValue="all"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="pending">Pendientes</TabsTrigger>
                  <TabsTrigger value="approved">Aprobados</TabsTrigger>
                  <TabsTrigger value="billable">Facturables</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              {isLoadingTimeEntries ? (
                <div className="flex justify-center items-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-[300px] text-center px-4">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium">No hay registros de horas</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    {activeTab !== "all"
                      ? `No hay registros de horas en la categoría seleccionada.`
                      : "No se han registrado horas para este proyecto todavía."}
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Registrar Horas
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Personal</TableHead>
                        <TableHead>Horas</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {formatDate(entry.date)}
                          </TableCell>
                          <TableCell>
                            {personnel?.find(p => p.id === entry.personnelId)?.name || "Desconocido"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="font-medium">{entry.hours}</span>
                              {!entry.billable && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  No facturable
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {entry.description || "-"}
                          </TableCell>
                          <TableCell>
                            {entry.approved ? (
                              <Badge className="bg-green-500 hover:bg-green-600">
                                Aprobado
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {!entry.approved && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleApproveEntry(entry.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="sr-only">Aprobar</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Eliminar</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Diálogo de confirmación de eliminación */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar eliminación</DialogTitle>
                <DialogDescription>
                  ¿Estás seguro de que deseas eliminar este registro de horas? Esta acción no se puede deshacer.
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
                  {deleteTimeEntryMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Eliminar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Diálogo de confirmación de aprobación */}
          <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aprobar registro de horas</DialogTitle>
                <DialogDescription>
                  Selecciona quién aprueba este registro de horas.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <FormItem>
                  <FormLabel>Aprobador</FormLabel>
                  <Select onValueChange={(value) => confirmApprove(parseInt(value))}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un aprobador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {personnel?.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setApproveDialogOpen(false)}
                >
                  Cancelar
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
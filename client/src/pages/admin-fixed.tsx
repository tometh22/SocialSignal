// Panel de Administración Completo - Restaurado

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGlobalCacheInvalidation } from "@/hooks/use-global-cache-invalidation";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BadgeDollarSign,
  Briefcase,
  Calculator,
  ChevronRight,
  Clock,
  DollarSign,
  FileText, 
  Info,
  LayoutGrid,
  Loader2, 
  Pencil, 
  Plus,
  PlusCircle,
  RefreshCw,
  Settings, 
  Trash,
  User2, 
  UserCog, 
  UserPlus,
  Users,
  Users2 
} from "lucide-react";
import { InlineEditRole } from "@/components/admin/inline-edit-role";
import { InlineEditPersonnel } from "@/components/admin/inline-edit-personnel";
import { RoleSummary } from "@/components/admin/role-summary";
import { TemplateCost } from "@/components/admin/template-cost";

import { 
  InsertPersonnel, 
  InsertReportTemplate, 
  InsertRole, 
  InsertTemplateRoleAssignment, 
  Personnel, 
  ReportTemplate, 
  Role, 
  TemplateRoleAssignment
} from "@shared/schema";

// Schema para el formulario de roles
const roleSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  defaultRate: z.coerce.number().min(0, "La tarifa debe ser mayor o igual a 0")
});

// Schema para el formulario de personal
const personnelSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  roleId: z.coerce.number().min(1, "Debe seleccionar un rol"),
  hourlyRate: z.coerce.number().min(0, "La tarifa debe ser mayor o igual a 0")
});

// Schema para el formulario de plantillas
const templateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  complexity: z.string().min(1, "Debe seleccionar una complejidad"),
  pageRange: z.string().optional(),
  features: z.string().optional(),
  platformCost: z.coerce.number().min(0, "El costo debe ser mayor o igual a 0"),
  deviationPercentage: z.coerce.number().min(0, "El porcentaje debe ser mayor o igual a 0").max(100, "El porcentaje no puede ser mayor a 100")
});

// Schema para el formulario de asignación de roles a plantillas
const templateRoleSchema = z.object({
  roleId: z.coerce.number().min(1, "Debe seleccionar un rol"),
  hours: z.coerce.number().min(0.5, "Las horas deben ser al menos 0.5")
});

// Tipos derivados para nuestros formularios
type RoleFormValues = z.infer<typeof roleSchema>;
type PersonnelFormValues = z.infer<typeof personnelSchema>;
type TemplateFormValues = z.infer<typeof templateSchema>;
type TemplateRoleFormValues = z.infer<typeof templateRoleSchema>;

export default function Admin() {
  // Estado para manejar tabs 
  const [activeTab, setActiveTab] = useState("roles");
  
  // Estados para manejar diálogos
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [assignRolesDialogOpen, setAssignRolesDialogOpen] = useState(false);
  
  // Estados para formularios
  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [currentPersonnel, setCurrentPersonnel] = useState<Personnel | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<ReportTemplate | null>(null);
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleHours, setNewRoleHours] = useState(0);
  
  // Estado para controlar animaciones de eliminación
  const [deletingTemplates, setDeletingTemplates] = useState<Set<number>>(new Set());
  const [hiddenTemplates, setHiddenTemplates] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const { 
    updatePersonnelInCache, 
    invalidatePersonnelData,
    invalidateAllRelatedData 
  } = useGlobalCacheInvalidation();
  
  // Obtener datos necesarios
  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });
  
  const { data: personnel, isLoading: personnelLoading } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });
  
  const { data: templates, isLoading: templatesLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });
  
  const { data: templateRoleAssignments, isLoading: templateRoleAssignmentsLoading } = useQuery<(TemplateRoleAssignment & { role: Role })[]>({
    queryKey: [`/api/template-roles/${currentTemplate?.id}/with-roles`],
    enabled: !!currentTemplate?.id,
  });

  // Configurar formularios con react-hook-form
  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      defaultRate: 0
    }
  });

  const personnelForm = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: {
      name: "",
      roleId: 0,
      hourlyRate: 0
    }
  });

  const templateForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      complexity: "",
      pageRange: "",
      features: "",
      platformCost: 0,
      deviationPercentage: 0
    }
  });

  const templateRoleForm = useForm<TemplateRoleFormValues>({
    resolver: zodResolver(templateRoleSchema),
    defaultValues: {
      roleId: 0,
      hours: 0
    }
  });
  
  // Mutations para crear y editar roles
  const createRoleMutation = useMutation({
    mutationFn: (role: InsertRole) => apiRequest("/api/roles", "POST", role),
    onSuccess: async () => {
      invalidateAllRelatedData();
      setRoleDialogOpen(false);
      roleForm.reset();
      toast({
        title: "Éxito",
        description: "Rol creado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el rol.",
        variant: "destructive",
      });
    },
  });
  
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertRole> }) => {
      return await apiRequest(`/api/roles/${id}`, "PATCH", data);
    },
    onSuccess: async () => {
      invalidateAllRelatedData();
      setRoleDialogOpen(false);
      roleForm.reset();
      toast({
        title: "Éxito",
        description: "Rol actualizado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol.",
        variant: "destructive",
      });
    },
  });
  
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/roles/${id}`, "DELETE");
    },
    onSuccess: async () => {
      invalidateAllRelatedData();
      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el rol. Puede que esté en uso.",
        variant: "destructive",
      });
    },
  });
  
  // Mutations para crear y editar personal
  const createPersonnelMutation = useMutation({
    mutationFn: (personnel: InsertPersonnel) => apiRequest("/api/personnel", "POST", personnel),
    onSuccess: async () => {
      invalidatePersonnelData();
      setPersonnelDialogOpen(false);
      personnelForm.reset();
      toast({
        title: "Éxito",
        description: "Miembro del equipo creado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el miembro del equipo.",
        variant: "destructive",
      });
    },
  });
  
  const updatePersonnelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPersonnel> }) => {
      return await apiRequest(`/api/personnel/${id}`, "PATCH", data);
    },
    onSuccess: async () => {
      invalidatePersonnelData();
      setPersonnelDialogOpen(false);
      personnelForm.reset();
      toast({
        title: "Éxito",
        description: "Miembro del equipo actualizado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el miembro del equipo.",
        variant: "destructive",
      });
    },
  });
  
  const deletePersonnelMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/personnel/${id}`, "DELETE");
    },
    onSuccess: async () => {
      invalidatePersonnelData();
      toast({
        title: "Éxito",
        description: "Miembro del equipo eliminado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el miembro del equipo.",
        variant: "destructive",
      });
    },
  });

  // Mutations para plantillas
  const createTemplateMutation = useMutation({
    mutationFn: (template: InsertReportTemplate) => apiRequest("/api/templates", "POST", template),
    onSuccess: async () => {
      invalidateAllRelatedData();
      setTemplateDialogOpen(false);
      templateForm.reset();
      toast({
        title: "Éxito",
        description: "Plantilla creada correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla.",
        variant: "destructive",
      });
    },
  });
  
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertReportTemplate> }) => {
      return await apiRequest(`/api/templates/${id}`, "PATCH", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setTemplateDialogOpen(false);
      templateForm.reset();
      toast({
        title: "Éxito",
        description: "Plantilla actualizada correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la plantilla.",
        variant: "destructive",
      });
    },
  });
  
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/templates/${id}`, "DELETE");
    },
    onMutate: async (id: number) => {
      // Marcar como eliminando para animación
      setDeletingTemplates(prev => {
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
      
      // Después de 300ms, ocultar completamente
      setTimeout(() => {
        setHiddenTemplates(prev => {
          const newSet = new Set(prev);
          newSet.add(id);
          return newSet;
        });
        setDeletingTemplates(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 300);
    },
    onSuccess: () => {
      // Invalidar cache para sincronizar con servidor
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Éxito",
        description: "Plantilla eliminada correctamente.",
      });
    },
    onError: (err, id) => {
      // En caso de error, mostrar nuevamente la plantilla
      setHiddenTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setDeletingTemplates(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla.",
        variant: "destructive",
      });
    },
  });

  // Mutation para asignar roles a plantillas
  const assignRoleToTemplateMutation = useMutation({
    mutationFn: (assignment: InsertTemplateRoleAssignment) => 
      apiRequest("/api/template-roles", "POST", assignment),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/template-roles/${currentTemplate?.id}/with-roles`] 
      });
      setAssignRolesDialogOpen(false);
      templateRoleForm.reset();
      toast({
        title: "Éxito",
        description: "Rol asignado a la plantilla correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo asignar el rol a la plantilla.",
        variant: "destructive",
      });
    },
  });

  // Funciones para manejar diálogos de roles
  const openNewRoleDialog = () => {
    roleForm.reset({
      name: "",
      description: "",
      defaultRate: 0
    });
    setCurrentRole(null);
    setIsEditing(false);
    setRoleDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    roleForm.reset({
      name: role.name,
      description: role.description || "",
      defaultRate: role.defaultRate
    });
    setCurrentRole(role);
    setIsEditing(true);
    setRoleDialogOpen(true);
  };

  const onRoleSubmit = (values: RoleFormValues) => {
    if (isEditing && currentRole) {
      updateRoleMutation.mutate({ id: currentRole.id, data: values });
    } else {
      createRoleMutation.mutate(values);
    }
  };

  // Funciones para manejar diálogos de personal
  const openNewPersonnelDialog = () => {
    personnelForm.reset({
      name: "",
      roleId: 0,
      hourlyRate: 0
    });
    setCurrentPersonnel(null);
    setIsEditing(false);
    setPersonnelDialogOpen(true);
  };

  const openEditPersonnelDialog = (personnel: Personnel) => {
    personnelForm.reset({
      name: personnel.name,
      roleId: personnel.roleId,
      hourlyRate: personnel.hourlyRate
    });
    setCurrentPersonnel(personnel);
    setIsEditing(true);
    setPersonnelDialogOpen(true);
  };

  const onPersonnelSubmit = (values: PersonnelFormValues) => {
    if (isEditing && currentPersonnel) {
      updatePersonnelMutation.mutate({ id: currentPersonnel.id, data: values });
    } else {
      createPersonnelMutation.mutate(values);
    }
  };

  // Funciones para manejar diálogos de plantillas
  const openNewTemplateDialog = () => {
    templateForm.reset({
      name: "",
      description: "",
      complexity: "",
      pageRange: "",
      features: "",
      platformCost: 0,
      deviationPercentage: 0
    });
    setCurrentTemplate(null);
    setIsEditing(false);
    setTemplateDialogOpen(true);
  };

  const openEditTemplateDialog = (template: ReportTemplate) => {
    templateForm.reset({
      name: template.name,
      description: template.description || "",
      complexity: template.complexity,
      pageRange: template.pageRange || "",
      features: template.features || "",
      platformCost: template.platformCost ?? undefined,
      deviationPercentage: template.deviationPercentage ?? undefined
    });
    setCurrentTemplate(template);
    setIsEditing(true);
    setTemplateDialogOpen(true);
  };

  const onTemplateSubmit = (values: TemplateFormValues) => {
    if (isEditing && currentTemplate) {
      updateTemplateMutation.mutate({ id: currentTemplate.id, data: values });
    } else {
      createTemplateMutation.mutate(values);
    }
  };

  // Función para abrir el diálogo de asignación de roles
  const openAssignRolesDialog = (template: ReportTemplate) => {
    setCurrentTemplate(template);
    templateRoleForm.reset({
      roleId: 0,
      hours: 0
    });
    setAssignRolesDialogOpen(true);
  };

  const onTemplateRoleSubmit = (values: TemplateRoleFormValues) => {
    if (currentTemplate) {
      assignRoleToTemplateMutation.mutate({
        templateId: currentTemplate.id,
        roleId: values.roleId,
        hours: values.hours.toString()
      });
    }
  };

  // Función para obtener el nombre del rol por ID
  const getRoleName = (roleId: number) => {
    const role = roles?.find(r => r.id === roleId);
    return role ? role.name : "Rol no encontrado";
  };

  return (
    <div className="page-container">
      {/* Breadcrumbs unificados */}
      <div className="breadcrumb-nav mb-6">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <span>Dashboard</span>
          <span>/</span>
          <span className="text-foreground font-medium">Panel de Administración</span>
        </nav>
        
        <div className="flex-between">
          <div>
            <h1 className="heading-page">Panel de Administración</h1>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="personnel" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Plantillas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <Card className="standard-card mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="heading-card">Roles del Equipo</CardTitle>
                  <CardDescription>Gestiona los roles y sus tarifas por defecto</CardDescription>
                </div>
                <Button onClick={openNewRoleDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Rol
                </Button>
              </div>
            </CardHeader>
            <CardContent className="card-content">
              {rolesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader variant="dots" size="md" text="Cargando roles" />
                </div>
              ) : roles && roles.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Tarifa por Defecto</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {role.description || "Sin descripción"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              ${role.defaultRate}/hr
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openEditRoleDialog(role)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteRoleMutation.mutate(role.id)}
                                disabled={deleteRoleMutation.isPending}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay roles configurados. ¡Añade tu primer rol!
                </div>
              )}
            </CardContent>
            {roles && roles.length > 0 && (
              <div className="p-4 bg-slate-50 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total: {roles.length} roles configurados</span>
                  <span className="text-blue-600 font-medium">
                    Tarifa promedio: ${(roles.reduce((sum, role) => sum + role.defaultRate, 0) / roles.length).toFixed(2)}/hr
                  </span>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="personnel">
          <Card className="standard-card mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="heading-card">Gestión de Personal</CardTitle>
                  <CardDescription>Añadir y actualizar miembros del equipo y sus tarifas</CardDescription>
                </div>
                <Button onClick={openNewPersonnelDialog} disabled={!roles || roles.length === 0}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Miembro
                </Button>
              </div>
            </CardHeader>
            <CardContent className="card-content">
              {personnelLoading || rolesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader variant="dots" size="md" text="Cargando personal" />
                </div>
              ) : !roles || roles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Primero debes crear al menos un rol antes de añadir personal.
                </div>
              ) : personnel && personnel.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Tarifa por Hora</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personnel.map((person) => (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">{person.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getRoleName(person.roleId)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              ${person.hourlyRate}/hr
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openEditPersonnelDialog(person)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deletePersonnelMutation.mutate(person.id)}
                                disabled={deletePersonnelMutation.isPending}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay miembros del equipo registrados. ¡Añade tu primer miembro!
                </div>
              )}
            </CardContent>
            {personnel && personnel.length > 0 && (
              <div className="p-4 bg-slate-50 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total: {personnel.length} miembros del equipo</span>
                  <span className="text-blue-600 font-medium">
                    Tarifa promedio: ${(personnel.reduce((sum, person) => sum + person.hourlyRate, 0) / personnel.length).toFixed(2)}/hr
                  </span>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="standard-card mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="heading-card">Plantillas de Reportes</CardTitle>
                  <CardDescription>Gestiona las plantillas y sus asignaciones de roles</CardDescription>
                </div>
                <Button onClick={openNewTemplateDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Plantilla
                </Button>
              </div>
            </CardHeader>
            <CardContent className="card-content">
              {templatesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader variant="dots" size="md" text="Cargando plantillas" />
                </div>
              ) : templates && templates.length > 0 ? (
                <div className="space-y-4">
                  {templates
                    .filter(template => !hiddenTemplates.has(template.id))
                    .map((template) => {
                      const isDeleting = deletingTemplates.has(template.id);
                      return (
                        <Card 
                          key={template.id} 
                          className={`border border-slate-200 transition-all duration-300 ${
                            isDeleting ? 'opacity-0 scale-95 transform -translate-y-2' : 'opacity-100 scale-100'
                          }`}
                          style={{ 
                            transform: isDeleting ? 'translateY(-8px)' : 'translateY(0)',
                            transition: 'all 0.3s ease-out'
                          }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <CardTitle className="text-lg">{template.name}</CardTitle>
                                <CardDescription>{template.description}</CardDescription>
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="outline">{template.complexity}</Badge>
                                  {template.pageRange && (
                                    <Badge variant="secondary">{template.pageRange} páginas</Badge>
                                  )}
                                  <Badge variant="secondary" className="font-mono">
                                    ${template.platformCost} costo base
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openAssignRolesDialog(template)}
                                  disabled={isDeleting}
                                >
                                  <UserCog className="h-4 w-4 mr-1" />
                                  Roles
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => openEditTemplateDialog(template)}
                                  disabled={isDeleting}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => deleteTemplateMutation.mutate(template.id)}
                                  disabled={deleteTemplateMutation.isPending || isDeleting}
                                  className={isDeleting ? 'bg-red-100' : ''}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {template.features && (
                            <CardContent className="pt-0">
                              <p className="text-sm text-muted-foreground">{template.features}</p>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay plantillas configuradas. ¡Añade tu primera plantilla!
                </div>
              )}
            </CardContent>
            {templates && templates.length > 0 && (
              <div className="p-4 bg-slate-50 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total: {templates.length} plantillas configuradas</span>
                  <span className="text-blue-600 font-medium">
                    Costo promedio: ${(templates.reduce((sum, template) => sum + (template.platformCost || 0), 0) / templates.length).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo para crear/editar roles */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Rol" : "Añadir Nuevo Rol"}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? 
                "Actualiza la información del rol a continuación." : 
                "Completa los detalles para añadir un nuevo rol al sistema."
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...roleForm}>
            <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-4">
              <FormField
                control={roleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Rol</FormLabel>
                    <FormControl>
                      <Input placeholder="ej. Analista Senior" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={roleForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe las responsabilidades del rol..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={roleForm.control}
                name="defaultRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa por Defecto (USD/hora)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="50.00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Esta será la tarifa por defecto para nuevo personal con este rol.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setRoleDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                >
                  {(createRoleMutation.isPending || updateRoleMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para crear/editar personal */}
      <Dialog open={personnelDialogOpen} onOpenChange={setPersonnelDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Miembro del Equipo" : "Añadir Nuevo Miembro"}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? 
                "Actualiza la información del miembro del equipo." : 
                "Completa los detalles para añadir un nuevo miembro al equipo."
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...personnelForm}>
            <form onSubmit={personnelForm.handleSubmit(onPersonnelSubmit)} className="space-y-4">
              <FormField
                control={personnelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="ej. Juan Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={personnelForm.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name} (${role.defaultRate}/hr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={personnelForm.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa por Hora (USD)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="50.00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Puede ser diferente a la tarifa por defecto del rol.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setPersonnelDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPersonnelMutation.isPending || updatePersonnelMutation.isPending}
                >
                  {(createPersonnelMutation.isPending || updatePersonnelMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para crear/editar plantillas */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Plantilla" : "Añadir Nueva Plantilla"}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? 
                "Actualiza la información de la plantilla." : 
                "Completa los detalles para añadir una nueva plantilla al sistema."
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={templateForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Plantilla</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. Análisis Competitivo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={templateForm.control}
                  name="complexity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complejidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="standard">Estándar</SelectItem>
                          <SelectItem value="advanced">Avanzado</SelectItem>
                          <SelectItem value="expert">Experto</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={templateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe qué incluye esta plantilla..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={templateForm.control}
                  name="pageRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rango de Páginas (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="ej. 15-25" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={templateForm.control}
                  name="platformCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Base (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="500.00" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={templateForm.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Características (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Lista las características principales..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={templateForm.control}
                name="deviationPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porcentaje de Desviación (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        placeholder="10.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Porcentaje de variación permitido en el costo final.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setTemplateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                >
                  {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para asignar roles a plantillas */}
      <Dialog open={assignRolesDialogOpen} onOpenChange={setAssignRolesDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Asignar Rol a Plantilla</DialogTitle>
            <DialogDescription>
              Asigna un rol y las horas estimadas para la plantilla "{currentTemplate?.name}".
            </DialogDescription>
          </DialogHeader>

          {/* Mostrar roles ya asignados */}
          {templateRoleAssignments && templateRoleAssignments.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">Roles Asignados:</h4>
              <div className="space-y-2">
                {templateRoleAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                    <span className="font-medium">{assignment.role.name}</span>
                    <Badge variant="secondary">{assignment.hours} horas</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Form {...templateRoleForm}>
            <form onSubmit={templateRoleForm.handleSubmit(onTemplateRoleSubmit)} className="space-y-4">
              <FormField
                control={templateRoleForm.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name} (${role.defaultRate}/hr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={templateRoleForm.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas Estimadas</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.5"
                        placeholder="8.0" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Número de horas estimadas para este rol en esta plantilla.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setAssignRolesDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={assignRoleToTemplateMutation.isPending}
                >
                  {assignRoleToTemplateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Asignar Rol
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
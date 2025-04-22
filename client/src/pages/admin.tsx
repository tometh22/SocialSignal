// Archivo original con correcciones

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Calculator,
  Clock,
  DollarSign,
  FileText, 
  Info,
  LayoutGrid,
  Loader2, 
  Pencil, 
  Plus,
  PlusCircle, 
  Settings, 
  Trash, 
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
  
  const { toast } = useToast();
  
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
    enabled: !!currentTemplate,
  });
  
  // Configuración de formularios
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
      complexity: "medium",
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
    mutationFn: (role: InsertRole) => apiRequest("POST", "/api/roles", role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
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
      const response = await apiRequest("PATCH", `/api/roles/${id}`, data);
      return await response.json();
    },
    onSuccess: (updatedRole: Role) => {
      // Actualizar la caché para actualización inmediata en UI
      queryClient.setQueryData<Role[]>(["/api/roles"], (oldRoles) => {
        if (!oldRoles) return [updatedRole];
        return oldRoles.map(role => 
          role.id === updatedRole.id ? updatedRole : role
        );
      });
      
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
      const response = await apiRequest("DELETE", `/api/roles/${id}`);
      if (!response.ok) {
        throw new Error("Failed to delete role");
      }
      return id;
    },
    onSuccess: (deletedId) => {
      // Actualizar la caché para actualización inmediata en UI
      queryClient.setQueryData<Role[]>(["/api/roles"], (oldRoles) => {
        if (!oldRoles) return [];
        return oldRoles.filter(role => role.id !== deletedId);
      });
      
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
    mutationFn: (personnel: InsertPersonnel) => apiRequest("POST", "/api/personnel", personnel),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
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
      const response = await apiRequest("PATCH", `/api/personnel/${id}`, data);
      return await response.json();
    },
    onSuccess: (updatedPersonnel: Personnel) => {
      // Actualizar la caché para actualización inmediata en UI
      queryClient.setQueryData<Personnel[]>(["/api/personnel"], (oldPersonnel) => {
        if (!oldPersonnel) return [updatedPersonnel];
        return oldPersonnel.map(person => 
          person.id === updatedPersonnel.id ? updatedPersonnel : person
        );
      });
      
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
      const response = await apiRequest("DELETE", `/api/personnel/${id}`);
      if (!response.ok) {
        throw new Error("Failed to delete personnel");
      }
      return id;
    },
    onSuccess: (deletedId) => {
      // Actualizar la caché para actualización inmediata en UI
      queryClient.setQueryData<Personnel[]>(["/api/personnel"], (oldPersonnel) => {
        if (!oldPersonnel) return [];
        return oldPersonnel.filter(person => person.id !== deletedId);
      });
      
      toast({
        title: "Éxito",
        description: "Miembro del equipo eliminado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el miembro del equipo. Puede que esté en uso.",
        variant: "destructive",
      });
    },
  });
  
  // Mutations para crear y editar plantillas
  const createTemplateMutation = useMutation({
    mutationFn: async (template: InsertReportTemplate) => {
      const response = await apiRequest("POST", "/api/templates", template);
      return await response.json();
    },
    onSuccess: (newTemplate: ReportTemplate) => {
      // Crear objeto optimista para actualización inmediata
      const optimisticTemplate: ReportTemplate = {
        ...newTemplate
      };
      
      // Actualizar la caché para actualización inmediata en UI
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], (oldTemplates) => {
        if (!oldTemplates) return [optimisticTemplate];
        return [...oldTemplates, optimisticTemplate];
      });
      
      setTemplateDialogOpen(false);
      templateForm.reset();
      toast({
        title: "Éxito",
        description: "Plantilla de reporte creada correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla de reporte.",
        variant: "destructive",
      });
    },
  });
  
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertReportTemplate> }) => {
      const response = await apiRequest("PATCH", `/api/templates/${id}`, data);
      return await response.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancelar consultas en curso
      await queryClient.cancelQueries({ queryKey: ["/api/templates"] });
      
      // Guardar estado anterior
      const previousTemplates = queryClient.getQueryData<ReportTemplate[]>(["/api/templates"]);
      
      // Actualización optimista
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], old => {
        if (!old) return [];
        
        return old.map(template => 
          template.id === id 
            ? { ...template, ...data }
            : template
        );
      });
      
      return { previousTemplates };
    },
    onSuccess: (updatedTemplate: ReportTemplate) => {
      // Asegurar que la caché tenga los datos actualizados
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], old => {
        if (!old) return [updatedTemplate];
        
        return old.map(template => 
          template.id === updatedTemplate.id 
            ? updatedTemplate
            : template
        );
      });
      
      // Reset de estados
      setIsEditing(false);
      setCurrentTemplate(null);
      setTemplateDialogOpen(false);
      templateForm.reset();
      
      toast({
        title: "Éxito",
        description: "Plantilla de reporte actualizada correctamente.",
      });
    },
    onError: (err, variables, context) => {
      console.error("Error al actualizar plantilla:", err);
      
      // Revertir al estado anterior en caso de error
      if (context?.previousTemplates) {
        queryClient.setQueryData(["/api/templates"], context.previousTemplates);
      }
      
      toast({
        title: "Error",
        description: "No se pudo actualizar la plantilla de reporte.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refrescar datos del servidor independientemente del resultado
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
  });
  
  // Mutación para eliminar plantilla de reporte
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/templates/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        // Crear un objeto de error con información adicional
        const error: any = new Error(errorData.message || "Error al eliminar la plantilla");
        error.status = response.status;
        throw error;
      }
      return id;
    },
    onMutate: async (deletedId) => {
      // Cancelar todas las consultas en curso
      await queryClient.cancelQueries({ queryKey: ["/api/templates"] });
      
      // Guardar el estado anterior por si necesitamos revertir
      const previousTemplates = queryClient.getQueryData<ReportTemplate[]>(["/api/templates"]);
      
      // Actualizar inmediatamente la UI con el cambio optimista
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], (old) => 
        old ? old.filter(item => item.id !== deletedId) : []
      );
      
      // Devolver el estado anterior para poder revertir si ocurre un error
      return { previousTemplates };
    },
    onSuccess: (deletedId) => {
      console.log(`Plantilla ${deletedId} eliminada exitosamente`);
      
      toast({
        title: "Éxito",
        description: "Plantilla de reporte eliminada correctamente.",
      });
    },
    onError: (err, deletedId, context) => {
      console.error("Error al eliminar plantilla:", err);
      
      // Revertir al estado anterior en caso de error
      if (context?.previousTemplates) {
        queryClient.setQueryData(["/api/templates"], context.previousTemplates);
      }
      
      // Mostrar mensaje de error según el tipo
      if ((err as any).status === 409) {
        toast({
          title: "No se puede eliminar",
          description: "Esta plantilla está siendo utilizada en cotizaciones existentes.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo eliminar la plantilla de reporte.",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      // Refrescar datos del servidor después de la operación, sin importar si hubo éxito o error
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
  });
  
  // Añadir asignación de rol a plantilla
  const createTemplateRoleAssignmentMutation = useMutation({
    mutationFn: async (data: InsertTemplateRoleAssignment) => {
      const response = await apiRequest("POST", "/api/template-roles", data);
      if (!response.ok) {
        throw new Error("Failed to assign role");
      }
      const result = await response.json();
      return result;
    },
    onMutate: async (newRoleAssignment) => {
      if (!currentTemplate || !roles) return {};
      
      // Conseguir el rol seleccionado para usarlo en la actualización optimista
      const selectedRole = roles.find(r => r.id === newRoleAssignment.roleId);
      if (!selectedRole) return {};
      
      // Cancelar consultas en curso
      await queryClient.cancelQueries({ 
        queryKey: [`/api/template-roles/${currentTemplate.id}/with-roles`] 
      });
      
      // Guardar el estado anterior
      const previousAssignments = queryClient.getQueryData<(TemplateRoleAssignment & { role: Role })[]>(
        [`/api/template-roles/${currentTemplate.id}/with-roles`]
      );
      
      // Crear una asignación optimista temporal
      const tempId = -Date.now(); // ID temporal negativo para distinguirlo
      const optimisticAssignment: TemplateRoleAssignment & { role: Role } = {
        id: tempId,
        templateId: newRoleAssignment.templateId,
        roleId: newRoleAssignment.roleId,
        hours: newRoleAssignment.hours || "0", // Asegurarnos de que hours sea un string válido
        role: selectedRole,
      };
      
      // Actualizar la caché con la asignación optimista
      queryClient.setQueryData<(TemplateRoleAssignment & { role: Role })[]>(
        [`/api/template-roles/${currentTemplate.id}/with-roles`],
        (old) => old ? [...old, optimisticAssignment] : [optimisticAssignment]
      );
      
      return { previousAssignments, tempId };
    },
    onSuccess: (newAssignment, variables, context) => {
      if (!currentTemplate || !roles) return;
      
      // Encontrar el rol para crear la asignación completa
      const role = roles.find(r => r.id === variables.roleId);
      if (!role) return;
      
      // Actualizar la caché con la asignación real (reemplazando la temporal)
      queryClient.setQueryData<(TemplateRoleAssignment & { role: Role })[]>(
        [`/api/template-roles/${currentTemplate.id}/with-roles`],
        (old) => {
          if (!old) return [{ ...newAssignment, role }];
          
          // Filtrar la asignación temporal y añadir la real
          return old
            .filter(item => item.id !== context?.tempId)
            .concat({ ...newAssignment, role });
        }
      );
      
      toast({
        title: "Éxito",
        description: "Rol agregado correctamente a la plantilla.",
      });
      
      // Resetear el formulario para añadir otro rol
      templateRoleForm.reset({
        roleId: roles && roles.length > 0 ? roles[0].id : 0,
        hours: 0
      });
    },
    onError: (err, _, context) => {
      // Revertir al estado anterior en caso de error
      if (context?.previousAssignments && currentTemplate) {
        queryClient.setQueryData(
          [`/api/template-roles/${currentTemplate.id}/with-roles`], 
          context.previousAssignments
        );
      }
      
      toast({
        title: "Error",
        description: "No se pudo agregar el rol a la plantilla.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refrescar datos del servidor
      if (currentTemplate) {
        // Invalidar la consulta de roles de la plantilla
        queryClient.invalidateQueries({ 
          queryKey: [`/api/template-roles/${currentTemplate.id}/with-roles`] 
        });
        
        // Invalidar también la lista completa de plantillas para actualizar costos
        queryClient.invalidateQueries({ 
          queryKey: ["/api/templates"] 
        });
      }
    }
  });
  
  // Eliminar asignación de rol a plantilla
  const deleteTemplateRoleAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/template-roles/${id}`);
      if (!response.ok) {
        throw new Error("Failed to delete role assignment");
      }
      return id;
    },
    onMutate: async (id) => {
      if (!currentTemplate) return {};
      
      // Cancelar consultas en curso
      await queryClient.cancelQueries({ 
        queryKey: [`/api/template-roles/${currentTemplate.id}/with-roles`] 
      });
      
      // Guardar el estado anterior
      const previousAssignments = queryClient.getQueryData<(TemplateRoleAssignment & { role: Role })[]>(
        [`/api/template-roles/${currentTemplate.id}/with-roles`]
      );
      
      // Actualizar la caché removiendo la asignación
      queryClient.setQueryData<(TemplateRoleAssignment & { role: Role })[]>(
        [`/api/template-roles/${currentTemplate.id}/with-roles`],
        (old) => old ? old.filter(assignment => assignment.id !== id) : []
      );
      
      return { previousAssignments };
    },
    onSuccess: (id) => {
      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente de la plantilla.",
      });
    },
    onError: (err, id, context) => {
      // Revertir al estado anterior en caso de error
      if (context?.previousAssignments && currentTemplate) {
        queryClient.setQueryData(
          [`/api/template-roles/${currentTemplate.id}/with-roles`], 
          context.previousAssignments
        );
      }
      
      toast({
        title: "Error",
        description: "No se pudo eliminar el rol de la plantilla.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refrescar datos del servidor
      if (currentTemplate) {
        // Invalidar la consulta de roles de la plantilla
        queryClient.invalidateQueries({ 
          queryKey: [`/api/template-roles/${currentTemplate.id}/with-roles`] 
        });
        
        // Invalidar también la lista completa de plantillas para actualizar costos
        queryClient.invalidateQueries({ 
          queryKey: ["/api/templates"] 
        });
      }
    },
  });

  // Open dialogs
  const openNewRoleDialog = () => {
    roleForm.reset({
      name: "",
      description: "",
      defaultRate: 0
    });
    setIsEditing(false);
    setCurrentRole(null);
    setRoleDialogOpen(true);
  };
  
  const openNewPersonnelDialog = () => {
    if (!roles || roles.length === 0) {
      toast({
        title: "Error",
        description: "Primero debe crear roles antes de añadir personal.",
        variant: "destructive",
      });
      return;
    }
    
    personnelForm.reset({
      name: "",
      roleId: roles[0].id,
      hourlyRate: 0
    });
    setIsEditing(false);
    setCurrentPersonnel(null);
    setPersonnelDialogOpen(true);
  };
  
  const openNewTemplateDialog = () => {
    templateForm.reset({
      name: "",
      description: "",
      complexity: "medium",
      pageRange: "",
      features: "",
      platformCost: 0,
      deviationPercentage: 0
    });
    setIsEditing(false);
    setCurrentTemplate(null);
    setTemplateDialogOpen(true);
  };
  
  const openEditRoleDialog = (role: Role) => {
    roleForm.reset({
      name: role.name,
      description: role.description || "",
      defaultRate: role.defaultRate
    });
    setIsEditing(true);
    setCurrentRole(role);
    setRoleDialogOpen(true);
  };
  
  const openEditPersonnelDialog = (person: Personnel) => {
    personnelForm.reset({
      name: person.name,
      roleId: person.roleId,
      hourlyRate: person.hourlyRate
    });
    setIsEditing(true);
    setCurrentPersonnel(person);
    setPersonnelDialogOpen(true);
  };
  
  const openEditTemplateDialog = (template: ReportTemplate) => {
    templateForm.reset({
      name: template.name,
      description: template.description || "",
      complexity: template.complexity,
      pageRange: template.pageRange || "",
      features: template.features || "",
      platformCost: template.platformCost || 0,
      deviationPercentage: template.deviationPercentage || 0
    });
    setIsEditing(true);
    setCurrentTemplate(template);
    
    // Pre-cargar los roles asignados a esta plantilla
    queryClient.prefetchQuery({
      queryKey: [`/api/template-roles/${template.id}/with-roles`],
    });
    
    setTemplateDialogOpen(true);
  };
  
  const openAssignRolesDialog = (template: ReportTemplate) => {
    if (!roles || roles.length === 0) {
      toast({
        title: "Error",
        description: "Primero debe crear roles antes de asignarlos a plantillas.",
        variant: "destructive",
      });
      return;
    }
    
    setCurrentTemplate(template);
    templateRoleForm.reset({
      roleId: roles[0].id,
      hours: 0
    });
    setAssignRolesDialogOpen(true);
  };
  
  // Form submissions
  const onRoleSubmit = (values: RoleFormValues) => {
    if (isEditing && currentRole) {
      updateRoleMutation.mutate({
        id: currentRole.id,
        data: values
      });
    } else {
      createRoleMutation.mutate(values);
    }
  };
  
  const onPersonnelSubmit = (values: PersonnelFormValues) => {
    if (isEditing && currentPersonnel) {
      updatePersonnelMutation.mutate({
        id: currentPersonnel.id,
        data: values
      });
    } else {
      createPersonnelMutation.mutate(values);
    }
  };
  
  const onTemplateSubmit = (values: TemplateFormValues) => {
    if (isEditing && currentTemplate) {
      updateTemplateMutation.mutate({
        id: currentTemplate.id,
        data: values
      });
    } else {
      createTemplateMutation.mutate(values);
    }
  };
  
  // Manejar añadir asignación de rol a plantilla
  const onTemplateRoleSubmit = (values: TemplateRoleFormValues) => {
    if (!currentTemplate) return;
    
    // Solo enviamos la mutación y dejamos que onMutate maneje la parte optimista
    createTemplateRoleAssignmentMutation.mutate({
      templateId: currentTemplate.id,
      roleId: values.roleId,
      hours: values.hours.toString() // La API espera un string para las horas
    });
  };

  // Find role name by ID
  const getRoleName = (roleId: number) => {
    if (!roles) return "Unknown";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Unknown";
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Panel de Administración</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="roles" className="flex items-center">
                <UserCog className="mr-2 h-4 w-4" />
                Roles de Equipo
              </TabsTrigger>
              <TabsTrigger value="personnel" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Plantillas de Reportes
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="roles">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Roles de Equipo</CardTitle>
                    <CardDescription>Administrar roles y tarifas por hora predeterminadas</CardDescription>
                  </div>
                  <Button onClick={openNewRoleDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Nuevo Rol
                  </Button>
                </CardHeader>
                <CardContent>
                  {rolesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader variant="gradient" size="md" text="Cargando roles" />
                    </div>
                  ) : roles && roles.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre del Rol</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Tarifa Predeterminada</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roles.map(role => (
                          <InlineEditRole 
                            key={role.id} 
                            role={role}
                            onUpdate={(updatedRole) => {
                              // Actualizar roles en tiempo real
                              const updatedRoles = roles.map(r => 
                                r.id === updatedRole.id ? updatedRole : r
                              );
                              queryClient.setQueryData(["/api/roles"], updatedRoles);
                            }}
                            onDelete={(roleId) => {
                              // Eliminar rol en tiempo real
                              deleteRoleMutation.mutate(roleId);
                            }}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-neutral-500">
                      No se encontraron roles. Añade tu primer rol.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="personnel">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Personal</CardTitle>
                    <CardDescription>Añadir y actualizar miembros del equipo y sus tarifas</CardDescription>
                  </div>
                  <Button onClick={openNewPersonnelDialog} disabled={!roles || roles.length === 0}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Miembro
                  </Button>
                </CardHeader>
                <CardContent>
                  {personnelLoading || rolesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader variant="gradient" size="md" text="Cargando personal" />
                    </div>
                  ) : !roles || roles.length === 0 ? (
                    <div className="text-center py-4 text-neutral-500">
                      Por favor, añade roles antes de añadir personal.
                    </div>
                  ) : personnel && personnel.length > 0 ? (
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
                        {personnel.map(person => (
                          <InlineEditPersonnel 
                            key={person.id}
                            person={person}
                            roles={roles}
                            onUpdate={(updatedPerson) => {
                              // Actualizar personal en tiempo real
                              const updatedPersonnel = personnel.map(p => 
                                p.id === updatedPerson.id ? updatedPerson : p
                              );
                              queryClient.setQueryData(["/api/personnel"], updatedPersonnel);
                            }}
                            onDelete={(personnelId) => {
                              // Eliminar personal en tiempo real
                              deletePersonnelMutation.mutate(personnelId);
                            }}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-neutral-500">
                      No se encontró personal. Añade tu primer miembro de equipo.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="templates">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Plantillas de Reportes</CardTitle>
                    <CardDescription>Configurar plantillas estándar de reportes</CardDescription>
                  </div>
                  <Button onClick={openNewTemplateDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Plantilla
                  </Button>
                </CardHeader>
                <CardContent>
                  {templatesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader variant="gradient" size="md" text="Cargando plantillas" />
                    </div>
                  ) : templates && templates.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre de Plantilla</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Complejidad</TableHead>
                          <TableHead>Rango de Páginas</TableHead>
                          <TableHead>Costo Estimado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map(template => (
                          <TableRow key={template.id}>
                            <TableCell className="py-3 font-medium">{template.name}</TableCell>
                            <TableCell className="py-3">{template.description}</TableCell>
                            <TableCell className="py-3">
                              <Badge className={
                                template.complexity === "high" ? "bg-red-100 text-red-800 hover:bg-red-100" :
                                template.complexity === "medium" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" :
                                template.complexity === "variable" ? "bg-purple-100 text-purple-800 hover:bg-purple-100" :
                                "bg-green-100 text-green-800 hover:bg-green-100"
                              }>
                                {template.complexity === "high" ? "Alta" :
                                 template.complexity === "medium" ? "Media" :
                                 template.complexity === "variable" ? "Variable" : "Baja"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">{template.pageRange}</TableCell>
                            <TableCell className="py-3">
                              <div className="space-y-1">
                                {/* Mostramos "Cargando..." mientras esperamos los datos */}
                                <TemplateCost templateId={template.id} platformCost={template.platformCost || 0} deviationPercentage={template.deviationPercentage || 0} />
                                
                                
                                {/* Información adicional más compacta */}
                                <div className="text-xs text-slate-500">
                                  {(template.platformCost || 0) > 0 && <span className="inline-block mr-2">Plataformas</span>}
                                  {(template.deviationPercentage || 0) > 0 && <span>Desvío {template.deviationPercentage}%</span>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openEditTemplateDialog(template)}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm(`¿Estás seguro de que deseas eliminar la plantilla "${template.name}"? Esta acción no se puede deshacer.`)) {
                                      deleteTemplateMutation.mutate(template.id);
                                    }
                                  }}
                                >
                                  <Trash className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-neutral-500">
                      No se encontraron plantillas. Añade tu primera plantilla de reporte.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Rol" : "Añadir Nuevo Rol"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza los detalles del rol a continuación."
                : "Añade un nuevo rol con su descripción y tarifa por hora predeterminada."}
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
                      <Input placeholder="Ej: Project Manager" {...field} />
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
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Breve descripción de las responsabilidades" 
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
                    <FormLabel>Tarifa por Hora (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Esta es la tarifa predeterminada por hora para este rol.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                >
                  {createRoleMutation.isPending || updateRoleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? "Actualizando..." : "Creando..."}
                    </>
                  ) : (
                    isEditing ? "Actualizar Rol" : "Añadir Rol"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Personnel Dialog */}
      <Dialog open={personnelDialogOpen} onOpenChange={setPersonnelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Miembro del Equipo" : "Añadir Miembro del Equipo"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza los detalles del miembro del equipo a continuación."
                : "Añade un nuevo miembro del equipo con su rol y tarifa por hora."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...personnelForm}>
            <form onSubmit={personnelForm.handleSubmit(onPersonnelSubmit)} className="space-y-4">
              <FormField
                control={personnelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del miembro del equipo" {...field} />
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
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map(role => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
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
                render={({ field }) => {
                  // Obtener la tarifa predeterminada del rol seleccionado
                  const selectedRoleId = personnelForm.watch("roleId");
                  const selectedRole = roles?.find(r => r.id === selectedRoleId);
                  const defaultRate = selectedRole?.defaultRate || 0;
                  
                  return (
                    <FormItem>
                      <FormLabel>Tarifa por Hora (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          {...field} 
                          // Al cambiar de rol, sugerir la tarifa predeterminada
                          onChange={(e) => {
                            if (e.target.value === "" && selectedRole) {
                              field.onChange(defaultRate);
                            } else {
                              field.onChange(e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Tarifa sugerida: ${defaultRate.toFixed(2)}/hora (basada en el rol seleccionado)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createPersonnelMutation.isPending || updatePersonnelMutation.isPending}
                >
                  {createPersonnelMutation.isPending || updatePersonnelMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? "Actualizando..." : "Creando..."}
                    </>
                  ) : (
                    isEditing ? "Actualizar Miembro" : "Añadir Miembro"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog 
        open={templateDialogOpen} 
        onOpenChange={(open) => {
          setTemplateDialogOpen(open);
          // Cuando se cierra el diálogo, resetear los estados
          if (!open) {
            setIsEditing(false);
            setCurrentTemplate(null);
            setTimeout(() => {
              // Forzar la actualización de la lista después de un pequeño retraso
              queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
            }, 100);
          }
        }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Plantilla" : "Añadir Plantilla de Reporte"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza los detalles de la plantilla de reporte y gestiona sus roles."
                : "Crea una nueva plantilla de reporte para cotizaciones."}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="details" className="mt-4">
            <TabsList>
              <TabsTrigger value="details">Detalles Generales</TabsTrigger>
              {isEditing && currentTemplate && (
                <TabsTrigger value="roles">Roles y Costos</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="details">
              <Form {...templateForm}>
                <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                  {/* Mostrar resumen de costos cuando se está editando */}
                  {isEditing && currentTemplate && (
                    <div className="mb-6">
                      <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-blue-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center text-blue-700">
                            <BadgeDollarSign className="h-5 w-5 mr-2" /> 
                            Resumen Financiero
                          </CardTitle>
                          <CardDescription>
                            Información de costos para la plantilla "{currentTemplate.name}"
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-slate-700 flex items-center">
                                <Users className="h-4 w-4 mr-2 text-blue-600" />
                                Composición del Equipo
                              </h4>
                              <div className="bg-white rounded-md p-3 border border-blue-100 shadow-sm">
                                <RoleSummary templateId={currentTemplate.id} showCosts={true} />
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-slate-700 flex items-center">
                                <Calculator className="h-4 w-4 mr-2 text-blue-600" />
                                Desglose de Costos
                              </h4>
                              
                              <div className="bg-white rounded-md p-4 border border-blue-100 shadow-sm">
                                {/* Cargando si no tenemos los datos aún */}
                                {templateRoleAssignmentsLoading ? (
                                  <div className="text-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                    <p className="text-sm text-slate-600">Calculando costos...</p>
                                  </div>
                                ) : templateRoleAssignments && (
                                  <div className="space-y-3">
                                    {/* Costo de personal */}
                                    <div className="flex justify-between items-center pb-2 border-b border-dashed">
                                      <div className="flex items-center text-slate-700">
                                        <Users className="h-4 w-4 mr-2 text-slate-500" />
                                        <span>Personal</span>
                                      </div>
                                      <span className="font-medium">
                                        ${templateRoleAssignments.reduce((acc, assignment) => 
                                          acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0).toFixed(2)}
                                      </span>
                                    </div>
                                    
                                    {/* Costo de plataformas */}
                                    <div className="flex justify-between items-center pb-2 border-b border-dashed">
                                      <div className="flex items-center text-slate-700">
                                        <LayoutGrid className="h-4 w-4 mr-2 text-slate-500" />
                                        <span>Plataformas</span>
                                      </div>
                                      <span className="font-medium">
                                        ${(currentTemplate.platformCost || 0).toFixed(2)}
                                      </span>
                                    </div>
                                    
                                    {/* Subtotal */}
                                    <div className="flex justify-between items-center pt-1 pb-2 font-medium">
                                      <span>Subtotal</span>
                                      <span>
                                        ${(templateRoleAssignments.reduce((acc, assignment) => 
                                          acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0) + 
                                          (currentTemplate.platformCost || 0)).toFixed(2)}
                                      </span>
                                    </div>
                                    
                                    {/* Desvío */}
                                    {(currentTemplate.deviationPercentage || 0) > 0 && (
                                      <div className="flex justify-between items-center text-purple-700 pb-2 border-b border-dashed">
                                        <div className="flex items-center">
                                          <BadgeDollarSign className="h-4 w-4 mr-2" />
                                          <span>Desvío ({currentTemplate.deviationPercentage || 0}%)</span>
                                        </div>
                                        <span className="font-medium">
                                          ${((templateRoleAssignments.reduce((acc, assignment) => 
                                            acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0) + 
                                            (currentTemplate.platformCost || 0)) * 
                                            ((currentTemplate.deviationPercentage || 0) / 100)).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Total */}
                                    <div className="flex justify-between items-center pt-2 pb-1 border-t">
                                      <span className="font-semibold text-blue-800">Total Final</span>
                                      <span className="font-bold text-lg text-blue-800">
                                        ${((templateRoleAssignments.reduce((acc, assignment) => 
                                          acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0) + 
                                          (currentTemplate.platformCost || 0)) * 
                                          (1 + ((currentTemplate.deviationPercentage || 0) / 100))).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  <Card className="mb-6">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-blue-600" />
                        Información General
                      </CardTitle>
                      <CardDescription>
                        Datos básicos de la plantilla de reporte
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={templateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-slate-700">Nombre de la Plantilla</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  placeholder="Ej: Análisis de Sentimiento Mensual" 
                                  className="bg-white pl-10"
                                  {...field} 
                                />
                                <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={templateForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-slate-700">Descripción</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Breve descripción de la plantilla" 
                                className="resize-none bg-white min-h-24" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={templateForm.control}
                          name="complexity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-medium text-slate-700">Complejidad</FormLabel>
                              <Select 
                                value={field.value} 
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Selecciona la complejidad" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Baja</SelectItem>
                                  <SelectItem value="medium">Media</SelectItem>
                                  <SelectItem value="high">Alta</SelectItem>
                                  <SelectItem value="variable">Variable</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={templateForm.control}
                          name="pageRange"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-medium text-slate-700">Rango de Páginas</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    placeholder="Ej: 10-15" 
                                    className="bg-white pl-10"
                                    {...field} 
                                  />
                                  <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                </div>
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
                            <FormLabel className="font-medium text-slate-700">Características</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Lista de características o elementos principales" 
                                className="resize-none bg-white min-h-24"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Enumera las características principales separadas por comas o líneas nuevas.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                    
                  <Card className="mb-6">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center">
                        <BadgeDollarSign className="h-4 w-4 mr-2 text-blue-600" />
                        Configuración de Costos
                      </CardTitle>
                      <CardDescription>
                        Ajustes de costos adicionales para esta plantilla
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={templateForm.control}
                          name="platformCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-medium text-slate-700">Costo de Plataformas (USD)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    placeholder="0.00" 
                                    className="bg-white pl-10"
                                    {...field}
                                  />
                                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                </div>
                              </FormControl>
                              <FormDescription>
                                Costo adicional por uso de plataformas de análisis
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={templateForm.control}
                          name="deviationPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-medium text-slate-700">Porcentaje de Desvío (%)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type="number" 
                                    step="1" 
                                    min="0" 
                                    max="100"
                                    placeholder="0" 
                                    className="bg-white pl-10"
                                    {...field}
                                  />
                                  <BadgeDollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                </div>
                              </FormControl>
                              <FormDescription>
                                Porcentaje adicional para contingencias
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                      className="px-6 py-5 rounded-lg shadow-md transition-all hover:shadow-lg"
                      size="lg"
                    >
                      {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          <span>{isEditing ? "Actualizando..." : "Creando..."}</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          {isEditing ? (
                            <>
                              <Pencil className="mr-2 h-5 w-5" />
                              <span>Guardar Cambios</span>
                            </>
                          ) : (
                            <>
                              <PlusCircle className="mr-2 h-5 w-5" />
                              <span>Crear Plantilla</span>
                            </>
                          )}
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            
            {isEditing && currentTemplate && (
              <TabsContent value="roles" className="py-4">
                <div className="space-y-6">
                  {/* Tarjetas de resumen financiero */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                      <CardContent className="p-6">
                        <div className="space-y-2">
                          <div className="flex items-center text-blue-600">
                            <Users className="h-5 w-5 mr-2" />
                            <h3 className="text-sm font-medium">Costo de Personal</h3>
                          </div>
                          <div className="text-2xl font-bold text-blue-700">
                            ${templateRoleAssignmentsLoading ? (
                              <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
                            ) : templateRoleAssignments?.reduce(
                              (sum, assignment) => sum + (parseFloat(assignment.hours) * assignment.role.defaultRate),
                              0
                            ).toFixed(2)} USD
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-emerald-100">
                      <CardContent className="p-6">
                        <div className="space-y-2">
                          <div className="flex items-center text-emerald-600">
                            <LayoutGrid className="h-5 w-5 mr-2" />
                            <h3 className="text-sm font-medium">Subtotal (con plataformas)</h3>
                          </div>
                          <div className="text-2xl font-bold text-emerald-700">
                            ${templateRoleAssignmentsLoading ? (
                              <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
                            ) : (templateRoleAssignments?.reduce(
                              (sum, assignment) => sum + (parseFloat(assignment.hours) * assignment.role.defaultRate),
                              0
                            ) + (currentTemplate.platformCost || 0)).toFixed(2)} USD
                          </div>
                          {(currentTemplate.platformCost || 0) > 0 && (
                            <div className="text-xs text-emerald-600">
                              <span className="font-medium">Incluye:</span> ${(currentTemplate.platformCost || 0).toFixed(2)} USD de plataformas
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border-purple-100">
                      <CardContent className="p-6">
                        <div className="space-y-2">
                          <div className="flex items-center text-purple-600">
                            <BadgeDollarSign className="h-5 w-5 mr-2" />
                            <h3 className="text-sm font-medium">Costo Total Final</h3>
                          </div>
                          <div className="text-2xl font-bold text-purple-700">
                            ${templateRoleAssignmentsLoading ? (
                              <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
                            ) : ((templateRoleAssignments?.reduce(
                              (sum, assignment) => sum + (parseFloat(assignment.hours) * assignment.role.defaultRate),
                              0
                            ) + (currentTemplate.platformCost || 0)) * 
                              (1 + ((currentTemplate.deviationPercentage || 0) / 100))).toFixed(2)} USD
                          </div>
                          {(currentTemplate.deviationPercentage || 0) > 0 && (
                            <div className="text-xs text-fuchsia-600">
                              Incluye {currentTemplate.deviationPercentage}% de desvío
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Header con título y ordenamiento */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Roles Asignados</h3>
                      <p className="text-sm text-muted-foreground">
                        Configura el equipo de trabajo para esta plantilla
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-md">
                      <span className="text-xs font-medium text-slate-600 px-2">Ordenar por:</span>
                      <Select
                        defaultValue="horas"
                        onValueChange={(value) => {
                          const sortedData = [...(templateRoleAssignments || [])];
                          
                          if (value === "horas") {
                            sortedData.sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours));
                          } else if (value === "costo") {
                            sortedData.sort((a, b) => 
                              (parseFloat(b.hours) * b.role.defaultRate) - 
                              (parseFloat(a.hours) * a.role.defaultRate)
                            );
                          } else if (value === "rol") {
                            sortedData.sort((a, b) => 
                              a.role.name.localeCompare(b.role.name)
                            );
                          }
                          
                          queryClient.setQueryData<(TemplateRoleAssignment & { role: Role })[]>(
                            [`/api/template-roles/${currentTemplate.id}/with-roles`],
                            sortedData
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 w-28 bg-white">
                          <SelectValue placeholder="Ordenar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="horas">Horas</SelectItem>
                          <SelectItem value="costo">Costo</SelectItem>
                          <SelectItem value="rol">Rol</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Lista de roles agrupados */}
                  {templateRoleAssignmentsLoading ? (
                    <Card>
                      <CardContent className="flex justify-center py-8">
                        <Loader variant="gradient" size="sm" text="Cargando roles..." />
                      </CardContent>
                    </Card>
                  ) : !templateRoleAssignments || templateRoleAssignments.length === 0 ? (
                    <Card className="border-dashed bg-slate-50">
                      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                        <Users2 className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium mb-1">Sin roles asignados</h3>
                        <p className="text-sm text-slate-500 max-w-sm mb-4">
                          Esta plantilla no tiene roles asignados. Añade roles para estimar el costo del proyecto.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {(() => {
                        // Crear grupos de roles
                        const roleGroups: Record<string, (TemplateRoleAssignment & { role: Role })[]> = {};
                        
                        templateRoleAssignments.forEach(assignment => {
                          const roleName = assignment.role.name;
                          if (!roleGroups[roleName]) {
                            roleGroups[roleName] = [];
                          }
                          roleGroups[roleName].push(assignment);
                        });
                        
                        return Object.entries(roleGroups).map(([roleName, assignments]) => (
                          <Card key={roleName} className="overflow-hidden">
                            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
                              <CardTitle className="text-base font-medium flex items-center">
                                <span>{roleName}</span>
                                {assignments.length > 1 && (
                                  <Badge variant="outline" className="ml-2">
                                    {assignments.length}
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                            
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-1/3">Horas</TableHead>
                                  <TableHead className="w-1/3">Tarifa</TableHead>
                                  <TableHead className="w-1/3">Costo</TableHead>
                                  <TableHead className="w-0 text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {assignments.map(assignment => (
                                  <TableRow key={assignment.id}>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center">
                                        <Clock className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                        {assignment.hours} hrs
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center">
                                        <DollarSign className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                        ${assignment.role.defaultRate.toFixed(2)}/hr
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center">
                                        <Calculator className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                        ${(parseFloat(assignment.hours) * assignment.role.defaultRate).toFixed(2)}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => {
                                          if (window.confirm(`¿Estás seguro de que deseas eliminar el rol ${assignment.role.name} de esta plantilla?`)) {
                                            deleteTemplateRoleAssignmentMutation.mutate(assignment.id);
                                          }
                                        }}
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                
                                {assignments.length > 1 && (
                                  <TableRow className="bg-slate-50/50">
                                    <TableCell colSpan={2} className="text-right font-medium">
                                      Subtotal:
                                    </TableCell>
                                    <TableCell colSpan={2} className="font-semibold">
                                      ${assignments.reduce((total, a) => 
                                        total + (parseFloat(a.hours) * a.role.defaultRate), 0).toFixed(2)} USD
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </Card>
                        ));
                      })()}
                    </div>
                  )}
                  
                  {/* Agregar Rol - UI mejorada */}
                  <Card className="mt-6">
                    <CardHeader className="py-3 px-4 border-b">
                      <CardTitle className="text-base font-medium flex items-center">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Agregar Nuevo Rol
                      </CardTitle>
                      <CardDescription>
                        Configura un nuevo rol para esta plantilla de reporte
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="py-4">
                      <Form {...templateRoleForm}>
                        <form onSubmit={templateRoleForm.handleSubmit(onTemplateRoleSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={templateRoleForm.control}
                              name="roleId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Rol</FormLabel>
                                  <Select 
                                    value={field.value.toString()} 
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Selecciona un rol" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {roles?.map(role => (
                                        <SelectItem key={role.id} value={role.id.toString()}>
                                          {role.name} (${role.defaultRate.toFixed(2)}/hr)
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
                                  <FormLabel className="text-sm font-medium">Horas Estándar</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        type="number" 
                                        min="0" 
                                        step="1" 
                                        placeholder="0" 
                                        className="pl-8 h-10"
                                        {...field} 
                                      />
                                      <Clock className="absolute left-2.5 top-3 h-4 w-4 text-slate-400" />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {templateRoleForm.watch("roleId") > 0 && templateRoleForm.watch("hours") > 0 && roles && currentTemplate && (
                            <Card className="border-dotted border-blue-200 bg-blue-50">
                              <CardContent className="py-3 px-4">
                                <div className="flex items-center text-sm mb-2">
                                  <Info className="h-4 w-4 mr-2 text-blue-500" />
                                  <span className="font-medium text-blue-700">Vista previa de costos</span>
                                </div>
                                
                                <div className="flex justify-between items-center mt-2">
                                  <div className="text-sm text-slate-600 flex items-center">
                                    <Users className="h-3.5 w-3.5 mr-2" />
                                    {roles.find(r => r.id === templateRoleForm.watch("roleId"))?.name || "Rol seleccionado"} 
                                    <span className="mx-1">×</span> 
                                    {templateRoleForm.watch("hours")} horas
                                  </div>
                                  <div className="font-medium">
                                    <span className="text-lg">
                                      ${((roles.find(r => r.id === templateRoleForm.watch("roleId"))?.defaultRate || 0) * 
                                        templateRoleForm.watch("hours")).toFixed(2)}
                                    </span>
                                    <span className="text-sm text-slate-500 ml-1">USD</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          
                          <div className="flex justify-end pt-2">
                            <Button 
                              type="submit" 
                              className="gap-2"
                              disabled={createTemplateRoleAssignmentMutation.isPending}
                            >
                              {createTemplateRoleAssignmentMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Agregando...</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4" />
                                  <span>Agregar Rol</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Template Role Assignment Dialog */}
      <Dialog open={assignRolesDialogOpen} onOpenChange={setAssignRolesDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Roles y Horas para {currentTemplate?.name}</DialogTitle>
            <DialogDescription>
              Configura los roles estándar y cantidad de horas para esta plantilla de reporte.
              Estos roles serán recomendados automáticamente al crear una nueva cotización 
              con esta plantilla.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h3 className="text-sm font-medium mb-2">Roles Agregados Actualmente</h3>
            
            {templateRoleAssignmentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader variant="gradient" size="sm" text="Cargando roles agregados" />
              </div>
            ) : !templateRoleAssignments || templateRoleAssignments.length === 0 ? (
              <div className="text-center py-3 text-sm text-neutral-500 border rounded-md">
                No hay roles agregados a esta plantilla.
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-end mb-2 space-x-2">
                  <span className="text-xs text-slate-500">Ordenar por:</span>
                  <Select
                    defaultValue="horas"
                    onValueChange={(value) => {
                      const sortedData = [...(templateRoleAssignments || [])];
                      
                      if (value === "horas") {
                        sortedData.sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours));
                      } else if (value === "costo") {
                        sortedData.sort((a, b) => 
                          (parseFloat(b.hours) * b.role.defaultRate) - 
                          (parseFloat(a.hours) * a.role.defaultRate)
                        );
                      } else if (value === "rol") {
                        sortedData.sort((a, b) => 
                          a.role.name.localeCompare(b.role.name)
                        );
                      }
                      
                      queryClient.setQueryData<(TemplateRoleAssignment & { role: Role })[]>(
                        [`/api/template-roles/${currentTemplate?.id}/with-roles`],
                        sortedData
                      );
                    }}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue placeholder="Ordenar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="costo">Costo</SelectItem>
                      <SelectItem value="rol">Rol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rol</TableHead>
                        <TableHead>Horas Estándar</TableHead>
                        <TableHead>Tarifa por Hora</TableHead>
                        <TableHead>Costo Estándar</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templateRoleAssignments.map(assignment => (
                          <TableRow key={assignment.id}>
                            <TableCell className="py-2">{assignment.role.name}</TableCell>
                            <TableCell className="py-2">{assignment.hours} hrs</TableCell>
                            <TableCell className="py-2">${assignment.role.defaultRate.toFixed(2)}</TableCell>
                            <TableCell className="py-2 font-medium">
                              ${(parseFloat(assignment.hours) * assignment.role.defaultRate).toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => deleteTemplateRoleAssignmentMutation.mutate(assignment.id)}
                              >
                                <Trash className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Cálculo del costo total */}
                <div className="mt-3 border-t pt-3 space-y-2">
                  {/* Mostrar costos de personal */}
                  <div className="flex justify-between items-center">
                    <div className="text-sm">Costo de Personal:</div>
                    <div className="text-base">
                      ${templateRoleAssignments.reduce((acc, assignment) => 
                        acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0).toFixed(2)} USD
                    </div>
                  </div>
                  
                  {/* Mostrar costo de plataformas */}
                  {currentTemplate && currentTemplate.platformCost && currentTemplate.platformCost > 0 && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm">Costo de Plataformas:</div>
                      <div className="text-base">${currentTemplate.platformCost.toFixed(2)} USD</div>
                    </div>
                  )}
                  
                  {/* Subtotal antes de desvío */}
                  <div className="flex justify-between items-center text-slate-700">
                    <div className="text-sm font-medium">Subtotal:</div>
                    <div className="text-base font-medium">
                      ${(templateRoleAssignments.reduce((acc, assignment) => 
                        acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0) + 
                        (currentTemplate?.platformCost || 0)).toFixed(2)} USD
                    </div>
                  </div>
                  
                  {/* Mostrar desvío si es mayor que cero */}
                  {currentTemplate && currentTemplate.deviationPercentage && currentTemplate.deviationPercentage > 0 && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm">Desvío ({currentTemplate.deviationPercentage}%):</div>
                      <div className="text-base">
                        ${((templateRoleAssignments.reduce((acc, assignment) => 
                          acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0) + 
                          (currentTemplate?.platformCost || 0)) * 
                          (currentTemplate.deviationPercentage / 100)).toFixed(2)} USD
                      </div>
                    </div>
                  )}
                  
                  {/* Total final */}
                  <div className="flex justify-between items-center pt-1 border-t font-medium">
                    <div className="font-medium">Costo Total Estándar:</div>
                    <div className="text-lg font-bold">
                      ${((templateRoleAssignments.reduce((acc, assignment) => 
                        acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0) + 
                        (currentTemplate?.platformCost || 0)) * 
                        (1 + ((currentTemplate?.deviationPercentage || 0) / 100))).toFixed(2)} USD
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">Agregar Nuevo Rol</h3>
              
              <Form {...templateRoleForm}>
                <form onSubmit={templateRoleForm.handleSubmit(onTemplateRoleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={templateRoleForm.control}
                      name="roleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rol</FormLabel>
                          <Select 
                            value={field.value.toString()} 
                            onValueChange={(value) => field.onChange(parseInt(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un rol" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {roles?.map(role => (
                                <SelectItem key={role.id} value={role.id.toString()}>
                                  {role.name} (${role.defaultRate.toFixed(2)}/hr)
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
                          <FormLabel>Horas Estándar</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              step="1" 
                              placeholder="0" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {templateRoleForm.watch("roleId") > 0 && templateRoleForm.watch("hours") > 0 && roles && currentTemplate && (
                    <div className="p-3 border rounded-md bg-slate-50">
                      <div className="text-sm font-medium mb-2">Vista previa de costos:</div>
                      
                      {/* Costo del rol a agregar */}
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-sm text-slate-600">
                          {roles.find(r => r.id === templateRoleForm.watch("roleId"))?.name || "Rol seleccionado"} 
                          &times; {templateRoleForm.watch("hours")} horas
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-base">
                            ${((roles.find(r => r.id === templateRoleForm.watch("roleId"))?.defaultRate || 0) * 
                              templateRoleForm.watch("hours")).toFixed(2)}
                          </span>
                          <span className="text-sm text-slate-600 ml-1">USD</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      type="button" 
                      onClick={() => setAssignRolesDialogOpen(false)}
                    >
                      Cerrar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTemplateRoleAssignmentMutation.isPending}
                    >
                      {createTemplateRoleAssignmentMutation.isPending ? (
                        <>
                          <Loader size="sm" variant="dots" className="mr-2" />
                          Agregando...
                        </>
                      ) : (
                        <>Agregar Rol</>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
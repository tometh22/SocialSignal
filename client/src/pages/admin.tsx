import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Role, InsertRole, 
  Personnel, InsertPersonnel, 
  ReportTemplate, InsertReportTemplate,
  TemplateRoleAssignment, InsertTemplateRoleAssignment
} from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlusCircle, Edit, UserCog, FileText, Settings, Users2, Pencil, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { InlineEditPersonnel } from "@/components/admin/inline-edit-personnel";
import { InlineEditRole } from "@/components/admin/inline-edit-role";
import { InlineEditTemplate } from "@/components/admin/inline-edit-template";

// Role form schema
const roleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  defaultRate: z.coerce.number().min(1, "Default rate must be at least 1")
});

type RoleFormValues = z.infer<typeof roleSchema>;

// Personnel form schema
const personnelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleId: z.coerce.number().min(1, "Role is required"),
  hourlyRate: z.coerce.number().min(1, "Hourly rate must be at least 1")
});

type PersonnelFormValues = z.infer<typeof personnelSchema>;

// Template form schema
const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  complexity: z.string().min(1, "Complexity is required"),
  pageRange: z.string().optional(),
  features: z.string().optional()
});

type TemplateFormValues = z.infer<typeof templateSchema>;

// Template role assignment schema
const templateRoleSchema = z.object({
  roleId: z.coerce.number().min(1, "Rol es requerido"),
  hours: z.coerce.number().min(0, "Horas deben ser 0 o más")
});

type TemplateRoleFormValues = z.infer<typeof templateRoleSchema>;

export default function Admin() {
  const [activeTab, setActiveTab] = useState("roles");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [assignRolesDialogOpen, setAssignRolesDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [currentPersonnel, setCurrentPersonnel] = useState<Personnel | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<ReportTemplate | null>(null);
  const { toast } = useToast();

  // Queries
  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: personnel, isLoading: personnelLoading } = useQuery<Personnel[]>({
    queryKey: ["/api/personnel"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });
  
  // Solo se usa cuando se abre el diálogo de asignación de roles
  const { data: templateRoleAssignments, isLoading: templateRoleAssignmentsLoading } = useQuery<(TemplateRoleAssignment & { role: Role })[]>({
    queryKey: [
      currentTemplate ? `/api/template-roles/${currentTemplate.id}/with-roles` : null,
    ],
    enabled: !!currentTemplate && assignRolesDialogOpen,
  });

  // Role form
  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      defaultRate: 0
    }
  });

  // Personnel form
  const personnelForm = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: {
      name: "",
      roleId: 0,
      hourlyRate: 0
    }
  });

  // Template form
  const templateForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      complexity: "",
      pageRange: "",
      features: ""
    }
  });

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: (role: InsertRole) => apiRequest("POST", "/api/roles", role),
    onSuccess: (response) => {
      // Optimistic update for instant UI feedback
      response.json().then(newRole => {
        queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
          if (!oldData) return [newRole];
          return [...oldData, newRole];
        });
        
        toast({
          title: "Éxito",
          description: "Rol creado correctamente.",
        });
        setRoleDialogOpen(false);
        roleForm.reset();
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
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertRole> }) => 
      apiRequest("PATCH", `/api/roles/${id}`, data),
    onSuccess: (response, variables) => {
      // Optimistic update for instant UI feedback
      response.json().then(updatedRole => {
        queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
          if (!oldData) return [updatedRole];
          return oldData.map(item => item.id === variables.id ? updatedRole : item);
        });
        
        toast({
          title: "Éxito",
          description: "Rol actualizado correctamente.",
        });
        setRoleDialogOpen(false);
        roleForm.reset();
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
      // Realizar la solicitud y devolver el resultado
      const response = await apiRequest("DELETE", `/api/roles/${id}`);
      
      // Verificar si la operación fue exitosa
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar el rol");
      }
      
      console.log(`Rol ${id} eliminado correctamente desde Admin`);
      return id;
    },
    onSuccess: (deletedId) => {
      console.log("Operación exitosa. ID del rol eliminado:", deletedId);
      
      // Actualizar la caché de forma inmediata
      queryClient.setQueryData(["/api/roles"], (oldData: Role[] | undefined) => {
        if (!oldData) return [];
        console.log("Roles antes de filtrado:", oldData.map(r => `${r.id}:${r.name}`));
        const filtered = oldData.filter(item => item.id !== deletedId);
        console.log("Roles después de filtrado:", filtered.map(r => `${r.id}:${r.name}`));
        return filtered;
      });
      
      toast({
        title: "Éxito",
        description: "Rol eliminado correctamente.",
      });
      
      // Forzar la recarga de datos del servidor
      setTimeout(() => {
        console.log("Invalidando consultas después de eliminar rol");
        queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      }, 300);
    },
    onError: (error) => {
      console.error("Error eliminando rol:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el rol. Puede que tenga personal asignado.",
        variant: "destructive",
      });
    },
  });

  const createPersonnelMutation = useMutation({
    mutationFn: (personnel: InsertPersonnel) => apiRequest("POST", "/api/personnel", personnel),
    onSuccess: (response) => {
      // Optimistic update for instant UI feedback
      response.json().then(newPersonnel => {
        queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
          if (!oldData) return [newPersonnel];
          return [...oldData, newPersonnel];
        });
        
        toast({
          title: "Éxito",
          description: "Miembro del equipo añadido correctamente.",
        });
        setPersonnelDialogOpen(false);
        personnelForm.reset();
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo añadir el miembro del equipo.",
        variant: "destructive",
      });
    },
  });

  const updatePersonnelMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPersonnel> }) => 
      apiRequest("PATCH", `/api/personnel/${id}`, data),
    onSuccess: (response, variables) => {
      // Optimistic update for instant UI feedback
      response.json().then(updatedPersonnel => {
        queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
          if (!oldData) return [updatedPersonnel];
          return oldData.map(item => item.id === variables.id ? updatedPersonnel : item);
        });
        
        toast({
          title: "Éxito",
          description: "Miembro del equipo actualizado correctamente.",
        });
        setPersonnelDialogOpen(false);
        personnelForm.reset();
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/personnel/${id}`),
    onSuccess: (_, variables) => {
      // Optimistic update - remove personnel instantly from UI
      queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(item => item.id !== variables);
      });
      
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

  const createTemplateMutation = useMutation({
    mutationFn: async (template: InsertReportTemplate) => {
      const response = await apiRequest("POST", "/api/templates", template);
      if (!response.ok) {
        throw new Error("Failed to create template");
      }
      return response.json();
    },
    onMutate: async (newTemplateData) => {
      // Cancelar consultas en curso
      await queryClient.cancelQueries({ queryKey: ["/api/templates"] });
      
      // Guardar el estado anterior
      const previousTemplates = queryClient.getQueryData<ReportTemplate[]>(["/api/templates"]);
      
      // Crear un ID temporal para la optimización de UI (será reemplazado al recibir la respuesta real)
      const tempId = Date.now();
      const optimisticTemplate: ReportTemplate = {
        id: tempId,
        name: newTemplateData.name,
        description: newTemplateData.description || null,
        complexity: newTemplateData.complexity,
        pageRange: newTemplateData.pageRange || null,
        features: newTemplateData.features || null,
      };
      
      // Actualizar la caché con el nuevo template optimista
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], (old) => 
        old ? [...old, optimisticTemplate] : [optimisticTemplate]
      );
      
      return { previousTemplates, tempId };
    },
    onSuccess: (data, variables, context) => {
      // Actualizar la caché con el template real (reemplazando el temporal)
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], (old) => {
        if (!old) return [data];
        
        // Filtrar el template temporal y añadir el real
        return old
          .filter(template => template.id !== context?.tempId)
          .concat(data);
      });
      
      toast({
        title: "Éxito",
        description: "Plantilla de reporte creada correctamente.",
      });
      
      setTemplateDialogOpen(false);
      templateForm.reset();
    },
    onError: (err, newTemplate, context) => {
      console.error("Error al crear plantilla:", err);
      
      // Revertir al estado anterior en caso de error
      if (context?.previousTemplates) {
        queryClient.setQueryData(["/api/templates"], context.previousTemplates);
      }
      
      toast({
        title: "Error",
        description: "No se pudo crear la plantilla de reporte.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refrescar datos del servidor independientemente del resultado
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertReportTemplate> }) => {
      const response = await apiRequest("PATCH", `/api/templates/${id}`, data);
      if (!response.ok) {
        throw new Error("Failed to update template");
      }
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancelar consultas en curso
      await queryClient.cancelQueries({ queryKey: ["/api/templates"] });
      
      // Guardar el estado anterior
      const previousTemplates = queryClient.getQueryData<ReportTemplate[]>(["/api/templates"]);
      
      // Actualizar la caché con el template actualizado optimistamente
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], (old) => {
        if (!old) return [];
        
        return old.map(template => 
          template.id === id 
            ? { ...template, ...data } 
            : template
        );
      });
      
      return { previousTemplates };
    },
    onSuccess: (updatedTemplate) => {
      // La caché ya está actualizada optimistamente, pero podemos asegurarnos
      // de que los datos son correctos al actualizar con el resultado de la API
      queryClient.setQueryData<ReportTemplate[]>(["/api/templates"], (old) => {
        if (!old) return [updatedTemplate];
        
        return old.map(template => 
          template.id === updatedTemplate.id 
            ? updatedTemplate
            : template
        );
      });
      
      toast({
        title: "Éxito",
        description: "Plantilla de reporte actualizada correctamente.",
      });
      
      setTemplateDialogOpen(false);
      templateForm.reset();
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
      return response.json();
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
      // Refrescar datos del servidor por si acaso
      if (currentTemplate) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/template-roles/${currentTemplate.id}/with-roles`] 
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
      // Refrescar datos del servidor por si acaso
      if (currentTemplate) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/template-roles/${currentTemplate.id}/with-roles`] 
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

  const openNewPersonnelDialog = () => {
    personnelForm.reset({
      name: "",
      roleId: roles && roles.length > 0 ? roles[0].id : 0,
      hourlyRate: roles && roles.length > 0 ? roles[0].defaultRate : 0
    });
    setCurrentPersonnel(null);
    setIsEditing(false);
    setPersonnelDialogOpen(true);
  };

  const openEditPersonnelDialog = (person: Personnel) => {
    personnelForm.reset({
      name: person.name,
      roleId: person.roleId,
      hourlyRate: person.hourlyRate
    });
    setCurrentPersonnel(person);
    setIsEditing(true);
    setPersonnelDialogOpen(true);
  };

  const openNewTemplateDialog = () => {
    templateForm.reset({
      name: "",
      description: "",
      complexity: "low",
      pageRange: "",
      features: ""
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
      features: template.features || ""
    });
    setCurrentTemplate(template);
    setIsEditing(true);
    setTemplateDialogOpen(true);
  };
  
  // Template role assignment form
  const templateRoleForm = useForm<TemplateRoleFormValues>({
    resolver: zodResolver(templateRoleSchema),
    defaultValues: {
      roleId: 0,
      hours: 0
    }
  });
  
  const openAssignRolesDialog = (template: ReportTemplate) => {
    templateRoleForm.reset({
      roleId: roles && roles.length > 0 ? roles[0].id : 0,
      hours: 0
    });
    setCurrentTemplate(template);
    setAssignRolesDialogOpen(true);
    
    // Obtener las asignaciones de roles existentes para esta plantilla
    if (template) {
      queryClient.prefetchQuery({
        queryKey: [`/api/template-roles/${template.id}/with-roles`],
      });
    }
  };

  // Handle form submissions
  const onRoleSubmit = (values: RoleFormValues) => {
    if (isEditing && currentRole) {
      updateRoleMutation.mutate({ id: currentRole.id, data: values });
    } else {
      createRoleMutation.mutate(values);
    }
  };

  const onPersonnelSubmit = (values: PersonnelFormValues) => {
    if (isEditing && currentPersonnel) {
      updatePersonnelMutation.mutate({ id: currentPersonnel.id, data: values });
    } else {
      createPersonnelMutation.mutate(values);
    }
  };

  const onTemplateSubmit = (values: TemplateFormValues) => {
    if (isEditing && currentTemplate) {
      updateTemplateMutation.mutate({ id: currentTemplate.id, data: values });
    } else {
      createTemplateMutation.mutate(values);
    }
  };
  
  // Manejar añadir asignación de rol a plantilla
  const onTemplateRoleSubmit = (values: TemplateRoleFormValues) => {
    if (!currentTemplate) return;
    
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
                            <TableCell className="py-3 text-right">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openAssignRolesDialog(template)}
                                >
                                  <Users2 className="h-4 w-4 mr-1" />
                                  Roles
                                </Button>
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
                : "Añade un nuevo rol con tarifa por hora predeterminada."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...roleForm}>
            <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-4 py-2">
              <FormField
                control={roleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Rol</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa el nombre del rol" {...field} />
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
                        placeholder="Ingresa la descripción del rol" 
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
                    <FormLabel>Tarifa Predeterminada por Hora ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setRoleDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                >
                  {isEditing ? "Actualizar Rol" : "Añadir Rol"}
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
            <form onSubmit={personnelForm.handleSubmit(onPersonnelSubmit)} className="space-y-4 py-2">
              <FormField
                control={personnelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa el nombre" {...field} />
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
                      onValueChange={(value) => {
                        field.onChange(parseInt(value));
                        // Set default hourly rate based on role if creating new personnel
                        if (!isEditing && roles) {
                          const selectedRole = roles.find(r => r.id === parseInt(value));
                          if (selectedRole) {
                            personnelForm.setValue("hourlyRate", selectedRole.defaultRate);
                          }
                        }
                      }}
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa por Hora ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setPersonnelDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPersonnelMutation.isPending || updatePersonnelMutation.isPending}
                >
                  {isEditing ? "Actualizar Miembro" : "Añadir Miembro"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Plantilla" : "Añadir Plantilla de Reporte"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza los detalles de la plantilla de reporte a continuación."
                : "Crea una nueva plantilla de reporte para cotizaciones."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4 py-2">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Plantilla</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa el nombre de la plantilla" {...field} />
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
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Ingresa la descripción de la plantilla" 
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
                name="complexity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complejidad</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                    <FormLabel>Rango de Páginas</FormLabel>
                    <FormControl>
                      <Input placeholder="ej., 5-10 páginas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={templateForm.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Características</FormLabel>
                    <FormControl>
                      <Input placeholder="ej., Solo métricas básicas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setTemplateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                >
                  {isEditing ? "Actualizar Plantilla" : "Añadir Plantilla"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Template Role Assignment Dialog */}
      <Dialog open={assignRolesDialogOpen} onOpenChange={setAssignRolesDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
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
                
                {/* Cálculo del costo total */}
                <div className="mt-3 border-t pt-3 flex justify-between items-center">
                  <div className="font-medium">Costo Total Estándar:</div>
                  <div className="text-lg font-bold">
                    ${templateRoleAssignments.reduce((acc, assignment) => 
                      acc + (parseFloat(assignment.hours) * assignment.role.defaultRate), 0).toFixed(2)} USD
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
                  
                  {templateRoleForm.watch("roleId") > 0 && templateRoleForm.watch("hours") > 0 && roles && (
                    <div className="p-3 border rounded-md bg-slate-50">
                      <div className="text-sm font-medium">Vista previa de costo:</div>
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

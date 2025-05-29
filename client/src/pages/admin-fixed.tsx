import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { 
  Briefcase, 
  DollarSign, 
  Edit2, 
  FileText, 
  Hash, 
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

  return (
    <div className="page-container">
      {/* Breadcrumbs unificados */}
      <div className="breadcrumb-nav">
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

      <div className="standard-card">
        <div className="card-content">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="roles" className="flex items-center">
                <UserCog className="mr-2 h-4 w-4" />
                Roles
              </TabsTrigger>
              <TabsTrigger value="personnel" className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Plantillas
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="roles">
              <Card className="standard-card mt-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="heading-card">Roles del Sistema</CardTitle>
                      <CardDescription>Gestiona los roles disponibles para las cotizaciones</CardDescription>
                    </div>
                    <Button className="gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Añadir Nuevo Rol
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="card-content">
                  <div className="text-center py-8 text-muted">
                    Funcionalidad en desarrollo
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="personnel">
              <Card className="standard-card mt-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="heading-card">Personal</CardTitle>
                      <CardDescription>Gestiona el personal disponible para las cotizaciones</CardDescription>
                    </div>
                    <Button className="gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Añadir Personal
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="card-content">
                  <div className="text-center py-8 text-muted">
                    Funcionalidad en desarrollo
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates">
              <Card className="standard-card mt-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="heading-card">Plantillas</CardTitle>
                      <CardDescription>Gestiona las plantillas de reportes</CardDescription>
                    </div>
                    <Button className="gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Añadir Plantilla
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="card-content">
                  <div className="text-center py-8 text-muted">
                    Funcionalidad en desarrollo
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
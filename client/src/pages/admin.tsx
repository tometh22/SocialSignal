import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Role, InsertRole, 
  Personnel, InsertPersonnel, 
  ReportTemplate, InsertReportTemplate 
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
import { PlusCircle, Edit, UserCog, FileText, Settings } from "lucide-react";
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

export default function Admin() {
  const [activeTab, setActiveTab] = useState("roles");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Success",
        description: "Role has been created successfully.",
      });
      setRoleDialogOpen(false);
      roleForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create role.",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertRole> }) => 
      apiRequest("PATCH", `/api/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Success",
        description: "Role has been updated successfully.",
      });
      setRoleDialogOpen(false);
      roleForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update role.",
        variant: "destructive",
      });
    },
  });

  const createPersonnelMutation = useMutation({
    mutationFn: (personnel: InsertPersonnel) => apiRequest("POST", "/api/personnel", personnel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      toast({
        title: "Success",
        description: "Team member has been added successfully.",
      });
      setPersonnelDialogOpen(false);
      personnelForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add team member.",
        variant: "destructive",
      });
    },
  });

  const updatePersonnelMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPersonnel> }) => 
      apiRequest("PATCH", `/api/personnel/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      toast({
        title: "Success",
        description: "Team member has been updated successfully.",
      });
      setPersonnelDialogOpen(false);
      personnelForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update team member.",
        variant: "destructive",
      });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (template: InsertReportTemplate) => apiRequest("POST", "/api/templates", template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Success",
        description: "Report template has been created successfully.",
      });
      setTemplateDialogOpen(false);
      templateForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create report template.",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertReportTemplate> }) => 
      apiRequest("PATCH", `/api/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Success",
        description: "Report template has been updated successfully.",
      });
      setTemplateDialogOpen(false);
      templateForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update report template.",
        variant: "destructive",
      });
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

  // Find role name by ID
  const getRoleName = (roleId: number) => {
    if (!roles) return "Unknown";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Unknown";
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Administration Panel</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="roles" className="flex items-center">
                <UserCog className="mr-2 h-4 w-4" />
                Team Roles
              </TabsTrigger>
              <TabsTrigger value="personnel" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Personnel
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Report Templates
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="roles">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Team Roles</CardTitle>
                    <CardDescription>Manage roles and default hourly rates</CardDescription>
                  </div>
                  <Button onClick={openNewRoleDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add New Role
                  </Button>
                </CardHeader>
                <CardContent>
                  {rolesLoading ? (
                    <div className="text-center py-4">Loading roles...</div>
                  ) : roles && roles.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Default Rate</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roles.map(role => (
                          <InlineEditRole 
                            key={role.id} 
                            role={role} 
                          />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-neutral-500">
                      No roles found. Add your first role.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="personnel">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Personnel Management</CardTitle>
                    <CardDescription>Add and update team members and their rates</CardDescription>
                  </div>
                  <Button onClick={openNewPersonnelDialog} disabled={!roles || roles.length === 0}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Team Member
                  </Button>
                </CardHeader>
                <CardContent>
                  {personnelLoading || rolesLoading ? (
                    <div className="text-center py-4">Loading personnel...</div>
                  ) : !roles || roles.length === 0 ? (
                    <div className="text-center py-4 text-neutral-500">
                      Please add roles before adding personnel.
                    </div>
                  ) : personnel && personnel.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Hourly Rate</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {personnel.map(person => (
                          <InlineEditPersonnel 
                            key={person.id}
                            person={person}
                            roles={roles}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-neutral-500">
                      No personnel found. Add your first team member.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="templates">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Report Templates</CardTitle>
                    <CardDescription>Configure standard report templates</CardDescription>
                  </div>
                  <Button onClick={openNewTemplateDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Template
                  </Button>
                </CardHeader>
                <CardContent>
                  {templatesLoading ? (
                    <div className="text-center py-4">Loading templates...</div>
                  ) : templates && templates.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Complexity</TableHead>
                          <TableHead>Page Range</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map(template => (
                          <InlineEditTemplate 
                            key={template.id} 
                            template={template} 
                          />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-neutral-500">
                      No templates found. Add your first report template.
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
            <DialogTitle>{isEditing ? "Edit Role" : "Add New Role"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update the role details below."
                : "Add a new role with default hourly rate."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...roleForm}>
            <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-4 py-2">
              <FormField
                control={roleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter role name" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter role description" 
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
                    <FormLabel>Default Hourly Rate ($)</FormLabel>
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
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                >
                  {isEditing ? "Update Role" : "Add Role"}
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
            <DialogTitle>{isEditing ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update the team member details below."
                : "Add a new team member with their role and hourly rate."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...personnelForm}>
            <form onSubmit={personnelForm.handleSubmit(onPersonnelSubmit)} className="space-y-4 py-2">
              <FormField
                control={personnelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} />
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
                    <FormLabel>Role</FormLabel>
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
                          <SelectValue placeholder="Select a role" />
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
                    <FormLabel>Hourly Rate ($)</FormLabel>
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
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPersonnelMutation.isPending || updatePersonnelMutation.isPending}
                >
                  {isEditing ? "Update Team Member" : "Add Team Member"}
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
            <DialogTitle>{isEditing ? "Edit Template" : "Add Report Template"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update the report template details below."
                : "Create a new report template for quotations."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...templateForm}>
            <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4 py-2">
              <FormField
                control={templateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter template name" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter template description" 
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
                    <FormLabel>Complexity</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select complexity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
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
                    <FormLabel>Page Range</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 5-10 pages" {...field} />
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
                    <FormLabel>Features</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Core metrics only" {...field} />
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
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                >
                  {isEditing ? "Update Template" : "Add Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

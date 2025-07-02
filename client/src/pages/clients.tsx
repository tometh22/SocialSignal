import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Client, InsertClient } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, UserPlus, Users, Mail, Phone, Edit, Trash, BarChart, Upload, Image } from "lucide-react";

// Componente de imagen robusto para logos
const ClientLogo = ({ client }: { client: Client }) => {
  const [hasError, setHasError] = useState(false);
  
  if (!client.logoUrl || hasError) {
    return (
      <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-primary">
          {client.name.substring(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }
  
  return (
    <div className="h-8 w-8 rounded overflow-hidden flex-shrink-0 bg-white border border-gray-200">
      <img 
        src={client.logoUrl} 
        alt={`${client.name} logo`} 
        className="h-full w-full object-contain"
        onError={() => {
          console.error(`Failed to load logo for ${client.name}:`, client.logoUrl);
          setHasError(true);
        }}
        onLoad={() => {
          console.log(`Successfully loaded logo for ${client.name}`);
        }}
      />
    </div>
  );
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const clientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  logoUrl: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function Clients() {
  const { data: clients, isLoading, refetch } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    onSuccess: (data) => {
      // Log de diagnóstico para verificar URLs de logos
      console.log('Clients loaded:', data?.map(c => ({ 
        name: c.name, 
        logoUrl: c.logoUrl,
        hasLogo: !!c.logoUrl 
      })));
    }
  });
  
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      logoUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (client: InsertClient) => 
      apiRequest("/api/clients", "POST", client),
    onSuccess: async () => {
      // Invalidar la caché de consultas
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      // Forzar una actualización inmediata
      await refetch();
      toast({
        title: "Éxito",
        description: "El cliente ha sido creado correctamente.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el cliente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertClient> }) => {
      try {
        const response = await apiRequest(`/api/clients/${id}`, "PATCH", data);
        return response;
      } catch (error) {
        console.error("Error detallado:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      // Invalidar la caché de consultas
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      // Forzar una actualización inmediata
      await refetch();
      toast({
        title: "Éxito",
        description: "El cliente ha sido actualizado correctamente.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error en updateMutation:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el cliente.",
        variant: "destructive",
      });
    },
  });
  
  // Mutación para cargar el logo del cliente
  const uploadLogoMutation = useMutation({
    mutationFn: async ({ clientId, file }: { clientId: number; file: File }) => {
      setIsUploadingLogo(true);
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch(`/api/clients/${clientId}/logo`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar el logo');
      }
      
      return await response.json();
    },
    onSuccess: async (data) => {
      // Actualizar el formulario con la nueva URL del logo
      form.setValue('logoUrl', data.logoUrl);
      setLogoPreview(data.logoUrl);
      
      // Invalidar la caché de consultas para actualizar los datos
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      toast({
        title: "Éxito",
        description: "Logo cargado correctamente.",
      });
      setIsUploadingLogo(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cargar el logo.",
        variant: "destructive",
      });
      setIsUploadingLogo(false);
    },
  });

  // Filter clients based on search term
  const filteredClients = clients
    ? clients.filter((client) => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.contactName && client.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.contactEmail && client.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  const openNewClientDialog = () => {
    form.reset({
      name: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      logoUrl: "",
    });
    setCurrentClient(null);
    setIsEditing(false);
    setLogoPreview(null);
    setDialogOpen(true);
  };

  const openEditClientDialog = (client: Client) => {
    form.reset({
      name: client.name,
      contactName: client.contactName || "",
      contactEmail: client.contactEmail || "",
      contactPhone: client.contactPhone || "",
      logoUrl: client.logoUrl || "",
    });
    setCurrentClient(client);
    setIsEditing(true);
    setLogoPreview(client.logoUrl || null);
    setDialogOpen(true);
  };
  
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentClient) return;
    
    // Crear URL de objeto para vista previa local
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
    
    // Subir el archivo
    uploadLogoMutation.mutate({ 
      clientId: currentClient.id,
      file 
    });
    
    // Limpiar el campo de archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = (values: ClientFormValues) => {
    if (isEditing && currentClient) {
      // Si se ha cargado un logo nuevo, usamos la URL que ya está en el form
      // Esto asegura que no perdemos la URL del logo actualizada
      const dataToUpdate = {
        ...values,
        logoUrl: logoPreview || values.logoUrl // Usar logoPreview si existe, o mantener la URL actual
      };
      
      updateMutation.mutate({ id: currentClient.id, data: dataToUpdate });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumbs unificados */}
      <div className="breadcrumb-nav mb-6">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
          <span>Dashboard</span>
          <span>/</span>
          <span className="text-foreground font-medium">Clientes</span>
        </nav>
        
        <div className="flex-between">
          <div>
            <h1 className="heading-page">Clientes</h1>
          </div>
          <Button onClick={openNewClientDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Añadir Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Buscador separado */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
        <Input
          placeholder="Buscar clientes..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="standard-card">
        <CardContent className="card-content">

          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando clientes...</div>
          ) : filteredClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 text-label">Nombre del Cliente</th>
                    <th className="text-left py-3 text-label">Persona de Contacto</th>
                    <th className="text-left py-3 text-label">Email</th>
                    <th className="text-left py-3 text-label">Acciones</th>
                  </tr>
                </thead>
                      <tbody>
                        {filteredClients.map((client) => (
                          <tr key={client.id} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                              <div className="flex items-center gap-3">
                                <ClientLogo client={client} />
                                <span>{client.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{client.contactName || "-"}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{client.contactEmail || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" className="hover-lift" onClick={() => openEditClientDialog(client)}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="hover-lift bg-blue-600 hover:bg-blue-700"
                                  onClick={() => navigate(`/client-summary-compact/${client.id}`)}
                                >
                                  <BarChart className="h-4 w-4 mr-1" />
                                  Resumen
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
          ) : (
            <div className="text-center py-8 text-muted">
              {searchTerm
                ? "No hay clientes que coincidan con tu búsqueda."
                : "No se encontraron clientes. ¡Añade tu primer cliente!"}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-heading">{isEditing ? "Editar Cliente" : "Añadir Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza la información del cliente a continuación."
                : "Completa los detalles para añadir un nuevo cliente al sistema."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="form-layout py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="form-group">
                    <FormLabel className="text-label">Nombre del Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Introduce el nombre del cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem className="form-group">
                    <FormLabel className="text-label">Persona de Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Introduce el nombre de contacto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem className="form-group">
                    <FormLabel className="text-label">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Introduce el email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo de teléfono eliminado por solicitud del usuario */}
              
              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem className="form-group">
                    <FormLabel className="text-label">Logo del Cliente</FormLabel>
                    
                    {/* Si estamos editando, mostramos el uploader de archivo */}
                    {isEditing && currentClient && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="h-9 flex gap-1 items-center" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                          >
                            <Upload className="h-4 w-4" />
                            <span>{isUploadingLogo ? "Subiendo..." : "Subir logo"}</span>
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Formatos aceptados: JPEG, PNG, GIF, SVG, WEBP
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    )}
                    
                    {/* URL del logo (modo fallback o para ver la URL actual) */}
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/logo.png" 
                        {...field} 
                        className={isEditing ? "text-sm text-muted-foreground" : ""}
                        readOnly={isEditing} 
                      />
                    </FormControl>
                    <FormMessage />
                    
                    {/* Vista previa del logo */}
                    {(field.value || logoPreview) && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-16 w-16 rounded overflow-hidden border shadow-sm">
                          <img 
                            src={logoPreview || field.value} 
                            alt="Logo preview" 
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              // Manejo de error si la imagen no se puede cargar
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium">Vista previa</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isUploadingLogo ? "Subiendo logo..." : "Logo del cliente"}
                          </p>
                        </div>
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-4">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="hover-lift" disabled={createMutation.isPending || updateMutation.isPending}>
                  {isEditing ? "Actualizar Cliente" : "Añadir Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

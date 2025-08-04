import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Users, Mail, Phone, Edit, Trash, Upload, Image } from "lucide-react";
import { PageLayout } from "@/components/ui/page-layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useImageRefresh } from "@/contexts/ImageRefreshContext";
import type { Client, InsertClient } from "@shared/schema";

// Componente de imagen robusto para logos
const ClientLogo = ({ client }: { client: Client }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshTimestamp } = useImageRefresh();

  // Reset error and loading state when client changes or global refresh occurs
  React.useEffect(() => {
    console.log(`🖼️ ClientLogo ${client.name} - refreshTimestamp changed:`, refreshTimestamp);
    setHasError(false);
    setIsLoading(true);
  }, [client.logoUrl, client.id, refreshTimestamp]);

  if (!client.logoUrl || hasError) {
    return (
      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border-2 border-blue-200/50">
        <Users className="w-8 h-8 text-blue-600" />
      </div>
    );
  }

  // Usar timestamp global para forzar recarga
  const logoUrlWithCacheBuster = `${client.logoUrl}${client.logoUrl.includes('?') ? '&' : '?'}t=${refreshTimestamp}`;

  return (
    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200/50 bg-white">
      {isLoading && (
        <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
          <Image className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <img
        key={`${client.id}-${refreshTimestamp}`}
        src={logoUrlWithCacheBuster}
        alt={`${client.name} logo`}
        className={`w-full h-full object-contain transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
};

// Schema de validación para el formulario
const clientSchema = z.object({
  name: z.string().min(1, "El nombre del cliente es requerido"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  logoUrl: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClients, setDeletingClients] = useState<Set<number>>(new Set());
  const [deletedClients, setDeletedClients] = useState<Set<number>>(new Set());
  const [newClients, setNewClients] = useState<Client[]>([]);
  const { toast } = useToast();
  const { forceRefresh } = useImageRefresh();

  // Query para obtener clientes
  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ['/api/clients'],
  });

  // Mutación para crear cliente
  const createMutation = useMutation({
    mutationFn: (client: InsertClient) => 
      fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client),
      }).then(res => res.json()),
    onSuccess: (newClient: Client) => {
      // Agregar inmediatamente a la lista local
      setNewClients(prev => [...prev, newClient]);
      
      // Cerrar dialogo y limpiar formulario
      setDialogOpen(false);
      form.reset();
      
      // Forzar refresh de todas las imágenes
      forceRefresh();
      
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido creado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el cliente.",
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar cliente
  const updateMutation = useMutation({
    mutationFn: ({ id, client }: { id: number; client: Partial<InsertClient> }) =>
      fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client),
      }).then(res => res.json()),
    onSuccess: () => {
      // Invalidar múltiples queries para actualización inmediata
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      // Forzar refresh de todas las imágenes
      forceRefresh();
      setDialogOpen(false);
      form.reset();
      setIsEditing(false);
      setEditingClient(null);
      toast({
        title: "Cliente actualizado",
        description: "El cliente ha sido actualizado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el cliente.",
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar cliente
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/clients/${id}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete client');
      }
      
      return response.json();
    },
    onSuccess: (_, id) => {
      // Move client to permanently deleted list
      setDeletedClients(prev => new Set([...prev, id]));
      
      // Remove from deleting state
      setDeletingClients(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado exitosamente.",
      });
    },
    onError: (error: Error, id) => {
      // Remove from deleting state on error
      setDeletingClients(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      toast({
        title: "Error al eliminar cliente",
        description: error.message || "No se pudo eliminar el cliente. Puede que tenga proyectos o cotizaciones activos.",
        variant: "destructive",
      });
    },
  });

  // Mutación para subir logo
  const uploadLogoMutation = useMutation({
    mutationFn: async ({ clientId, file }: { clientId: number; file: File }) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch(`/api/clients/${clientId}/logo`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar múltiples queries para actualización inmediata
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      // Forzar refresh de todas las imágenes
      console.log('📸 Logo uploaded, forcing refresh...');
      forceRefresh();
      toast({
        title: "Logo subido",
        description: "El logo ha sido subido exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo subir el logo.",
        variant: "destructive",
      });
    },
  });

  // Configuración del formulario
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

  // Combinar clientes del servidor con los nuevos creados localmente
  const allClients = Array.isArray(clients) ? [...clients, ...newClients] : newClients;
  
  // Filtrar clientes según término de búsqueda y excluir los que se están eliminando
  const filteredClients = allClients.filter((client: Client) =>
    !deletingClients.has(client.id) && !deletedClients.has(client.id) && (
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.contactName && client.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.contactEmail && client.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const openNewClientDialog = () => {
    setIsEditing(false);
    setEditingClient(null);
    form.reset({
      name: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      logoUrl: "",
    });
    setDialogOpen(true);
  };

  const openEditClientDialog = (client: Client) => {
    setIsEditing(true);
    setEditingClient(client);
    form.reset({
      name: client.name,
      contactName: client.contactName || "",
      contactEmail: client.contactEmail || "",
      contactPhone: client.contactPhone || "",
      logoUrl: client.logoUrl || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: ClientFormValues) => {
    if (isEditing && editingClient) {
      updateMutation.mutate({ id: editingClient.id, client: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleLogoUpload = (clientId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadLogoMutation.mutate({ clientId, file });
    }
  };

  const handleDeleteClient = (client: Client) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el cliente ${client.name}?`)) {
      // Add to deleting state for animation
      setDeletingClients(prev => new Set([...prev, client.id]));
      
      // Wait for animation and then delete
      setTimeout(() => {
        deleteMutation.mutate(client.id);
      }, 300);
    }
  };

  if (error) {
    return (
      <PageLayout
        title="Clientes"
        description="Gestiona la información de tus clientes y accede a sus resúmenes"
        breadcrumbs={[{ label: "Clientes", current: true }]}
      >
        <div className="flex items-start justify-start h-64 p-6">
          <div className="text-left">
            <div className="text-red-500 mb-2">Error al cargar los clientes</div>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <>
      <PageLayout
        title="Clientes"
        description="Gestiona la información de tus clientes y accede a sus resúmenes"
        breadcrumbs={[{ label: "Clientes", current: true }]}
        actions={
          <Button onClick={openNewClientDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Añadir Nuevo Cliente
          </Button>
        }
      >
        {/* Buscador */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Buscar clientes..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista de clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes ({filteredClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 h-32 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map((client: Client) => (
                  <div 
                    key={client.id} 
                    className={`border rounded-lg p-4 hover:shadow-md transition-all duration-300 ${
                      deletingClients.has(client.id) ? 'opacity-0 scale-95 pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <ClientLogo client={client} />
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditClientDialog(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClient(client)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                        <div className="relative">
                          <input
                            type="file"
                            id={`logo-${client.id}`}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept="image/*"
                            onChange={(e) => handleLogoUpload(client.id, e)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={uploadLogoMutation.isPending}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2">{client.name}</h3>
                    
                    {client.contactName && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Contacto:</strong> {client.contactName}
                      </p>
                    )}
                    
                    {client.contactEmail && (
                      <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.contactEmail}
                      </p>
                    )}
                    
                    {client.contactPhone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.contactPhone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-gray-500">
                {searchTerm
                  ? "No hay clientes que coincidan con tu búsqueda."
                  : "No se encontraron clientes. ¡Añade tu primer cliente!"}
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>

      {/* Dialog para crear/editar cliente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Cliente" : "Añadir Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza la información del cliente a continuación."
                : "Completa los detalles para añadir un nuevo cliente al sistema."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Cliente *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la empresa o cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la persona de contacto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Contacto</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 8900" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://ejemplo.com/logo.png" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-4">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditing ? "Actualizar Cliente" : "Añadir Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Client, InsertClient } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, UserPlus, Users, Mail, Phone, Edit, Trash, BarChart } from "lucide-react";
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
  });
  
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
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
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertClient> }) => 
      apiRequest(`/api/clients/${id}`, "PATCH", data),
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
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el cliente.",
        variant: "destructive",
      });
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
    setDialogOpen(true);
  };

  const onSubmit = (values: ClientFormValues) => {
    if (isEditing && currentClient) {
      updateMutation.mutate({ id: currentClient.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-subheading text-neutral-900">Clientes</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="container-xl fade-in">
          <div className="section-sm">
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-heading">Gestión de Clientes</CardTitle>
                <Button className="hover-lift" onClick={openNewClientDialog}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Añadir Nuevo Cliente
                </Button>
              </CardHeader>
              <CardContent>
                <div className="relative mb-6 form-group">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      placeholder="Buscar clientes..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-8">Cargando clientes...</div>
                ) : filteredClients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Logo</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Nombre del Cliente</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Persona de Contacto</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Email</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Teléfono</th>
                          <th className="px-4 py-3 text-left text-label text-neutral-500">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map((client) => (
                          <tr key={client.id} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              {client.logoUrl ? (
                                <div className="h-8 w-8 rounded overflow-hidden">
                                  <img 
                                    src={client.logoUrl} 
                                    alt={`${client.name} logo`} 
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary">
                                    {client.name.substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-neutral-900">{client.name}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{client.contactName || "-"}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{client.contactEmail || "-"}</td>
                            <td className="px-4 py-3 text-sm text-neutral-700">{client.contactPhone || "-"}</td>
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
                                  onClick={() => navigate(`/client-summary/${client.id}`)}
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
                  <div className="text-center py-8 text-neutral-500">
                    {searchTerm
                      ? "No hay clientes que coincidan con tu búsqueda."
                      : "No se encontraron clientes. ¡Añade tu primer cliente!"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem className="form-group">
                    <FormLabel className="text-label">Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="Introduce el número de teléfono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem className="form-group">
                    <FormLabel className="text-label">URL del Logo</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/logo.png" {...field} />
                    </FormControl>
                    <FormMessage />
                    {field.value && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-8 w-8 rounded overflow-hidden border">
                          <img 
                            src={field.value} 
                            alt="Logo preview" 
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              // Manejo de error si la imagen no se puede cargar
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Vista previa</p>
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

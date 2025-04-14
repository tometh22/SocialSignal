import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Client, InsertClient } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, UserPlus, Users, Mail, Phone, Edit, Trash } from "lucide-react";
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
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function Clients() {
  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

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
    },
  });

  const createMutation = useMutation({
    mutationFn: (client: InsertClient) => 
      apiRequest("POST", "/api/clients", client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client has been created successfully.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertClient> }) => 
      apiRequest("PATCH", `/api/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client has been updated successfully.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client.",
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
        <h2 className="text-lg font-semibold text-neutral-900">Clients</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Client Management</CardTitle>
              <Button onClick={openNewClientDialog}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Client
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="Search clients..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {isLoading ? (
                <div className="text-center py-8">Loading clients...</div>
              ) : filteredClients.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Client Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Contact Person</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Phone</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => (
                        <tr key={client.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm text-neutral-900">{client.name}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{client.contactName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{client.contactEmail || "-"}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{client.contactPhone || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => openEditClientDialog(client)}>
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
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
                    ? "No clients match your search criteria."
                    : "No clients found. Add your first client!"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Client" : "Add New Client"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update the client information below."
                : "Fill in the details to add a new client to the system."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter client name" {...field} />
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
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact name" {...field} />
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" {...field} />
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {isEditing ? "Update Client" : "Add Client"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

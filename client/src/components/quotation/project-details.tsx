import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuoteContext } from "@/context/quote-context";
import { Client } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const clientSchema = z.object({
  name: z.string().min(1, "El nombre del cliente es obligatorio"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Dirección de correo inválida").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function ProjectDetails({ onNext }: { onNext: () => void }) {
  const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);
  const { toast } = useToast();
  const {
    projectDetails,
    updateProjectDetails,
    analyzeInputs,
    calculateBaseCost
  } = useQuoteContext();

  // Define interfaces for the option types
  interface Option {
    value: string;
    label: string;
  }

  // Get options and clients from API
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: analysisTypes } = useQuery<Option[]>({
    queryKey: ["/api/options/analysis-types"],
  });

  const { data: projectTypes } = useQuery<Option[]>({
    queryKey: ["/api/options/project-types"],
  });

  const { data: mentionsVolume } = useQuery<Option[]>({
    queryKey: ["/api/options/mentions-volume"],
  });

  const { data: countriesCovered } = useQuery<Option[]>({
    queryKey: ["/api/options/countries-covered"],
  });

  const { data: clientEngagement } = useQuery<Option[]>({
    queryKey: ["/api/options/client-engagement"],
  });

  // New client form
  const clientForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  // Create new client
  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      const response = await apiRequest("POST", "/api/clients", values);
      const newClient = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Éxito",
        description: "Cliente creado correctamente.",
      });
      
      // Update the selected client in the form
      updateProjectDetails({ clientId: newClient.id });
      
      setNewClientDialogOpen(false);
      clientForm.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el cliente.",
        variant: "destructive",
      });
    }
  };

  // Check if form is valid and fields are filled
  const validateForm = () => {
    if (
      !projectDetails.clientId ||
      !projectDetails.projectName ||
      !projectDetails.projectType ||
      !projectDetails.mentionsVolume ||
      !projectDetails.countriesCovered ||
      !projectDetails.clientEngagement
    ) {
      toast({
        title: "Información Incompleta",
        description: "Por favor, completa todos los campos requeridos.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Update calculations when inputs change
  useEffect(() => {
    if (
      projectDetails.mentionsVolume &&
      projectDetails.countriesCovered &&
      projectDetails.clientEngagement
    ) {
      // Default analysisType to 'basic' if it's not set
      if (!projectDetails.analysisType) {
        updateProjectDetails({ analysisType: "basic" });
      }
      analyzeInputs();
    }
  }, [
    projectDetails.mentionsVolume,
    projectDetails.countriesCovered,
    projectDetails.clientEngagement,
    projectDetails.analysisType,
    analyzeInputs,
    updateProjectDetails
  ]);

  // Handle continue button click
  const handleContinue = () => {
    if (validateForm()) {
      // First, calculate the base cost
      calculateBaseCost();
      // Then move to next step
      onNext();
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-neutral-900 mb-6">Detalles del Proyecto</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="client" className="block text-sm font-medium text-neutral-700 mb-1">Nombre del Cliente</Label>
            <div className="flex gap-2">
              <Select
                value={projectDetails.clientId ? projectDetails.clientId.toString() : ""}
                onValueChange={(value) => updateProjectDetails({ clientId: parseInt(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">
                    <span className="flex items-center">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Nuevo Cliente...
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setNewClientDialogOpen(true)}
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="project-name" className="block text-sm font-medium text-neutral-700 mb-1">Nombre del Proyecto</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="Ingresa el nombre del proyecto"
              value={projectDetails.projectName || ""}
              onChange={(e) => updateProjectDetails({ projectName: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="project-type" className="block text-sm font-medium text-neutral-700 mb-1">Tipo de Proyecto</Label>
            <p className="text-xs text-neutral-500 mb-2">Define el formato, enfoque y alcance del entregable final (determina estructura y tipo de informe)</p>
            <Select 
              value={projectDetails.projectType || ""}
              onValueChange={(value) => updateProjectDetails({ projectType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tipo de proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes?.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="relative group">
                    <div>
                      {type.label}
                      <div className="absolute left-full ml-2 top-0 hidden group-hover:block bg-white shadow-lg rounded-md p-2 z-50 w-64">
                        <p className="text-xs text-neutral-700 font-medium">
                          {type.value === "demo" && "Informe de demostración para ganar un cliente potencial. Formato conciso y visual."}
                          {type.value === "executive" && "Informe estándar, más conciso, diseñado para toma de decisiones rápidas a nivel ejecutivo."}
                          {type.value === "comprehensive" && "Informe integral con análisis de alta profundidad y recomendaciones detalladas."}
                          {type.value === "always-on" && "Servicio recurrente facturado mensualmente. Incluye dashboard y reportes periódicos."}
                          {type.value === "monitoring" && "Servicio de inteligencia en tiempo real con alertas y monitoreo continuo."}
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="mt-6">
          <h4 className="text-lg font-medium text-neutral-800 mb-4">Alcance del Proyecto</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="mentions" className="block text-sm font-medium text-neutral-700 mb-1">Menciones Estimadas</Label>
              <Select 
                value={projectDetails.mentionsVolume || ""}
                onValueChange={(value) => updateProjectDetails({ mentionsVolume: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona rango" />
                </SelectTrigger>
                <SelectContent>
                  {mentionsVolume?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="countries" className="block text-sm font-medium text-neutral-700 mb-1">Países Cubiertos</Label>
              <Select 
                value={projectDetails.countriesCovered || ""}
                onValueChange={(value) => updateProjectDetails({ countriesCovered: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona rango" />
                </SelectTrigger>
                <SelectContent>
                  {countriesCovered?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="engagement" className="block text-sm font-medium text-neutral-700 mb-1">Nivel de Participación del Cliente</Label>
              <Select 
                value={projectDetails.clientEngagement || ""}
                onValueChange={(value) => updateProjectDetails({ clientEngagement: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona nivel" />
                </SelectTrigger>
                <SelectContent>
                  {clientEngagement?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button type="button" onClick={handleContinue} className="flex items-center">
            Continuar
            <span className="ml-1">→</span>
          </Button>
        </div>
      </div>

      {/* New Client Dialog */}
      <Dialog open={newClientDialogOpen} onOpenChange={setNewClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Cliente</DialogTitle>
          </DialogHeader>
          
          <Form {...clientForm}>
            <form onSubmit={clientForm.handleSubmit(handleCreateClient)} className="space-y-4 py-2">
              <FormField
                control={clientForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa nombre del cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={clientForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Persona de Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa nombre de contacto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={clientForm.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa dirección de correo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={clientForm.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa número de teléfono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setNewClientDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Añadir Cliente
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

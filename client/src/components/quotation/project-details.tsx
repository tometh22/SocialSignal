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
  name: z.string().min(1, "Client name is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
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

  // Get options and clients from API
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: analysisTypes } = useQuery({
    queryKey: ["/api/options/analysis-types"],
  });

  const { data: projectTypes } = useQuery({
    queryKey: ["/api/options/project-types"],
  });

  const { data: mentionsVolume } = useQuery({
    queryKey: ["/api/options/mentions-volume"],
  });

  const { data: countriesCovered } = useQuery({
    queryKey: ["/api/options/countries-covered"],
  });

  const { data: clientEngagement } = useQuery({
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
        title: "Success",
        description: "Client created successfully.",
      });
      
      // Update the selected client in the form
      updateProjectDetails({ clientId: newClient.id });
      
      setNewClientDialogOpen(false);
      clientForm.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create client.",
        variant: "destructive",
      });
    }
  };

  // Check if form is valid and fields are filled
  const validateForm = () => {
    if (
      !projectDetails.clientId ||
      !projectDetails.projectName ||
      !projectDetails.analysisType ||
      !projectDetails.projectType ||
      !projectDetails.mentionsVolume ||
      !projectDetails.countriesCovered ||
      !projectDetails.clientEngagement
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Update calculations when inputs change
  useEffect(() => {
    if (
      projectDetails.analysisType &&
      projectDetails.mentionsVolume &&
      projectDetails.countriesCovered &&
      projectDetails.clientEngagement
    ) {
      analyzeInputs();
    }
  }, [
    projectDetails.analysisType,
    projectDetails.mentionsVolume,
    projectDetails.countriesCovered,
    projectDetails.clientEngagement,
    analyzeInputs
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
        <h3 className="text-xl font-semibold text-neutral-900 mb-6">Project Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="client" className="block text-sm font-medium text-neutral-700 mb-1">Client Name</Label>
            <div className="flex gap-2">
              <Select
                value={projectDetails.clientId ? projectDetails.clientId.toString() : ""}
                onValueChange={(value) => updateProjectDetails({ clientId: parseInt(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
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
                      New Client...
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
            <Label htmlFor="project-name" className="block text-sm font-medium text-neutral-700 mb-1">Project Name</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="Enter project name"
              value={projectDetails.projectName || ""}
              onChange={(e) => updateProjectDetails({ projectName: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="analysis-type" className="block text-sm font-medium text-neutral-700 mb-1">Analysis Type</Label>
            <Select 
              value={projectDetails.analysisType || ""}
              onValueChange={(value) => updateProjectDetails({ analysisType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                {analysisTypes?.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="project-type" className="block text-sm font-medium text-neutral-700 mb-1">Project Type</Label>
            <Select 
              value={projectDetails.projectType || ""}
              onValueChange={(value) => updateProjectDetails({ projectType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project type" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes?.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="mt-6">
          <h4 className="text-lg font-medium text-neutral-800 mb-4">Project Scope</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="mentions" className="block text-sm font-medium text-neutral-700 mb-1">Estimated Mentions</Label>
              <Select 
                value={projectDetails.mentionsVolume || ""}
                onValueChange={(value) => updateProjectDetails({ mentionsVolume: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
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
              <Label htmlFor="countries" className="block text-sm font-medium text-neutral-700 mb-1">Countries Covered</Label>
              <Select 
                value={projectDetails.countriesCovered || ""}
                onValueChange={(value) => updateProjectDetails({ countriesCovered: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
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
              <Label htmlFor="engagement" className="block text-sm font-medium text-neutral-700 mb-1">Client Engagement Level</Label>
              <Select 
                value={projectDetails.clientEngagement || ""}
                onValueChange={(value) => updateProjectDetails({ clientEngagement: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
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
            Continue
            <span className="material-icons ml-1">arrow_forward</span>
          </Button>
        </div>
      </div>

      {/* New Client Dialog */}
      <Dialog open={newClientDialogOpen} onOpenChange={setNewClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          
          <Form {...clientForm}>
            <form onSubmit={clientForm.handleSubmit(handleCreateClient)} className="space-y-4 py-2">
              <FormField
                control={clientForm.control}
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
                control={clientForm.control}
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
                control={clientForm.control}
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
                control={clientForm.control}
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
                <Button variant="outline" type="button" onClick={() => setNewClientDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Add Client
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

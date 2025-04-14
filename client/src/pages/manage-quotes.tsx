import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManageQuotes() {
  const { data: quotations, isLoading, refetch } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const { toast } = useToast();

  // Filter quotations based on search term and status
  const filteredQuotations = quotations
    ? quotations.filter((quote) => {
        const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
    : [];

  const handleStatusChange = async () => {
    if (!selectedQuote || !newStatus) return;

    try {
      await apiRequest(
        "PATCH",
        `/api/quotations/${selectedQuote.id}/status`,
        { status: newStatus }
      );
      
      toast({
        title: "Status updated",
        description: `Quotation status has been updated to ${newStatus}.`,
      });
      
      refetch();
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quotation status.",
        variant: "destructive",
      });
    }
  };

  const openStatusDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setNewStatus(quote.status);
    setDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "in-negotiation":
        return <Edit className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in-negotiation":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Manage Quotations</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Quotations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    placeholder="Search by project name..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-64">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="in-negotiation">In Negotiation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8">Loading quotations...</div>
              ) : filteredQuotations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Project Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Client ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Analysis Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Total</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotations.map((quote) => (
                        <tr key={quote.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.projectName}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.clientId}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.analysisType}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(quote.status)}`}>
                              {getStatusIcon(quote.status)}
                              <span className="ml-1.5">{quote.status.charAt(0).toUpperCase() + quote.status.slice(1).replace('-', ' ')}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                            ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => openStatusDialog(quote)}>
                                <Edit className="h-4 w-4 mr-1" />
                                Status
                              </Button>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View
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
                  {searchTerm || statusFilter !== "all"
                    ? "No quotations match your search criteria."
                    : "No quotations found."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Quotation Status</DialogTitle>
            <DialogDescription>
              Change the status of this quotation. Updating to "In Negotiation" allows for additional adjustments.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Current Status:</h4>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${selectedQuote ? getStatusClass(selectedQuote.status) : ''}`}>
                {selectedQuote && getStatusIcon(selectedQuote.status)}
                <span className="ml-1.5">
                  {selectedQuote?.status.charAt(0).toUpperCase() + selectedQuote?.status.slice(1).replace('-', ' ')}
                </span>
              </span>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">New Status:</h4>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="in-negotiation">In Negotiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusChange}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

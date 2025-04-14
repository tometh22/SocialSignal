import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import { Quotation } from "@shared/schema";

export default function Dashboard() {
  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  // Count quotations by status
  const getStatusCounts = () => {
    if (!quotations) return { pending: 0, approved: 0, rejected: 0, inNegotiation: 0 };
    
    return quotations.reduce(
      (acc, quote) => {
        if (quote.status === "pending") acc.pending += 1;
        if (quote.status === "approved") acc.approved += 1;
        if (quote.status === "rejected") acc.rejected += 1;
        if (quote.status === "in-negotiation") acc.inNegotiation += 1;
        return acc;
      }, 
      { pending: 0, approved: 0, rejected: 0, inNegotiation: 0 }
    );
  };

  const statusCounts = getStatusCounts();

  // Get 5 most recent quotations
  const recentQuotations = quotations 
    ? [...quotations]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Dashboard</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-2xl font-bold text-neutral-900">Social Listening Quotation System</h1>
            <Link href="/new-quote">
              <Button className="mt-4 sm:mt-0">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Quote
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Pending</CardTitle>
                <CardDescription>Quotes awaiting review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-yellow-500 mr-3" />
                  <span className="text-3xl font-bold">{isLoading ? "..." : statusCounts.pending}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Approved</CardTitle>
                <CardDescription>Quotes accepted by clients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                  <span className="text-3xl font-bold">{isLoading ? "..." : statusCounts.approved}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Rejected</CardTitle>
                <CardDescription>Quotes declined by clients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mr-3" />
                  <span className="text-3xl font-bold">{isLoading ? "..." : statusCounts.rejected}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">In Negotiation</CardTitle>
                <CardDescription>Quotes being negotiated</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-blue-500 mr-3" />
                  <span className="text-3xl font-bold">{isLoading ? "..." : statusCounts.inNegotiation}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Quotations</CardTitle>
              <CardDescription>The 5 most recently created quotations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading recent quotations...</div>
              ) : recentQuotations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Project Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Client</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Analysis Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentQuotations.map((quote) => (
                        <tr key={quote.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.projectName}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">Client {quote.clientId}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">{quote.analysisType}</td>
                          <td className="px-4 py-3 text-sm text-neutral-900">
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${quote.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                              ${quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                              ${quote.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                              ${quote.status === 'in-negotiation' ? 'bg-blue-100 text-blue-800' : ''}
                            `}>
                              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1).replace('-', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                            ${quote.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-neutral-500">No quotations found. Create your first quote!</div>
              )}
              
              <div className="mt-4 flex justify-end">
                <Link href="/manage-quotes">
                  <Button variant="outline">View All Quotations</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

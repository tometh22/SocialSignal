import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronDown, Calendar, Layers, ArrowUpDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Statistics() {
  const { data: quotations, isLoading } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [timeFrame, setTimeFrame] = useState("all");
  const [analysisType, setAnalysisType] = useState("all");

  // Filter quotations based on search, time frame, and analysis type
  const filteredQuotations = quotations
    ? quotations.filter((quote) => {
        const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesTimeFrame = true;
        if (timeFrame !== "all") {
          const quoteDate = new Date(quote.createdAt);
          const now = new Date();
          
          if (timeFrame === "7days") {
            const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
            matchesTimeFrame = quoteDate >= sevenDaysAgo;
          } else if (timeFrame === "30days") {
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
            matchesTimeFrame = quoteDate >= thirtyDaysAgo;
          } else if (timeFrame === "90days") {
            const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));
            matchesTimeFrame = quoteDate >= ninetyDaysAgo;
          }
        }
        
        const matchesAnalysisType = analysisType === "all" || quote.analysisType === analysisType;
        
        return matchesSearch && matchesTimeFrame && matchesAnalysisType;
      })
    : [];

  // Prepare data for charts
  const getStatusData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      inNegotiation: 0,
    };
    
    filteredQuotations.forEach((quote) => {
      if (quote.status === "pending") counts.pending += 1;
      else if (quote.status === "approved") counts.approved += 1;
      else if (quote.status === "rejected") counts.rejected += 1;
      else if (quote.status === "in-negotiation") counts.inNegotiation += 1;
    });
    
    return [
      { name: "Pending", value: counts.pending },
      { name: "Approved", value: counts.approved },
      { name: "Rejected", value: counts.rejected },
      { name: "In Negotiation", value: counts.inNegotiation },
    ].filter(item => item.value > 0);
  };

  const getAnalysisTypeData = () => {
    if (!filteredQuotations.length) return [];
    
    const counts = {
      basic: 0,
      standard: 0,
      deep: 0,
    };
    
    filteredQuotations.forEach((quote) => {
      if (quote.analysisType === "basic") counts.basic += 1;
      else if (quote.analysisType === "standard") counts.standard += 1;
      else if (quote.analysisType === "deep") counts.deep += 1;
    });
    
    return [
      { name: "Basic Analysis", value: counts.basic },
      { name: "Standard Analysis", value: counts.standard },
      { name: "Deep Analysis", value: counts.deep },
    ].filter(item => item.value > 0);
  };

  const getMonthlyData = () => {
    if (!filteredQuotations.length) return [];
    
    const monthlyData = {};
    
    filteredQuotations.forEach((quote) => {
      const date = new Date(quote.createdAt);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      const key = `${month} ${year}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          month: key,
          count: 0,
          value: 0,
        };
      }
      
      monthlyData[key].count += 1;
      monthlyData[key].value += quote.totalAmount;
    });
    
    return Object.values(monthlyData).sort((a: any, b: any) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const COLORS = ['#1976d2', '#ff6d00', '#4caf50', '#f44336'];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Estadísticas y Análisis</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filter Options</CardTitle>
              <CardDescription>Refine the historical data view</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    placeholder="Search by project name..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="w-full md:w-48">
                  <Select value={timeFrame} onValueChange={setTimeFrame}>
                    <SelectTrigger>
                      <Calendar className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Time frame" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-full md:w-48">
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger>
                      <Layers className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Analysis type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="basic">Basic Analysis</SelectItem>
                      <SelectItem value="standard">Standard Analysis</SelectItem>
                      <SelectItem value="deep">Deep Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Quotations by Status</CardTitle>
                <CardDescription>Distribution of quotation statuses</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center">Loading chart data...</div>
                ) : getStatusData().length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getStatusData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {getStatusData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-neutral-500">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analysis Type Distribution</CardTitle>
                <CardDescription>Breakdown by analysis complexity</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 flex items-center justify-center">Loading chart data...</div>
                ) : getAnalysisTypeData().length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getAnalysisTypeData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {getAnalysisTypeData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-neutral-500">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quote Value Summary</CardTitle>
                <CardDescription>Aggregate financial metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-neutral-500">Total Quotes</p>
                    <p className="text-2xl font-semibold">
                      {isLoading ? "..." : filteredQuotations.length}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-neutral-500">Total Value</p>
                    <p className="text-2xl font-semibold">
                      {isLoading ? "..." : `$${filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-neutral-500">Average Quote Value</p>
                    <p className="text-2xl font-semibold">
                      {isLoading ? "..." : filteredQuotations.length > 0 
                        ? `$${(filteredQuotations.reduce((sum, quote) => sum + quote.totalAmount, 0) / filteredQuotations.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "$0.00"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
              <CardDescription>Quotation activity over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-80 flex items-center justify-center">Loading chart data...</div>
              ) : getMonthlyData().length > 0 ? (
                <div className="h-80">
                  <Tabs defaultValue="count">
                    <TabsList className="mb-4">
                      <TabsTrigger value="count">Quote Count</TabsTrigger>
                      <TabsTrigger value="value">Quote Value</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="count">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getMonthlyData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" name="Number of Quotes" fill="#1976d2" />
                        </BarChart>
                      </ResponsiveContainer>
                    </TabsContent>
                    
                    <TabsContent value="value">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getMonthlyData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, "Total Value"]} />
                          <Legend />
                          <Bar dataKey="value" name="Total Quote Value" fill="#4caf50" />
                        </BarChart>
                      </ResponsiveContainer>
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-neutral-500">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

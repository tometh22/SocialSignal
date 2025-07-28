import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Plus, DollarSign, Clock, Tag, Calendar as CalendarIcon, 
  Edit, Trash2, Users, TrendingUp, Building2, Receipt,
  Briefcase, FileText, CreditCard, UserCheck, Calculator,
  ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import type { 
  IndirectCostCategory, 
  IndirectCost, 
  NonBillableHours,
  InsertIndirectCostCategory,
  InsertIndirectCost,
  InsertNonBillableHours,
  Personnel
} from '@shared/schema';

export function IndirectCosts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState<any>({});
  
  // Quick entry forms state
  const [quickCosts, setQuickCosts] = useState<any[]>([
    { categoryId: '', name: '', amount: '', period: 'monthly', description: '' }
  ]);
  const [quickHours, setQuickHours] = useState<any[]>([
    { personnelId: '', categoryId: '', hours: '', date: new Date(), description: '' }
  ]);

  // Only load categories initially (they're needed for all tabs)
  const { data: categories = [], isLoading: loadingCategories } = useQuery<IndirectCostCategory[]>({
    queryKey: ['/api/indirect-cost-categories']
  });

  // Load costs only when needed
  const { data: costs = [], isLoading: loadingCosts } = useQuery<IndirectCost[]>({
    queryKey: ['/api/indirect-costs'],
    enabled: selectedTab === 'overview' || selectedTab === 'costs'
  });

  // Load hours only when needed
  const { data: hours = [], isLoading: loadingHours } = useQuery<NonBillableHours[]>({
    queryKey: ['/api/indirect-costs/hours'],
    enabled: selectedTab === 'overview' || selectedTab === 'hours'
  });

  // Load personnel only when needed
  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel'],
    enabled: selectedTab === 'hours'
  });

  // Mutations
  const createCategoryMutation = useMutation<IndirectCostCategory, Error, InsertIndirectCostCategory>({
    mutationFn: (data: InsertIndirectCostCategory) => 
      apiRequest('/api/indirect-cost-categories', {
        method: 'POST',
        body: data
      }),
    onMutate: async (newCategory) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/indirect-cost-categories'] });
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<IndirectCostCategory[]>(['/api/indirect-cost-categories']);
      
      // Optimistically update to the new value
      if (previousCategories) {
        queryClient.setQueryData<IndirectCostCategory[]>(['/api/indirect-cost-categories'], old => [
          ...(old || []),
          { ...newCategory, id: Date.now(), createdAt: new Date() } as IndirectCostCategory
        ]);
      }
      
      // Return context with the previous categories
      return { previousCategories };
    },
    onError: (err, newCategory, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousCategories) {
        queryClient.setQueryData(['/api/indirect-cost-categories'], context.previousCategories);
      }
    },
    onSuccess: async (data) => {
      // Replace optimistic update with actual data
      await queryClient.invalidateQueries({ queryKey: ['/api/indirect-cost-categories'] });
      setIsAddingCategory(false);
      setFormData({});
      toast({
        title: "Categoría creada",
        description: "La categoría se creó exitosamente"
      });
    }
  });

  const createCostMutation = useMutation({
    mutationFn: (data: InsertIndirectCost) => 
      apiRequest('/api/indirect-costs', {
        method: 'POST',
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs'] });
      setFormData({});
      toast({
        title: "Costo registrado",
        description: "El costo se registró exitosamente"
      });
    }
  });

  const createHoursMutation = useMutation({
    mutationFn: (data: InsertNonBillableHours) => 
      apiRequest('/api/indirect-costs/hours', {
        method: 'POST',
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs/hours'] });
      setFormData({});
      toast({
        title: "Horas registradas",
        description: "Las horas no facturables se registraron exitosamente"
      });
    }
  });

  // Optimized calculations with memoization to avoid re-computation
  const totalMonthlyCosts = React.useMemo(() => 
    costs
      .filter(c => c.period === 'monthly')
      .reduce((sum, cost) => sum + parseFloat(cost.amount), 0),
    [costs]
  );

  const totalNonBillableHours = React.useMemo(() =>
    hours.reduce((sum, h) => sum + parseFloat(h.hours), 0),
    [hours]
  );

  const totalNonBillableCost = React.useMemo(() =>
    hours.reduce((sum, h) => {
      const person = personnel.find(p => p.id === h.personnelId);
      return sum + (parseFloat(h.hours) * (person?.hourlyRate || 0));
    }, 0),
    [hours, personnel]
  );

  // Show optimized loading state only when essential data is loading
  if (loadingCategories) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto p-6 space-y-8">
          {/* Header Skeleton */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-10 w-96 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-6 w-72 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="hidden md:block">
                <div className="h-20 w-20 bg-slate-100 rounded-2xl animate-pulse" />
              </div>
            </div>
          </div>
          
          {/* KPI Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="container mx-auto p-6 space-y-8">
        {/* Modern Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Centro de Costos Indirectos
              </h1>
              <p className="text-slate-600 mt-2 text-lg">
                Gestión integral de costos operativos y administrativos
              </p>
            </div>
            <div className="hidden md:block">
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-4 rounded-2xl">
                <Receipt className="h-12 w-12 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <Badge variant="secondary">Mensual</Badge>
              </div>
              <CardTitle className="text-lg text-slate-700 mt-4">Costos Fijos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${totalMonthlyCosts.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-slate-500 mt-1">por mes</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="bg-orange-100 p-3 rounded-xl">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <Badge variant="secondary">No Facturable</Badge>
              </div>
              <CardTitle className="text-lg text-slate-700 mt-4">Horas Indirectas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {totalNonBillableHours.toFixed(1)}h
              </div>
              <p className="text-sm text-slate-500 mt-1">
                ${totalNonBillableCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <Badge variant="secondary">Total</Badge>
              </div>
              <CardTitle className="text-lg text-slate-700 mt-4">Costo Total Indirecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${(totalMonthlyCosts + totalNonBillableCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-slate-500 mt-1">impacto mensual</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl mx-auto">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="categories">Categorías</TabsTrigger>
            <TabsTrigger value="costs">Costos Fijos</TabsTrigger>
            <TabsTrigger value="hours">Horas No Facturables</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categories.map(category => {
                      const categoryCosts = costs.filter(c => c.categoryId === category.id);
                      const total = categoryCosts.reduce((sum, c) => sum + parseFloat(c.amount), 0);
                      
                      return (
                        <div key={category.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Tag className="h-4 w-4 text-slate-600" />
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <span className="font-bold">
                            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tendencia Mensual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    <Activity className="h-8 w-8 mr-2" />
                    <span>Gráfico de tendencias próximamente</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Categorías de Costos</h2>
              <Button onClick={() => setIsAddingCategory(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Categoría
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(category => (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    {category.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant={category.isActive ? "default" : "secondary"}>
                        {category.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        {costs.filter(c => c.categoryId === category.id).length} costos
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Costs Tab - Quick Entry Style */}
          <TabsContent value="costs" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Registro Rápido de Costos</h2>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setQuickCosts([...quickCosts, { categoryId: '', name: '', amount: '', period: 'monthly', description: '' }])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Línea
                </Button>
                <Button 
                  onClick={async () => {
                    const validCosts = quickCosts.filter(c => c.categoryId && c.name && c.amount);
                    if (validCosts.length === 0) {
                      toast({ title: "Error", description: "Completa al menos una línea", variant: "destructive" });
                      return;
                    }
                    
                    for (const cost of validCosts) {
                      await apiRequest('/api/indirect-costs', {
                        method: 'POST',
                        body: {
                          categoryId: parseInt(cost.categoryId),
                          name: cost.name,
                          description: cost.description || null,
                          amount: cost.amount.toString(),
                          period: cost.period,
                          startDate: new Date(),
                          endDate: null,
                          createdBy: user?.id
                        }
                      });
                    }
                    
                    queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs'] });
                    setQuickCosts([{ categoryId: '', name: '', amount: '', period: 'monthly', description: '' }]);
                    toast({ title: "Éxito", description: `${validCosts.length} costos registrados` });
                  }}
                  disabled={!quickCosts.some(c => c.categoryId && c.name && c.amount)}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Guardar Todos ({quickCosts.filter(c => c.categoryId && c.name && c.amount).length})
                </Button>
              </div>
            </div>

            {/* Quick Entry Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Categoría</th>
                      <th className="text-left p-3 font-medium text-sm">Nombre del Costo</th>
                      <th className="text-left p-3 font-medium text-sm">Monto</th>
                      <th className="text-left p-3 font-medium text-sm">Frecuencia</th>
                      <th className="text-left p-3 font-medium text-sm">Descripción</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickCosts.map((cost, index) => (
                      <tr key={index} className="border-b hover:bg-slate-50">
                        <td className="p-2">
                          <Select 
                            value={cost.categoryId}
                            onValueChange={(value) => {
                              const newCosts = [...quickCosts];
                              newCosts[index].categoryId = value;
                              setQuickCosts(newCosts);
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.filter(c => c.isActive).map(category => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={cost.name}
                            onChange={(e) => {
                              const newCosts = [...quickCosts];
                              newCosts[index].name = e.target.value;
                              setQuickCosts(newCosts);
                            }}
                            placeholder="Ej: Slack Premium"
                            className="h-9"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={cost.amount}
                            onChange={(e) => {
                              const newCosts = [...quickCosts];
                              newCosts[index].amount = e.target.value;
                              setQuickCosts(newCosts);
                            }}
                            placeholder="0.00"
                            className="h-9 w-32"
                          />
                        </td>
                        <td className="p-2">
                          <Select 
                            value={cost.period}
                            onValueChange={(value) => {
                              const newCosts = [...quickCosts];
                              newCosts[index].period = value;
                              setQuickCosts(newCosts);
                            }}
                          >
                            <SelectTrigger className="h-9 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Mensual</SelectItem>
                              <SelectItem value="quarterly">Trimestral</SelectItem>
                              <SelectItem value="yearly">Anual</SelectItem>
                              <SelectItem value="once">Una vez</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={cost.description}
                            onChange={(e) => {
                              const newCosts = [...quickCosts];
                              newCosts[index].description = e.target.value;
                              setQuickCosts(newCosts);
                            }}
                            placeholder="Opcional"
                            className="h-9"
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newCosts = quickCosts.filter((_, i) => i !== index);
                              setQuickCosts(newCosts.length > 0 ? newCosts : [{ categoryId: '', name: '', amount: '', period: 'monthly', description: '' }]);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700">Total a Registrar</span>
                    <span className="text-xl font-bold text-blue-900">
                      ${quickCosts.filter(c => c.amount).reduce((sum, c) => sum + parseFloat(c.amount || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Existing Costs List */}
            {costs.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8">Costos Registrados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {costs.map(cost => {
                    const category = categories.find(c => c.id === cost.categoryId);
                    return (
                      <Card key={cost.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-sm">{cost.name}</h4>
                            <Badge variant="outline" className="text-xs">{category?.name}</Badge>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-xs text-slate-500">
                              {cost.period === 'monthly' ? 'Mensual' : 
                               cost.period === 'quarterly' ? 'Trimestral' : 
                               cost.period === 'yearly' ? 'Anual' : 'Una vez'}
                            </span>
                            <span className="font-bold text-lg">
                              ${parseFloat(cost.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Hours Tab - Quick Entry Style */}
          <TabsContent value="hours" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Registro Rápido de Horas No Facturables</h2>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setQuickHours([...quickHours, { personnelId: '', categoryId: '', hours: '', date: new Date(), description: '' }])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Línea
                </Button>
                <Button 
                  onClick={async () => {
                    const validHours = quickHours.filter(h => h.personnelId && h.categoryId && h.hours);
                    if (validHours.length === 0) {
                      toast({ title: "Error", description: "Completa al menos una línea", variant: "destructive" });
                      return;
                    }
                    
                    for (const hour of validHours) {
                      await apiRequest('/api/indirect-costs/hours', {
                        method: 'POST',
                        body: {
                          personnelId: parseInt(hour.personnelId),
                          categoryId: parseInt(hour.categoryId),
                          date: hour.date,
                          hours: hour.hours.toString(),
                          description: hour.description || null,
                          createdBy: user?.id
                        }
                      });
                    }
                    
                    queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs/hours'] });
                    setQuickHours([{ personnelId: '', categoryId: '', hours: '', date: new Date(), description: '' }]);
                    toast({ title: "Éxito", description: `${validHours.length} registros de horas guardados` });
                  }}
                  disabled={!quickHours.some(h => h.personnelId && h.categoryId && h.hours)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Guardar Todos ({quickHours.filter(h => h.personnelId && h.categoryId && h.hours).length})
                </Button>
              </div>
            </div>

            {/* Quick Entry Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Persona</th>
                      <th className="text-left p-3 font-medium text-sm">Categoría</th>
                      <th className="text-left p-3 font-medium text-sm">Horas</th>
                      <th className="text-left p-3 font-medium text-sm">Fecha</th>
                      <th className="text-left p-3 font-medium text-sm">Descripción</th>
                      <th className="text-left p-3 font-medium text-sm">Costo</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickHours.map((hour, index) => {
                      const person = personnel.find(p => p.id === parseInt(hour.personnelId));
                      const hourCost = parseFloat(hour.hours || '0') * (person?.hourlyRate || 0);
                      
                      return (
                        <tr key={index} className="border-b hover:bg-slate-50">
                          <td className="p-2">
                            <Select 
                              value={hour.personnelId}
                              onValueChange={(value) => {
                                const newHours = [...quickHours];
                                newHours[index].personnelId = value;
                                setQuickHours(newHours);
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {personnel.map(person => (
                                  <SelectItem key={person.id} value={person.id.toString()}>
                                    {person.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Select 
                              value={hour.categoryId}
                              onValueChange={(value) => {
                                const newHours = [...quickHours];
                                newHours[index].categoryId = value;
                                setQuickHours(newHours);
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.filter(c => c.isActive).map(category => (
                                  <SelectItem key={category.id} value={category.id.toString()}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              value={hour.hours}
                              onChange={(e) => {
                                const newHours = [...quickHours];
                                newHours[index].hours = e.target.value;
                                setQuickHours(newHours);
                              }}
                              placeholder="0.0"
                              className="h-9 w-20"
                            />
                          </td>
                          <td className="p-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="h-9 w-32 justify-start text-left font-normal">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {format(hour.date, 'dd/MM', { locale: es })}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={hour.date}
                                  onSelect={(date) => {
                                    if (date) {
                                      const newHours = [...quickHours];
                                      newHours[index].date = date;
                                      setQuickHours(newHours);
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </td>
                          <td className="p-2">
                            <Input
                              value={hour.description}
                              onChange={(e) => {
                                const newHours = [...quickHours];
                                newHours[index].description = e.target.value;
                                setQuickHours(newHours);
                              }}
                              placeholder="Actividad realizada"
                              className="h-9"
                            />
                          </td>
                          <td className="p-2">
                            <span className="font-medium text-sm">
                              ${hourCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newHours = quickHours.filter((_, i) => i !== index);
                                setQuickHours(newHours.length > 0 ? newHours : [{ personnelId: '', categoryId: '', hours: '', date: new Date(), description: '' }]);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-orange-700">Total Horas</span>
                    <span className="text-xl font-bold text-orange-900">
                      {quickHours.filter(h => h.hours).reduce((sum, h) => sum + parseFloat(h.hours || 0), 0).toFixed(1)}h
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-700">Costo Total</span>
                    <span className="text-xl font-bold text-purple-900">
                      ${quickHours.reduce((sum, h) => {
                        const person = personnel.find(p => p.id === parseInt(h.personnelId));
                        return sum + (parseFloat(h.hours || '0') * (person?.hourlyRate || 0));
                      }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Existing Hours List */}
            {hours.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8">Horas Registradas</h3>
                <div className="space-y-2">
                  {hours.slice(0, 10).map(hour => {
                    const person = personnel.find(p => p.id === hour.personnelId);
                    const category = categories.find(c => c.id === hour.categoryId);
                    const cost = parseFloat(hour.hours) * (person?.hourlyRate || 0);

                    return (
                      <div key={hour.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="font-medium text-sm">{person?.name}</span>
                            <span className="text-xs text-slate-500 ml-2">{category?.name}</span>
                          </div>
                          {hour.description && (
                            <span className="text-sm text-slate-600">{hour.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-sm text-slate-500">
                            {format(new Date(hour.date), 'dd MMM', { locale: es })}
                          </span>
                          <span className="font-medium">{parseFloat(hour.hours).toFixed(1)}h</span>
                          <span className="font-bold text-sm">
                            ${cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Category Dialog - Keep this one for now */}
        <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Categoría</DialogTitle>
              <DialogDescription>
                Crea una nueva categoría para organizar tus costos indirectos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Suscripciones de Software"
                />
              </div>

              <div>
                <Label htmlFor="category-description">Descripción</Label>
                <Textarea
                  id="category-description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe esta categoría..."
                />
              </div>

              <div>
                <Label htmlFor="category-type">Tipo</Label>
                <Select 
                  value={formData.type || 'operational'}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="category-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operacional</SelectItem>
                    <SelectItem value="administrative">Administrativo</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="technology">Tecnología</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingCategory(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (formData.name && formData.type) {
                    createCategoryMutation.mutate({
                      name: formData.name,
                      description: formData.description || null,
                      type: formData.type,
                      isActive: true
                    });
                  }
                }}
              >
                Crear Categoría
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

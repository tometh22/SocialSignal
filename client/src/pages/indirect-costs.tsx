import { useState } from 'react';
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
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [isAddingHours, setIsAddingHours] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState<any>({});

  // Queries
  const { data: categories = [], isLoading: loadingCategories } = useQuery<IndirectCostCategory[]>({
    queryKey: ['/api/indirect-costs/categories']
  });

  const { data: costs = [], isLoading: loadingCosts } = useQuery<IndirectCost[]>({
    queryKey: ['/api/indirect-costs']
  });

  const { data: hours = [], isLoading: loadingHours } = useQuery<NonBillableHours[]>({
    queryKey: ['/api/indirect-costs/hours']
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel']
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: InsertIndirectCostCategory) => 
      apiRequest('/api/indirect-costs/categories', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs/categories'] });
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
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs'] });
      setIsAddingCost(false);
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
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs/hours'] });
      setIsAddingHours(false);
      setFormData({});
      toast({
        title: "Horas registradas",
        description: "Las horas no facturables se registraron exitosamente"
      });
    }
  });

  // Calculations
  const totalMonthlyCosts = costs
    .filter(c => c.period === 'monthly')
    .reduce((sum, cost) => sum + parseFloat(cost.amount), 0);

  const totalNonBillableHours = hours
    .reduce((sum, h) => sum + parseFloat(h.hours), 0);

  const totalNonBillableCost = hours
    .reduce((sum, h) => {
      const person = personnel.find(p => p.id === h.personnelId);
      return sum + (parseFloat(h.hours) * (person?.hourlyRate || 0));
    }, 0);

  if (loadingCategories || loadingCosts || loadingHours) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Costos Fijos Registrados</h2>
              <Button onClick={() => setIsAddingCost(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Costo
              </Button>
            </div>

            <div className="space-y-4">
              {costs.map(cost => {
                const category = categories.find(c => c.id === cost.categoryId);
                return (
                  <Card key={cost.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{cost.name}</h3>
                          {cost.description && (
                            <p className="text-sm text-slate-600">{cost.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <Badge variant="outline">{category?.name}</Badge>
                            <span className="text-slate-500">
                              {cost.period === 'monthly' ? 'Mensual' : 
                               cost.period === 'quarterly' ? 'Trimestral' : 
                               cost.period === 'yearly' ? 'Anual' : 'Una vez'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ${parseFloat(cost.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </div>
                          <p className="text-sm text-slate-500">
                            {format(new Date(cost.startDate), 'dd MMM yyyy', { locale: es })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Horas No Facturables</h2>
              <Button onClick={() => setIsAddingHours(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Horas
              </Button>
            </div>

            <div className="space-y-4">
              {hours.map(hour => {
                const person = personnel.find(p => p.id === hour.personnelId);
                const category = categories.find(c => c.id === hour.categoryId);
                const cost = parseFloat(hour.hours) * (person?.hourlyRate || 0);

                return (
                  <Card key={hour.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{person?.name}</h3>
                          {hour.description && (
                            <p className="text-sm text-slate-600">{hour.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <Badge variant="outline">{category?.name}</Badge>
                            <span className="text-slate-500">
                              {format(new Date(hour.date), 'dd MMM yyyy', { locale: es })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{parseFloat(hour.hours).toFixed(1)}h</div>
                          <p className="text-sm text-slate-500">
                            ${cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Category Dialog */}
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

        {/* Add Cost Dialog */}
        <Dialog open={isAddingCost} onOpenChange={setIsAddingCost}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Costo Fijo</DialogTitle>
              <DialogDescription>
                Registra un nuevo costo fijo o recurrente
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost-category">Categoría</Label>
                <Select 
                  value={formData.categoryId || ''}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger id="cost-category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.isActive).map(category => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost-name">Nombre del Costo</Label>
                <Input
                  id="cost-name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Slack Premium"
                />
              </div>

              <div>
                <Label htmlFor="cost-amount">Monto</Label>
                <Input
                  id="cost-amount"
                  type="number"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="cost-period">Frecuencia</Label>
                <Select 
                  value={formData.period || 'monthly'}
                  onValueChange={(value) => setFormData({ ...formData, period: value })}
                >
                  <SelectTrigger id="cost-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                    <SelectItem value="once">Una vez</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="cost-description">Descripción</Label>
                <Textarea
                  id="cost-description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe este costo..."
                />
              </div>

              <div>
                <Label>Fecha de Inicio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : 'Selecciona fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingCost(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (formData.categoryId && formData.name && formData.amount && user) {
                    createCostMutation.mutate({
                      categoryId: parseInt(formData.categoryId),
                      name: formData.name,
                      description: formData.description || null,
                      amount: formData.amount.toString(),
                      period: formData.period || 'monthly',
                      startDate: selectedDate || new Date(),
                      endDate: null,
                      createdBy: user.id
                    });
                  }
                }}
              >
                Registrar Costo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Hours Dialog */}
        <Dialog open={isAddingHours} onOpenChange={setIsAddingHours}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Horas No Facturables</DialogTitle>
              <DialogDescription>
                Registra tiempo dedicado a actividades no facturables
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="hours-person">Persona</Label>
                <Select 
                  value={formData.personnelId || ''}
                  onValueChange={(value) => setFormData({ ...formData, personnelId: value })}
                >
                  <SelectTrigger id="hours-person">
                    <SelectValue placeholder="Selecciona una persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {personnel.map(person => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="hours-category">Categoría</Label>
                <Select 
                  value={formData.categoryId || ''}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger id="hours-category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.isActive).map(category => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="hours-amount">Horas</Label>
                <Input
                  id="hours-amount"
                  type="number"
                  step="0.5"
                  value={formData.hours || ''}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  placeholder="0.0"
                />
              </div>

              <div>
                <Label>Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : 'Selecciona fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="hours-description">Descripción</Label>
                <Textarea
                  id="hours-description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe la actividad..."
                />
              </div>

              {formData.personnelId && formData.hours && (
                <div className="p-3 bg-slate-100 rounded-lg">
                  <p className="text-sm font-medium">Costo estimado</p>
                  <p className="text-2xl font-bold">
                    ${(parseFloat(formData.hours || '0') * (personnel.find(p => p.id === parseInt(formData.personnelId))?.hourlyRate || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingHours(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (formData.personnelId && formData.categoryId && formData.hours && user) {
                    createHoursMutation.mutate({
                      personnelId: parseInt(formData.personnelId),
                      categoryId: parseInt(formData.categoryId),
                      date: selectedDate || new Date(),
                      hours: formData.hours.toString(),
                      description: formData.description || null,
                      createdBy: user.id
                    });
                  }
                }}
              >
                Registrar Horas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

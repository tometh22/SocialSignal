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
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Clock, Tag, Calendar as CalendarIcon, Edit, Trash2, Users, TrendingUp, Building2, Receipt } from 'lucide-react';
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
  const [selectedTab, setSelectedTab] = useState("categories");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [isAddingHours, setIsAddingHours] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState<any>({});

  // Queries
  const { data: categories = [], isLoading: loadingCategories } = useQuery<IndirectCostCategory[]>({
    queryKey: ['/api/indirect-cost-categories']
  });

  const { data: costs = [], isLoading: loadingCosts } = useQuery<IndirectCost[]>({
    queryKey: ['/api/indirect-costs']
  });

  const { data: nonBillableHours = [], isLoading: loadingHours } = useQuery<NonBillableHours[]>({
    queryKey: ['/api/non-billable-hours']
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel']
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: InsertIndirectCostCategory) => 
      apiRequest('/api/indirect-cost-categories', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-cost-categories'] });
      setIsAddingCategory(false);
      setFormData({});
      toast({
        title: "Categoría creada",
        description: "La categoría de costo indirecto se creó exitosamente"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la categoría",
        variant: "destructive"
      });
    }
  });

  const createCostMutation = useMutation({
    mutationFn: (data: InsertIndirectCost) => 
      apiRequest('/api/indirect-costs', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs'] });
      setIsAddingCost(false);
      setFormData({});
      toast({
        title: "Costo creado",
        description: "El costo indirecto se registró exitosamente"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el costo",
        variant: "destructive"
      });
    }
  });

  const createHoursMutation = useMutation({
    mutationFn: (data: InsertNonBillableHours) => 
      apiRequest('/api/non-billable-hours', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/non-billable-hours'] });
      setIsAddingHours(false);
      setFormData({});
      toast({
        title: "Horas registradas",
        description: "Las horas no facturables se registraron exitosamente"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron registrar las horas",
        variant: "destructive"
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/indirect-cost-categories/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-cost-categories'] });
      toast({
        title: "Categoría eliminada",
        description: "La categoría se eliminó exitosamente"
      });
    }
  });

  const deleteCostMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/indirect-costs/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/indirect-costs'] });
      toast({
        title: "Costo eliminado",
        description: "El costo se eliminó exitosamente"
      });
    }
  });

  const deleteHoursMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/non-billable-hours/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/non-billable-hours'] });
      toast({
        title: "Horas eliminadas",
        description: "Las horas se eliminaron exitosamente"
      });
    }
  });

  // Calculate totals
  const totalIndirectCosts = costs.reduce((sum, cost) => {
    const amount = parseFloat(cost.amount);
    // Convert to monthly amount based on period
    let monthlyAmount = amount;
    if (cost.period === 'quarterly') {
      monthlyAmount = amount / 3;
    } else if (cost.period === 'annual') {
      monthlyAmount = amount / 12;
    }
    return sum + monthlyAmount;
  }, 0);

  const totalNonBillableHours = nonBillableHours.reduce((sum, hour) => {
    return sum + parseFloat(hour.hours);
  }, 0);

  // Calculate cost of non-billable hours based on personnel hourly rate
  const totalNonBillableCost = nonBillableHours.reduce((sum, hour) => {
    const person = personnel.find((p: Personnel) => p.id === hour.personnelId);
    if (person && person.hourlyRate) {
      return sum + (parseFloat(hour.hours) * parseFloat(person.hourlyRate));
    }
    return sum;
  }, 0);

  const handleCreateCategory = () => {
    if (!formData.name || !formData.type) return;

    createCategoryMutation.mutate({
      name: formData.name,
      description: formData.description || null,
      type: formData.type
    });
  };

  const handleCreateCost = () => {
    if (!formData.categoryId || !formData.name || !formData.amount) return;

    createCostMutation.mutate({
      categoryId: parseInt(formData.categoryId),
      name: formData.name,
      description: formData.description || null,
      amount: formData.amount.toString(),
      period: formData.period || 'monthly',
      startDate: selectedDate || new Date(),
      endDate: formData.endDate || null
    });
  };

  const handleCreateHours = () => {
    if (!formData.personnelId || !formData.categoryId || !formData.hours) return;

    createHoursMutation.mutate({
      personnelId: parseInt(formData.personnelId),
      categoryId: parseInt(formData.categoryId),
      date: selectedDate || new Date(),
      hours: formData.hours.toString(),
      description: formData.description || null
    });
  };

  if (loadingCategories || loadingCosts || loadingHours) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Costos Indirectos</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de costos no asignados directamente a proyectos
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Indirectos Mensuales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalIndirectCosts.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {costs.length} costos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas No Facturables</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalNonBillableHours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Costo: ${totalNonBillableCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total Indirecto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalIndirectCosts + totalNonBillableCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Mensual estimado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="costs">Costos Fijos</TabsTrigger>
          <TabsTrigger value="hours">Horas No Facturables</TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Categorías de Costos</h2>
            <Button onClick={() => setIsAddingCategory(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(category => (
              <Card key={category.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {category.type === 'administrative' && <Building2 className="h-5 w-5 text-blue-500" />}
                      {category.type === 'commercial' && <Users className="h-5 w-5 text-green-500" />}
                      {category.type === 'operational' && <Receipt className="h-5 w-5 text-orange-500" />}
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCategoryMutation.mutate(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    {category.type === 'administrative' && 'Administrativo'}
                    {category.type === 'commercial' && 'Comercial'}
                    {category.type === 'operational' && 'Operacional'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Fixed Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Costos Fijos e Indirectos</h2>
            <Button onClick={() => setIsAddingCost(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Costo
            </Button>
          </div>

          <div className="space-y-2">
            {costs.map(cost => {
              const category = categories.find(c => c.id === cost.categoryId);
              return (
                <Card key={cost.id}>
                  <CardContent className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                      <Tag className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{cost.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {category?.name} • {cost.recurrenceType === 'monthly' ? 'Mensual' : 'Único'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">
                          ${cost.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Desde {format(new Date(cost.startDate), 'MMM yyyy', { locale: es })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCostMutation.mutate(cost.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Non-Billable Hours Tab */}
        <TabsContent value="hours" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Horas No Facturables</h2>
            <Button onClick={() => setIsAddingHours(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Horas
            </Button>
          </div>

          <div className="space-y-2">
            {nonBillableHours.map(hour => {
              const person = personnel.find(p => p.id === hour.personnelId);
              const category = categories.find(c => c.id === hour.categoryId);
              return (
                <Card key={hour.id}>
                  <CardContent className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{person?.name || 'Desconocido'}</p>
                        <p className="text-sm text-muted-foreground">
                          {category?.name} • {hour.description || 'Sin descripción'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{hour.hours}h</p>
                        <p className="text-xs text-muted-foreground">
                          ${hour.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {format(new Date(hour.date), 'dd/MM/yyyy')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHoursMutation.mutate(hour.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>Nueva Categoría de Costo Indirecto</DialogTitle>
            <DialogDescription>
              Crea una nueva categoría para organizar los costos indirectos
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
              <Label htmlFor="category-type">Tipo</Label>
              <Select
                value={formData.type || ''}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="category-type">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrative">Administrativo</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
                  <SelectItem value="operational">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-description">Descripción</Label>
              <Input
                id="category-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingCategory(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCategory}>
              Crear Categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cost Dialog */}
      <Dialog open={isAddingCost} onOpenChange={setIsAddingCost}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Costo Indirecto</DialogTitle>
            <DialogDescription>
              Registra un nuevo costo fijo o indirecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cost-name">Nombre</Label>
              <Input
                id="cost-name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Licencia de Adobe Creative Cloud"
              />
            </div>

            <div>
              <Label htmlFor="cost-amount">Monto</Label>
              <Input
                id="cost-amount"
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="cost-recurrence">Recurrencia</Label>
              <Select
                value={formData.recurrenceType || 'monthly'}
                onValueChange={(value) => setFormData({ ...formData, recurrenceType: value })}
              >
                <SelectTrigger id="cost-recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="one-time">Pago único</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha de inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
              <Label htmlFor="cost-description">Descripción</Label>
              <Input
                id="cost-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingCost(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCost}>
              Crear Costo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Non-Billable Hours Dialog */}
      <Dialog open={isAddingHours} onOpenChange={setIsAddingHours}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Horas No Facturables</DialogTitle>
            <DialogDescription>
              Registra horas trabajadas que no se facturan a ningún proyecto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="hours-personnel">Persona</Label>
              <Select
                value={formData.personnelId || ''}
                onValueChange={(value) => setFormData({ ...formData, personnelId: value })}
              >
                <SelectTrigger id="hours-personnel">
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
                  {categories.map(category => (
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
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
              <Input
                id="hours-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ej: Reunión comercial con prospecto"
              />
            </div>

            {formData.personnelId && formData.hours && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Costo estimado</p>
                <p className="text-2xl font-bold">
                  ${(parseFloat(formData.hours || 0) * (personnel.find(p => p.id === parseInt(formData.personnelId))?.hourlyRate || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingHours(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateHours}>
              Registrar Horas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
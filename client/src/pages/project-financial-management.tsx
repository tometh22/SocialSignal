import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar, DollarSign, TrendingUp, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProjectMonthlyRevenue {
  id: number;
  projectId: number;
  year: number;
  month: number;
  amountUsd: string;
  amountArs?: string;
  exchangeRate?: string;
  invoiced: boolean;
  invoiceDate?: string;
  invoiceNumber?: string;
  collected: boolean;
  collectionDate?: string;
  revenueSource: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectPricingChange {
  id: number;
  projectId: number;
  effectiveFromYear: number;
  effectiveFromMonth: number;
  effectiveToYear?: number;
  effectiveToMonth?: number;
  monthlyAmountUsd: string;
  monthlyAmountArs?: string;
  changeReason?: string;
  scopeDescription?: string;
  createdAt: string;
}

interface ProjectFinancialSummary {
  id: number;
  projectId: number;
  totalRevenueUsd: string;
  totalInvoicedUsd: string;
  totalCollectedUsd: string;
  currentMonthlyRateUsd?: string;
  lastRevenueMonth?: number;
  lastRevenueYear?: number;
  outstandingInvoicesUsd: string;
  pendingCollectionUsd: string;
  updatedAt: string;
}

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export default function ProjectFinancialManagement() {
  const params = useParams();
  const projectId = parseInt(params.projectId || '0');
  const queryClient = useQueryClient();
  
  const [selectedRevenue, setSelectedRevenue] = useState<ProjectMonthlyRevenue | null>(null);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [isGenerateRevenueDialogOpen, setIsGenerateRevenueDialogOpen] = useState(false);

  // Forzar actualización del cache cuando el componente se monta
  useEffect(() => {
    if (projectId) {
      // Force cache refresh with current timestamp
      const timestamp = Date.now();
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/monthly-revenue`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/pricing-changes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/financial-summary`] });
      
      // Also refetch immediately
      queryClient.refetchQueries({ queryKey: [`/api/projects/${projectId}/financial-summary`] });
    }
  }, [projectId, queryClient]);

  // Queries
  const { data: monthlyRevenues = [], isLoading: revenuesLoading } = useQuery<ProjectMonthlyRevenue[]>({
    queryKey: [`/api/projects/${projectId}/monthly-revenue`],
    enabled: !!projectId,
  });

  const { data: pricingChanges = [], isLoading: pricingLoading } = useQuery<ProjectPricingChange[]>({
    queryKey: [`/api/projects/${projectId}/pricing-changes`],
    enabled: !!projectId,
  });

  const { data: financialSummary, isLoading: summaryLoading } = useQuery<ProjectFinancialSummary>({
    queryKey: [`/api/projects/${projectId}/financial-summary`],
    enabled: !!projectId,
  });

  const { data: project } = useQuery<any>({
    queryKey: [`/api/active-projects/${projectId}`],
    enabled: !!projectId,
  });

  // Mutations
  const createRevenueMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}/monthly-revenue`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/monthly-revenue`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/financial-summary`] });
      setIsRevenueDialogOpen(false);
    },
  });

  const updateRevenueMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/monthly-revenue/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/monthly-revenue`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/financial-summary`] });
      setIsRevenueDialogOpen(false);
      setSelectedRevenue(null);
    },
  });

  const createPricingChangeMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}/pricing-changes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/pricing-changes`] });
      setIsPricingDialogOpen(false);
    },
  });

  const generateRevenueMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}/generate-revenue`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/monthly-revenue`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/financial-summary`] });
      setIsGenerateRevenueDialogOpen(false);
    },
  });

  const formatCurrency = (amount: string | undefined) => {
    if (!amount) return '$0';
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getMonthName = (month: number) => {
    return MONTHS.find(m => m.value === month)?.label || month.toString();
  };

  const getStatusBadge = (revenue: ProjectMonthlyRevenue) => {
    if (revenue.collected) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Cobrado
      </Badge>;
    }
    if (revenue.invoiced) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">
        <Clock className="w-3 h-3 mr-1" />
        Facturado
      </Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
      <AlertCircle className="w-3 h-3 mr-1" />
      Pendiente
    </Badge>;
  };

  const RevenueForm = ({ revenue, onSubmit }: { 
    revenue?: ProjectMonthlyRevenue; 
    onSubmit: (data: any) => void;
  }) => {
    const [formData, setFormData] = useState({
      year: revenue?.year || new Date().getFullYear(),
      month: revenue?.month || new Date().getMonth() + 1,
      amountUsd: revenue?.amountUsd || '',
      amountArs: revenue?.amountArs || '',
      exchangeRate: revenue?.exchangeRate || '',
      invoiced: revenue?.invoiced || false,
      invoiceDate: revenue?.invoiceDate || '',
      invoiceNumber: revenue?.invoiceNumber || '',
      collected: revenue?.collected || false,
      collectionDate: revenue?.collectionDate || '',
      revenueSource: revenue?.revenueSource || 'manual_entry',
      notes: revenue?.notes || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="year">Año</Label>
            <Input
              id="year"
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              required
            />
          </div>
          <div>
            <Label htmlFor="month">Mes</Label>
            <Select value={formData.month.toString()} onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amountUsd">Monto USD</Label>
            <Input
              id="amountUsd"
              type="number"
              step="0.01"
              value={formData.amountUsd}
              onChange={(e) => setFormData({ ...formData, amountUsd: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="amountArs">Monto ARS (opcional)</Label>
            <Input
              id="amountArs"
              type="number"
              step="0.01"
              value={formData.amountArs}
              onChange={(e) => setFormData({ ...formData, amountArs: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="exchangeRate">Tipo de Cambio (opcional)</Label>
          <Input
            id="exchangeRate"
            type="number"
            step="0.01"
            value={formData.exchangeRate}
            onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="revenueSource">Fuente de Ingreso</Label>
          <Select value={formData.revenueSource} onValueChange={(value) => setFormData({ ...formData, revenueSource: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_entry">Entrada Manual</SelectItem>
              <SelectItem value="excel_automated">Excel Automatizado</SelectItem>
              <SelectItem value="contract_payment">Pago de Contrato</SelectItem>
              <SelectItem value="recurring_service">Servicio Recurrente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="invoiced"
              checked={formData.invoiced}
              onCheckedChange={(checked) => setFormData({ ...formData, invoiced: checked })}
            />
            <Label htmlFor="invoiced">Facturado</Label>
          </div>

          {formData.invoiced && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoiceDate">Fecha de Factura</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="invoiceNumber">Número de Factura</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="collected"
              checked={formData.collected}
              onCheckedChange={(checked) => setFormData({ ...formData, collected: checked })}
            />
            <Label htmlFor="collected">Cobrado</Label>
          </div>

          {formData.collected && (
            <div>
              <Label htmlFor="collectionDate">Fecha de Cobro</Label>
              <Input
                id="collectionDate"
                type="date"
                value={formData.collectionDate}
                onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
              />
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full">
          {revenue ? 'Actualizar' : 'Crear'} Ingreso
        </Button>
      </form>
    );
  };

  if (!projectId) return <div>Proyecto no encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión Financiera</h1>
          <p className="text-muted-foreground">
            {project?.quotation?.projectName} - {project?.quotation?.client?.name}
          </p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      {financialSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(financialSummary.totalRevenueUsd)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(financialSummary.totalInvoicedUsd)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(financialSummary.totalCollectedUsd)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendiente Facturación</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(financialSummary.pendingCollectionUsd)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Ingresos Mensuales</TabsTrigger>
          <TabsTrigger value="pricing">Cambios de Pricing</TabsTrigger>
          <TabsTrigger value="tools">Herramientas</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Ingresos Mensuales</h3>
            <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
              <DialogTrigger asChild>
                <Button>Agregar Ingreso</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedRevenue ? 'Editar' : 'Nuevo'} Ingreso Mensual
                  </DialogTitle>
                </DialogHeader>
                <RevenueForm
                  revenue={selectedRevenue || undefined}
                  onSubmit={(data) => {
                    if (selectedRevenue) {
                      updateRevenueMutation.mutate({ id: selectedRevenue.id, data });
                    } else {
                      createRevenueMutation.mutate(data);
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {monthlyRevenues
              .sort((a, b) => {
                // Ordenar por año y mes descendente (más reciente primero)
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
              })
              .map((revenue: ProjectMonthlyRevenue) => (
              <Card key={revenue.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedRevenue(revenue);
                      setIsRevenueDialogOpen(true);
                    }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {getMonthName(revenue.month)} {revenue.year}
                        </span>
                        {getStatusBadge(revenue)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Fuente: {revenue.revenueSource}
                      </div>
                      {revenue.notes && (
                        <div className="text-sm text-muted-foreground">
                          {revenue.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatCurrency(revenue.amountUsd)}
                      </div>
                      {revenue.amountArs && (
                        <div className="text-sm text-muted-foreground">
                          ${parseFloat(revenue.amountArs).toLocaleString()} ARS
                        </div>
                      )}
                      {revenue.invoiceNumber && (
                        <div className="text-xs text-muted-foreground">
                          Factura: {revenue.invoiceNumber}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Cambios de Pricing</h3>
            <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
              <DialogTrigger asChild>
                <Button>Agregar Cambio</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Cambio de Pricing</DialogTitle>
                </DialogHeader>
                {/* Pricing form would go here */}
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {pricingChanges.map((change: ProjectPricingChange) => (
              <Card key={change.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {getMonthName(change.effectiveFromMonth)} {change.effectiveFromYear}
                          {change.effectiveToMonth && change.effectiveToYear && 
                            ` - ${getMonthName(change.effectiveToMonth)} ${change.effectiveToYear}`
                          }
                        </span>
                      </div>
                      {change.changeReason && (
                        <div className="text-sm text-muted-foreground">
                          {change.changeReason}
                        </div>
                      )}
                      {change.scopeDescription && (
                        <div className="text-sm text-muted-foreground">
                          {change.scopeDescription}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatCurrency(change.monthlyAmountUsd)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        por mes
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Herramientas Automatizadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={isGenerateRevenueDialogOpen} onOpenChange={setIsGenerateRevenueDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Generar Ingresos Automáticamente (Este Proyecto)
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generar Ingresos Mensuales</DialogTitle>
                  </DialogHeader>
                  {/* Generate revenue form would go here */}
                </DialogContent>
              </Dialog>

              <Button 
                variant="default" 
                className="w-full"
                onClick={() => {
                  // Generar ingresos para TODOS los proyectos confirmados
                  apiRequest('/api/projects/generate-all-revenues', {
                    method: 'POST',
                  }).then((response) => {
                    // Refrescar datos después de la generación
                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/monthly-revenue`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/financial-summary`] });
                    alert(`¡Ingresos generados para todos los proyectos activos! ${response.message}`);
                  }).catch((error) => {
                    console.error('Error generating revenues for all projects:', error);
                    alert('Error al generar ingresos para todos los proyectos');
                  });
                }}
                disabled={generateRevenueMutation.isPending}
              >
                {generateRevenueMutation.isPending ? 'Procesando...' : 'Generar Ingresos para TODOS los Proyectos Activos'}
              </Button>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">Generación Automática de Ingresos:</p>
                <p>
                  Genera ingresos mensuales para TODOS los proyectos activos (no solo fee mensual), 
                  distribuyendo el valor total de cada proyecto a lo largo de su duración desde la 
                  fecha de inicio hasta el mes actual.
                </p>
                <p>
                  Esto resuelve el problema de proyectos confirmados que aparecen con $0 en 
                  gestión financiera, permitiendo análisis operacional de ingresos vs costos.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { apiRequest, authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocation } from "wouter";
import { Quotation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, CheckCircle, AlertCircle, Clock, Edit, Eye, Archive, PenLine, Plus, X, MessageCircle, Filter, Loader2, Calendar, DollarSign, TrendingUp, Zap, Users, Handshake, Briefcase, Target, ThumbsDown, TrendingDown, AlertOctagon, ChevronDown, FolderOpen, List, Send, GitBranch, Layers3 } from "lucide-react";
import { LossReasonDialog } from "@/components/quotation/loss-reason-dialog";
import { ArchivedQuotationsDialog } from "@/components/quotation/archived-quotations-dialog";
import { PageLayout } from "@/components/ui/page-layout";
import { Loader } from "@/components/ui/loader";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from 'wouter';

// Interfaces para los datos del cliente
interface Client {
  id: number;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
}

export default function ManageQuotes() {
  const [, navigate] = useLocation();
  const { formatCurrency: formatCurrencyWithConversion, exchangeRate } = useCurrency();

  const { data: quotations, isLoading, refetch, error: quotationsError } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true
  });

  const { data: clients = [], error: clientsError } = useQuery<Client[]>({
    queryKey: ["/api/clients"]
  });

  const { data: teamCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ["/api/quotations/team-counts"],
    staleTime: 30000,
  });

  const { data: managementMetadata } = useQuery<{
    negotiations: Record<number, boolean>;
    projects: Record<number, boolean>;
  }>({ queryKey: ["/api/quotations/management-metadata"] });
  const negotiationData = managementMetadata?.negotiations ?? {};
  const quotationProjects = managementMetadata?.projects ?? {};
  const { data: commercialGroups = [] } = useQuery<Array<{
    group: { id: number; groupNumber: string; name: string; clientId: number };
    client: { name: string } | null;
    status: string;
    items: Array<{ quotationId: number; projectName: string; status: string; currency: string; totalAmount: number }>;
  }>>({ queryKey: ['/api/quotation-groups'] });
  const { data: funnel } = useQuery<{
    sent: number;
    won: number;
    winRate: number;
    byStatus: Record<string, { count: number; value: number }>;
  }>({
    queryKey: ['/api/quotation-analytics/funnel'],
  });
  const { data: professionalAnalytics } = useQuery<{
    byMotion: Array<{ key: string; count: number; won: number; value: number }>;
    byBlueprint: Array<{ key: number | null; count: number; won: number; value: number }>;
    byDuration: Array<{ key: string | null; count: number; won: number; value: number }>;
    byMarket: Array<{ key: string; count: number; won: number; value: number }>;
    byPriceBand: Array<{ key: string; count: number; won: number; value: number }>;
    byLossReason: Array<{ key: string | null; count: number }>;
  }>({ queryKey: ['/api/quotation-analytics/professional'] });
  const { data: marginRisk } = useQuery<{
    evaluated: number;
    applicable: number;
    atRisk: Array<{
      quotationId: number;
      quotationNumber: string | null;
      projectName: string;
      clientName: string | null;
      quotationCurrency: string;
      currentMarginPercentage: number;
      originalMarginPercentage: number;
      marginErosionPoints: number;
      severity: 'watch' | 'critical';
    }>;
  }>({ queryKey: ['/api/quotations/margin-drift-summary'] });
  const queryClient = useQueryClient();
  const { data: pendingIpcAdjustments = [] } = useQuery<PendingIpcAdjustment[]>({ queryKey: ['/api/quotation-price-adjustments/pending'] });


  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [deletingQuoteId, setDeletingQuoteId] = useState<number | null>(null);
  const [lossReasonQuote, setLossReasonQuote] = useState<Quotation | null>(null);
  const [markingLost, setMarkingLost] = useState(false);
  const [expandedQuoteClients, setExpandedQuoteClients] = useState<Set<string>>(new Set());
  const [quoteView, setQuoteView] = useState<"folders" | "list">("folders");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isOperations } = usePermissions();
  // El servidor exige requirePermission("quotations_approve", "operations")
  // para aprobar/rechazar un ajuste de IPC — "quotations_approve" no es una
  // AppSection (esas son secciones amplias de navegación), así que se lee
  // directo del array crudo de permisos del usuario, igual que hace el
  // propio hook por dentro.
  const canApproveIpcAdjustments = isOperations || Boolean((user as any)?.permissions?.includes('quotations_approve'));

  // Función auxiliar para obtener el nombre del cliente por ID
  const getClientName = (clientId: number) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : `Cliente ID: ${clientId}`;
  };

  // Función auxiliar para obtener el cliente completo por ID
  const getClient = (clientId: number) => {
    return clients.find(c => c.id === clientId);
  };

  // Filter quotations based on search term and status
  // Then sort by creation date (most recent first)
  const filteredQuotations = quotations
    ? quotations
        .filter((quote) => {
          const matchesSearch = quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
          return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
          // Sort by createdAt date in descending order (most recent first)
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        })
    : [];
  const groupedQuotationIds = new Set(commercialGroups.flatMap((entry) => entry.items.map((item) => item.quotationId)));
  const standaloneQuotations = filteredQuotations.filter((quote) => !groupedQuotationIds.has(quote.id));
  const quotationGroups = Object.entries(
    standaloneQuotations.reduce<Record<string, Quotation[]>>((groups, quote) => {
      const clientName = getClient(quote.clientId)?.name || "Cliente sin identificar";
      (groups[clientName] ??= []).push(quote);
      return groups;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b, "es"));

  const handleStatusChange = async () => {
    if (!selectedQuote || !newStatus) return;

    try {
      await apiRequest(
        `/api/quotations/${selectedQuote.id}/status`,
        "PATCH",
        { status: newStatus }
      );

      toast({
        title: "Estado actualizado",
        description: `El estado de la cotización "${selectedQuote.projectName}" ha sido actualizado a ${translateStatus(newStatus)}.`,
      });

      setDialogOpen(false);

      if (newStatus === 'approved') {
        toast({
          title: "Cotización lista",
          description: "Si corresponde, creá el proyecto desde Proyectos.",
        });
      }

      refetch();
    } catch (error) {
      console.error(`[QUOTES] ❌ Error en actualización de estado:`, {
        quotationId: selectedQuote.id,
        oldStatus: selectedQuote.status,
        newStatus: newStatus,
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Error al actualizar estado",
        description: `No se pudo actualizar el estado de la cotización "${selectedQuote.projectName}". ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive",
      });
    }
  };

  const openStatusDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setNewStatus(null);
    setTimeout(() => {
      setDialogOpen(true);
    }, 10);
  };

  const openDeleteDialog = (quote: Quotation) => {
    setSelectedQuote(quote);
    setDeleteDialogOpen(true);
  };

  const handleDeleteQuotation = async () => {
    if (!selectedQuote) return;

    try {
      setDeletingQuoteId(selectedQuote.id);

      const response = await authFetch(`/api/quotations/${selectedQuote.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      let data;
      try {
        data = await response.json();
      } catch {
        data = { success: response.ok, message: response.statusText };
      }

      if (response.ok && data.success) {

        setTimeout(() => {
          toast({
            title: "Cotización archivada",
            description: `La cotización "${selectedQuote.projectName}" se archivó sin borrar su historial comercial.`,
          });

          refetch();
          setDeleteDialogOpen(false);
          setDeletingQuoteId(null);
        }, 800);
      } else {
        console.error(`[QUOTES] ❌ Error al archivar:`, {
          status: response.status,
          statusText: response.statusText,
          data: data,
          quotationId: selectedQuote.id
        });

        setDeletingQuoteId(null);
        toast({
          title: "Error al archivar",
          description: data.message || `No se pudo archivar la cotización "${selectedQuote.projectName}".`,
          variant: "destructive",
        });
      }
    } catch (error) {
      setDeletingQuoteId(null);
      console.error(`[QUOTES] ❌ Error crítico al archivar cotización:`, {
        quotationId: selectedQuote.id,
        quotationName: selectedQuote.projectName,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Error crítico",
        description: `Ocurrió un error inesperado al intentar archivar la cotización "${selectedQuote.projectName}". ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive",
      });
    }
  };

  const getExpiryBadge = (quote: Quotation) => {
    if (!quote.expiresAt || !['sent', 'viewed', 'in-negotiation'].includes(quote.status)) return null;
    const exp = new Date(quote.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs inline-flex items-center gap-1 px-2 py-0.5">
          <AlertOctagon className="h-3 w-3" /> Vencida
        </Badge>
      );
    }
    if (daysLeft <= 7) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs inline-flex items-center gap-1 px-2 py-0.5">
          <Clock className="h-3 w-3" /> Vence en {daysLeft}d
        </Badge>
      );
    }
    return null;
  };

  const isQuoteExpired = (quote: { status: string; expiresAt?: string | Date | null }) => {
    return quote.expiresAt
      && ["sent", "viewed", "in-negotiation"].includes(quote.status)
      && new Date(quote.expiresAt) < new Date();
  };

  const getStatusBadge = (status: string, quote?: { status: string; expiresAt?: string | Date | null }) => {
    if (quote && isQuoteExpired(quote)) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md">
          <AlertOctagon className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Vencida</span>
        </Badge>
      );
    }

    const statusConfig = {
      'approved': {
        variant: 'default' as const,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        icon: CheckCircle,
        label: 'Aceptada por cliente'
      },
      'pending': {
        variant: 'secondary' as const,
        className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        icon: Clock,
        label: 'Aprobación interna'
      },
      'internally-approved': {
        variant: 'outline' as const,
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        icon: CheckCircle,
        label: 'Aprobada internamente'
      },
      'sent': {
        variant: 'outline' as const,
        className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        icon: Send,
        label: 'Enviada'
      },
      'viewed': {
        variant: 'outline' as const,
        className: 'bg-violet-50 text-violet-700 border-violet-200',
        icon: Eye,
        label: 'Vista por cliente'
      },
      'rejected': {
        variant: 'destructive' as const,
        className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
        icon: X,
        label: 'Rechazada'
      },
      'in-negotiation': {
        variant: 'outline' as const,
        className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
        icon: MessageCircle,
        label: 'En Negociación'
      },
      'draft': {
        variant: 'outline' as const,
        className: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
        icon: Edit,
        label: 'Borrador'
      },
      'expired': { variant: 'outline' as const, className: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertOctagon, label: 'Vencida' },
      'cancelled': { variant: 'outline' as const, className: 'bg-slate-50 text-slate-600 border-slate-200', icon: X, label: 'Cancelada' },
      'superseded': { variant: 'outline' as const, className: 'bg-slate-50 text-slate-500 border-slate-200', icon: GitBranch, label: 'Reemplazada' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge
        variant={config.variant}
        className={`${config.className} inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border whitespace-nowrap`}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{config.label}</span>
      </Badge>
    );
  };

  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Pendiente',
      'internally-approved': 'Aprobada internamente',
      'sent': 'Enviada',
      'viewed': 'Vista por cliente',
      'approved': 'Aceptada por cliente',
      'rejected': 'Rechazada',
      'in-negotiation': 'En Negociación',
      'draft': 'Borrador',
      'expired': 'Vencida',
      'cancelled': 'Cancelada',
      'superseded': 'Reemplazada',
    };
    return statusMap[status] || status;
  };

  const handleEditQuotation = (quotation: Quotation) => {
    navigate(`/optimized-quote/${quotation.id}`);
  };

  // Calculate statistics
  // Helpers para expiración
  const isExpired = (quote: Quotation) =>
    !!quote.expiresAt
    && new Date(quote.expiresAt) < new Date()
    && ['sent', 'viewed', 'in-negotiation'].includes(quote.status);

  const statsSource = quotations || [];
  const stats = {
    total: statsSource.length,
    approved: statsSource.filter(q => q.status === 'approved').length,
    pending: statsSource.filter(q => q.status === 'pending').length,
    rejected: statsSource.filter(q => q.status === 'rejected').length,
    expired: statsSource.filter(isExpired).length,
    inNegotiation: statsSource.filter(q => q.status === 'in-negotiation').length,
    totalValueARS: statsSource.reduce((sum, q) => {
      const fx = Number(q.exchangeRateAtQuote) || Number(q.usdExchangeRate) || exchangeRate;
      return sum + (q.quotationCurrency === 'USD' ? q.totalAmount * fx : q.totalAmount);
    }, 0),
    conversionRate: funnel?.winRate ?? 0,
    rejectionRate: (funnel?.sent || 0) > 0
      ? ((funnel?.byStatus?.rejected?.count || 0) / (funnel?.sent || 1)) * 100
      : 0,
  };

  // Win/Loss reasons breakdown
  const lossReasonBreakdown = (quotations || [])
    .filter(q => q.status === 'rejected' && q.lossReason)
    .reduce((acc: Record<string, number>, q) => {
      const key = (q.lossReason as string).split(' — ')[0];
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const handleMarkAsLost = async (lossReason: string) => {
    if (!lossReasonQuote) return;
    setMarkingLost(true);
    try {
      await apiRequest(`/api/quotations/${lossReasonQuote.id}/status`, { method: 'PATCH', body: { status: 'rejected', lossReason } });
      toast({ title: "Cotización marcada como perdida", description: `Motivo: ${lossReason}` });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    } finally {
      setMarkingLost(false);
      setLossReasonQuote(null);
    }
  };

    const formatCurrency = (amount: number, curr: string = 'ARS') => {
        const isUSD = curr.toUpperCase() === 'USD';
        return `$${amount.toLocaleString(isUSD ? 'en-US' : 'es-AR', {
          minimumFractionDigits: isUSD ? 2 : 0,
          maximumFractionDigits: isUSD ? 2 : 0,
        })} ${curr}`;
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'approved':
                return 'success';
            case 'pending':
                return 'secondary';
            case 'rejected':
                return 'destructive';
            default:
                return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved':
                return 'Aprobada';
            case 'pending':
                return 'Pendiente';
            case 'rejected':
                return 'Rechazada';
            case 'in-negotiation':
                return 'En Negociación';
            case 'draft':
                return 'Borrador';
            default:
                return 'Desconocido';
        }
    };

  return (
    <>
      <PageLayout
      title="Gestión de Cotizaciones"
      description="Administra y da seguimiento a todas las cotizaciones del sistema"
      breadcrumbs={[
        { label: "Gestión de Cotizaciones", current: true }
      ]}
      actions={
        <Button
          onClick={() => navigate("/optimized-quote")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cotización
        </Button>
      }
    >

        <div className="relative z-10 min-w-0">
          <MetricGrid className="mb-6" minColumnWidth="11rem">
            <MetricCard
              label="Total"
              value={stats.total.toLocaleString("es-AR")}
              icon={<FileText className="h-5 w-5" />}
              tone="primary"
              valueLabel={`${stats.total} cotizaciones en total`}
            />
            <MetricCard
              label="Aprobadas"
              value={stats.approved.toLocaleString("es-AR")}
              icon={<CheckCircle className="h-5 w-5" />}
              tone="success"
              valueLabel={`${stats.approved} cotizaciones aprobadas`}
            />
            <MetricCard
              label="Pendientes"
              value={stats.pending.toLocaleString("es-AR")}
              icon={<Clock className="h-5 w-5" />}
              tone="warning"
              valueLabel={`${stats.pending} cotizaciones pendientes`}
            />
            <MetricCard
              label="Valor total"
              value={`ARS ${stats.totalValueARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
              icon={<DollarSign className="h-5 w-5" />}
              tone="info"
              valueSize="compact"
              valueLabel={`Valor total en pesos: ${stats.totalValueARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
            />
            <MetricCard
              label="Conversión"
              value={`${stats.conversionRate.toFixed(1)}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              detail={`${funnel?.won ?? stats.approved} aceptadas de ${funnel?.sent ?? 0} enviadas`}
              tone="success"
              valueLabel={`Tasa de conversión: ${stats.conversionRate.toFixed(1)} por ciento`}
            />
            <MetricCard
              label="Rechazos"
              value={`${stats.rejectionRate.toFixed(1)}%`}
              icon={<X className="h-5 w-5" />}
              detail={`${stats.rejected} rechazadas de ${stats.total}`}
              tone="danger"
              valueLabel={`Tasa de rechazo: ${stats.rejectionRate.toFixed(1)} por ciento`}
            />
          </MetricGrid>

          {professionalAnalytics?.byMotion?.length ? <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3"><div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600"><GitBranch className="h-3.5 w-3.5" /> Conversión por modalidad comercial <span className="font-normal normal-case text-slate-500">· demos excluidas</span></div><div className="flex flex-wrap gap-2">{professionalAnalytics.byMotion.map((item) => <Badge key={item.key} variant="outline" className="bg-white px-3 py-1.5">{motionLabel(item.key)} · {item.count ? ((item.won / item.count) * 100).toFixed(0) : 0}% <span className="ml-1 text-slate-400">({item.won}/{item.count})</span></Badge>)}</div></div> : null}

          {/* Cuentas en riesgo: fee mensual/programa anual cuyo margen real
              (con tarifas vigentes hoy) se alejó del margen cotizado. El
              costo se paga en pesos y el precio quedó fijo en dólares — ver
              shared/utils/quotation-margin-drift.ts. Sólo diagnóstico. */}
          {marginRisk && marginRisk.atRisk.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                <TrendingDown className="h-3.5 w-3.5" /> Cuentas en riesgo
                <span className="font-normal normal-case text-slate-500">· margen erosionado vs. lo cotizado, {marginRisk.applicable} cuentas recurrentes evaluadas</span>
              </div>
              <div className="space-y-1.5">
                {marginRisk.atRisk.map((item) => (
                  <button
                    key={item.quotationId}
                    type="button"
                    onClick={() => navigate(`/quotations/${item.quotationId}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-left transition hover:border-amber-300"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.clientName || 'Sin cliente'} · {item.projectName}</p>
                      <p className="text-xs text-slate-500">Margen cotizado {item.originalMarginPercentage.toFixed(1)}% → hoy {item.currentMarginPercentage.toFixed(1)}%</p>
                    </div>
                    <Badge className={cn('shrink-0', item.severity === 'critical' ? 'bg-red-100 text-red-800 hover:bg-red-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100')}>
                      <AlertOctagon className="mr-1 h-3 w-3" />
                      -{item.marginErosionPoints.toFixed(1)}pts
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ajustes de precio por IPC pendientes de aprobación (fee mensual/
              programa anual en ARS con la cláusula desde que se cotizaron).
              Ver server/jobs/ipc-price-adjustments.ts. Aprobar aplica el
              precio nuevo y avisa al cliente por email; rechazar no cambia
              nada — el próximo ciclo se vuelve a evaluar solo. */}
          {pendingIpcAdjustments.length > 0 && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                <TrendingUp className="h-3.5 w-3.5" /> Ajustes de precio por IPC pendientes
                <span className="font-normal normal-case text-slate-500">· sólo contratos en ARS con cláusula desde el origen</span>
              </div>
              <div className="space-y-1.5">
                {pendingIpcAdjustments.map((item) => (
                  <IpcAdjustmentRow key={item.id} item={item} canApprove={canApproveIpcAdjustments} />
                ))}
              </div>
            </div>
          )}

          {/* Win/Loss insights bar */}
          {Object.keys(lossReasonBreakdown).length > 0 && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500 uppercase tracking-wide shrink-0">
                <TrendingDown className="h-3.5 w-3.5" /> Motivos de pérdida
              </div>
              {Object.entries(lossReasonBreakdown).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                <span key={reason} className="inline-flex items-center gap-1 text-xs bg-white border border-red-200 text-red-600 rounded-full px-2.5 py-1">
                  {reason} <span className="font-semibold">{count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Expired quotes alert */}
          {stats.expired > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center gap-3">
              <AlertOctagon className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700">
                <span className="font-semibold">{stats.expired}</span> cotización{stats.expired !== 1 ? 'es' : ''} vencida{stats.expired !== 1 ? 's' : ''} sin respuesta del cliente
              </span>
            </div>
          )}

          {/* Filters mejorados */}
          <Card className="mind-panel mb-6">
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    placeholder="Buscar por nombre de proyecto..."
                    className="h-11 bg-slate-50/70 pl-12 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 bg-slate-50/70 text-sm">
                      <Filter className="h-4 w-4 mr-2 text-gray-400" />
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Estados</SelectItem>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="internally-approved">Aprobada internamente</SelectItem>
                      <SelectItem value="sent">Enviada</SelectItem>
                      <SelectItem value="viewed">Vista por cliente</SelectItem>
                      <SelectItem value="approved">Aprobada</SelectItem>
                      <SelectItem value="rejected">Rechazada</SelectItem>
                      <SelectItem value="in-negotiation">En Negociación</SelectItem>
                      <SelectItem value="expired">Vencida</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Card */}
          {commercialGroups.length > 0 && (
            <Card className="mind-panel mb-6 overflow-hidden">
              <CardHeader className="border-b border-slate-200 bg-slate-950 py-4 text-white"><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-5 w-5 text-indigo-300" />Cliente → grupos de propuestas → cotizaciones</CardTitle></CardHeader>
              <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
                {commercialGroups.filter((entry) => entry.items.some((item) => item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter))).map((entry) => (
                  <button key={entry.group.id} type="button" onClick={() => navigate(`/quotation-groups/${entry.group.id}`)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{entry.client?.name || 'Cliente'}</p><h3 className="mt-1 font-semibold text-slate-950">{entry.group.name}</h3><p className="mt-1 text-xs text-slate-500">{entry.group.groupNumber} · {entry.items.length} propuestas</p></div><Badge variant="outline">{entry.status.replaceAll('_', ' ')}</Badge></div>
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">{entry.items.map((item) => <div key={item.quotationId} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-700">{item.projectName}</span><span className="shrink-0 font-medium text-slate-900">{formatCurrency(item.totalAmount, item.currency)}</span></div>)}</div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="mind-panel mb-8 overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50/70 py-4">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center justify-between gap-3">
                <span className="flex items-center"><Users className="h-5 w-5 mr-2 text-slate-600" />Lista de Cotizaciones</span>
                <span className="flex items-center gap-2">
                  <ArchivedQuotationsDialog />
                  <span className="flex items-center rounded-md border bg-white p-0.5">
                    <Button type="button" variant={quoteView === "folders" ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={() => setQuoteView("folders")}>
                      <FolderOpen className="mr-1 h-3.5 w-3.5" />Carpetas
                    </Button>
                    <Button type="button" variant={quoteView === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={() => setQuoteView("list")}>
                      <List className="mr-1 h-3.5 w-3.5" />Lista
                    </Button>
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader variant="dots" size="lg" text="Cargando cotizaciones..." />
                </div>
              ) : filteredQuotations.length > 0 ? (

                <div className="space-y-7 p-3 sm:p-6">
                  {(quoteView === "folders" ? quotationGroups : [["__all__", standaloneQuotations] as [string, Quotation[]]]).map(([clientName, clientQuotes]) => (
                    <section key={clientName}>
                      {quoteView === "folders" && <button className="mb-3 flex w-full items-center gap-3 border-b border-slate-200 pb-2 text-left" onClick={() => setExpandedQuoteClients((previous) => {
                        const next = new Set(previous);
                        next.has(clientName) ? next.delete(clientName) : next.add(clientName);
                        return next;
                      })}>
                        <ChevronDown className={cn("h-4 w-4 -rotate-90 transition-transform", expandedQuoteClients.has(clientName) && "rotate-0")} />
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">
                          {clientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{clientName}</h3>
                          <p className="text-xs text-slate-500">{clientQuotes.length} cotizaciones</p>
                        </div>
                      </button>}
                      {(quoteView === "list" || expandedQuoteClients.has(clientName)) && <div className="grid grid-cols-1 gap-4">
                  {clientQuotes.map((quote, index) => {
                    const client = getClient(quote.clientId);
                    const createdDate = new Date(quote.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });

                    const clientInitials = client?.name
                      ?.split(' ')
                      .map(word => word[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || quote.projectName.slice(0, 2).toUpperCase();

                    const teamMembersCount = teamCounts[quote.id] ?? 0;

                    return (
                      <Card key={quote.id} className="mind-interactive-card group relative overflow-hidden">
                        {/* Status stays in document flow so variable badge counts never cover quotation data. */}
                        <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border/60 bg-slate-50/60 px-4 py-3">
                          {getStatusBadge(quote.status, quote)}
                          {!isQuoteExpired(quote) && getExpiryBadge(quote)}
                          {(quote as any).leadId && (
                            <Link href={`/crm/${(quote as any).leadId}`}>
                              <Badge
                                variant="outline"
                                className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-medium px-3 py-1 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-indigo-100 cursor-pointer"
                              >
                                <Target className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>Lead CRM</span>
                              </Badge>
                            </Link>
                          )}
                          {negotiationData[quote.id] && quote.status === 'approved' && (
                            <Badge 
                              variant="outline" 
                              className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-medium px-3 py-1 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Handshake className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Negociada</span>
                            </Badge>
                          )}
                          {quote.status === 'approved' && quotationProjects[quote.id] && (
                            <Badge 
                              variant="outline" 
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium px-3 py-1 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Proyecto Activo</span>
                            </Badge>
                          )}
                        </div>

                        <div className="flex">
                          {/* Status color indicator */}
                          <div className={`w-1.5 ${
                            quote.status === 'approved' ? 'bg-gradient-to-b from-emerald-500 to-emerald-600' :
                            quote.status === 'pending' ? 'bg-gradient-to-b from-amber-500 to-amber-600' :
                            quote.status === 'in-negotiation' ? 'bg-gradient-to-b from-purple-500 to-purple-600' :
                            quote.status === 'rejected' ? 'bg-gradient-to-b from-red-500 to-red-600' :
                            'bg-gradient-to-b from-gray-400 to-gray-500'
                          }`} />
                          
                          <CardContent className="flex-1 p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              {/* Main content area */}
                              <div className="flex items-start gap-4 flex-1">
                                {/* Client Logo */}
                                <div className="flex-shrink-0">
                                  {client?.logoUrl ? (
                                    <div className="w-14 h-14 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                                      <img 
                                        src={client.logoUrl} 
                                        alt={`${client.name} logo`} 
                                        className="w-full h-full object-contain p-1"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const nextElement = e.currentTarget.nextElementSibling;
                                          if (nextElement && nextElement instanceof HTMLElement) {
                                            nextElement.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 hidden items-center justify-center">
                                        <span className="text-white font-bold text-base">
                                          {clientInitials}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                      <span className="text-white font-bold text-base">
                                        {clientInitials}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Project Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h3 className="font-bold text-base text-gray-900 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                                        {quote.projectName}
                                      </h3>
                                      <p className="text-sm text-gray-600">
                                        {getClientName(quote.clientId)}
                                      </p>
                                    </div>
                                    

                                  </div>

                                  {/* Additional info row */}
                                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" />
                                      {createdDate}
                                    </span>
                                    {quote.projectType && (
                                      <span className="flex items-center gap-1">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        {quote.projectType === 'credit-pack' ? 'Bolsa de créditos' : quote.projectType === 'always-on' ? 'Always-On' :
                                         quote.projectType === 'monitoring' ? 'Monitoreo' : 'One-Shot'}
                                      </span>
                                    )}
                                    {teamMembersCount > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {teamMembersCount} miembros
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Value and actions section */}
                              <div className="flex w-full flex-col items-start gap-3 border-t border-border/60 pt-4 lg:w-auto lg:items-end lg:border-0 lg:pt-0">
                                <div className="text-right">
                                  {/* Price section with better visual hierarchy */}
                                  <div className="mb-3">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                      {quote.projectType === 'always-on' ? 'Precio Mensual' : 'Precio Total'}
                                    </p>
                                    <p className="text-2xl font-bold text-gray-900">
                                      {(() => {
                                        // Mostrar cotización en su moneda original
                                        const currency = quote.quotationCurrency || 'ARS';
                                        return formatCurrencyWithConversion(quote.totalAmount, currency);
                                      })()}
                                    </p>
                                  </div>
                                  
                                  {/* Cost and Markup info with better styling */}
                                  <div className="space-y-2 border-t pt-2">
                                    <div className="flex items-center justify-between gap-8 text-xs">
                                      <span className="text-gray-500">Costo:</span>
                                      <span className="font-medium text-gray-700">
                                        {(() => {
                                          const currency = quote.quotationCurrency || 'ARS';
                                          return formatCurrencyWithConversion(quote.baseCost, currency);
                                        })()}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-8 text-xs">
                                      <span className="text-gray-500">Markup:</span>
                                      <span className={`font-bold ${
                                        (() => {
                                          const realFactor = Number(quote.marginFactor) || 1;
                                          return realFactor >= 2.5 ? 'text-emerald-600' :
                                                 realFactor >= 2.0 ? 'text-blue-600' :
                                                 realFactor >= 1.5 ? 'text-amber-600' :
                                                 'text-red-600';
                                        })()
                                      }`}>
                                        {(() => {
                                          const realFactor = Number(quote.marginFactor) || 1;
                                          const markupPercentage = ((realFactor - 1) * 100).toFixed(0);
                                          return `${markupPercentage}% (${realFactor.toFixed(1)}x)`;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/quotation/${quote.id}`)}
                                    className="h-8 px-3 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                                    Ver
                                  </Button>
                                  
                                  {quote.status === 'draft' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditQuotation(quote)}
                                      className="h-8 px-3 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50"
                                    >
                                      <PenLine className="h-3.5 w-3.5 mr-1.5" />
                                      Editar
                                    </Button>
                                  )}
                                  
                                  {quote.status === 'approved' && !quotationProjects[quote.id] && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate("/active-projects")}
                                      className="h-8 px-3 text-xs font-medium"
                                    >
                                      <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                                      Ir a Proyectos
                                    </Button>
                                  )}
                                  
                                  <div className="ml-2 border-l border-gray-200 pl-2 flex items-center">
                                    {['sent', 'viewed', 'in-negotiation'].includes(quote.status) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLossReasonQuote(quote)}
                                        title="Marcar como perdida"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                                      >
                                        <ThumbsDown className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openStatusDialog(quote)}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeleteDialog(quote)}
                                      disabled={deletingQuoteId === quote.id}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                    >
                                      {deletingQuoteId === quote.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Archive className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
                      </div>}
                    </section>
                  ))}
                </div>

              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-10 w-10 text-slate-400" />
                  </div>
                  {searchTerm || statusFilter !== "all" ? (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        No se encontraron cotizaciones con los filtros aplicados
                      </h3>
                      <p className="text-slate-600 mb-6">
                        Intenta con otro término de búsqueda o cambia el filtro de estado.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
                        className="border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Limpiar filtros
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        No hay cotizaciones disponibles
                      </h3>
                      <p className="text-slate-600 mb-6">
                        Comienza creando tu primera cotización.
                      </p>
                      <Button onClick={() => navigate("/optimized-quote")} className="bg-slate-700 hover:bg-slate-800">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Primera Cotización
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageLayout>

      {/* Dialogs remain the same but with improved styling */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center">
              <Edit className="h-5 w-5 mr-2 text-indigo-600" />
              Actualizar Estado de Cotización
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Cambia el estado de esta cotización. Actualizarla a "En Negociación" permite realizar ajustes adicionales.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Estado Actual:</h4>
              {selectedQuote && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {getStatusBadge(selectedQuote.status)}
                </div>
              )}
            </div>

            {(() => {
              const VALID_TRANSITIONS: Record<string, Array<{ status: string; label: string; className: string }>> = {
                "draft":          [
                  { status: "pending", label: "Solicitar aprobación interna", className: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" },
                  { status: "cancelled", label: "Cancelar", className: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" },
                ],
                "pending":        [
                  { status: "cancelled", label: "Cancelar solicitud", className: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" },
                ],
                "internally-approved": [{ status: "cancelled", label: "Cancelar antes del envío", className: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" }],
                "sent": [{ status: "in-negotiation", label: "Registrar negociación", className: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" }, { status: "cancelled", label: "Cancelar", className: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" }],
                "viewed": [{ status: "in-negotiation", label: "Registrar negociación", className: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" }, { status: "cancelled", label: "Cancelar", className: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" }],
                "in-negotiation": [
                  { status: "cancelled", label: "Cancelar", className: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" },
                ],
                "rejected": [],
                "expired": [],
                "cancelled": [],
                "approved": [],
                "superseded": [],
              };
              const currentStatus = selectedQuote?.status || "draft";
              const transitions = VALID_TRANSITIONS[currentStatus] || [];
              return (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Cambiar a:</h4>
                  {transitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No hay transiciones disponibles desde este estado.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {transitions.map(t => (
                        <button
                          key={t.status}
                          onClick={() => setNewStatus(t.status)}
                          className={cn(
                            "px-3 py-2 rounded-xl border text-xs font-medium transition-all",
                            t.className,
                            newStatus === t.status && "ring-2 ring-indigo-500 ring-offset-1"
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleStatusChange}
              disabled={!newStatus || newStatus === selectedQuote?.status}
            >
              Actualizar Estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recoverable archive dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-lg font-semibold">
              <Archive className="h-5 w-5 mr-2 text-slate-600" />
              ¿Archivar cotización?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              <div>
                <p className="mb-4">Se ocultará del listado activo, pero conservará revisiones, aprobaciones, decisiones y proyectos vinculados.</p>
                {selectedQuote && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="font-medium text-sm mb-2">Detalles de la cotización:</p>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Proyecto: <span className="font-semibold text-gray-900">{selectedQuote.projectName}</span></p>
                      <p>Número: <span className="font-semibold text-gray-900">{selectedQuote.quotationNumber || `#${selectedQuote.id}`}</span></p>
                      <p>Estado: {getStatusBadge(selectedQuote.status)}</p>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuotation}
              className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loss Reason Dialog */}
      <LossReasonDialog
        open={!!lossReasonQuote}
        onOpenChange={(open) => { if (!open) setLossReasonQuote(null); }}
        quotationName={lossReasonQuote?.projectName || ''}
        onConfirm={handleMarkAsLost}
        isLoading={markingLost}
      />
    </>
  );
}

function motionLabel(value: string) {
  return ({ new_business: "Nuevo negocio", renewal: "Renovación", expansion: "Expansión", demo: "Demo" } as Record<string, string>)[value] || value;
}

const ipcMoneyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type PendingIpcAdjustment = {
  id: number;
  quotationId: number;
  quotationNumber: string | null;
  projectName: string;
  clientName: string | null;
  clientContactEmail: string | null;
  cadence: 'ipc_quarterly' | 'annual_review';
  periodStart: string;
  periodEnd: string;
  ipcAccumulatedPercentage: number;
  previousTotalAmount: number;
  proposedTotalAmount: number;
};

// Fila propia (no un .map() plano) a propósito: cada fila necesita su propio
// estado de mutación. Con una única mutation compartida para toda la lista,
// aprobar la fila A y después la B hacía que el spinner/disabled de A se
// apagara apenas arrancaba B (mutation.variables sólo recuerda el último
// llamado), permitiendo un doble click sobre A mientras seguía en vuelo.
function IpcAdjustmentRow({ item, canApprove }: { item: PendingIpcAdjustment; canApprove: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: () => apiRequest(`/api/quotation-price-adjustments/${item.id}/approve`, 'POST'),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotation-price-adjustments/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      toast({
        title: result?.emailError ? 'Precio actualizado, pero hay que avisar a mano' : 'Ajuste aplicado',
        description: result?.emailError ? `Precio actualizado. ${result.emailError}` : 'Precio actualizado y cliente notificado por email.',
        variant: result?.emailError ? 'destructive' : 'default',
      });
    },
    onError: (error: any) => toast({ title: 'No se pudo aplicar el ajuste', description: error?.message || 'Intentá de nuevo.', variant: 'destructive' }),
  });
  const reject = useMutation({
    mutationFn: () => apiRequest(`/api/quotation-price-adjustments/${item.id}/reject`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotation-price-adjustments/pending'] });
      toast({ title: 'Ajuste rechazado', description: 'No se modificó el precio de la cotización.' });
    },
    onError: (error: any) => toast({ title: 'No se pudo rechazar el ajuste', description: error?.message || 'Intentá de nuevo.', variant: 'destructive' }),
  });
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{item.clientName || 'Sin cliente'} · {item.projectName}</p>
        <p className="text-xs text-slate-500">
          {ipcMoneyFormatter.format(item.previousTotalAmount)} → {ipcMoneyFormatter.format(item.proposedTotalAmount)} (+{item.ipcAccumulatedPercentage.toFixed(2)}% IPC · {item.periodStart} a {item.periodEnd})
          {!item.clientContactEmail && <span className="ml-1 text-amber-700">· sin email de contacto cargado</span>}
        </p>
      </div>
      {canApprove ? (
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => reject.mutate()}>
            {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rechazar'}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => approve.mutate()}>
            {approve.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
            Aprobar y aplicar
          </Button>
        </div>
      ) : (
        <p className="shrink-0 text-xs text-slate-400">Necesitás permiso de aprobación</p>
      )}
    </div>
  );
}

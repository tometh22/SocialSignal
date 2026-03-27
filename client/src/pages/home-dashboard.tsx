import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { computeAlerts, THRESHOLDS, type Alert } from "@/lib/smart-alerts";
import {
  Briefcase, FileText, Target, Users, ClipboardList, BarChart2,
  Plus, TrendingUp, Gauge, CalendarCheck, LayoutDashboard, Building2,
  CheckSquare, Calendar, ArrowRight, AlertTriangle, AlertCircle,
  Info, Lightbulb, ChevronRight, Zap
} from "lucide-react";

interface QuickLink {
  href: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  permission?: string;
}

export default function HomeDashboard() {
  const { user } = useAuth();
  const { isOperations, hasPermission } = usePermissions();

  const { data: projectCount } = useQuery<number>({
    queryKey: ["/api/active-projects/count"],
    queryFn: () => fetch("/api/active-projects/count", { credentials: "include" })
      .then(r => r.json()).then(d => d.count || 0).catch(() => 0),
  });

  const { data: quotationStats } = useQuery<any>({
    queryKey: ["/api/quotations/stats"],
    queryFn: () => fetch("/api/quotations", { credentials: "include" })
      .then(r => r.json()).then((qs: any[]) => ({
        total: qs?.length || 0,
        pending: qs?.filter((q: any) => q.status === 'pending').length || 0,
        draft: qs?.filter((q: any) => q.status === 'draft').length || 0,
      })).catch(() => ({ total: 0, pending: 0, draft: 0 })),
    enabled: hasPermission('quotations'),
  });

  // Fetch projects for smart alerts
  const { data: projectsRaw } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: () => fetch("/api/projects?period=current_month", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    enabled: hasPermission('projects'),
  });

  // Compute alerts from project data
  const projectsForAlerts = (projectsRaw || []).map((p: any) => ({
    projectId: p.projectId || p.id,
    projectName: p.projectName || p.name || 'Sin nombre',
    clientName: p.clientName || '',
    revenue: p.metrics?.revenueDisplay || p.metrics?.revenue || 0,
    cost: p.metrics?.costDisplay || p.metrics?.cost || 0,
    markup: p.metrics?.markup || p.metrics?.markupRatio || 0,
    margin: p.metrics?.margin || 0,
    budget: p.metrics?.budget || 0,
    budgetUsed: p.metrics?.budgetUtilization || 0,
    totalHours: p.metrics?.totalHours || 0,
    estimatedHours: p.metrics?.estimatedHours || 0,
    teamSize: p.metrics?.teamSize || 0,
    status: p.status || 'active',
  }));

  const { alerts, insights, summary } = computeAlerts(projectsForAlerts);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos dias";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  const alertIcon = (type: Alert['type']) => {
    if (type === 'critical') return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    if (type === 'warning') return <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  };

  const alertBg = (type: Alert['type']) => {
    if (type === 'critical') return "border-red-200 bg-red-50/50";
    if (type === 'warning') return "border-amber-200 bg-amber-50/50";
    return "border-blue-200 bg-blue-50/50";
  };

  const commercialLinks: QuickLink[] = [
    { href: "/optimized-quote", title: "Nueva Cotización", description: "Crear una cotización", icon: Plus, color: "bg-green-500", permission: "quotations" },
    { href: "/quotations", title: "Cotizaciones", description: `${quotationStats?.pending || 0} pendientes`, icon: FileText, color: "bg-blue-500", permission: "quotations" },
    { href: "/crm", title: "CRM Ventas", description: "Pipeline de prospectos", icon: Target, color: "bg-purple-500", permission: "crm" },
    { href: "/clients", title: "Clientes", description: "Base de clientes", icon: Building2, color: "bg-indigo-500", permission: "crm" },
  ];

  const projectLinks: QuickLink[] = [
    { href: "/active-projects", title: "Rentabilidad", description: `${projectCount || 0} proyectos activos`, icon: Briefcase, color: "bg-orange-500", permission: "projects" },
    { href: "/status-semanal", title: "Status Semanal", description: "Revisión ejecutiva", icon: ClipboardList, color: "bg-teal-500", permission: "status" },
    { href: "/tasks", title: "Tareas", description: "Gestión de tareas", icon: CheckSquare, color: "bg-cyan-500", permission: "projects" },
    { href: "/tasks/hours-dashboard", title: "Panel de Horas", description: "Horas por persona", icon: BarChart2, color: "bg-amber-500", permission: "projects" },
  ];

  const operationsLinks: QuickLink[] = [
    { href: "/operations/capacity", title: "Capacidad Semanal", description: "Capacidad por persona", icon: Gauge, color: "bg-rose-500" },
    { href: "/operations/monthly-closing", title: "Cierre Mensual", description: "Reconciliación de horas", icon: CalendarCheck, color: "bg-pink-500" },
    { href: "/operations/estimated-rates", title: "Valor Hora", description: "Proyección de rates", icon: TrendingUp, color: "bg-fuchsia-500" },
    { href: "/operations/holidays", title: "Feriados", description: "Gestión de feriados", icon: Calendar, color: "bg-violet-500" },
  ];

  const renderLinkCard = (link: QuickLink) => (
    <Link key={link.href} href={link.href}>
      <Card className="group hover:shadow-md transition-all cursor-pointer border hover:border-primary/30 h-full">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`${link.color} p-2.5 rounded-lg text-white flex-shrink-0`}>
            <link.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm group-hover:text-primary transition-colors">{link.title}</div>
            <div className="text-xs text-muted-foreground truncate">{link.description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );

  const renderSection = (title: string, links: QuickLink[]) => {
    const filtered = links.filter(l => !l.permission || hasPermission(l.permission as any));
    if (filtered.length === 0) return null;
    return (
      <div key={title}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map(renderLinkCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {greeting()}, {user?.firstName || "Usuario"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido a Mind. Accedé rápidamente a las secciones principales.
          </p>
        </div>
        {summary.critical > 0 && (
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 px-3 py-1.5 text-sm animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            {summary.critical} alerta{summary.critical > 1 ? 's' : ''} crítica{summary.critical > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Smart Alerts */}
      {alerts.length > 0 && hasPermission('projects') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alertas Inteligentes</h2>
            <Badge variant="secondary" className="text-xs">
              {summary.critical > 0 && <span className="text-red-600 mr-1">{summary.critical} criticas</span>}
              {summary.warning > 0 && <span className="text-amber-600">{summary.warning} warnings</span>}
            </Badge>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${alertBg(alert.type)}`}>
                {alertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{alert.title}</span>
                    {alert.clientName && (
                      <span className="text-xs text-muted-foreground">· {alert.clientName}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                  {alert.action && (
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> {alert.action}
                    </p>
                  )}
                </div>
                {alert.projectId && (
                  <Link href={`/active-projects/${alert.projectId}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer flex-shrink-0" />
                  </Link>
                )}
              </div>
            ))}
            {alerts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{alerts.length - 5} alertas más
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && hasPermission('projects') && (
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/30 to-purple-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-100">
                <Lightbulb className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-indigo-900">Insights del Portfolio</span>
            </div>
            <ul className="space-y-1.5">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">·</span>
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {hasPermission('projects') && (
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-primary">{projectCount || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Proyectos Activos</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('quotations') && (
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{quotationStats?.pending || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Cotizaciones Pendientes</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('quotations') && (
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{quotationStats?.draft || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Borradores</div>
            </CardContent>
          </Card>
        )}
        {hasPermission('projects') && (
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-slate-700">
                {summary.critical > 0 ? (
                  <span className="text-red-600">{summary.critical}</span>
                ) : (
                  <span className="text-emerald-600">0</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Alertas Críticas</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sections */}
      {renderSection("Comercial", commercialLinks)}
      {renderSection("Proyectos", projectLinks)}
      {isOperations && renderSection("Operaciones", operationsLinks)}
      {renderSection("Dashboard y Admin", [
        { href: "/dashboard", title: "Dashboard Ejecutivo", description: "KPIs financieros", icon: LayoutDashboard, color: "bg-emerald-500", permission: "dashboard" },
        { href: "/admin/users", title: "Usuarios", description: "Usuarios y permisos", icon: Users, color: "bg-slate-500", permission: "admin" },
      ])}
    </div>
  );
}

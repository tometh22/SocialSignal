import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import GlobalTimerWidget from "@/components/tasks/GlobalTimerWidget";
import ErrorBoundary from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { lazy, Suspense, useEffect, useState } from "react";
// Core Pages
const ExecutiveDashboardV2 = lazy(() => import("@/pages/executive-dashboard-v2"));
const OptimizedQuote = lazy(() => import("@/pages/optimized-quote"));
import { OptimizedQuoteProvider } from "@/context/optimized-quote-context";
const ManageQuotes = lazy(() => import("@/pages/manage-quotes"));
const QuotationDetail = lazy(() => import("@/pages/quotation-detail"));
const QuoteRedirect = lazy(() => import("@/pages/quote-redirect"));
const Clients = lazy(() => import("@/pages/clients"));
const Admin = lazy(() => import("@/pages/admin-fixed"));
const AdminInflation = lazy(() => import("@/pages/admin-inflation"));
const AdminDataSources = lazy(() => import("@/pages/admin-data-sources"));
const AdminDefinitions = lazy(() => import("@/pages/admin-definitions"));

// Project Management Pages
const ActiveProjectsNext = lazy(() => import("@/pages/active-projects-next"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const ProjectSettings = lazy(() => import("@/pages/project-settings"));
const NewProjectWithTooltips = lazy(() => import("@/pages/new-project-with-tooltips"));
const TimeEntries = lazy(() => import("@/pages/time-entries"));
const MyInvoices = lazy(() => import("@/pages/my-invoices"));
const AdminProviders = lazy(() => import("@/pages/admin-providers"));
const ProviderDashboard = lazy(() => import("@/pages/provider/dashboard"));
const EditProject = lazy(() => import("@/pages/edit-project"));

// Analytics & Specialized Pages
const ProjectAnalyticsView = lazy(() => import("@/pages/project-analytics-view"));
const ClientSummaryCompact = lazy(() => import("@/pages/client-summary-compact"));
const QualityScores = lazy(() => import("@/pages/quality-scores"));
const QuarterlyNpsSurvey = lazy(() => import("@/pages/quarterly-nps-survey"));
const CurrencyDemo = lazy(() => import("@/pages/currency-demo"));
const GoogleSheetsManager = lazy(() => import("@/pages/google-sheets-manager"));
const ExecutiveOperativo = lazy(() => import("@/pages/Executive/Operativo"));
const ExecutiveFinanciero = lazy(() => import("@/pages/Executive/Financiero"));
const CRMPage = lazy(() => import("@/pages/crm"));
const CRMLeadPage = lazy(() => import("@/pages/crm-lead"));
const ReviewHubPage = lazy(() => import("@/pages/review/hub"));
const ReviewRoomPage = lazy(() => import("@/pages/review/room"));
const ActivoPage = lazy(() => import("@/pages/activo"));
const PasivoPage = lazy(() => import("@/pages/pasivo"));
const ProvisionsPage = lazy(() => import("@/pages/provisions"));
const CashflowPage = lazy(() => import("@/pages/cashflow"));
const ClientPnlPage = lazy(() => import("@/pages/client-pnl"));

// Task Management Module
const MyTasksPage = lazy(() => import("@/pages/my-tasks"));
const TeamCalendarPage = lazy(() => import("@/pages/team-calendar"));
const HoursDashboardPage = lazy(() => import("@/pages/hours-dashboard"));
const ProjectsHubPage = lazy(() => import("@/pages/tasks/projects-hub"));
const ProjectsKanbanPage = lazy(() => import("@/pages/tasks/projects-kanban"));
const ProjectTasksPage = lazy(() => import("@/pages/tasks/project-tasks-page"));
const TasksHomePage = lazy(() => import("@/pages/tasks/tasks-home"));


// Authentication & Utilities
import AuthPage from "@/pages/auth-page";
const EditDeliverable = lazy(() => import("@/pages/edit-deliverable"));
const EditRobustnessPage = lazy(() => import("@/pages/edit-robustness"));
const AlwaysOnProjectView = lazy(() => import("@/pages/always-on-project-view"));
const RecurringTemplatesPage = lazy(() => import("@/pages/recurring-templates"));
const AdminUsersPage = lazy(() => import("@/pages/admin-users"));
const CapacityDashboard = lazy(() => import("@/pages/capacity-dashboard"));
const MonthlyClosing = lazy(() => import("@/pages/monthly-closing"));
const EstimatedRates = lazy(() => import("@/pages/estimated-rates"));
const HolidaysManagement = lazy(() => import("@/pages/holidays-management"));
const PersonnelAbsences = lazy(() => import("@/pages/personnel-absences"));
import HomeDashboard from "@/pages/home-dashboard";
const UnauthorizedPage = lazy(() => import("@/pages/unauthorized"));
import SidebarFixed from "@/components/layout/sidebar-fixed";
import Topbar from "@/components/layout/topbar";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AuthProvider } from "@/hooks/use-auth";
import { ChatProvider } from "@/hooks/use-chat";
import { ProtectedRoute } from "@/lib/protected-route";
import { ImageRefreshProvider } from "@/contexts/ImageRefreshContext";
import {
  FINANCE_SUMMARY_ACCESS_SECTIONS,
  HOME_ACCESS_SECTIONS,
  HOURS_DASHBOARD_ACCESS_SECTIONS,
  usePermissions,
} from "@/hooks/use-permissions";

function PortfolioHubByRole() {
  const { isOperations } = usePermissions();
  return isOperations ? <ActiveProjectsNext /> : <Redirect to="/tasks/projects" />;
}

function OperationsOnlyProjectCreate() {
  const { isOperations } = usePermissions();
  return isOperations ? <NewProjectWithTooltips /> : <Redirect to="/tasks/projects" />;
}

function OperationsOnlyProjectDetail() {
  const { isOperations } = usePermissions();
  return isOperations ? <ProjectDetail /> : <Redirect to="/tasks/projects" />;
}

function OperationsOnlyProjectEdit() {
  const { isOperations } = usePermissions();
  return isOperations ? <EditProject /> : <Redirect to="/tasks/projects" />;
}

function OperationsOnlyProjectSettings() {
  const { isOperations } = usePermissions();
  return isOperations ? <ProjectSettings /> : <Redirect to="/tasks/projects" />;
}

function OperationsOnlyProjectTimeEntries() {
  const { isOperations } = usePermissions();
  return isOperations ? <TimeEntries /> : <Redirect to="/tasks/projects" />;
}

function ProjectTasksRedirect({ params }: { params: { id: string } }) {
  return <Redirect to={`/tasks/projects/${params.id}`} />;
}

// Wrapper para procesar parámetros de consulta para OptimizedQuote
function OptimizedQuoteWrapper() {
  // Obtener los parámetros de consulta de la URL
  const search = useSearch();
  const params = new URLSearchParams(search);

  // Extraer parámetros para edición o recotización
  const idParam = params.get('id');
  const cloneParam = params.get('clone');

  // Convertir a números si existen
  const quotationId = idParam ? parseInt(idParam) : undefined;
  const cloneId = cloneParam ? parseInt(cloneParam) : undefined;

  // Determinar el modo: edición normal o recotización
  const isRequote = !!cloneId;
  const finalId = isRequote ? cloneId : quotationId;


  // Renderizar OptimizedQuote envuelto en su provider
  return (
    <OptimizedQuoteProvider quotationId={finalId} isRequote={isRequote}>
      <OptimizedQuote />
    </OptimizedQuoteProvider>
  );
}

// Wrapper para rutas con path parameters (como /optimized-quote/13)
function OptimizedQuotePathWrapper({ params }: { params: { id: string } }) {
  const quotationId = parseInt(params.id);

  return (
    <OptimizedQuoteProvider quotationId={quotationId} isRequote={false}>
      <OptimizedQuote />
    </OptimizedQuoteProvider>
  );
}

function AppRouteFallback() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-4" role="status" aria-label="Cargando pantalla">
      <div className="h-40 animate-pulse rounded-3xl border border-white/80 bg-white/75" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/80 bg-white/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-white/80 bg-white/70" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function AppRoutes() {
  // Keep the document in light mode. The sidebar owns its dark surface locally,
  // so global theme classes cannot leak into the topbar or page content.
  const [location] = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.title = "mind";
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.body.classList.remove('sidebar-dark');
  }, []);

  // Cerrar el sidebar mobile cuando cambia la ruta
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />

      <Route path="*">
        <div className="app-shell flex h-[100dvh] overflow-hidden bg-background">
          {/* Sidebar permanente en desktop */}
          <div className="hidden lg:flex">
            <SidebarFixed />
          </div>

          {/* Sidebar como drawer en mobile */}
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetContent
              side="left"
              className="p-0 w-[260px] max-w-[85vw] border-r-0 lg:hidden"
            >
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <SheetDescription className="sr-only">
                Acceso a las secciones de la aplicación
              </SheetDescription>
              <SidebarFixed mobileMode />
            </SheetContent>
          </Sheet>

          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
            <main className="app-main flex-1 overflow-y-auto overflow-x-hidden">
              <div className="app-content max-w-full p-3 sm:p-5 lg:p-6">
                <Suspense fallback={<AppRouteFallback />}>
                <Switch>
                  {/* Unauthorized */}
                  <Route path="/unauthorized" component={UnauthorizedPage} />

                  {/* Core Application Routes */}
                  <ProtectedRoute path="/" component={HomeDashboard} requiredAnyPermission={HOME_ACCESS_SECTIONS} />
                  <ProtectedRoute path="/dashboard" component={ExecutiveDashboardV2} requiredAnyPermission={FINANCE_SUMMARY_ACCESS_SECTIONS} />
                  <ProtectedRoute path="/dashboard-legacy" component={() => <Redirect to="/dashboard" />} />
                  <ProtectedRoute path="/executive-dashboard-new" component={() => <Redirect to="/dashboard" />} />
                  <ProtectedRoute path="/executive/operativo" component={ExecutiveOperativo} requiredPermission="dashboard" />
                  <ProtectedRoute path="/executive/economico" component={() => <Redirect to="/dashboard" />} />
                  <ProtectedRoute path="/executive/finanzas" component={ExecutiveFinanciero} requiredPermission="finance" />
                  <ProtectedRoute path="/principal" component={() => <Redirect to="/" />} />
                  
                  {/* Quotation Management */}
                  <ProtectedRoute path="/optimized-quote" component={OptimizedQuoteWrapper} requiredPermission="quotations" />
                  <ProtectedRoute path="/optimized-quote/:id" component={OptimizedQuotePathWrapper} requiredPermission="quotations" />
                  <ProtectedRoute path="/new-quote" component={() => <Redirect to="/optimized-quote" />} />
                  <ProtectedRoute path="/quotations" component={ManageQuotes} requiredPermission="quotations" />
                  <ProtectedRoute path="/quotations/:id" component={QuotationDetail} requiredPermission="quotations" />
                  <ProtectedRoute path="/quote-redirect" component={QuoteRedirect} />
                  
                  {/* Legacy Redirects for Quotations */}
                  <ProtectedRoute path="/manage-quotes" component={() => <Redirect to="/quotations" />} />
                  <ProtectedRoute path="/quotation/:id" component={({ params }: { params: { id: string } }) => <Redirect to={`/quotations/${params.id}`} />} />
                  
                  {/* Project Management */}
                  <ProtectedRoute path="/active-projects" component={PortfolioHubByRole} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects-next" component={PortfolioHubByRole} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/new" component={OperationsOnlyProjectCreate} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:id/edit" component={OperationsOnlyProjectEdit} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:id" component={OperationsOnlyProjectDetail} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:id/time-entries" component={OperationsOnlyProjectTimeEntries} requiredPermission="projects" />
                  <ProtectedRoute path="/projects/:id" component={ProjectTasksRedirect} requiredPermission="projects" />
                  <ProtectedRoute path="/project-settings/:id" component={OperationsOnlyProjectSettings} requiredPermission="projects" />
                  <ProtectedRoute path="/time-entries/project/:projectId" component={OperationsOnlyProjectTimeEntries} requiredPermission="projects" />

                  {/* Facturación personal (acceso para todo usuario autenticado) */}
                  <ProtectedRoute path="/my-invoices" component={MyInvoices} />

                  {/* Admin: gestión de proveedores externos */}
                  <ProtectedRoute path="/admin/providers" component={AdminProviders} requiredPermission="admin" />

                  {/* Proveedor externo: vista propia */}
                  <ProtectedRoute path="/provider/dashboard" component={ProviderDashboard} />
                  <ProtectedRoute path="/provider" component={() => <Redirect to="/provider/dashboard" />} />

                  {/* Analytics & Reports */}
                  <ProtectedRoute path="/project-analytics/:projectId" component={ProjectAnalyticsView} requiredPermission="finance" />
                  <ProtectedRoute path="/client-summary/:clientId" component={ClientSummaryCompact} requiredPermission="projects" />
                  <ProtectedRoute path="/quality-scores/:clientId" component={QualityScores} requiredPermission="projects" />
                  <ProtectedRoute path="/quarterly-nps/:clientId" component={QuarterlyNpsSurvey} requiredPermission="projects" />
                  
                  {/* Gestión de Tareas */}
                  <ProtectedRoute path="/tasks" component={TasksHomePage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/my-tasks" component={MyTasksPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/team-calendar" component={TeamCalendarPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/hours-dashboard" component={HoursDashboardPage} requiredAnyPermission={HOURS_DASHBOARD_ACCESS_SECTIONS} />
                  <ProtectedRoute path="/absences" component={PersonnelAbsences} requiredAnyPermission={HOME_ACCESS_SECTIONS} />
                  <ProtectedRoute path="/tasks/projects" component={ProjectsHubPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/projects/kanban" component={ProjectsKanbanPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/projects/:id" component={ProjectTasksPage} requiredPermission="projects" />

                  {/* CRM Ventas */}
                  <ProtectedRoute path="/crm" component={CRMPage} requiredPermission="crm" />
                  <ProtectedRoute path="/crm/:id" component={CRMLeadPage} requiredPermission="crm" />
                  <ProtectedRoute path="/review" component={ReviewHubPage} requiredPermission="status" />
                  <ProtectedRoute path="/review/:roomId" component={ReviewRoomPage} requiredPermission="status" />
                  <Route path="/status-semanal">{() => <Redirect to="/review" />}</Route>

                  {/* Client & Resource Management */}
                  <ProtectedRoute path="/clients" component={Clients} requiredPermission="crm" />
                  <ProtectedRoute path="/admin/users" component={AdminUsersPage} requiredPermission="admin" />
                  <ProtectedRoute path="/admin/inflation" component={AdminInflation} requiredPermission="admin" />
                  <ProtectedRoute path="/admin/data-sources" component={AdminDataSources} requiredPermission="admin" />
                  <ProtectedRoute path="/admin/definitions" component={AdminDefinitions} requiredPermission="admin" />
                  <ProtectedRoute path="/admin" component={Admin} requiredPermission="admin" />

                  {/* Finance Ledger */}
                  <ProtectedRoute path="/finance/activo" component={ActivoPage} requiredPermission="finance" />
                  <ProtectedRoute path="/finance/pasivo" component={PasivoPage} requiredPermission="finance" />
                  <ProtectedRoute path="/finance/provisions" component={ProvisionsPage} requiredPermission="finance" />
                  <ProtectedRoute path="/finance/cashflow" component={CashflowPage} requiredPermission="finance" />
                  <ProtectedRoute path="/clients/:id/pnl" component={ClientPnlPage} requiredPermission="finance" />

                  {/* Operations Management */}
                  <ProtectedRoute path="/operations/capacity" component={CapacityDashboard} requiredPermission="operations" />
                  <ProtectedRoute path="/operations/monthly-closing" component={MonthlyClosing} requiredPermission="operations" />
                  <ProtectedRoute path="/operations/estimated-rates" component={EstimatedRates} requiredPermission="operations" />
                  <ProtectedRoute path="/operations/holidays" component={HolidaysManagement} requiredPermission="operations" />
                  <ProtectedRoute path="/operations/absences" component={() => <Redirect to="/absences" />} requiredPermission="operations" />
                  <ProtectedRoute path="/google-sheets" component={GoogleSheetsManager} requiredPermission="admin" />
                  
                  {/* Specialized Tools */}
                  <ProtectedRoute path="/edit-deliverable/:id" component={EditDeliverable} requiredPermission="projects" />
                  <ProtectedRoute path="/edit-indicators/:id" component={EditRobustnessPage} requiredPermission="projects" />
                  <ProtectedRoute path="/always-on-project/:projectId" component={AlwaysOnProjectView} requiredPermission="projects" />
                  <ProtectedRoute path="/recurring-templates/:projectId" component={RecurringTemplatesPage} requiredPermission="projects" />
                  <ProtectedRoute path="/currency-demo" component={CurrencyDemo} />

                  
                  {/* Legacy Redirects */}
                  <ProtectedRoute path="/project-details/:id" component={ProjectTasksRedirect} requiredPermission="projects" />
                  <ProtectedRoute path="/project/:id" component={ProjectTasksRedirect} requiredPermission="projects" />
                  
                  <Route component={NotFound} />
                </Switch>
                </Suspense>
              </div>
            </main>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ChatProvider>
          <ImageRefreshProvider>
            <AppRoutes />
            <GlobalTimerWidget />
            <Toaster />
          </ImageRefreshProvider>
        </ChatProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

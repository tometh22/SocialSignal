import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import GlobalTimerWidget from "@/components/tasks/GlobalTimerWidget";
import ErrorBoundary from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
// Core Pages
import ExecutiveDashboard from "@/pages/executive-dashboard-new";
import OptimizedQuote from "@/pages/optimized-quote";
import { OptimizedQuoteProvider } from "@/context/optimized-quote-context";
import ManageQuotes from "@/pages/manage-quotes";
import QuotationDetail from "@/pages/quotation-detail";
import QuoteRedirect from "@/pages/quote-redirect";
import Clients from "@/pages/clients";
import Admin from "@/pages/admin-fixed";
import AdminInflation from "@/pages/admin-inflation";

// Project Management Pages  
import ActiveProjectsV2 from "@/pages/active-projects-v2";
import ActiveProjectsNext from "@/pages/active-projects-next";
import ProjectDetailsRedesigned from "@/pages/project-details-redesigned";
import ProjectSingle from "@/pages/project-single";
import ProjectSettings from "@/pages/project-settings";
import NewProjectWithTooltips from "@/pages/new-project-with-tooltips";
import TimeEntries from "@/pages/time-entries";
import EditProject from "@/pages/edit-project";
import ProjectFinancialManagement from "@/pages/project-financial-management";

// Analytics & Specialized Pages
import ProjectAnalyticsView from "@/pages/project-analytics-view";
import ClientSummaryCompact from "@/pages/client-summary-compact";
import QualityScores from "@/pages/quality-scores";
import QuarterlyNpsSurvey from "@/pages/quarterly-nps-survey";
import CurrencyDemo from "@/pages/currency-demo";
import GoogleSheetsManager from "@/pages/google-sheets-manager";
import ExecutiveOperativo from "@/pages/Executive/Operativo";
import ExecutiveFinanciero from "@/pages/Executive/Financiero";
import CRMPage from "@/pages/crm";
import CRMLeadPage from "@/pages/crm-lead";
import StatusSemanalPage from "@/pages/status-semanal";

// Task Management Module
import MyTasksPage from "@/pages/my-tasks";
import TeamCalendarPage from "@/pages/team-calendar";
import HoursDashboardPage from "@/pages/hours-dashboard";
import ProjectsHubPage from "@/pages/tasks/projects-hub";
import ProjectTasksPage from "@/pages/tasks/project-tasks-page";
import TasksHomePage from "@/pages/tasks/tasks-home";


// Authentication & Utilities
import AuthPage from "@/pages/auth-page";
import EditDeliverable from "@/pages/edit-deliverable";
import EditRobustnessPage from "@/pages/edit-robustness";
import AlwaysOnProjectView from "@/pages/always-on-project-view";
import RecurringTemplatesPage from "@/pages/recurring-templates";
import AdminUsersPage from "@/pages/admin-users";
import UnauthorizedPage from "@/pages/unauthorized";
import SidebarFixed from "@/components/layout/sidebar-fixed";
import Topbar from "@/components/layout/topbar";
import { AuthProvider } from "@/hooks/use-auth";
import { ChatProvider } from "@/hooks/use-chat";
import { ProtectedRoute } from "@/lib/protected-route";
import { ImageRefreshProvider } from "@/contexts/ImageRefreshContext";
import { ProjectDataProvider } from "@/contexts/ProjectDataProvider";

import { useEffect } from "react";

// Wrapper para envolver ProjectDetailsRedesigned con ProjectDataProvider
function ProjectDetailsWithProvider({ params }: { params: { id: string } }) {
  return (
    <ProjectDataProvider initialProjectId={parseInt(params.id)}>
      <ProjectDetailsRedesigned params={params} />
    </ProjectDataProvider>
  );
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

function AppRoutes() {
  // Set document title - permite modo claro para contenido principal pero mantiene sidebar oscura
  const setLocation = useLocation()[1];
  useEffect(() => {
    document.title = "Mind | Epical";
    // Remover dark mode del documento general (para contenido principal)
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    // Pero dejamos la clase sidebar-dark que mantendrá la estética oscura solo en el sidebar
    document.body.classList.add('sidebar-dark');
  }, []);

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />

      <Route path="*">
        <div className="flex h-screen overflow-hidden bg-background">
          <SidebarFixed />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="max-w-full p-3 sm:p-4">
                <Switch>
                  {/* Unauthorized */}
                  <Route path="/unauthorized" component={UnauthorizedPage} />

                  {/* Core Application Routes */}
                  <ProtectedRoute path="/" component={ExecutiveDashboard} requiredPermission="dashboard" />
                  <ProtectedRoute path="/dashboard" component={ExecutiveDashboard} requiredPermission="dashboard" />
                  <ProtectedRoute path="/executive-dashboard-new" component={ExecutiveDashboard} requiredPermission="dashboard" />
                  <ProtectedRoute path="/executive/operativo" component={ExecutiveOperativo} requiredPermission="dashboard" />
                  <ProtectedRoute path="/executive/economico" component={ExecutiveDashboard} requiredPermission="dashboard" />
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
                  <ProtectedRoute path="/active-projects" component={ActiveProjectsNext} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects-next" component={ActiveProjectsNext} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects-old" component={ActiveProjectsV2} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/new" component={NewProjectWithTooltips} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:id/edit" component={EditProject} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:id" component={ProjectDetailsWithProvider} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:id/time-entries" component={TimeEntries} requiredPermission="projects" />
                  <ProtectedRoute path="/active-projects/:projectId/financial-management" component={ProjectFinancialManagement} requiredPermission="projects" />
                  <ProtectedRoute path="/projects/:id" component={({ params }: { params: { id: string } }) => <Redirect to={`/active-projects/${params.id}`} />} />
                  <ProtectedRoute path="/project-settings/:id" component={ProjectSettings} requiredPermission="projects" />
                  <ProtectedRoute path="/time-entries/project/:projectId" component={TimeEntries} requiredPermission="projects" />
                  
                  {/* Analytics & Reports */}
                  <ProtectedRoute path="/project-analytics/:projectId" component={ProjectAnalyticsView} requiredPermission="finance" />
                  <ProtectedRoute path="/client-summary/:clientId" component={ClientSummaryCompact} requiredPermission="projects" />
                  <ProtectedRoute path="/quality-scores/:clientId" component={QualityScores} requiredPermission="projects" />
                  <ProtectedRoute path="/quarterly-nps/:clientId" component={QuarterlyNpsSurvey} requiredPermission="projects" />
                  
                  {/* Gestión de Tareas */}
                  <ProtectedRoute path="/tasks" component={TasksHomePage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/my-tasks" component={MyTasksPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/team-calendar" component={TeamCalendarPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/hours-dashboard" component={HoursDashboardPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/projects" component={ProjectsHubPage} requiredPermission="projects" />
                  <ProtectedRoute path="/tasks/projects/:id" component={ProjectTasksPage} requiredPermission="projects" />

                  {/* CRM Ventas */}
                  <ProtectedRoute path="/crm" component={CRMPage} requiredPermission="crm" />
                  <ProtectedRoute path="/crm/:id" component={CRMLeadPage} requiredPermission="crm" />
                  <ProtectedRoute path="/status-semanal" component={StatusSemanalPage} requiredPermission="projects" />

                  {/* Client & Resource Management */}
                  <ProtectedRoute path="/clients" component={Clients} requiredPermission="crm" />
                  <ProtectedRoute path="/admin/users" component={AdminUsersPage} requiredPermission="admin" />
                  <ProtectedRoute path="/admin/inflation" component={AdminInflation} requiredPermission="admin" />
                  <ProtectedRoute path="/admin" component={Admin} requiredPermission="admin" />
                  <ProtectedRoute path="/google-sheets" component={GoogleSheetsManager} requiredPermission="admin" />
                  
                  {/* Specialized Tools */}
                  <ProtectedRoute path="/edit-deliverable/:id" component={EditDeliverable} requiredPermission="projects" />
                  <ProtectedRoute path="/edit-indicators/:id" component={EditRobustnessPage} requiredPermission="projects" />
                  <ProtectedRoute path="/always-on-project/:projectId" component={AlwaysOnProjectView} requiredPermission="projects" />
                  <ProtectedRoute path="/recurring-templates/:projectId" component={RecurringTemplatesPage} requiredPermission="projects" />
                  <ProtectedRoute path="/currency-demo" component={CurrencyDemo} />

                  
                  {/* Legacy Redirects */}
                  <ProtectedRoute path="/project-details/:id" component={({ params }: { params: { id: string } }) => <Redirect to={`/active-projects/${params.id}`} />} />
                  <ProtectedRoute path="/project/:id" component={({ params }: { params: { id: string } }) => <Redirect to={`/projects/${params.id}`} />} />
                  
                  <Route component={NotFound} />
                </Switch>
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
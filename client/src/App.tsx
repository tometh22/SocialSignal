import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard-fixed-corrected";
import ExecutiveDashboard from "@/pages/executive-dashboard";
import OptimizedQuote from "@/pages/optimized-quote";
import { OptimizedQuoteProvider } from "@/context/optimized-quote-context";
import ManageQuotes from "@/pages/manage-quotes";
import QuoteDetails from "@/pages/quote-details";
import QuotationDetail from "@/pages/quotation-detail";
import QuoteRedirect from "@/pages/quote-redirect";
import HuggiesPage from "@/pages/huggies-page";
import Clients from "@/pages/clients";
import Statistics from "@/pages/statistics-fixed";
import Admin from "@/pages/admin-fixed";
import AdminInflation from "@/pages/admin-inflation";
import ActiveProjects from "@/pages/active-projects-redesigned";
import ProjectDetailsRedesigned from "@/pages/project-details-redesigned";
import ProjectSettings from "@/pages/project-settings";
import NewProjectWithTooltips from "@/pages/new-project-with-tooltips";
import TimeEntries from "@/pages/time-entries";
// Dashboard moderno mantenido - todos los antiguos eliminados
import ProjectAnalyticsView from "@/pages/project-analytics-view";
import VersionSelector from "@/pages/selector-version";
import ClientSummary from "@/pages/client-summary";
import ClientSummaryEnhanced from "@/pages/client-summary-enhanced";
import ClientSummaryRedesigned from "@/pages/client-summary-redesigned";
import QualityScores from "@/pages/quality-scores";
import QuarterlyNpsSurvey from "@/pages/quarterly-nps-survey";
import AuthPage from "@/pages/auth-page";
import WarnerTeamTemplate from "@/pages/temp-helpers/apply-warner-team";
import EditDeliverable from "@/pages/edit-deliverable";
import EditRobustnessPage from "@/pages/edit-robustness";
// Importamos directamente el componente de edición de proyectos Always On
import EditAlwaysOnProject from "@/pages/edit-always-on-project";
import AlwaysOnDeliverablesDemo from "@/pages/always-on-deliverables-demo";
import AlwaysOnProjectView from "@/pages/always-on-project-view";
import RecurringTemplatesPage from "@/pages/recurring-templates";
import AlwaysOnLanding from "@/pages/always-on-landing";
import TestAlwaysOn from "@/pages/test-always-on";
import SidebarFixed from "@/components/layout/sidebar-fixed";
import Topbar from "@/components/layout/topbar";
import { AuthProvider } from "@/hooks/use-auth";
import { ChatProvider } from "@/hooks/use-chat";
import { ProtectedRoute } from "@/lib/protected-route";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";

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
  const cloneId = cloneParam ? parseInt(cloneId) : undefined;

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
                  <ProtectedRoute path="/recurring-templates" component={AlwaysOnLanding} />
                  <ProtectedRoute path="/" component={ExecutiveDashboard} />
                  <ProtectedRoute path="/dashboard" component={ExecutiveDashboard} />
                  <ProtectedRoute path="/optimized-quote" component={OptimizedQuoteWrapper} />
                  <ProtectedRoute path="/optimized-quote/:id" component={OptimizedQuotePathWrapper} />
                  <ProtectedRoute path="/quote-redirect" component={QuoteRedirect} />
                  <ProtectedRoute path="/huggies" component={HuggiesPage} />
                  <ProtectedRoute path="/new-quote" component={() => <Redirect to="/optimized-quote" />} />
                  <ProtectedRoute path="/quotations" component={ManageQuotes} />
                  <ProtectedRoute path="/manage-quotes" component={ManageQuotes} />
                  <ProtectedRoute path="/quote/:id" component={QuoteDetails} />
                  <ProtectedRoute path="/quotations/:id" component={QuotationDetail} />
                  <ProtectedRoute path="/quotation/:id" component={QuotationDetail} />
                  <ProtectedRoute path="/clients" component={Clients} />
                  <ProtectedRoute path="/statistics" component={Statistics} />
                  <ProtectedRoute path="/history" component={() => <Redirect to="/statistics" />} />
                  <ProtectedRoute path="/admin" component={Admin} />

                  <ProtectedRoute path="/admin/inflation" component={AdminInflation} />

                  {/* Rutas para gestión de proyectos activos */}
                  <ProtectedRoute path="/active-projects/new" component={NewProjectWithTooltips} />
                  <ProtectedRoute path="/active-projects/:id" component={ProjectDetailsRedesigned} />
                  <ProtectedRoute path="/project-details/:id" component={ProjectDetailsRedesigned} />
                  <ProtectedRoute path="/project-settings/:id" component={ProjectSettings} />
                  <ProtectedRoute path="/active-projects" component={ActiveProjects} />
                  <ProtectedRoute path="/active-projects/:projectId/time-entries" component={TimeEntries} />
                  <ProtectedRoute path="/time-entries/project/:projectId" component={TimeEntries} />
                  {/* Ruta moderna para proyecto analytics */}
                  <ProtectedRoute path="/project-summary/:projectId" component={ProjectAnalyticsView} />
                  <ProtectedRoute path="/project-analytics/:projectId" component={ProjectAnalyticsView} />
                  <ProtectedRoute path="/project-summary-selector/:projectId" component={VersionSelector} />
                  <ProtectedRoute path="/client-summary/:clientId" component={ClientSummaryEnhanced} />
                  <ProtectedRoute path="/client-summary-redesigned/:id" component={ClientSummaryRedesigned} />
                  <ProtectedRoute path="/quality-scores/:clientId" component={QualityScores} />
                  <ProtectedRoute path="/quarterly-nps/:clientId" component={QuarterlyNpsSurvey} />
                  <ProtectedRoute path="/temp-helpers/apply-warner-team" component={WarnerTeamTemplate} />
                  <ProtectedRoute path="/edit-deliverable/:id" component={EditDeliverable} />
                  <ProtectedRoute path="/always-on-demo" component={AlwaysOnDeliverablesDemo} />
                  <ProtectedRoute path="/always-on-project/:projectId" component={AlwaysOnProjectView} />
                  <ProtectedRoute path="/edit-indicators/:id" component={EditRobustnessPage} />
                  <ProtectedRoute path="/edit-always-on/:projectId" component={EditRobustnessPage} />
                  <ProtectedRoute path="/projects/:projectId/recurring-templates" component={RecurringTemplatesPage} />
                  <ProtectedRoute path="/projects/:id" component={ProjectDetailsRedesigned} />
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
  // App ya está envuelto en QueryClientProvider en main.tsx
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ChatProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toaster />
        </ChatProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
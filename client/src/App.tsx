import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
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
import AnalyticsConsolidated from "@/pages/analytics-consolidated";
import Admin from "@/pages/admin-fixed";
import AdminInflation from "@/pages/admin-inflation";

// Project Management Pages
import ActiveProjects from "@/pages/active-projects";
import ProjectDetailsRedesigned from "@/pages/project-details-redesigned";
import ProjectSettings from "@/pages/project-settings";
import NewProjectWithTooltips from "@/pages/new-project-with-tooltips";
import TimeEntries from "@/pages/time-entries";
import EditProject from "@/pages/edit-project";
import ProjectFinancialManagement from "@/pages/project-financial-management";
import FinancialOverview from "@/pages/financial-overview";

// Analytics & Specialized Pages
import ProjectAnalyticsView from "@/pages/project-analytics-view";
import ClientSummaryCompact from "@/pages/client-summary-compact";
import QualityScores from "@/pages/quality-scores";
import QuarterlyNpsSurvey from "@/pages/quarterly-nps-survey";
import { IndirectCosts } from "@/pages/indirect-costs";
import CurrencyDemo from "@/pages/currency-demo";
import GoogleSheetsManager from "@/pages/google-sheets-manager";
import ExcelMaestroPage from "@/pages/excel-maestro";


// Authentication & Utilities
import AuthPage from "@/pages/auth-page";
import EditDeliverable from "@/pages/edit-deliverable";
import EditRobustnessPage from "@/pages/edit-robustness";
import AlwaysOnProjectView from "@/pages/always-on-project-view";
import RecurringTemplatesPage from "@/pages/recurring-templates";
import SidebarFixed from "@/components/layout/sidebar-fixed";
import Topbar from "@/components/layout/topbar";
import { AuthProvider } from "@/hooks/use-auth";
import { ChatProvider } from "@/hooks/use-chat";
import { ProtectedRoute } from "@/lib/protected-route";
import { ImageRefreshProvider } from "@/contexts/ImageRefreshContext";

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
                  {/* Core Application Routes */}
                  <ProtectedRoute path="/" component={ExecutiveDashboard} />
                  <ProtectedRoute path="/dashboard" component={ExecutiveDashboard} />
                  
                  {/* Quotation Management */}
                  <ProtectedRoute path="/optimized-quote" component={OptimizedQuoteWrapper} />
                  <ProtectedRoute path="/optimized-quote/:id" component={OptimizedQuotePathWrapper} />
                  <ProtectedRoute path="/new-quote" component={() => <Redirect to="/optimized-quote" />} />
                  <ProtectedRoute path="/quotations" component={ManageQuotes} />
                  <ProtectedRoute path="/quotations/:id" component={QuotationDetail} />
                  <ProtectedRoute path="/quote-redirect" component={QuoteRedirect} />
                  
                  {/* Legacy Redirects for Quotations */}
                  <ProtectedRoute path="/manage-quotes" component={() => <Redirect to="/quotations" />} />
                  <ProtectedRoute path="/quotation/:id" component={({ params }: { params: { id: string } }) => <Redirect to={`/quotations/${params.id}`} />} />
                  
                  {/* Project Management */}
                  <ProtectedRoute path="/active-projects" component={ActiveProjects} />
                  <ProtectedRoute path="/active-projects/new" component={NewProjectWithTooltips} />
                  <ProtectedRoute path="/active-projects/:id/edit" component={EditProject} />
                  <ProtectedRoute path="/active-projects/:id" component={ProjectDetailsRedesigned} />
                  <ProtectedRoute path="/active-projects/:id/time-entries" component={TimeEntries} />
                  <ProtectedRoute path="/active-projects/:projectId/financial-management" component={ProjectFinancialManagement} />
                  <ProtectedRoute path="/projects/:id" component={ProjectDetailsRedesigned} />
                  <ProtectedRoute path="/project-settings/:id" component={ProjectSettings} />
                  <ProtectedRoute path="/time-entries/project/:projectId" component={TimeEntries} />
                  
                  {/* Analytics & Reports */}
                  <ProtectedRoute path="/financial-overview" component={FinancialOverview} />
                  <ProtectedRoute path="/statistics" component={AnalyticsConsolidated} />
                  <ProtectedRoute path="/project-analytics/:projectId" component={ProjectAnalyticsView} />
                  <ProtectedRoute path="/client-summary/:clientId" component={ClientSummaryCompact} />
                  <ProtectedRoute path="/quality-scores/:clientId" component={QualityScores} />
                  <ProtectedRoute path="/quarterly-nps/:clientId" component={QuarterlyNpsSurvey} />
                  
                  {/* Client & Resource Management */}
                  <ProtectedRoute path="/clients" component={Clients} />
                  <ProtectedRoute path="/admin" component={Admin} />
                  <ProtectedRoute path="/admin/inflation" component={AdminInflation} />
                  <ProtectedRoute path="/indirect-costs" component={IndirectCosts} />
                  <ProtectedRoute path="/google-sheets" component={GoogleSheetsManager} />
                  <ProtectedRoute path="/excel-maestro" component={ExcelMaestroPage} />
                  
                  {/* Specialized Tools */}
                  <ProtectedRoute path="/edit-deliverable/:id" component={EditDeliverable} />
                  <ProtectedRoute path="/edit-indicators/:id" component={EditRobustnessPage} />
                  <ProtectedRoute path="/always-on-project/:projectId" component={AlwaysOnProjectView} />
                  <ProtectedRoute path="/recurring-templates/:projectId" component={RecurringTemplatesPage} />
                  <ProtectedRoute path="/currency-demo" component={CurrencyDemo} />

                  
                  {/* Legacy Redirects */}
                  <ProtectedRoute path="/history" component={() => <Redirect to="/statistics" />} />
                  <ProtectedRoute path="/project-details/:id" component={({ params }: { params: { id: string } }) => <Redirect to={`/active-projects/${params.id}`} />} />
                  
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
            <Toaster />
          </ImageRefreshProvider>
        </ChatProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
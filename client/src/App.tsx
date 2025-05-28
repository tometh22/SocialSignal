import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import OptimizedQuote from "@/pages/optimized-quote";
import { OptimizedQuoteProvider } from "@/context/optimized-quote-context";
import ManageQuotes from "@/pages/manage-quotes";
import QuoteDetails from "@/pages/quote-details";
import QuotationDetail from "@/pages/quotation-detail";
import QuoteRedirect from "@/pages/quote-redirect";
import HuggiesPage from "@/pages/huggies-page";
import Clients from "@/pages/clients";
import Statistics from "@/pages/statistics";
import Admin from "@/pages/admin";
import ActiveProjects from "@/pages/active-projects";
import NewActiveProject from "@/pages/new-active-project";
import TimeEntries from "@/pages/time-entries";
// Dashboard moderno mantenido - todos los antiguos eliminados
import ProjectAnalyticsView from "@/pages/project-analytics-view";
import VersionSelector from "@/pages/selector-version";
import ClientSummary from "@/pages/client-summary";
import AuthPage from "@/pages/auth-page";
import WarnerTeamTemplate from "@/pages/temp-helpers/apply-warner-team";
import EditDeliverable from "@/pages/edit-deliverable";
import EditRobustnessPage from "@/pages/edit-robustness";
// Importamos directamente el componente de edición de proyectos Always On
import EditAlwaysOnProject from "@/pages/edit-always-on-project";
import AlwaysOnDeliverablesDemo from "@/pages/always-on-deliverables-demo";
import AlwaysOnProjectView from "@/pages/always-on-project-view";
import Sidebar from "@/components/layout/sidebar-new";
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
  const cloneId = cloneParam ? parseInt(cloneParam) : undefined;
  
  // Determinar el modo: edición normal o recotización
  const isRequote = !!cloneId;
  const finalId = isRequote ? cloneId : quotationId;
  
  console.log(`OptimizedQuoteWrapper: id=${idParam}, clone=${cloneParam}, usando ID=${finalId}, isRequote=${isRequote}`);
  
  // Renderizar OptimizedQuote envuelto en su provider
  return (
    <OptimizedQuoteProvider>
      <OptimizedQuote 
        quotationId={finalId} 
        isRequote={isRequote} 
      />
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
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="max-w-full p-3 sm:p-4">
                <Switch>
                  <ProtectedRoute path="/" component={Dashboard} />
                  <ProtectedRoute path="/optimized-quote" component={OptimizedQuoteWrapper} />
                  <ProtectedRoute path="/quote-redirect" component={QuoteRedirect} />
                  <ProtectedRoute path="/huggies" component={HuggiesPage} />
                  <ProtectedRoute path="/new-quote">
                    <Redirect to="/optimized-quote" />
                  </ProtectedRoute>
                  <ProtectedRoute path="/manage-quotes" component={ManageQuotes} />
                  <ProtectedRoute path="/quote/:id" component={QuoteDetails} />
                  <ProtectedRoute path="/quotations/:id" component={QuotationDetail} />
                  <ProtectedRoute path="/quotation/:id" component={QuotationDetail} />
                  <ProtectedRoute path="/clients" component={Clients} />
                  <ProtectedRoute path="/statistics" component={Statistics} />
                  <ProtectedRoute path="/history">
                    <Redirect to="/statistics" />
                  </ProtectedRoute>
                  <ProtectedRoute path="/admin" component={Admin} />
                  {/* Rutas para gestión de proyectos activos */}
                  <ProtectedRoute path="/active-projects" component={ActiveProjects} />
                  <ProtectedRoute path="/active-projects/new" component={NewActiveProject} />
                  <ProtectedRoute path="/active-projects/:projectId/time-entries" component={TimeEntries} />
                  <ProtectedRoute path="/time-entries/project/:projectId" component={TimeEntries} />
                  {/* Ruta moderna para proyecto analytics */}
                  <ProtectedRoute path="/project-summary/:projectId" component={ProjectAnalyticsView} />
                  <ProtectedRoute path="/project-analytics/:projectId" component={ProjectAnalyticsView} />
                  <ProtectedRoute path="/project-summary-selector/:projectId" component={VersionSelector} />
                  <ProtectedRoute path="/client-summary/:clientId" component={ClientSummary} />
                  <ProtectedRoute path="/temp-helpers/apply-warner-team" component={WarnerTeamTemplate} />
                  <ProtectedRoute path="/edit-deliverable/:id" component={EditDeliverable} />
                  <ProtectedRoute path="/always-on-demo" component={AlwaysOnDeliverablesDemo} />
                  <ProtectedRoute path="/always-on-project/:projectId" component={AlwaysOnProjectView} />
                  <ProtectedRoute path="/edit-indicators/:id" component={EditRobustnessPage} />
                  <ProtectedRoute path="/edit-always-on/:projectId" component={EditRobustnessPage} />
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
    <AuthProvider>
      <ChatProvider>
        <AppRoutes />
        <Toaster />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;

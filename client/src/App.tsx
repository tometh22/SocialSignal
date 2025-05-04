import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import OptimizedQuote from "@/pages/optimized-quote";
import ManageQuotes from "@/pages/manage-quotes";
import QuoteDetails from "@/pages/quote-details";
import QuotationDetail from "@/pages/quotation-detail";
import Clients from "@/pages/clients";
import Statistics from "@/pages/statistics";
import Admin from "@/pages/admin";
import ActiveProjects from "@/pages/active-projects";
import NewActiveProject from "@/pages/new-active-project";
import TimeEntries from "@/pages/time-entries";
import ProjectSummary from "@/pages/project-summary";
import Sidebar from "@/components/layout/sidebar-new";
import Topbar from "@/components/layout/topbar";
import { useEffect } from "react";

function App() {
  // Set document title - permite modo claro para contenido principal pero mantiene sidebar oscura
  useEffect(() => {
    document.title = "Sistema de Gestión | Epical";
    // Remover dark mode del documento general (para contenido principal)
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    // Pero dejamos la clase sidebar-dark que mantendrá la estética oscura solo en el sidebar
    document.body.classList.add('sidebar-dark');
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-full p-3 sm:p-4">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/optimized-quote" component={OptimizedQuote} />
              <Route path="/new-quote">
                <Redirect to="/optimized-quote" />
              </Route>
              <Route path="/manage-quotes" component={ManageQuotes} />
              <Route path="/quote/:id" component={QuoteDetails} />
              <Route path="/quotations/:id" component={QuotationDetail} />
              <Route path="/quotation/:id" component={QuotationDetail} />
              <Route path="/clients" component={Clients} />
              <Route path="/statistics" component={Statistics} />
              <Route path="/history">
                <Redirect to="/statistics" />
              </Route>
              <Route path="/admin" component={Admin} />
              {/* Rutas para gestión de proyectos activos */}
              <Route path="/active-projects" component={ActiveProjects} />
              <Route path="/active-projects/new" component={NewActiveProject} />
              <Route path="/active-projects/:projectId/time-entries" component={TimeEntries} />
              <Route path="/time-entries/project/:projectId" component={TimeEntries} />
              <Route path="/project-summary/:projectId" component={ProjectSummary} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export default App;

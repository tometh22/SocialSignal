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
import ModernSidebar from "@/components/layout/modern-sidebar";
import EnhancedTopbar from "@/components/layout/enhanced-topbar";
import { useEffect } from "react";

function App() {
  // Set document title
  useEffect(() => {
    document.title = "Sistema de Gestión | Epical";
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <ModernSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <EnhancedTopbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="container mx-auto max-w-7xl p-4 sm:p-6">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/optimized-quote" component={OptimizedQuote} />
              <Route path="/new-quote">
                <Redirect to="/optimized-quote" />
              </Route>
              <Route path="/manage-quotes" component={ManageQuotes} />
              <Route path="/quote/:id" component={QuoteDetails} />
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

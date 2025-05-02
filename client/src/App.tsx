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
import Sidebar from "@/components/layout/sidebar";
import { useEffect } from "react";

function App() {
  // Set document title and fix styling
  useEffect(() => {
    document.title = "Sistema de Gestión | Epical";
    
    // Eliminar cualquier margen/padding del HTML y body
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.background = '#F7F8FA';
    
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'auto';
    document.body.style.height = '100vh';
    document.body.style.background = '#F7F8FA';
  }, []);

  return (
    <div className="layout h-screen overflow-hidden bg-[#F7F8FA]">
      <Sidebar />
      <main className="main overflow-y-auto overflow-x-hidden p-0">
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
      </main>
      <Toaster />
    </div>
  );
}

export default App;

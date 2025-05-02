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
    // y configurar background azul para evitar la franja gris
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.width = '100%';
    document.documentElement.style.background = '#3B82F6'; // Usar color azul para cover cualquier espacio
    
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.width = '100%';
    document.body.style.background = '#3B82F6'; // Usar color azul para cover cualquier espacio
    document.body.style.position = 'absolute';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.bottom = '0';
    
    // Agregar un elemento fijo en la parte superior
    const fixTopGap = () => {
      // Si ya existe el elemento, no lo recrear
      if (document.getElementById('top-fix-element')) return;
      
      const fixElement = document.createElement('div');
      fixElement.id = 'top-fix-element';
      Object.assign(fixElement.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        height: '30px',
        background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
        zIndex: '999999'
      });
      document.body.appendChild(fixElement);
    };
    
    fixTopGap();
    
    // Aplicar también al contenedor principal
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.style.margin = '0';
      rootElement.style.padding = '0';
      rootElement.style.height = '100%';
      rootElement.style.width = '100%';
      rootElement.style.background = '#3B82F6';
    }
    
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

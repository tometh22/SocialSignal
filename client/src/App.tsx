import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import NewQuote from "@/pages/new-quote";
import ManageQuotes from "@/pages/manage-quotes";
import Clients from "@/pages/clients";
import History from "@/pages/history";
import Admin from "@/pages/admin";
import Sidebar from "@/components/layout/sidebar";
import { useEffect } from "react";

function App() {
  // Set document title
  useEffect(() => {
    document.title = "Sistema de Cotización de Escucha Social";
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/new-quote" component={NewQuote} />
          <Route path="/manage-quotes" component={ManageQuotes} />
          <Route path="/clients" component={Clients} />
          <Route path="/history" component={History} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <Toaster />
    </div>
  );
}

export default App;

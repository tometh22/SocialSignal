import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Users, Briefcase, X } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Quotation, ActiveProject, Client } from "@shared/schema";

type SearchResult = {
  id: string | number;
  type: 'project' | 'quote' | 'client';
  title: string;
  subtitle?: string;
  path: string;
};

export function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  // Datos para buscar
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Cargar datos cuando se abre el buscador
  useEffect(() => {
    if (isOpen) {
      const fetchSearchData = async () => {
        setIsLoading(true);
        try {
          const [projectsData, quotationsData, clientsData] = await Promise.all([
            apiRequest('/api/active-projects'),
            apiRequest('/api/quotations'),
            apiRequest('/api/clients')
          ]);
          
          setProjects(projectsData || []);
          setQuotations(quotationsData || []);
          setClients(clientsData || []);
        } catch (error) {
          console.error("Error al cargar datos para búsqueda:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchSearchData();
      
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [isOpen]);

  // Realizar búsqueda con los datos cargados
  useEffect(() => {
    if (searchTerm.trim().length > 1) {
      setIsLoading(true);
      
      // Buscar en proyectos
      const projectResults: SearchResult[] = projects
        .filter(project => 
          project.quotation?.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          project.quotation?.client?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(project => ({
          id: project.id,
          type: 'project',
          title: project.quotation?.projectName || `Proyecto #${project.id}`,
          subtitle: `${project.status === 'active' ? 'Activo' : project.status} - ${project.quotation?.client?.name || 'Sin cliente'}`,
          path: `/project-summary/${project.id}`
        }));
      
      // Buscar en cotizaciones
      const quoteResults: SearchResult[] = quotations
        .filter(quote => 
          quote.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quote.status?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(quote => ({
          id: quote.id,
          type: 'quote',
          title: quote.projectName || `Cotización #${quote.id}`,
          subtitle: quote.status === 'pending' ? 'Pendiente' : 
                    quote.status === 'approved' ? 'Aprobada' : 
                    quote.status === 'rejected' ? 'Rechazada' : 
                    quote.status === 'in-negotiation' ? 'En Negociación' : quote.status,
          path: `/quote/${quote.id}`
        }));
      
      // Buscar en clientes
      const clientResults: SearchResult[] = clients
        .filter(client => 
          client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(client => ({
          id: client.id,
          type: 'client',
          title: client.name || `Cliente #${client.id}`,
          subtitle: client.contactName || 'Cliente',
          path: `/client-summary/${client.id}`
        }));
      
      // Combinar resultados y ordenar por relevancia
      setResults([...projectResults, ...quoteResults, ...clientResults]);
      setIsLoading(false);
    } else {
      setResults([]);
    }
  }, [searchTerm, projects, quotations, clients]);

  const handleResultClick = (path: string) => {
    navigate(path);
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Briefcase className="h-4 w-4 text-primary" />;
      case 'quote':
        return <FileText className="h-4 w-4 text-indigo-500" />;
      case 'client':
        return <Users className="h-4 w-4 text-emerald-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={onClose}>
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <div className="p-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              className="pl-10 pr-10"
              placeholder="Buscar proyectos, cotizaciones, clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Buscando...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => handleResultClick(result.path)}
                  >
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      {getIcon(result.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{result.title}</p>
                      <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchTerm.trim().length > 1 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No se encontraron resultados</p>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ingresa al menos 2 caracteres para buscar</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
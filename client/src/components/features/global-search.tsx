import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Users, Briefcase, X } from "lucide-react";
import { useLocation } from "wouter";

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

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length > 1) {
        setIsLoading(true);
        // Simulación de búsqueda - reemplazar con llamada real a API
        setTimeout(() => {
          const searchResults: SearchResult[] = [
            // Proyectos
            {
              id: 1,
              type: 'project',
              title: 'Desarrollo Web Warner',
              subtitle: 'Activo',
              path: '/project-summary/1'
            },
            // Cotizaciones
            {
              id: 5,
              type: 'quote',
              title: 'Diseño UX/UI',
              subtitle: 'Pendiente',
              path: '/quote/5'
            },
            // Clientes
            {
              id: 9,
              type: 'client',
              title: 'Acme Corporation',
              subtitle: 'Cliente',
              path: '/clients/9'
            }
          ].filter(item => 
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          setResults(searchResults);
          setIsLoading(false);
        }, 300);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

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
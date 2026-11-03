import { QueryError } from "@/components/query-error";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { authFetchJson } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Filter, 
  Users, 
  Building2, 
  FileText, 
  Briefcase,
  Clock,
  Star,
  ChevronRight,
  Calendar,
  DollarSign,
  Target,
  Zap,
  TrendingUp,
  AlertTriangle,
  X
} from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SearchResult {
  id: string;
  type: 'client' | 'project' | 'quotation' | 'deliverable' | 'alert';
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  priority?: 'high' | 'medium' | 'low' | 'critical';
  date?: Date;
  amount?: number;
  url: string;
  metadata?: Record<string, any>;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const { isOperations, hasPermission, hasAnyPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebouncedValue(searchTerm);
  const { data: matches = [], isFetching, error, refetch } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", debouncedSearch],
    queryFn: ({ signal }) => authFetchJson(`/api/search?q=${encodeURIComponent(debouncedSearch)}`, { signal }),
    enabled: isOpen && debouncedSearch.trim().length >= 2,
    staleTime: 30_000,
  });

  // Focus en el input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => searchTerm.trim().length < 2 ? [] : matches.filter(result => selectedFilters.length === 0 || selectedFilters.includes(result.type)), [searchTerm, matches, selectedFilters]);

  // Agrupar resultados por tipo
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      client: [],
      project: [],
      quotation: [],
      deliverable: [],
      alert: []
    };

    searchResults.forEach(result => {
      groups[result.type].push(result);
    });

    return groups;
  }, [searchResults]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client': return <Building2 className="h-4 w-4" />;
      case 'project': return <Briefcase className="h-4 w-4" />;
      case 'quotation': return <FileText className="h-4 w-4" />;
      case 'deliverable': return <Target className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string, priority?: string) => {
    if (priority === 'critical') return 'bg-red-100 text-red-800';
    if (priority === 'high') return 'bg-orange-100 text-orange-800';
    if (status === 'active') return 'bg-green-100 text-green-800';
    if (status === 'approved') return 'bg-blue-100 text-blue-800';
    if (status === 'completed') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleFilterToggle = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const clearFilters = () => {
    setSelectedFilters([]);
  };

  const getTypeCounts = () => {
    const counts: Record<string, number> = {};
    searchResults.forEach(result => {
      counts[result.type] = (counts[result.type] || 0) + 1;
    });
    return counts;
  };

  if (!isOpen) return null;

  const typeCounts = getTypeCounts();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/[0.55] p-3 backdrop-blur-[3px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden shadow-2xl sm:mt-8 sm:max-h-[calc(100dvh-4rem)]">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Búsqueda Global Inteligente
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar búsqueda">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={inputRef}
                placeholder="Buscar clientes, proyectos, cotizaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-base"
              />
            </div>

            {/* Filtros rápidos */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Filtros:</span>
              {[
                { key: 'client', label: 'Clientes', icon: Building2 },
                { key: 'project', label: 'Proyectos', icon: Briefcase },
                { key: 'quotation', label: 'Cotizaciones', icon: FileText },
                { key: 'deliverable', label: 'Entregables', icon: Target }
              ].map(filter => (
                <Button
                  key={filter.key}
                  variant={selectedFilters.includes(filter.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterToggle(filter.key)}
                  className="text-xs"
                >
                  <filter.icon className="h-3 w-3 mr-1" />
                  {filter.label}
                  {typeCounts[filter.key] && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {typeCounts[filter.key]}
                    </Badge>
                  )}
                </Button>
              ))}
              
              {selectedFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs text-gray-500"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto pt-0">
          {searchTerm.trim() === '' ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <h3 className="font-medium text-gray-600">Comienza a escribir para buscar</h3>
              <p className="text-sm">Encuentra clientes, proyectos, cotizaciones y más...</p>
            </div>
          ) : error ? <QueryError message="No se pudo completar la búsqueda." retry={refetch} /> : isFetching ? <p role="status" className="p-6">Buscando…</p> : searchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <h3 className="font-medium text-gray-600">No se encontraron resultados</h3>
              <p className="text-sm">Intenta con otros términos de búsqueda</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="overflow-x-auto pb-1">
                <TabsList className="grid min-w-[36rem] w-full grid-cols-5">
                  <TabsTrigger value="all" className="text-xs">
                    Todos ({searchResults.length})
                  </TabsTrigger>
                  <TabsTrigger value="client" className="text-xs">
                    Clientes ({groupedResults.client.length})
                  </TabsTrigger>
                  <TabsTrigger value="project" className="text-xs">
                    Proyectos ({groupedResults.project.length})
                  </TabsTrigger>
                  <TabsTrigger value="quotation" className="text-xs">
                    Cotizaciones ({groupedResults.quotation.length})
                  </TabsTrigger>
                  <TabsTrigger value="deliverable" className="text-xs">
                    Entregables ({groupedResults.deliverable.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="h-96 mt-4">
                <TabsContent value="all" className="mt-0">
                  <div className="space-y-2">
                    {searchResults.map(result => (
                      <SearchResultItem key={result.id} result={result} onSelect={onClose} />
                    ))}
                  </div>
                </TabsContent>

                {Object.entries(groupedResults).map(([type, results]) => (
                  <TabsContent key={type} value={type} className="mt-0">
                    <div className="space-y-2">
                      {results.map(result => (
                        <SearchResultItem key={result.id} result={result} onSelect={onClose} />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </ScrollArea>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  onSelect: () => void;
}

function SearchResultItem({ result, onSelect }: SearchResultItemProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client': return <Building2 className="h-4 w-4" />;
      case 'project': return <Briefcase className="h-4 w-4" />;
      case 'quotation': return <FileText className="h-4 w-4" />;
      case 'deliverable': return <Target className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string, priority?: string) => {
    if (priority === 'critical') return 'bg-red-100 text-red-800';
    if (priority === 'high') return 'bg-orange-100 text-orange-800';
    if (status === 'active') return 'bg-green-100 text-green-800';
    if (status === 'approved') return 'bg-blue-100 text-blue-800';
    if (status === 'completed') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Link href={result.url}>
      <div 
        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onSelect}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center gap-2 text-gray-600">
              {getTypeIcon(result.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">{result.title}</h4>
                {result.status && (
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getStatusColor(result.status, result.priority)}`}
                  >
                    {result.status}
                  </Badge>
                )}
                {result.metadata?.isAlwaysOn && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Always-On
                  </Badge>
                )}
              </div>
              
              {result.subtitle && (
                <p className="text-xs text-gray-600 mb-1">{result.subtitle}</p>
              )}
              
              {result.description && (
                <p className="text-xs text-gray-500">{result.description}</p>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                {result.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(result.date, "dd MMM yyyy", { locale: es })}
                  </span>
                )}
                
                {result.amount && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${result.amount.toLocaleString()}
                  </span>
                )}

                {result.metadata?.projects && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {result.metadata.projects} proyecto(s)
                  </span>
                )}

                {result.metadata?.qualityScore && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {result.metadata.qualityScore}/5
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}


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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [] } = useQuery({ queryKey: ['/api/clients'] });
  const { data: activeProjects = [] } = useQuery({ queryKey: ['/api/active-projects'] });
  const { data: quotations = [] } = useQuery({ queryKey: ['/api/quotations'] });
  const { data: deliverables = [] } = useQuery({ queryKey: ['/api/deliverables'] });

  // Focus en el input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Generar resultados de búsqueda inteligente
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const results: SearchResult[] = [];
    const term = searchTerm.toLowerCase();

    // Buscar en clientes
    (clients as any[]).forEach(client => {
      if (
        client.name?.toLowerCase().includes(term) ||
        client.contactName?.toLowerCase().includes(term) ||
        client.contactEmail?.toLowerCase().includes(term)
      ) {
        results.push({
          id: `client-${client.id}`,
          type: 'client',
          title: client.name,
          subtitle: client.contactName,
          description: client.contactEmail,
          url: `/client-summary/${client.id}`,
          metadata: { 
            projects: activeProjects.filter((p: any) => {
              const quotation = quotations.find((q: any) => q.id === p.quotationId);
              return quotation?.clientId === client.id;
            }).length
          }
        });
      }
    });

    // Buscar en proyectos activos
    (activeProjects as any[]).forEach(project => {
      const quotation = quotations.find((q: any) => q.id === project.quotationId);
      const client = clients.find((c: any) => c.id === quotation?.clientId);
      
      if (
        quotation?.projectName?.toLowerCase().includes(term) ||
        client?.name?.toLowerCase().includes(term) ||
        project.id.toString().includes(term)
      ) {
        results.push({
          id: `project-${project.id}`,
          type: 'project',
          title: quotation?.projectName || `Proyecto #${project.id}`,
          subtitle: client?.name,
          description: `Estado: ${project.status}`,
          status: project.status,
          date: new Date(project.startDate),
          url: `/project-details/${project.id}`,
          metadata: {
            isAlwaysOn: project.isAlwaysOnMacro,
            budget: quotation?.totalAmount
          }
        });
      }
    });

    // Buscar en cotizaciones
    (quotations as any[]).forEach(quotation => {
      const client = clients.find((c: any) => c.id === quotation.clientId);
      
      if (
        quotation.projectName?.toLowerCase().includes(term) ||
        client?.name?.toLowerCase().includes(term) ||
        quotation.id.toString().includes(term)
      ) {
        results.push({
          id: `quotation-${quotation.id}`,
          type: 'quotation',
          title: quotation.projectName,
          subtitle: client?.name,
          description: `Estado: ${quotation.status}`,
          status: quotation.status,
          amount: quotation.totalAmount,
          date: new Date(quotation.createdAt),
          url: `/quotations/${quotation.id}`,
          metadata: {
            analysisType: quotation.analysisType,
            projectType: quotation.projectType
          }
        });
      }
    });

    // Buscar en entregables
    (deliverables as any[]).forEach(deliverable => {
      const client = clients.find((c: any) => c.id === deliverable.clientId);
      
      if (
        deliverable.name?.toLowerCase().includes(term) ||
        client?.name?.toLowerCase().includes(term) ||
        deliverable.deliveryMonth?.toLowerCase().includes(term)
      ) {
        results.push({
          id: `deliverable-${deliverable.id}`,
          type: 'deliverable',
          title: deliverable.name,
          subtitle: client?.name,
          description: `Mes: ${deliverable.deliveryMonth}`,
          status: deliverable.deliveryOnTime ? 'completed' : 'delayed',
          priority: deliverable.deliveryOnTime ? 'low' : 'high',
          date: deliverable.delivery_date ? new Date(deliverable.delivery_date) : undefined,
          url: `/edit-deliverable/${deliverable.id}`,
          metadata: {
            qualityScore: deliverable.narrativeQuality,
            onTime: deliverable.deliveryOnTime
          }
        });
      }
    });

    // Filtrar por filtros seleccionados
    let filteredResults = results;
    if (selectedFilters.length > 0) {
      filteredResults = results.filter(result => 
        selectedFilters.includes(result.type)
      );
    }

    // Ordenar por relevancia y fecha
    return filteredResults.sort((a, b) => {
      // Priorizar por relevancia (exactitud del match)
      const aExact = a.title.toLowerCase() === term;
      const bExact = b.title.toLowerCase() === term;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Luego por fecha (más reciente primero)
      if (a.date && b.date) {
        return b.date.getTime() - a.date.getTime();
      }

      return 0;
    });
  }, [searchTerm, clients, activeProjects, quotations, deliverables, selectedFilters]);

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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[80vh] mt-20 shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Búsqueda Global Inteligente
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
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

        <CardContent className="pt-0">
          {searchTerm.trim() === '' ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <h3 className="font-medium text-gray-600">Comienza a escribir para buscar</h3>
              <p className="text-sm">Encuentra clientes, proyectos, cotizaciones y más...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <h3 className="font-medium text-gray-600">No se encontraron resultados</h3>
              <p className="text-sm">Intenta con otros términos de búsqueda</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
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

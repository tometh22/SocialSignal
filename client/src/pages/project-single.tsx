import { useState, useEffect } from 'react';
import { useParams, useLocation, useSearch, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Building2, 
  Calendar,
  Settings,
  Users,
  BarChart3,
  Clock,
  DollarSign,
  TrendingUp,
  Cog,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectDataProvider, useProjectData } from '@/contexts/ProjectDataProvider';

// 🎯 COMPONENTES DE PESTAÑAS según handoff
import DashboardTab from '@/components/project-tabs/DashboardTab';
import EquipoTab from '@/components/project-tabs/EquipoTab';
import PerformanceTab from '@/components/project-tabs/PerformanceTab';
import TiempoTab from '@/components/project-tabs/TiempoTab';
import IngresosTab from '@/components/project-tabs/IngresosTab';
import CostosTab from '@/components/project-tabs/CostosTab';
import FinancieroTab from '@/components/project-tabs/FinancieroTab';
import OperacionalTab from '@/components/project-tabs/OperacionalTab';

// 🎯 HEADER DEL PROYECTO con filtro temporal global
function ProjectHeader() {
  const { projectId, timeFilter, basis, setTimeFilter, setBasis } = useProjectData();

  // Query para información básica del proyecto
  const { data: projectInfo, isLoading: isLoadingProject } = useQuery({
    queryKey: ['/api/active-projects', 'projects'],
    enabled: !!projectId,
    select: (data: any) => data?.find((p: any) => p.id === projectId)
  });

  const { data: clientInfo } = useQuery({
    queryKey: ['/api/clients', 'clients'],
    enabled: !!projectInfo?.clientId,
    select: (data: any) => data?.find((c: any) => c.id === projectInfo?.clientId)
  });

  // 🎯 FILTROS TEMPORALES según handoff
  const timeFilterOptions = [
    { value: 'august_2025', label: 'Agosto 2025' },
    { value: 'july_2025', label: 'Julio 2025' },
    { value: 'june_2025', label: 'Junio 2025' },
    { value: 'q3_2025', label: 'Q3 2025' },
    { value: 'this_month', label: 'Este mes' },
    { value: 'last_month', label: 'Mes anterior' },
    { value: 'this_quarter', label: 'Este trimestre' },
    { value: 'this_year', label: 'Este año' },
  ];

  if (isLoadingProject) {
    return (
      <div className="border-b bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    );
  }

  const projectName = projectInfo?.quotation?.projectName || 'Proyecto';
  const clientName = clientInfo?.name || 'Cliente';

  return (
    <div className="border-b bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/active-projects">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Proyectos
            </Button>
          </Link>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-project-name">
              {projectName}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 className="h-4 w-4" />
              <span data-testid="text-client-name">{clientName}</span>
              <Badge variant="outline" data-testid="badge-project-id">
                ID: {projectId}
              </Badge>
            </div>
          </div>
        </div>

        {/* 🎯 FILTRO TEMPORAL GLOBAL */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={timeFilter} onValueChange={setTimeFilter} data-testid="select-time-filter">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-500" />
            <Select value={basis} onValueChange={(value: 'ECON' | 'EXEC') => setBasis(value)} data-testid="select-basis">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ECON">ECON</SelectItem>
                <SelectItem value="EXEC">EXEC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🎯 NAVEGACIÓN ENTRE PESTAÑAS según handoff
function ProjectTabs() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'equipo', label: 'Equipo', icon: Users },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'tiempo', label: 'Tiempo', icon: Clock },
    { id: 'ingresos', label: 'Ingresos', icon: DollarSign },
    { id: 'costos', label: 'Costos', icon: DollarSign },
    { id: 'financiero', label: 'Financiero', icon: TrendingUp },
    { id: 'operacional', label: 'Operacional', icon: Cog },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
      {/* 🎯 NAVEGACIÓN HORIZONTAL */}
      <div className="border-b bg-gray-50 px-6">
        <TabsList className="grid w-full grid-cols-8 bg-transparent h-auto p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* 🎯 CONTENIDO DE PESTAÑAS - todas usan el mismo motor */}
      <div className="flex-1 p-6">
        <TabsContent value="dashboard" className="mt-0">
          <DashboardTab />
        </TabsContent>
        
        <TabsContent value="equipo" className="mt-0">
          <EquipoTab />
        </TabsContent>
        
        <TabsContent value="performance" className="mt-0">
          <PerformanceTab />
        </TabsContent>
        
        <TabsContent value="tiempo" className="mt-0">
          <TiempoTab />
        </TabsContent>
        
        <TabsContent value="ingresos" className="mt-0">
          <IngresosTab />
        </TabsContent>
        
        <TabsContent value="costos" className="mt-0">
          <CostosTab />
        </TabsContent>
        
        <TabsContent value="financiero" className="mt-0">
          <FinancieroTab />
        </TabsContent>
        
        <TabsContent value="operacional" className="mt-0">
          <OperacionalTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}

// 🎯 PÁGINA PRINCIPAL sin provider (se envuelve desde App.tsx)
function ProjectSingleContent() {
  return (
    <div className="flex flex-col h-full">
      <ProjectHeader />
      <ProjectTabs />
    </div>
  );
}

// 🎯 WRAPPER CON PROVIDER según handoff
function ProjectSingle() {
  const params = useParams();
  const search = useSearch();
  const projectId = parseInt(params.id as string);
  
  // Extraer parámetros de query según handoff
  const searchParams = new URLSearchParams(search);
  const timeFilter = searchParams.get('timeFilter') || 'august_2025';
  const basis = (searchParams.get('basis') || 'ECON') as 'ECON' | 'EXEC';

  return (
    <ProjectDataProvider
      initialProjectId={projectId}
      initialTimeFilter={timeFilter}
      initialBasis={basis}
    >
      <ProjectSingleContent />
    </ProjectDataProvider>
  );
}

export default ProjectSingle;
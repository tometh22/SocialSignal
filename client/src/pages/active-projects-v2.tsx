/**
 * UNIFIED ACTIVE PROJECTS PAGE V2
 * 
 * Implements the blueprint specification:
 * - Single useQuery to GET /api/projects/active
 * - Replaces multiple hooks with unified data source
 * - Maintains familiar UI but powered by aggregated data
 * - Uses ProjectMetrics, PortfolioSummary, TimeFilter contracts
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  ChevronDown,
  ChevronRight,
  Eye,
  TrendingUp,
  CalendarDays,
  Target,
  Timer,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { 
  ActiveProjectsResponse, 
  ActiveProjectItem,
  TimeFilter 
} from "@shared/schema";
import { f } from "@/utils/formatters";

// ==================== TYPES & INTERFACES ====================

interface ProjectCardProps {
  project: ActiveProjectItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// ==================== PROJECT CARD COMPONENT ====================

function ProjectCard({ project, isExpanded, onToggleExpand }: ProjectCardProps) {
  const { metrics, flags, client } = project;

  // Calculate status indicators based on flags and metrics
  const hasData = flags.hasSales || flags.hasCosts || flags.hasHours;
  const isHealthy = metrics.markupRatio && metrics.markupRatio >= 1.15;
  const isEfficient = metrics.efficiencyFrac && metrics.efficiencyFrac <= 1.05;

  // 🚀 DUAL CURRENCY: Format display values using native currency
  const revenueDisplay = f.currency(
    metrics.revenueDisplay ?? metrics.revenueUSD, 
    metrics.displayCurrency, 
    true // compact format
  );

  const markupDisplay = metrics.markupRatio 
    ? f.markupX(metrics.markupRatio)
    : 'N/A';

  const efficiencyDisplay = metrics.efficiencyFrac 
    ? f.pct(metrics.efficiencyFrac)
    : 'N/A';

  const progressValue = metrics.targetHours > 0 
    ? Math.min((metrics.workedHours / metrics.targetHours) * 100, 100)
    : 0;

  return (
    <Card 
      className={`mb-4 transition-all duration-200 hover:shadow-md ${
        hasData ? 'border-blue-200' : 'border-gray-200'
      }`}
      data-testid={`card-project-${project.projectId}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="p-1 h-6 w-6"
              data-testid={`button-toggle-${project.projectId}`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>

            {/* Client logo/icon */}
            <div className="flex items-center gap-2">
              {client.logo ? (
                <img 
                  src={client.logo} 
                  alt={client.name} 
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-gray-500" />
                </div>
              )}
              
              <div>
                <h3 className="font-semibold text-lg" data-testid={`text-project-name-${project.projectId}`}>
                  {project.name}
                </h3>
                <p className="text-sm text-gray-600" data-testid={`text-client-name-${project.projectId}`}>
                  {client.name}
                </p>
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={hasData ? "default" : "secondary"}
              className="capitalize"
              data-testid={`badge-status-${project.projectId}`}
            >
              {project.status}
            </Badge>
            
            <Badge 
              variant="outline"
              className="capitalize"
              data-testid={`badge-type-${project.projectId}`}
            >
              {project.type}
            </Badge>

            {/* Health indicators */}
            {isHealthy && (
              <CheckCircle2 className="h-4 w-4 text-green-500" data-testid={`icon-healthy-${project.projectId}`} />
            )}
            {!isHealthy && metrics.markupRatio && (
              <AlertCircle className="h-4 w-4 text-orange-500" data-testid={`icon-warning-${project.projectId}`} />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Summary metrics - always visible */}
      <CardContent className="pt-0">
        {/* Metrics grid - 6 columns: Revenue, Profit, Cost, Markup, Margin, Efficiency */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div className="text-center">
            <div className="text-sm font-semibold text-green-600" data-testid={`text-revenue-${project.projectId}`}>
              {revenueDisplay}
            </div>
            <div className="text-xs text-gray-500">Revenue</div>
          </div>
          
          <div className="text-center">
            <div className={`text-sm font-semibold ${metrics.profitUSD >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-profit-${project.projectId}`}>
              {f.usdCompact.format(metrics.profitUSD)}
            </div>
            <div className="text-xs text-gray-500">Profit</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm font-semibold text-orange-600" data-testid={`text-cost-${project.projectId}`}>
              {f.usdCompact.format(metrics.costUSD)}
            </div>
            <div className="text-xs text-gray-500">Cost</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm font-semibold text-blue-600" data-testid={`text-markup-${project.projectId}`}>
              {markupDisplay}
            </div>
            <div className="text-xs text-gray-500">Markup</div>
          </div>
          
          <div className="text-center">
            <div className={`text-sm font-semibold ${(metrics.marginFrac && metrics.marginFrac >= 0) ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-margin-${project.projectId}`}>
              {metrics.marginFrac ? f.pct(metrics.marginFrac) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Margin</div>
          </div>
          
          <div className="text-center">
            <div className={`text-sm font-semibold ${(metrics.efficiencyFrac && metrics.efficiencyFrac <= 1.05) ? 'text-green-600' : 'text-orange-600'}`} data-testid={`text-efficiency-${project.projectId}`}>
              {efficiencyDisplay}
            </div>
            <div className="text-xs text-gray-500">Efficiency</div>
          </div>
        </div>

        {/* Progress bar for hour utilization */}
        {metrics.targetHours > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress: {metrics.workedHours.toFixed(1)}h / {metrics.targetHours.toFixed(1)}h</span>
              <span>{progressValue.toFixed(0)}%</span>
            </div>
            <Progress 
              value={progressValue} 
              className="h-2"
              data-testid={`progress-hours-${project.projectId}`}
            />
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {/* Financial details */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Financial
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="font-mono" data-testid={`text-revenue-detail-${project.projectId}`}>
                      {revenueDisplay}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost:</span>
                    <span className="font-mono" data-testid={`text-cost-detail-${project.projectId}`}>
                      {f.usd.format(metrics.costUSD)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Profit:</span>
                    <span 
                      className={`font-mono ${metrics.profitUSD >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      data-testid={`text-profit-detail-${project.projectId}`}
                    >
                      {f.usd.format(metrics.profitUSD)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time details */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Time Tracking
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Target:</span>
                    <span className="font-mono" data-testid={`text-target-hours-${project.projectId}`}>
                      {metrics.targetHours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Worked:</span>
                    <span className="font-mono" data-testid={`text-worked-hours-${project.projectId}`}>
                      {metrics.workedHours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efficiency:</span>
                    <span 
                      className={`font-mono ${
                        metrics.efficiencyFrac && metrics.efficiencyFrac <= 1.05 ? 'text-green-600' : 'text-orange-600'
                      }`}
                      data-testid={`text-efficiency-detail-${project.projectId}`}
                    >
                      {efficiencyDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Flags & Status */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Data Status
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${flags.hasSales ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Sales Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${flags.hasCosts ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Cost Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${flags.hasHours ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Hours Data</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MAIN COMPONENT ====================

export default function ActiveProjectsV2() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('last_month');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  
  const { toast } = useToast();

  // ==================== UNIFIED DATA QUERY ====================
  // Single source of truth according to blueprint

  const { 
    data: response, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<ActiveProjectsResponse>({
    queryKey: ['/api/projects/active', timeFilter, showOnlyActive],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeFilter: typeof timeFilter === 'string' ? timeFilter : `${timeFilter.start}_to_${timeFilter.end}`,
        onlyActiveInPeriod: String(showOnlyActive)
      });

      const res = await fetch(`/api/projects/active?${params}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds - fresh data
    gcTime: 5 * 60 * 1000  // 5 minutes cache
  });

  // ==================== COMPUTED VALUES ====================

  const { projects = [], summary, period } = response || {};
  
  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(term) ||
        project.client.name.toLowerCase().includes(term)
      );
    }
    
    // Sort by Revenue desc → Profit desc → Hours desc (immutable with null safety)
    const sortedProjects = filtered.slice();
    return sortedProjects.sort((a, b) => {
      // Primary sort: Revenue desc
      const revenueDiff = (b.metrics.revenueUSD ?? 0) - (a.metrics.revenueUSD ?? 0);
      if (revenueDiff !== 0) return revenueDiff;
      
      // Secondary sort: Profit desc
      const profitDiff = (b.metrics.profitUSD ?? 0) - (a.metrics.profitUSD ?? 0);
      if (profitDiff !== 0) return profitDiff;
      
      // Tertiary sort: Hours desc
      return (b.metrics.workedHours ?? 0) - (a.metrics.workedHours ?? 0);
    });
  }, [projects, searchTerm]);

  // Use new response structure
  const portfolioSummary = summary;
  const periodInfo = period;

  // ==================== HANDLERS ====================

  const handleToggleExpand = (projectId: number) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value as TimeFilter);
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing data...",
      description: "Fetching latest project information"
    });
  };

  // ==================== ERROR HANDLING ====================

  if (error) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error loading projects</h2>
              <p className="text-gray-600 mb-4">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <Button onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" data-testid="heading-active-projects">
                Active Projects
              </h1>
              <p className="text-gray-600 mt-1">
                Unified dashboard powered by Excel MAESTRO data
              </p>
            </div>
            
            <Button 
              onClick={handleRefresh} 
              disabled={isLoading}
              className="flex items-center gap-2"
              data-testid="button-refresh"
            >
              <TrendingUp className="h-4 w-4" />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {/* Period info */}
          {periodInfo && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <CalendarDays className="h-4 w-4" />
              <span data-testid="text-period-info">
                Period: {periodInfo.label} ({periodInfo.start} to {periodInfo.end})
              </span>
            </div>
          )}
        </div>

        {/* Portfolio Summary Cards */}
        {portfolioSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card data-testid="card-portfolio-revenue">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Period Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      {f.usdCompact.format(portfolioSummary.periodRevenueUSD)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-portfolio-profit">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Period Profit</p>
                    <p className={`text-2xl font-bold ${
                      portfolioSummary.periodProfitUSD >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {f.usdCompact.format(portfolioSummary.periodProfitUSD)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-portfolio-hours">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Period Hours</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {f.hours(portfolioSummary.periodWorkedHours)}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-portfolio-projects">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Projects</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {portfolioSummary.activeProjects} / {portfolioSummary.totalProjects}
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Controls */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              {/* Time Filter */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Select value={String(timeFilter)} onValueChange={handleTimeFilterChange}>
                  <SelectTrigger className="w-48" data-testid="select-time-filter">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_quarter">This Quarter</SelectItem>
                    <SelectItem value="agosto_2025">August 2025</SelectItem>
                    <SelectItem value="julio_2025">July 2025</SelectItem>
                    <SelectItem value="q3_2025">Q3 2025</SelectItem>
                    <SelectItem value="q4_2025">Q4 2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search projects or clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                  data-testid="input-search"
                />
              </div>

              {/* Active only filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Button
                  variant={showOnlyActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyActive(!showOnlyActive)}
                  data-testid="button-filter-active"
                >
                  Active Only ({filteredProjects.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No projects found</h3>
                <p className="text-gray-500">
                  {searchTerm ? 'Try adjusting your search terms' : 'No active projects in the selected period'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.projectId}
                project={project}
                isExpanded={expandedProjects.has(project.projectId)}
                onToggleExpand={() => handleToggleExpand(project.projectId)}
              />
            ))}
          </div>
        )}

        {/* Debug info in dev mode */}
        {process.env.NODE_ENV === 'development' && response && (
          <Card className="mt-6 border-dashed">
            <CardContent className="pt-4">
              <div className="text-sm text-gray-600">
                <strong>Debug Info:</strong> Engine: unified_aggregator | Source: Excel_MAESTRO_unified | Filter: {typeof timeFilter === 'string' ? timeFilter : `${timeFilter.start}_to_${timeFilter.end}`}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
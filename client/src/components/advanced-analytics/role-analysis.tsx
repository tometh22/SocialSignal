import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, DollarSign, Clock, TrendingUp, Briefcase } from "lucide-react";

interface TeamMember {
  name: string;
  roleName: string;
  hoursAsana: number;
  hoursBilling: number;
  targetHours: number;
  hourlyRateARS?: number;
  fx?: number;
  costARS?: number;
  costUSD?: number;
}

interface RoleAnalysisProps {
  teamBreakdown: TeamMember[];
  currency?: string;
}

interface RoleMetrics {
  roleName: string;
  personCount: number;
  totalHours: number;
  targetHours: number;
  totalCost: number;
  avgCostPerHour: number;
  efficiency: number;
  budgetUtilization: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function RoleAnalysis({ teamBreakdown, currency = "USD" }: RoleAnalysisProps) {
  // Agrupar datos por rol
  const roleMetrics: RoleMetrics[] = Object.values(
    teamBreakdown.reduce((acc, member) => {
      const role = member.roleName || "Sin Rol";
      
      if (!acc[role]) {
        acc[role] = {
          roleName: role,
          personCount: 0,
          totalHours: 0,
          targetHours: 0,
          totalCost: 0,
          avgCostPerHour: 0,
          efficiency: 0,
          budgetUtilization: 0,
        };
      }
      
      acc[role].personCount += 1;
      acc[role].totalHours += member.hoursAsana || 0;
      acc[role].targetHours += member.targetHours || 0;
      acc[role].totalCost += member.costUSD || 0;
      
      return acc;
    }, {} as Record<string, RoleMetrics>)
  ).map(role => ({
    ...role,
    avgCostPerHour: role.totalHours > 0 ? role.totalCost / role.totalHours : 0,
    efficiency: role.targetHours > 0 ? (role.totalHours / role.targetHours) * 100 : 0,
    budgetUtilization: role.targetHours > 0 ? (role.totalHours / role.targetHours) * 100 : 0,
  }));

  // Ordenar por costo total (mayor a menor)
  const sortedByMetrics = [...roleMetrics].sort((a, b) => b.totalCost - a.totalCost);

  // Datos para gráficos
  const costChartData = sortedByMetrics.map(role => ({
    name: role.roleName,
    costo: Math.round(role.totalCost),
    horas: Math.round(role.totalHours * 10) / 10,
  }));

  const hoursDistribution = sortedByMetrics.map(role => ({
    name: role.roleName,
    value: Math.round(role.totalHours * 10) / 10,
  }));

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency <= 80) return "text-green-600 bg-green-50";
    if (efficiency <= 100) return "text-blue-600 bg-blue-50";
    if (efficiency <= 120) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency <= 80) return { label: "Eficiente", color: "bg-green-500" };
    if (efficiency <= 100) return { label: "Óptimo", color: "bg-blue-500" };
    if (efficiency <= 120) return { label: "Atención", color: "bg-orange-500" };
    return { label: "Sobre presupuesto", color: "bg-red-500" };
  };

  const totalCost = roleMetrics.reduce((sum, role) => sum + role.totalCost, 0);
  const totalHours = roleMetrics.reduce((sum, role) => sum + role.totalHours, 0);
  const totalPeople = roleMetrics.reduce((sum, role) => sum + role.personCount, 0);
  const avgCostPerHour = totalHours > 0 ? totalCost / totalHours : 0;

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Roles Activos</p>
                <p className="text-2xl font-bold text-gray-900">{roleMetrics.length}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Personas</p>
                <p className="text-2xl font-bold text-gray-900">{totalPeople}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Horas Totales</p>
                <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Costo Prom/Hora</p>
                <p className="text-2xl font-bold text-gray-900">${avgCostPerHour.toFixed(0)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Métricas por Rol */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas por Rol</CardTitle>
          <CardDescription>
            Análisis detallado de rendimiento y costos por tipo de rol
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Personas</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">$/Hora</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Eficiencia</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedByMetrics.map((role, index) => {
                  const badge = getEfficiencyBadge(role.efficiency);
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${COLORS[index % COLORS.length]}`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="text-sm font-medium text-gray-900">{role.roleName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-gray-900">{role.personCount}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">{role.totalHours.toFixed(1)}h</div>
                          <div className="text-xs text-gray-500">Target: {role.targetHours.toFixed(0)}h</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">
                            ${role.totalCost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {((role.totalCost / totalCost) * 100).toFixed(1)}% del total
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">
                          ${role.avgCostPerHour.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className={`${badge.color} text-white text-xs px-2 py-1`}>
                            {badge.label}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {role.efficiency.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de Costos */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Costos por Rol</CardTitle>
            <CardDescription>Inversión por tipo de rol en {currency}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'costo') return [`$${value.toLocaleString()}`, 'Costo'];
                    if (name === 'horas') return [`${value}h`, 'Horas'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="costo" fill="#3b82f6" name="Costo" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribución de Horas */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Horas por Rol</CardTitle>
            <CardDescription>Proporción de tiempo por tipo de rol</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={hoursDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {hoursDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}h`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

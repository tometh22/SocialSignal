
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2, PieChart as PieChartIcon, Maximize2, Pencil, FileText } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface TimePersonnel {
  name: string;
  hours: number;
  role: string;
}

interface BillableData {
  name: string;
  value: number;
}

interface TimeAndCostData {
  date: string;
  totalCost: number;
  totalHours: number;
  cost?: number;
  hours?: number;
}

interface ChartsSectionProps {
  timeByPersonnelData: TimePersonnel[];
  billableDistributionData: BillableData[];
  timeAndCostData: TimeAndCostData[];
  onChartExpand: (type: string, title: string) => void;
  onRegisterHours: () => void;
}

export const ChartsSection = ({
  timeByPersonnelData,
  billableDistributionData,
  timeAndCostData,
  onChartExpand,
  onRegisterHours
}: ChartsSectionProps) => {
  return (
    <div className="mb-8">
      {/* Gráfico de Evolución de Tiempo y Costo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-6"
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-medium">Evolución de Tiempo y Costo</CardTitle>
                <CardDescription>Seguimiento acumulado a lo largo del proyecto</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChartExpand('costTimeline', 'Evolución de Tiempo y Costo')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {timeAndCostData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeAndCostData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#888" }}
                      tickFormatter={(value) => `${value}h`}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "Costo acumulado")
                          return [`$${value}`, name];
                        return [`${value}h`, name];
                      }}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalCost"
                      name="Costo acumulado"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalHours"
                      name="Horas acumuladas"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No hay suficientes datos para mostrar la evolución.</p>
                  <p className="text-sm text-muted-foreground">Registre más horas en diferentes fechas para visualizar la tendencia.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de distribución de horas por personal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-medium">
                    Distribución de Horas por Personal
                  </CardTitle>
                  <CardDescription>
                    Horas trabajadas por cada miembro del equipo
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChartExpand('personnelBar', 'Distribución de Horas por Personal')}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {timeByPersonnelData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={timeByPersonnelData}
                      margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                      barSize={26}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#888",
                          fontSize: 12
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#888",
                          fontSize: 12
                        }}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          `${value} horas`,
                          "Tiempo registrado"
                        ]}
                        labelFormatter={(label) => `Personal: ${label}`}
                      />
                      <Bar
                        dataKey="hours"
                        fill="#4f46e5"
                        name="Horas"
                        radius={[4, 4, 0, 0]}
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center">
                  <div className="text-center">
                    <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No hay datos disponibles para este periodo.</p>
                    <p className="text-sm text-muted-foreground">Intente cambiar el filtro de tiempo.</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/20 py-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={onRegisterHours}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Registrar Horas
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
        
        {/* Gráfico de distribución facturables vs no facturables */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-medium">
                    Horas Facturables vs No Facturables
                  </CardTitle>
                  <CardDescription>
                    Distribución de horas según facturación
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChartExpand('billablePie', 'Horas Facturables vs No Facturables')}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {billableDistributionData.length > 0 ? (
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
                      <Pie
                        data={billableDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={{
                          stroke: "#666",
                          strokeWidth: 1,
                          length: 15,
                          length2: 10
                        }}
                        outerRadius={90}
                        innerRadius={45}
                        fill="#8884d8"
                        dataKey="value"
                        animationDuration={1500}
                        label={({ name, percent, value }) => 
                          `${name}: ${value}h (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {billableDistributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "#4f46e5" : "#94a3b8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name) => [`${value} horas`, name]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center">
                  <div className="text-center">
                    <PieChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No hay datos disponibles para este periodo.</p>
                    <p className="text-sm text-muted-foreground">Intente cambiar el filtro de tiempo.</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/20 py-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={onRegisterHours}
              >
                <FileText className="h-3 w-3 mr-1" />
                Ver Detalles
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ChartsSection;
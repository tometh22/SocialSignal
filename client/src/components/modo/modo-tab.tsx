import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ModoTabProps {
  clientId: number;
}

interface DeliverableData {
  id: number;
  title: string;
  project_id: number;
  delivery_date: string;
  due_date: string;
  on_time: boolean;
  narrative_quality: number;
  graphics_effectiveness: number;
  format_design: number;
  relevant_insights: number;
  operations_feedback: number;
  client_feedback: number;
  brief_compliance: number;
  hours_available: number;
  hours_real: number;
  hours_compliance: number;
  notes?: string;
}

interface ModoSummary {
  totalDeliverables: number;
  onTimeDeliveries: number;
  onTimePercentage: number;
  averageScores: {
    narrativeQuality: number;
    graphicsEffectiveness: number;
    formatDesign: number;
    relevantInsights: number;
    operationsFeedback: number;
    clientFeedback: number;
    briefCompliance: number;
    hoursCompliance: number;
  };
  averageHours: {
    available: number;
    real: number;
    compliance: number;
  };
  totalComments: number;
  latestComment?: {
    id: number;
    comment_text: string;
    year: number;
    quarter: number;
    timestamp: string;
  };
}

interface CommentData {
  id: number;
  comment_text: string;
  year: number;
  quarter: number;
  timestamp: string;
}

const ModoTab = ({ clientId }: ModoTabProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [newComment, setNewComment] = useState("");
  
  // Calcular trimestre y año actual
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentQuarterValue = Math.floor(currentMonth / 3) + 1;
  const currentYearValue = today.getFullYear();
  
  const [currentQuarter, setCurrentQuarter] = useState(currentQuarterValue);
  const [currentYear, setCurrentYear] = useState(currentYearValue);

  // Fetch MODO data for this client
  const { data: modoSummary, isLoading: summaryLoading } = useQuery<ModoSummary>({
    queryKey: ["/api/clients", clientId, "modo-summary"],
    enabled: !!clientId,
  });

  // Fetch deliverables
  const { data: deliverables, isLoading: deliverablesLoading } = useQuery<DeliverableData[]>({
    queryKey: ["/api/clients", clientId, "deliverables"],
    enabled: !!clientId,
  });

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useQuery<CommentData[]>({
    queryKey: ["/api/clients", clientId, "modo-comments"],
    enabled: !!clientId,
  });

  // Function to handle saving a new comment
  const handleSaveComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "El comentario no puede estar vacío",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}/modo-comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment_text: newComment,
          year: currentYear,
          quarter: currentQuarter,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al guardar el comentario");
      }

      // Invalidar consultas para actualizar la interfaz
      // Nota: si estuvieras usando react-query mutations, podrías usar queryClient.invalidateQueries aquí
      
      toast({
        title: "Comentario guardado",
        description: "El comentario ha sido guardado exitosamente",
      });
      
      // Limpiar campo y refrescar datos
      setNewComment("");
      
      // Refrescar la consulta manualmente (alternativa a invalidateQueries)
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error al guardar el comentario:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al guardar el comentario",
        variant: "destructive",
      });
    }
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: es });
    } catch (error) {
      return "Fecha inválida";
    }
  };

  // Helper to get color for scores
  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "text-green-600";
    if (score >= 3.5) return "text-blue-600";
    if (score >= 2.5) return "text-yellow-600";
    return "text-red-600";
  };

  // Helper to get color for on-time percentage
  const getPercentageColor = (percentage: number) => {
    if (percentage >= 85) return "text-green-600";
    if (percentage >= 70) return "text-blue-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  // Helper to get status icon
  const getStatusIcon = (onTime: boolean) => {
    return onTime ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );
  };

  if (summaryLoading || deliverablesLoading || commentsLoading) {
    return <div className="flex justify-center p-4">Cargando datos MODO...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sistema de Seguimiento Operacional (MODO)</h2>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Exportar a Excel
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard MODO</TabsTrigger>
          <TabsTrigger value="deliverables">Entregables</TabsTrigger>
          <TabsTrigger value="comments">Comentarios del Cliente</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Entregables a tiempo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className={`text-2xl font-bold ${getPercentageColor(modoSummary?.onTimePercentage || 0)}`}>
                    {modoSummary?.onTimePercentage ? modoSummary.onTimePercentage.toFixed(1) : '0'}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {modoSummary?.onTimeDeliveries || 0} de {modoSummary?.totalDeliverables || 0} entregables
                  </p>
                  <Progress
                    value={modoSummary?.onTimePercentage || 0}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Calidad narrativa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className={`text-2xl font-bold ${getScoreColor(modoSummary?.averageScores?.narrativeQuality || 0)}`}>
                    {modoSummary?.averageScores?.narrativeQuality ? modoSummary.averageScores.narrativeQuality.toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Promedio sobre 5.0
                  </p>
                  <Progress
                    value={(modoSummary?.averageScores?.narrativeQuality || 0) * 20}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Efectividad de gráficos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className={`text-2xl font-bold ${getScoreColor(modoSummary?.averageScores?.graphicsEffectiveness || 0)}`}>
                    {modoSummary?.averageScores?.graphicsEffectiveness ? modoSummary.averageScores.graphicsEffectiveness.toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Promedio sobre 5.0
                  </p>
                  <Progress
                    value={(modoSummary?.averageScores?.graphicsEffectiveness || 0) * 20}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Feedback del cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className={`text-2xl font-bold ${getScoreColor(modoSummary?.averageScores?.clientFeedback || 0)}`}>
                    {modoSummary?.averageScores?.clientFeedback ? modoSummary.averageScores.clientFeedback.toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Promedio sobre 5.0
                  </p>
                  <Progress
                    value={(modoSummary?.averageScores?.clientFeedback || 0) * 20}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cumplimiento del brief</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className={`text-2xl font-bold ${getScoreColor(modoSummary?.averageScores?.briefCompliance || 0)}`}>
                    {modoSummary?.averageScores?.briefCompliance ? modoSummary.averageScores.briefCompliance.toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Promedio sobre 5.0
                  </p>
                  <Progress
                    value={(modoSummary?.averageScores?.briefCompliance || 0) * 20}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cumplimiento de horas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className={`text-2xl font-bold ${getScoreColor(modoSummary?.averageScores?.hoursCompliance || 0)}`}>
                    {modoSummary?.averageScores?.hoursCompliance ? modoSummary.averageScores.hoursCompliance.toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {modoSummary?.averageHours?.real || 0} de {modoSummary?.averageHours?.available || 0} horas promedio
                  </p>
                  <Progress
                    value={(modoSummary?.averageScores?.hoursCompliance || 0) * 20}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">SCORE TOTAL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  {/* Calculate a weighted average of all scores */}
                  {(() => {
                    const scores = modoSummary?.averageScores || {
                      narrativeQuality: 0,
                      graphicsEffectiveness: 0,
                      formatDesign: 0,
                      relevantInsights: 0,
                      operationsFeedback: 0,
                      clientFeedback: 0,
                      briefCompliance: 0,
                      hoursCompliance: 0
                    };
                    
                    const totalScore = (
                      scores.narrativeQuality * 0.15 + 
                      scores.graphicsEffectiveness * 0.15 + 
                      scores.formatDesign * 0.1 +
                      scores.relevantInsights * 0.2 +
                      scores.operationsFeedback * 0.1 +
                      scores.clientFeedback * 0.2 +
                      scores.briefCompliance * 0.1
                    );
                    
                    return (
                      <div className={`text-2xl font-bold ${getScoreColor(totalScore)}`}>
                        {totalScore.toFixed(2)}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">
                    Promedio ponderado sobre 5.0
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Horas totales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className="text-2xl font-bold">
                    {modoSummary?.averageHours?.real || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tiempo promedio por informe (horas)
                  </p>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span>Disponible: {modoSummary?.averageHours?.available || 0}h</span>
                    <span>Real: {modoSummary?.averageHours?.real || 0}h</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Latest client comment */}
          {modoSummary?.latestComment && (
            <Card>
              <CardHeader>
                <CardTitle>Último comentario del cliente</CardTitle>
                <CardDescription>
                  Q{modoSummary.latestComment.quarter} {modoSummary.latestComment.year}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">"{modoSummary.latestComment.comment_text}"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Lista de Entregables</h3>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Entregable
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fecha Entrega</TableHead>
                    <TableHead>Fecha Límite</TableHead>
                    <TableHead className="text-center">A Tiempo</TableHead>
                    <TableHead className="text-center">Calidad Narrativa</TableHead>
                    <TableHead className="text-center">Gráficos</TableHead>
                    <TableHead className="text-center">Formato</TableHead>
                    <TableHead className="text-center">Insights</TableHead>
                    <TableHead className="text-center">FB Operaciones</TableHead>
                    <TableHead className="text-center">FB Cliente</TableHead>
                    <TableHead className="text-center">Brief</TableHead>
                    <TableHead className="text-center">Horas Disp.</TableHead>
                    <TableHead className="text-center">Horas Real</TableHead>
                    <TableHead className="text-center">Cumplimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!deliverables || deliverables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-4">
                        No hay entregables registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliverables.map((deliverable) => (
                      <TableRow key={deliverable.id}>
                        <TableCell className="font-medium">{deliverable.title}</TableCell>
                        <TableCell>{formatDate(deliverable.delivery_date)}</TableCell>
                        <TableCell>{formatDate(deliverable.due_date)}</TableCell>
                        <TableCell className="text-center">
                          {getStatusIcon(deliverable.on_time)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.narrative_quality || 0)}>
                            {deliverable.narrative_quality !== undefined && deliverable.narrative_quality !== null ? deliverable.narrative_quality.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.graphics_effectiveness || 0)}>
                            {deliverable.graphics_effectiveness !== undefined && deliverable.graphics_effectiveness !== null ? deliverable.graphics_effectiveness.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.format_design || 0)}>
                            {deliverable.format_design !== undefined && deliverable.format_design !== null ? deliverable.format_design.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.relevant_insights || 0)}>
                            {deliverable.relevant_insights !== undefined && deliverable.relevant_insights !== null ? deliverable.relevant_insights.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.operations_feedback || 0)}>
                            {deliverable.operations_feedback !== undefined && deliverable.operations_feedback !== null ? deliverable.operations_feedback.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.client_feedback || 0)}>
                            {deliverable.client_feedback !== undefined && deliverable.client_feedback !== null ? deliverable.client_feedback.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.brief_compliance || 0)}>
                            {deliverable.brief_compliance !== undefined && deliverable.brief_compliance !== null ? deliverable.brief_compliance.toFixed(1) : '0.0'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {deliverable.hours_available !== undefined && deliverable.hours_available !== null ? deliverable.hours_available : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {deliverable.hours_real !== undefined && deliverable.hours_real !== null ? deliverable.hours_real : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getScoreColor(deliverable.hours_compliance || 0)}>
                            {deliverable.hours_compliance !== undefined && deliverable.hours_compliance !== null ? deliverable.hours_compliance.toFixed(1) : '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comentarios del Cliente</CardTitle>
              <CardDescription>
                Historial de comentarios y retroalimentación del cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new comment */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Nuevo comentario (Q{currentQuarter} {currentYear})</h4>
                <Textarea
                  placeholder="Escribir comentario del cliente..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                />
                <Button onClick={handleSaveComment} className="mt-2">
                  Guardar Comentario
                </Button>
              </div>

              <Separator />

              {/* Comment history */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Historial de comentarios</h4>
                
                {!comments || comments.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No hay comentarios registrados
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">
                            Q{comment.quarter} {comment.year}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(comment.timestamp)}
                          </div>
                        </div>
                        <p className="text-sm">{comment.comment_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ModoTab;
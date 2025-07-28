import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, History, TrendingUp, TrendingDown, FileText, MessageSquare, AlertCircle, Users, Handshake, UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { NegotiationFormModern } from './negotiation-form-modern';

interface NegotiationHistoryEntry {
  id: number;
  quotationId: number;
  previousPrice: number;
  newPrice: number;
  previousScope?: string;
  newScope?: string;
  previousTeam?: string;
  newTeam?: string;
  changeType: string;
  clientFeedback?: string;
  internalNotes?: string;
  negotiationReason?: string;
  adjustmentPercentage?: number;
  createdAt: string;
  createdBy?: number;
}

interface NegotiationHistoryProps {
  quotationId: number;
  currentPrice: number;
  quotationStatus: string;
  currentTeam?: any[];
}

export function NegotiationHistory({ quotationId, currentPrice, quotationStatus, currentTeam = [] }: NegotiationHistoryProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useQuery<NegotiationHistoryEntry[]>({
    queryKey: [`/api/quotations/${quotationId}/negotiation-history`],
    enabled: quotationStatus === 'in-negotiation'
  });

  const { data: personnel } = useQuery<any[]>({
    queryKey: ['/api/personnel']
  });

  const createNegotiationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/quotations/${quotationId}/negotiation-history`, 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "Negociación registrada",
        description: "El historial de negociación se ha guardado correctamente."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/negotiation-history`] });
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar el historial de negociación.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: any) => {
    createNegotiationMutation.mutate(data);
  };

  // Function to parse and compare team changes
  const renderTeamChanges = (previousTeam?: string, newTeam?: string) => {
    if (!previousTeam && !newTeam) return null;

    try {
      const prevTeam = previousTeam ? JSON.parse(previousTeam) : [];
      const currTeam = newTeam ? JSON.parse(newTeam) : [];

      // Find added, removed, and modified members
      const added: any[] = [];
      const removed: any[] = [];
      const modified: any[] = [];

      // Check for removed and modified members
      prevTeam.forEach((prevMember: any) => {
        const currentMember = currTeam.find((m: any) => m.personnelId === prevMember.personnelId);
        if (!currentMember) {
          removed.push(prevMember);
        } else if (
          currentMember.estimatedHours !== prevMember.estimatedHours ||
          currentMember.hourlyRate !== prevMember.hourlyRate
        ) {
          modified.push({
            ...currentMember,
            previousHours: prevMember.estimatedHours,
            previousRate: prevMember.hourlyRate
          });
        }
      });

      // Check for added members
      currTeam.forEach((currMember: any) => {
        const prevMember = prevTeam.find((m: any) => m.personnelId === currMember.personnelId);
        if (!prevMember) {
          added.push(currMember);
        }
      });

      if (added.length === 0 && removed.length === 0 && modified.length === 0) {
        return null;
      }

      // Helper function to get personnel name
      const getPersonnelName = (personnelId: number) => {
        const person = personnel?.find(p => p.id === personnelId);
        return person ? person.name : `Personal ID ${personnelId}`;
      };

      return (
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">Cambios en el equipo:</span>
          </div>
          
          <div className="space-y-2">
            {added.length > 0 && (
              <div className="bg-green-50 p-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Miembros agregados:</span>
                </div>
                <div className="space-y-1">
                  {added.map((member: any, idx: number) => (
                    <div key={idx} className="text-sm text-green-600">
                      • {getPersonnelName(member.personnelId)}: {member.estimatedHours}h a ${member.hourlyRate}/h
                    </div>
                  ))}
                </div>
              </div>
            )}

            {removed.length > 0 && (
              <div className="bg-red-50 p-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <UserMinus className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Miembros eliminados:</span>
                </div>
                <div className="space-y-1">
                  {removed.map((member: any, idx: number) => (
                    <div key={idx} className="text-sm text-red-600">
                      • {getPersonnelName(member.personnelId)}: {member.estimatedHours}h a ${member.hourlyRate}/h
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modified.length > 0 && (
              <div className="bg-amber-50 p-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Miembros modificados:</span>
                </div>
                <div className="space-y-1">
                  {modified.map((member: any, idx: number) => (
                    <div key={idx} className="text-sm text-amber-600">
                      • {getPersonnelName(member.personnelId)}: 
                      {member.previousHours !== member.estimatedHours && (
                        <span> {member.previousHours}h → {member.estimatedHours}h</span>
                      )}
                      {member.previousRate !== member.hourlyRate && (
                        <span> (${member.previousRate} → ${member.hourlyRate}/h)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } catch (error) {
      console.error('Error parsing team changes:', error);
      return null;
    }
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'price_reduction': 'Reducción de precio',
      'price_increase': 'Aumento de precio',
      'scope_reduction': 'Reducción de alcance',
      'scope_expansion': 'Expansión de alcance',
      'team_adjustment': 'Ajuste de equipo',
      'mixed': 'Cambios mixtos'
    };
    return labels[type] || type;
  };

  const getChangeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'price_reduction': 'destructive',
      'price_increase': 'default',
      'scope_reduction': 'secondary',
      'scope_expansion': 'default',
      'team_adjustment': 'secondary',
      'mixed': 'outline'
    };
    return colors[type] || 'default';
  };

  if (quotationStatus !== 'in-negotiation') {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Negociación
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Registrar Negociación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <NegotiationFormModern
              quotationId={quotationId}
              currentPrice={currentPrice}
              currentTeam={currentTeam}
              onSubmit={handleSubmit}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Cargando historial...</div>
        ) : history && history.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {history.map((entry) => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getChangeTypeColor(entry.changeType) as any}>
                        {getChangeTypeLabel(entry.changeType)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {format(new Date(entry.createdAt), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                    </div>
                    {entry.adjustmentPercentage && (
                      <div className="flex items-center gap-1">
                        {entry.adjustmentPercentage > 0 ? (
                          <TrendingUp className="h-4 w-4 text-red-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-green-500" />
                        )}
                        <span className={`text-sm font-medium ${entry.adjustmentPercentage > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {Math.abs(entry.adjustmentPercentage).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <span className="text-sm text-gray-500">Precio anterior:</span>
                      <p className="font-medium">${entry.previousPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Nuevo precio:</span>
                      <p className="font-medium">${entry.newPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  {entry.negotiationReason && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">Razón de negociación:</span>
                      </div>
                      <p className="text-sm text-gray-600">{entry.negotiationReason}</p>
                    </div>
                  )}

                  {entry.clientFeedback && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Feedback del cliente:</span>
                      </div>
                      <p className="text-sm text-gray-600">{entry.clientFeedback}</p>
                    </div>
                  )}

                  {entry.internalNotes && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Notas internas:</span>
                      </div>
                      <p className="text-sm text-gray-600">{entry.internalNotes}</p>
                    </div>
                  )}

                  {(entry.previousScope || entry.newScope) && (
                    <div className="border-t pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-4">
                        {entry.previousScope && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">Alcance anterior:</span>
                            <p className="text-sm mt-1">{entry.previousScope}</p>
                          </div>
                        )}
                        {entry.newScope && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">Nuevo alcance:</span>
                            <p className="text-sm mt-1">{entry.newScope}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {renderTeamChanges(entry.previousTeam, entry.newTeam)}
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No hay historial de negociación aún</p>
            <p className="text-sm mt-1">Registra los cambios y ajustes durante la negociación</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
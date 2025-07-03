import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Clock, AlertTriangle } from 'lucide-react';

export interface DraftData {
  timestamp: number;
  data: any;
  clientName?: string;
  projectName?: string;
  estimatedHours?: number;
}

interface DraftRecoveryWelcomeProps {
  availableDrafts: DraftData[];
  onContinueDraft: (draft: DraftData) => void;
  onStartNew: () => void;
  onDeleteDraft: (timestamp: number) => void;
}

const DraftRecoveryWelcome: React.FC<DraftRecoveryWelcomeProps> = ({
  availableDrafts,
  onContinueDraft,
  onStartNew,
  onDeleteDraft
}) => {
  // Sort drafts by timestamp (newest first)
  const sortedDrafts = [...availableDrafts].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Nueva Cotización
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 mt-2">
            {sortedDrafts.length > 0 
              ? "Se encontraron borradores guardados. ¿Qué deseas hacer?"
              : "Comienza a crear una nueva cotización para tu cliente"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4">
          {sortedDrafts.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Borradores Disponibles
                </h3>
                
                {sortedDrafts.map((draft) => (
                  <Card key={draft.timestamp} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {draft.clientName || 'Cliente sin nombre'}
                            </h4>
                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-gray-300 text-gray-600">
                              {new Date(draft.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          {draft.projectName && (
                            <p className="text-sm text-gray-600 mb-1">
                              Proyecto: {draft.projectName}
                            </p>
                          )}
                          
                          {draft.estimatedHours && (
                            <p className="text-sm text-gray-600">
                              Horas estimadas: {draft.estimatedHours}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2 mt-3">
                            <Button 
                              onClick={() => onContinueDraft(draft)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Continuar Borrador
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => onDeleteDraft(draft.timestamp)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">o</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <Button 
              onClick={onStartNew}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-medium"
            >
              <Plus className="w-5 h-5 mr-2" />
              Comenzar Nueva Cotización
            </Button>
          </div>

          {sortedDrafts.length > 0 && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 mb-1">
                    Protección contra pérdida de datos
                  </p>
                  <p className="text-amber-700">
                    Los borradores se guardan automáticamente cada 10 segundos y se conservan por 48 horas.
                    Puedes continuar trabajando donde lo dejaste en cualquier momento.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DraftRecoveryWelcome;
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { 
  Calculator, 
  Users, 
  DollarSign, 
  TrendingUp,
  Mail,
  Phone,
  Building2,
  Edit3,
  Info
} from 'lucide-react';
// import TeamMemberQuickAdd from '@/components/quotation/TeamMemberSelector';
import { apiRequest } from '@/lib/queryClient';

const FinalFinancialReview: React.FC = () => {
  const { 
    quotationData, 
    removeTeamMember,
    availableRoles,
    availablePersonnel
  } = useOptimizedQuote();

  // Estados para edición inline
  const [editingFactors, setEditingFactors] = useState({
    complexity: false,
    urgency: false,
    margin: false
  });

  const [factors, setFactors] = useState({
    complexity: 100,
    urgency: 1.0,
    margin: 25
  });

  // Formateo de moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Cálculos
  const teamTotal = quotationData.teamMembers?.reduce((sum, member) => sum + (member.cost || 0), 0) || 0;
  const teamHours = quotationData.teamMembers?.reduce((sum, member) => sum + (member.hours || 0), 0) || 0;
  const complexityAdjustment = (teamTotal * factors.complexity) / 100;
  const urgencyAdjustment = complexityAdjustment * factors.urgency;
  const subtotal = urgencyAdjustment;
  const marginAmount = (subtotal * factors.margin) / 100;
  const finalTotal = subtotal + marginAmount;

  // Componente para factores editables
  const EditableFactor: React.FC<{
    label: string;
    value: number;
    type: 'complexity' | 'urgency' | 'margin';
    suffix: string;
    onSave: (value: number) => void;
  }> = ({ label, value, type, suffix, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value.toString());

    const handleSave = () => {
      const numValue = parseFloat(tempValue);
      if (!isNaN(numValue) && numValue >= 0) {
        onSave(numValue);
        setIsEditing(false);
      }
    };

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="w-20 h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            autoFocus
          />
          <Button size="sm" onClick={handleSave} className="h-8 px-2">
            ✓
          </Button>
        </div>
      );
    }

    return (
      <div 
        className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        onClick={() => setIsEditing(true)}
      >
        <span className="text-lg font-bold text-gray-900">
          {type === 'urgency' ? value.toFixed(1) : value.toFixed(0)}{suffix}
        </span>
        <Edit3 className="w-3 h-3 text-gray-400" />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header principal */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
        <p className="text-gray-600 mt-2">Desglose completo de costos y rentabilidad</p>
      </div>

      {/* Información del cliente compacta */}
      {quotationData.client && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{quotationData.client.name}</h3>
                  <p className="text-sm text-gray-600">{quotationData.project?.name || 'Proyecto sin nombre'}</p>
                </div>
              </div>
              {quotationData.client.contactEmail && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{quotationData.client.contactEmail}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen financiero principal */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl text-blue-900">Precio Final</CardTitle>
                <p className="text-blue-700 text-sm">Cálculo detallado del proyecto</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-900">{formatCurrency(finalTotal)}</div>
              <div className="text-sm text-blue-600">Total del proyecto</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Factores editables */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 mb-2">Costo Base</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(teamTotal)}</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 mb-2">Factor Complejidad</div>
              <EditableFactor
                label="Complejidad"
                value={factors.complexity}
                type="complexity"
                suffix="%"
                onSave={(value) => setFactors({...factors, complexity: value})}
              />
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 mb-2">Multiplicador Urgencia</div>
              <EditableFactor
                label="Urgencia"
                value={factors.urgency}
                type="urgency"
                suffix="x"
                onSave={(value) => setFactors({...factors, urgency: value})}
              />
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 mb-2">Margen Beneficio</div>
              <EditableFactor
                label="Margen"
                value={factors.margin}
                type="margin"
                suffix="%"
                onSave={(value) => setFactors({...factors, margin: value})}
              />
            </div>
          </div>

          {/* Desglose de cálculo */}
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Desglose de Cálculo
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Costo base del equipo</span>
                <span className="font-mono">{formatCurrency(teamTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ajuste por complejidad ({factors.complexity}%)</span>
                <span className="font-mono">{formatCurrency(complexityAdjustment)}</span>
              </div>
              <div className="flex justify-between">
                <span>Multiplicador de urgencia ({factors.urgency}x)</span>
                <span className="font-mono">{formatCurrency(urgencyAdjustment)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Subtotal</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Margen de beneficio ({factors.margin}%)</span>
                <span className="font-mono">{formatCurrency(marginAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total Final</span>
                <span className="font-mono">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipo del proyecto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <CardTitle>Equipo del Proyecto</CardTitle>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {quotationData.teamMembers?.length || 0} miembros
              </span>
            </div>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              Agregar Miembro
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {quotationData.teamMembers && quotationData.teamMembers.length > 0 ? (
            <div className="space-y-3">
              {quotationData.teamMembers.map((member, index) => {
                const role = availableRoles?.find(r => r.id === member.roleId);
                const person = availablePersonnel?.find(p => p.id === member.personnelId);
                
                return (
                  <div key={member.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {(person?.name || role?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{role?.name || 'Rol sin definir'}</p>
                        <p className="text-sm text-gray-600">{person?.name || 'Sin asignar'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-gray-500">Horas</p>
                        <p className="font-semibold">{member.hours || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Tarifa</p>
                        <p className="font-semibold">${(member.rate || 0).toFixed(0)}/h</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500">Costo</p>
                        <p className="font-semibold text-blue-600">{formatCurrency(member.cost || 0)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTeamMember(member.id)}
                        className="text-red-500 hover:bg-red-50"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {/* Total del equipo */}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total del Equipo</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{teamHours} horas total</span>
                    <span className="text-lg font-bold text-blue-600">{formatCurrency(teamTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Sin miembros del equipo</h3>
              <p className="mb-4">Agrega miembros para completar la cotización</p>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Agregar Primer Miembro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Análisis final */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-800 mb-1">Análisis de Rentabilidad</h4>
              <p className="text-sm text-green-700">
                El proyecto tiene un margen de beneficio del {factors.margin}% sobre un costo base de {formatCurrency(teamTotal)}. 
                El costo por hora promedio es de {formatCurrency(teamHours > 0 ? teamTotal / teamHours : 0)} 
                con {quotationData.teamMembers?.length || 0} profesionales asignados.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinalFinancialReview;
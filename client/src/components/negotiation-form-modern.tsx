import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, Users, FileText, AlertCircle, Plus, Trash2, TrendingUp, TrendingDown, Handshake, ChevronRight, MessageSquare, Link } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Personnel, Role } from '@shared/schema';

interface TeamMember {
  personnelId: number;
  roleId: number;
  estimatedHours: number;
  hourlyRate?: number;
}

interface NegotiationFormProps {
  quotationId: number;
  currentPrice: number;
  currentTeam: TeamMember[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function NegotiationFormModern({ 
  quotationId, 
  currentPrice, 
  currentTeam,
  onSubmit,
  onCancel
}: NegotiationFormProps) {
  const [activeTab, setActiveTab] = useState('price');
  const [includeTeamChanges, setIncludeTeamChanges] = useState(false);
  
  // Price form state
  const [newPrice, setNewPrice] = useState(currentPrice);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  
  // Team form state
  const [modifiedTeam, setModifiedTeam] = useState<TeamMember[]>([...currentTeam]);
  const [teamChangeReason, setTeamChangeReason] = useState('');
  
  // Common form state
  const [clientFeedback, setClientFeedback] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [proposalLink, setProposalLink] = useState('');
  
  // Query personnel and roles
  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ['/api/personnel']
  });
  
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles']
  });

  // Calculate price difference
  const priceDifference = newPrice - currentPrice;
  const pricePercentageChange = ((priceDifference / currentPrice) * 100).toFixed(1);
  const isPriceReduction = priceDifference < 0;
  
  // Calculate team cost changes
  const calculateTeamCost = (team: TeamMember[]) => {
    return team.reduce((total, member) => {
      const person = personnel.find(p => p.id === member.personnelId);
      const rate = member.hourlyRate || person?.hourlyRate || 0;
      return total + (member.estimatedHours * rate);
    }, 0);
  };
  
  const originalTeamCost = calculateTeamCost(currentTeam);
  const newTeamCost = calculateTeamCost(modifiedTeam);
  const teamCostDifference = newTeamCost - originalTeamCost;

  const handleAddTeamMember = () => {
    setModifiedTeam([...modifiedTeam, {
      personnelId: 0,
      roleId: 0,
      estimatedHours: 0
    }]);
  };

  const handleRemoveTeamMember = (index: number) => {
    setModifiedTeam(modifiedTeam.filter((_, i) => i !== index));
  };

  const handleTeamMemberChange = (index: number, field: keyof TeamMember, value: any) => {
    const updated = [...modifiedTeam];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill hourly rate when personnel is selected
    if (field === 'personnelId') {
      const person = personnel.find(p => p.id === value);
      if (person) {
        updated[index].hourlyRate = person.hourlyRate;
      }
    }
    
    setModifiedTeam(updated);
  };

  const determineChangeType = () => {
    const hasTeamChanges = includeTeamChanges && JSON.stringify(currentTeam) !== JSON.stringify(modifiedTeam);
    const hasPriceChange = newPrice !== currentPrice;
    
    if (hasTeamChanges && hasPriceChange) return 'mixed';
    if (isPriceReduction) return 'price_reduction';
    if (hasPriceChange) return 'price_increase';
    if (hasTeamChanges && teamCostDifference < 0) return 'scope_reduction';
    if (hasTeamChanges) return 'team_adjustment';
    return 'price_reduction';
  };

  const handleSubmit = () => {
    const changeType = determineChangeType();
    
    const data = {
      newPrice,
      changeType,
      clientFeedback,
      internalNotes,
      proposalLink,
      negotiationReason: includeTeamChanges ? `${priceChangeReason}\n\nCambios en equipo: ${teamChangeReason}` : priceChangeReason,
      previousTeam: includeTeamChanges ? JSON.stringify(currentTeam) : null,
      newTeam: includeTeamChanges ? JSON.stringify(modifiedTeam) : null
    };
    
    onSubmit(data);
  };

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Handshake className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Registrar Nueva Negociación</h3>
              <p className="text-sm text-gray-600">Documenta los cambios acordados con el cliente</p>
            </div>
          </div>
        </div>
        
        {/* Quick Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white p-3 rounded-lg">
            <p className="text-xs text-gray-500">Precio Original</p>
            <p className="text-lg font-semibold">${currentPrice.toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <p className="text-xs text-gray-500">Nuevo Precio</p>
            <p className="text-lg font-semibold text-purple-600">${newPrice.toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <p className="text-xs text-gray-500">Diferencia</p>
            <div className="flex items-center gap-1">
              {isPriceReduction ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              <p className={`text-lg font-semibold ${isPriceReduction ? 'text-red-600' : 'text-green-600'}`}>
                {pricePercentageChange}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="price" className="text-sm font-medium">
                <DollarSign className="h-4 w-4 mr-2" />
                Ajuste de Precio
              </TabsTrigger>
              <TabsTrigger value="feedback" className="text-sm font-medium">
                <FileText className="h-4 w-4 mr-2" />
                Feedback y Notas
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="price" className="p-6 space-y-6">
              {/* Price Adjustment */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newPrice" className="text-sm font-medium">Nuevo Precio Acordado</Label>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="newPrice"
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                      className="pl-10 text-lg font-semibold"
                      placeholder="0.00"
                    />
                  </div>
                  {priceDifference !== 0 && (
                    <p className={`text-sm mt-2 ${isPriceReduction ? 'text-red-600' : 'text-green-600'}`}>
                      {isPriceReduction ? 'Reducción' : 'Aumento'} de ${Math.abs(priceDifference).toLocaleString()} ({pricePercentageChange}%)
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="priceReason" className="text-sm font-medium">Razón del Cambio de Precio</Label>
                  <Textarea
                    id="priceReason"
                    value={priceChangeReason}
                    onChange={(e) => setPriceChangeReason(e.target.value)}
                    placeholder="Explica por qué se está ajustando el precio..."
                    className="mt-2 min-h-[100px]"
                  />
                </div>

                {/* Team Changes Toggle */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="team-changes" className="text-sm font-medium">Incluir Cambios en el Equipo</Label>
                      <p className="text-xs text-gray-500">Ajusta la composición del equipo si fue parte de la negociación</p>
                    </div>
                    <Switch
                      id="team-changes"
                      checked={includeTeamChanges}
                      onCheckedChange={setIncludeTeamChanges}
                    />
                  </div>
                </div>

                {/* Team Adjustments */}
                {includeTeamChanges && (
                  <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Ajustes del Equipo
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddTeamMember}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar Miembro
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {modifiedTeam.map((member, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Persona</Label>
                              <Select
                                value={member.personnelId?.toString() || ''}
                                onValueChange={(value) => handleTeamMemberChange(index, 'personnelId', parseInt(value))}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {personnel.map((person) => (
                                    <SelectItem key={person.id} value={person.id.toString()}>
                                      {person.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label className="text-xs">Rol</Label>
                              <Select
                                value={member.roleId?.toString() || ''}
                                onValueChange={(value) => handleTeamMemberChange(index, 'roleId', parseInt(value))}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id.toString()}>
                                      {role.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Horas</Label>
                                <Input
                                  type="number"
                                  value={member.estimatedHours || ''}
                                  onChange={(e) => handleTeamMemberChange(index, 'estimatedHours', parseFloat(e.target.value) || 0)}
                                  className="h-9 text-sm"
                                  placeholder="0"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTeamMember(index)}
                                className="mt-5"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {teamCostDifference !== 0 && (
                      <Alert className={teamCostDifference < 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Impacto en costo del equipo: {teamCostDifference < 0 ? 'Ahorro' : 'Aumento'} de ${Math.abs(teamCostDifference).toLocaleString()}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <Label htmlFor="teamReason" className="text-xs font-medium">Razón de los Cambios en el Equipo</Label>
                      <Textarea
                        id="teamReason"
                        value={teamChangeReason}
                        onChange={(e) => setTeamChangeReason(e.target.value)}
                        placeholder="Explica por qué se ajustó el equipo..."
                        className="mt-1 min-h-[80px] text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="feedback" className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="clientFeedback" className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    Feedback del Cliente
                  </Label>
                  <Textarea
                    id="clientFeedback"
                    value={clientFeedback}
                    onChange={(e) => setClientFeedback(e.target.value)}
                    placeholder="¿Qué dijo el cliente sobre la propuesta anterior? ¿Qué le gustó o no le gustó?"
                    className="mt-2 min-h-[120px]"
                  />
                </div>

                <div>
                  <Label htmlFor="internalNotes" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    Notas Internas
                  </Label>
                  <Textarea
                    id="internalNotes"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Notas internas sobre la negociación, estrategia, o lecciones aprendidas..."
                    className="mt-2 min-h-[120px]"
                  />
                </div>

                <div>
                  <Label htmlFor="proposalLink" className="text-sm font-medium flex items-center gap-2">
                    <Link className="h-4 w-4 text-green-500" />
                    Link a la Nueva Propuesta
                  </Label>
                  <Input
                    id="proposalLink"
                    type="url"
                    value={proposalLink}
                    onChange={(e) => setProposalLink(e.target.value)}
                    placeholder="https://drive.google.com/... o cualquier link a la propuesta"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Adjunta el link al documento de la nueva propuesta para facilitar el acceso
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Handshake className="h-4 w-4 mr-2" />
          Registrar Negociación
        </Button>
      </div>
    </div>
  );
}
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuoteContext } from "@/context/quote-context";
import { ReportTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import CostBreakdown from "./cost-breakdown";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export default function ReportTemplates({ onPrevious, onNext }: { onPrevious: () => void; onNext: () => void }) {
  const { toast } = useToast();
  const {
    selectedTemplateId,
    templateCustomization,
    teamMembers,
    updateReportTemplate,
    updateTemplateCustomization,
    calculateTotalCost,
    complexityFactors,
    quotationData
  } = useQuoteContext();

  // Get templates from API
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/templates"],
  });

  // Update cost calculations when template changes
  useEffect(() => {
    calculateTotalCost();
  }, [selectedTemplateId, calculateTotalCost]);

  // Check if form is valid
  const validateForm = () => {
    if (!selectedTemplateId) {
      toast({
        title: "Template Required",
        description: "Please select a report template.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Prepare data for cost factors chart
  const getCostFactorsData = () => {
    const factorsData = [
      { name: "Analysis Type", value: complexityFactors.analysisTypeFactor || 0 },
      { name: "Mentions Volume", value: complexityFactors.mentionsVolumeFactor || 0 },
      { name: "Countries", value: complexityFactors.countriesFactor || 0 },
      { name: "Client Engagement", value: complexityFactors.clientEngagementFactor || 0 },
      { name: "Template", value: complexityFactors.templateFactor || 0 },
    ].filter(factor => factor.value > 0);
    
    return factorsData;
  };

  // Chart colors
  const COLORS = ['#1976d2', '#ff6d00', '#4caf50', '#f44336', '#9c27b0'];

  // Handle continue button click
  const handleContinue = () => {
    if (validateForm()) {
      calculateTotalCost();
      onNext();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold text-neutral-900 mb-6">Report Templates</h3>
      
      <p className="text-sm text-neutral-600 mb-6">Select a report template that best fits your project requirements. The template selection may affect the overall quote based on complexity and required customization.</p>
      
      <div className="mb-6">
        <RadioGroup 
          value={selectedTemplateId?.toString() || ""} 
          onValueChange={(value) => updateReportTemplate(parseInt(value))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {templates?.map(template => (
            <div
              key={template.id}
              className={cn(
                "card-select p-4 border border-neutral-300 rounded-lg hover:bg-neutral-50 cursor-pointer",
                selectedTemplateId === template.id && "selected"
              )}
              onClick={() => updateReportTemplate(template.id)}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <RadioGroupItem value={template.id.toString()} id={`template-${template.id}`} className="h-5 w-5" />
                </div>
                <div className="ml-3 flex-1">
                  <Label
                    htmlFor={`template-${template.id}`}
                    className="text-base font-medium text-neutral-800 cursor-pointer"
                  >
                    {template.name}
                  </Label>
                  <p className="text-sm text-neutral-600 mt-1">{template.description}</p>
                  
                  <div className="mt-3 flex items-center text-sm">
                    {template.pageRange && (
                      <span className="inline-flex items-center mr-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                        {template.pageRange}
                      </span>
                    )}
                    {template.features && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                        {template.features}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      <div className="p-4 bg-neutral-100 rounded-lg mb-6">
        <h4 className="text-base font-medium text-neutral-800 mb-3">Template Customization</h4>
        <p className="text-sm text-neutral-600 mb-3">Specify any custom requirements or modifications needed for the selected template.</p>
        
        <Textarea
          className="w-full"
          rows={3}
          placeholder="Describe any special requirements or customizations needed..."
          value={templateCustomization || ""}
          onChange={(e) => updateTemplateCustomization(e.target.value)}
        />
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <Button type="button" variant="outline" onClick={onPrevious} className="flex items-center">
          <span className="material-icons mr-1">arrow_back</span>
          Back
        </Button>
        
        <Button type="button" onClick={handleContinue} className="flex items-center">
          Continue
          <span className="material-icons ml-1">arrow_forward</span>
        </Button>
      </div>

      {/* Cost breakdown with chart visualization */}
      <div className="bg-white rounded-lg shadow mt-6 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-800">Cost Breakdown</h3>
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Updated
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <h4 className="text-base font-medium text-neutral-700 mb-3">Cost Factors</h4>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Category</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Item</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Impact</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {quotationData.analysisType && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Analysis Type</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{quotationData.analysisType}</td>
                      <td className="px-4 py-2">
                        {complexityFactors.analysisTypeFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.analysisTypeFactor * 100).toFixed(0)}% cost
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {quotationData.mentionsVolume && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Mentions Volume</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{quotationData.mentionsVolume}</td>
                      <td className="px-4 py-2">
                        {complexityFactors.mentionsVolumeFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.mentionsVolumeFactor * 100).toFixed(0)}% cost
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {quotationData.countriesCovered && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Countries</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">{quotationData.countriesCovered}</td>
                      <td className="px-4 py-2">
                        {complexityFactors.countriesFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.countriesFactor * 100).toFixed(0)}% cost
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {selectedTemplateId && templates && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-neutral-900">Template</td>
                      <td className="px-4 py-2 text-sm text-neutral-900">
                        {templates.find(t => t.id === selectedTemplateId)?.name}
                      </td>
                      <td className="px-4 py-2">
                        {complexityFactors.templateFactor > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning bg-opacity-10 text-warning">
                            +{(complexityFactors.templateFactor * 100).toFixed(0)}% cost
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <h4 className="text-base font-medium text-neutral-700 mb-3">Cost Distribution</h4>
            <div className="bg-neutral-100 p-4 rounded-lg h-48">
              {getCostFactorsData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getCostFactorsData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name }) => name}
                      labelLine={false}
                    >
                      {getCostFactorsData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`+${(value * 100).toFixed(0)}%`, "Impact"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-neutral-500">No complexity factors applied</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <CostBreakdown teamMembers={teamMembers} showComplexity={true} />
      </div>
    </div>
  );
}

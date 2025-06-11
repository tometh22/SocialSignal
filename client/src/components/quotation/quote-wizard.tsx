import { useState } from "react";
import ProgressIndicator from "./progress-indicator";
import ProjectDetails from "./project-details";
import TeamResources from "./team-resources";
import ReportTemplates from "./report-templates";
import ReviewQuote from "./review-quote";

export default function QuoteWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Move to next step
  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      // Scroll to top
      window.scrollTo(0, 0);
    }
  };
  
  // Move to previous step
  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Scroll to top
      window.scrollTo(0, 0);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <ProjectDetails onNext={nextStep} />;
      case 2:
        return <ReportTemplates onPrevious={previousStep} onNext={nextStep} />;
      case 3:
        return <TeamResources onPrevious={previousStep} onNext={nextStep} />;
      case 4:
        return <ReviewQuote onPrevious={previousStep} />;
      default:
        return <ProjectDetails onNext={nextStep} />;
    }
  };

  return (
    <>
      {/* Progress indicator */}
      <ProgressIndicator currentStep={currentStep} />
      
      {/* Render only the current step */}
      {renderStepContent()}
    </>
  );
}

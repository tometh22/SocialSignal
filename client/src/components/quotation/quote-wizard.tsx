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

  return (
    <>
      {/* Progress indicator */}
      <ProgressIndicator currentStep={currentStep} />
      
      {/* Wizard step content */}
      <div className={`wizard-step ${currentStep === 1 ? 'active' : ''}`}>
        <ProjectDetails onNext={nextStep} />
      </div>
      
      <div className={`wizard-step ${currentStep === 2 ? 'active' : ''}`}>
        <TeamResources onPrevious={previousStep} onNext={nextStep} />
      </div>
      
      <div className={`wizard-step ${currentStep === 3 ? 'active' : ''}`}>
        <ReportTemplates onPrevious={previousStep} onNext={nextStep} />
      </div>
      
      <div className={`wizard-step ${currentStep === 4 ? 'active' : ''}`}>
        <ReviewQuote onPrevious={previousStep} />
      </div>
    </>
  );
}

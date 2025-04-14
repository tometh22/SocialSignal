interface ProgressIndicatorProps {
  currentStep: number;
}

export default function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const steps = [
    { number: 1, label: "Project Details" },
    { number: 2, label: "Team & Resources" },
    { number: 3, label: "Report Templates" },
    { number: 4, label: "Review & Quote" },
  ];

  return (
    <div className="progress-indicator flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={step.number}>
          <div className="step flex flex-col items-center">
            <div 
              className={`flex items-center justify-center w-10 h-10 rounded-full font-medium
                ${currentStep >= step.number 
                  ? "bg-primary text-white" 
                  : "bg-neutral-300 text-neutral-600"}`}
            >
              {step.number}
            </div>
            <span 
              className={`mt-2 text-sm font-medium
                ${currentStep >= step.number 
                  ? "text-primary" 
                  : "text-neutral-600"}`}
            >
              {step.label}
            </span>
          </div>
          
          {index < steps.length - 1 && (
            <div className="flex-1 h-1 mx-2 bg-neutral-300">
              <div 
                className="h-1 bg-primary" 
                style={{ 
                  width: currentStep > step.number 
                    ? "100%" 
                    : currentStep === step.number 
                      ? "50%" 
                      : "0%" 
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

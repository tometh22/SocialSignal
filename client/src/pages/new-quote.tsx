import QuoteWizard from "@/components/quotation/quote-wizard";
import { QuoteProvider } from "@/context/quote-context";

export default function NewQuote() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Nueva Cotización de Social Listening</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto wizard-container">
          <QuoteProvider>
            <QuoteWizard />
          </QuoteProvider>
        </div>
      </div>
    </div>
  );
}

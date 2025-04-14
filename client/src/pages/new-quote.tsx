import QuoteWizard from "@/components/quotation/quote-wizard";

export default function NewQuote() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">New Social Listening Quote</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <QuoteWizard />
        </div>
      </div>
    </div>
  );
}

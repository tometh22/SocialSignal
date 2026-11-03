import { Button } from "@/components/ui/button";

export function QueryError({ message = "No se pudieron cargar los datos.", retry }: { message?: string; retry: () => unknown }) {
  return <div role="alert" className="my-3 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
    <span>{message}</span><Button size="sm" variant="outline" onClick={() => void retry()}>Reintentar</Button>
  </div>;
}

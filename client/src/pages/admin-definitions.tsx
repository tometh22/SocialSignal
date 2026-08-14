import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, FileCheck2, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProductDefinitions = {
  version: string;
  updatedAt: string;
  sourceCommit: string;
  sha256: string;
  markdown: string;
};

export default function AdminDefinitionsPage() {
  const { data, isLoading, error } = useQuery<ProductDefinitions>({
    queryKey: ["/api/admin/product-definitions"],
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-5xl space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-[32rem] w-full" /></div>;
  }

  if (error || !data) {
    return (
      <Card className="mx-auto max-w-3xl border-red-200">
        <CardContent className="p-6 text-sm text-red-700">No fue posible cargar las definiciones de producto.</CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-950 text-white">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><BookOpen className="h-5 w-5" /></span>
              <div>
                <CardTitle className="text-xl">Definiciones de producto</CardTitle>
                <p className="mt-1 text-xs text-slate-300">Fuente canónica, versionada y de sólo lectura</p>
              </div>
            </div>
            <Badge className="w-fit bg-white text-slate-950 hover:bg-white">v{data.version}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 text-xs text-slate-600 sm:grid-cols-3">
          <span className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Actualizado {data.updatedAt}</span>
          <span className="flex min-w-0 items-center gap-2"><Fingerprint className="h-4 w-4 shrink-0" /><code className="truncate">{data.sha256}</code></span>
          <span className="truncate">Commit: <code>{data.sourceCommit}</code></span>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-8">
          <article className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-th:whitespace-nowrap prose-td:align-top prose-code:break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{data.markdown}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}

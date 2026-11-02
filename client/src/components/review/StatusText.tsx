import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// WhatsApp inserts invisible characters and nonbreaking spaces after its bullets.
// Normalize only list markers; keep the user's paragraphs and indentation intact.
export function normalizeStatusText(content: string): string {
  return content.replace(/\r\n?/g, "\n").replace(
    /^([ \t]*)[•◦▪][ \t\u00a0\u200b\u2060\ufeff]*([^\n])/gm,
    "$1- $2",
  );
}

export default function StatusText({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn(
      "min-w-0 break-words [overflow-wrap:anywhere] leading-relaxed",
      "[&>*>:first-child]:mt-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      "[&_p]:my-2 [&_p]:whitespace-pre-wrap [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
      "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li>p]:my-1",
      "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3",
      "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-2",
      "[&_code]:whitespace-pre-wrap [&_code]:text-[0.95em] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold",
      "[&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2",
      className,
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
        a: ({ node, ...props }) => <a {...props} className="text-indigo-600 underline underline-offset-2" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} />,
        img: ({ alt }) => <span>{alt}</span>,
      }}>
        {normalizeStatusText(children)}
      </ReactMarkdown>
    </div>
  );
}

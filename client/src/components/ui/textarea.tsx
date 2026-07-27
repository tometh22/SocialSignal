import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full resize-y rounded-xl border border-input bg-background/90 px-3.5 py-3 text-sm shadow-sm ring-offset-background transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/80 hover:border-slate-300 focus-visible:border-primary/55 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

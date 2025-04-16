import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
  variant?: "default" | "gradient" | "dots";
}

export function Loader({
  size = "md",
  text,
  className,
  variant = "default"
}: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  if (variant === "gradient") {
    return (
      <div className={cn("flex flex-col items-center justify-center", className)}>
        <div className="relative">
          <div
            className={cn(
              "relative rounded-full animate-spin",
              {
                "h-10 w-10": size === "sm",
                "h-14 w-14": size === "md",
                "h-20 w-20": size === "lg",
              },
              "bg-gradient-to-tr from-primary via-purple-500 to-blue-400 flex items-center justify-center"
            )}
          >
            <div className="absolute bg-white dark:bg-slate-900 rounded-full inset-1.5"></div>
          </div>
          <div 
            className={cn(
              "absolute top-0 left-0 rounded-full animate-ping opacity-20",
              {
                "h-10 w-10": size === "sm",
                "h-14 w-14": size === "md",
                "h-20 w-20": size === "lg",
              },
              "bg-primary"
            )}
          ></div>
        </div>
        {text && (
          <div className="mt-4 flex items-center">
            <p className="text-neutral-700 dark:text-neutral-300 font-medium">
              {text}
            </p>
            <span className="ml-2 flex space-x-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"></span>
            </span>
          </div>
        )}
      </div>
    );
  }

  if (variant === "dots") {
    const dotSizes = {
      sm: "h-1.5 w-1.5",
      md: "h-2.5 w-2.5",
      lg: "h-3 w-3",
    };
    
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <div className="flex space-x-2">
          <div className={cn(
            dotSizes[size], 
            "bg-gradient-to-tr from-primary to-purple-400 rounded-full animate-pulse shadow-lg shadow-primary/40 [animation-delay:-0.4s]"
          )}></div>
          <div className={cn(
            dotSizes[size], 
            "bg-gradient-to-tr from-primary to-purple-400 rounded-full animate-pulse shadow-lg shadow-primary/40 [animation-delay:-0.2s]"
          )}></div>
          <div className={cn(
            dotSizes[size], 
            "bg-gradient-to-tr from-primary to-purple-400 rounded-full animate-pulse shadow-lg shadow-primary/40"
          )}></div>
        </div>
        {text && (
          <p className="text-neutral-700 dark:text-neutral-300 mt-3 font-medium tracking-wide">
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative">
        <Loader2 className={cn(
          "animate-spin text-primary drop-shadow-md",
          {
            "h-7 w-7": size === "sm",
            "h-10 w-10": size === "md",
            "h-14 w-14": size === "lg",
          }
        )} />
        <div className={cn(
          "absolute rounded-full animate-ping opacity-10",
          {
            "h-7 w-7 -top-0 -left-0": size === "sm",
            "h-10 w-10 -top-0 -left-0": size === "md",
            "h-14 w-14 -top-0 -left-0": size === "lg",
          },
          "bg-primary"
        )}></div>
      </div>
      {text && (
        <div className="mt-3 flex items-center">
          <p className="text-neutral-700 dark:text-neutral-300 font-medium">
            {text}
          </p>
          <span className="ml-2 inline-flex w-1.5 h-1.5 bg-primary rounded-full animate-ping opacity-75"></span>
        </div>
      )}
    </div>
  );
}
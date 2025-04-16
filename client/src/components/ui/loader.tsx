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
        <div
          className={cn(
            "relative rounded-full animate-spin",
            {
              "h-8 w-8": size === "sm",
              "h-12 w-12": size === "md",
              "h-16 w-16": size === "lg",
            },
            "bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center"
          )}
        >
          <div className="absolute bg-white rounded-full inset-1"></div>
        </div>
        {text && (
          <p className="text-neutral-700 mt-3 font-medium animate-pulse">
            {text}
          </p>
        )}
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <div className="flex space-x-2">
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
        </div>
        {text && (
          <p className="text-neutral-700 mt-3 font-medium">
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {text && (
        <p className="text-neutral-700 mt-2 font-medium">
          {text}
        </p>
      )}
    </div>
  );
}
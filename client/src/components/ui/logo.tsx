import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  };

  return (
    <div className={cn("flex-shrink-0 flex items-center justify-center", sizeClasses[size], className)}>
      <img 
        src="/epical-logo.jpeg"
        alt="Epical Digital Logo" 
        className="h-full w-full object-contain rounded-sm" 
      />
    </div>
  );
}
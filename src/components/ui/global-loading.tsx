import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalLoadingProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export function GlobalLoading({ isVisible, message = "Carregando dados...", className }: GlobalLoadingProps) {
  if (!isVisible) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm", className)}>
      <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-card border shadow-lg animate-in fade-in zoom-in duration-300">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        <p className="text-lg font-medium text-foreground animate-pulse">{message}</p>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Grade responsiva para os cards do hub de configurações. */
export function SettingsGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

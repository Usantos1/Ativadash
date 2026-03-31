import { cn } from "@/lib/utils";

/** Estilo de badge por categoria de papel (Stripe/Linear-inspired, cores discretas). */
export function teamRoleBadgeClass(role: string): string {
  const r = role.toLowerCase();
  if (r === "owner" || r === "agency_owner" || r === "workspace_owner") {
    return cn(
      "border border-violet-500/20 bg-violet-500/[0.08] text-[11px] font-medium text-violet-800 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-200"
    );
  }
  if (
    r === "admin" ||
    r === "agency_admin" ||
    r === "workspace_admin" ||
    r === "media_manager" ||
    r === "media_meta_manager" ||
    r === "media_google_manager"
  ) {
    return cn(
      "border border-blue-500/20 bg-blue-500/[0.08] text-[11px] font-medium text-blue-800 dark:border-blue-400/25 dark:bg-blue-500/15 dark:text-blue-200"
    );
  }
  return cn(
    "border border-border/50 bg-muted/40 text-[11px] font-medium text-muted-foreground dark:bg-muted/30"
  );
}

export function userInitials(name: string, email: string): string {
  const base = name.trim() || email;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || "?";
}

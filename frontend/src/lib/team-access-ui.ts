import { cn } from "@/lib/utils";

export const TEAM_JOB_TITLE_OPTIONS = [
  { value: "traffic_manager", label: "Gestor de Tráfego" },
  { value: "social_media", label: "Social Media" },
  { value: "media_manager", label: "Gestor de Mídia" },
  { value: "client_viewer", label: "Cliente (Viewer)" },
] as const;

export type TeamJobTitleValue = (typeof TEAM_JOB_TITLE_OPTIONS)[number]["value"];

export const TEAM_ACCESS_LEVEL_OPTIONS = [
  { value: "ADMIN" as const, label: "Administrador", hint: "Acesso total à conta" },
  { value: "OPERADOR" as const, label: "Operador", hint: "Mídia e integrações; sem faturamento/planos" },
  { value: "VIEWER" as const, label: "Visualizador", hint: "Somente leitura em relatórios" },
];

export function jobTitleLabelPt(slug: string | null | undefined): string {
  if (!slug) return "—";
  const o = TEAM_JOB_TITLE_OPTIONS.find((x) => x.value === slug);
  return o?.label ?? slug;
}

export function accessLevelFromSystemRole(role: string): "ADMIN" | "OPERADOR" | "VIEWER" {
  if (role === "report_viewer") return "VIEWER";
  if (
    role === "owner" ||
    role === "admin" ||
    role === "agency_owner" ||
    role === "agency_admin" ||
    role === "workspace_owner" ||
    role === "workspace_admin"
  ) {
    return "ADMIN";
  }
  return "OPERADOR";
}

export function accessLevelLabelPt(level: "ADMIN" | "OPERADOR" | "VIEWER"): string {
  return TEAM_ACCESS_LEVEL_OPTIONS.find((x) => x.value === level)?.label ?? level;
}

/** Badges de cargo (cores discretas). */
export function jobTitleBadgeClass(slug: string | null | undefined): string {
  switch (slug) {
    case "traffic_manager":
      return "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-100";
    case "social_media":
      return "border-pink-500/25 bg-pink-500/10 text-pink-900 dark:text-pink-100";
    case "media_manager":
      return "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "client_viewer":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    default:
      return "border-border/50 bg-muted/40 text-muted-foreground";
  }
}

export function accessLevelBadgeClass(level: "ADMIN" | "OPERADOR" | "VIEWER"): string {
  switch (level) {
    case "ADMIN":
      return "border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-100";
    case "VIEWER":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    default:
      return "border-border/50 bg-muted/40 text-muted-foreground";
  }
}

export function badgePillClass(colorClass: string): string {
  return cn(
    "inline-flex max-w-[220px] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium",
    colorClass
  );
}

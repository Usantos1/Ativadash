import { cn } from "@/lib/utils";

/** Cargos exibidos no dropdown (slug = valor persistido em `Membership.jobTitle`). */
export const TEAM_JOB_TITLE_OPTIONS = [
  { value: "owner_ceo", label: "Dono / CEO" },
  { value: "partner_director", label: "Sócio / Diretor" },
  { value: "launch_strategist", label: "Estrategista de Lançamento" },
  { value: "traffic_manager", label: "Gestor de Tráfego" },
  { value: "media_manager", label: "Gestor de Mídia" },
  { value: "social_media", label: "Social Media" },
  { value: "copywriter", label: "Copywriter" },
  { value: "designer_audiovisual", label: "Designer / Audiovisual" },
  { value: "support_cs", label: "Suporte / Atendimento" },
  { value: "data_analyst", label: "Analista de Dados" },
  { value: "client_viewer", label: "Cliente (Viewer)" },
] as const;

export type TeamJobTitleValue = (typeof TEAM_JOB_TITLE_OPTIONS)[number]["value"];

export const TEAM_ACCESS_LEVEL_OPTIONS = [
  { value: "ADMIN" as const, label: "Administrador", hint: "Acesso total à conta" },
  { value: "OPERADOR" as const, label: "Operador", hint: "Mídia e integrações; sem faturamento/planos" },
  { value: "VIEWER" as const, label: "Visualizador", hint: "Somente leitura em relatórios" },
];

export function jobTitleLabelPt(slug: string | null | undefined): string {
  if (!slug) return "Sem cargo";
  const o = TEAM_JOB_TITLE_OPTIONS.find((x) => x.value === slug);
  return o?.label ?? slug.replace(/_/g, " ");
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

/** Badges de cargo (cores discretas por função). */
/** Badge de cargo na tabela (inclui estado vazio). */
export function jobTitleCellBadgeClass(slug: string | null | undefined): string {
  if (!slug) {
    return "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-400";
  }
  return jobTitleBadgeClass(slug);
}

export function jobTitleBadgeClass(slug: string | null | undefined): string {
  switch (slug) {
    case "owner_ceo":
    case "partner_director":
      return "border-violet-500/30 bg-violet-500/10 text-violet-950 dark:text-violet-100";
    case "launch_strategist":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-950 dark:text-fuchsia-100";
    case "traffic_manager":
      return "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-100";
    case "social_media":
      return "border-pink-500/25 bg-pink-500/10 text-pink-900 dark:text-pink-100";
    case "media_manager":
      return "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "copywriter":
      return "border-orange-500/25 bg-orange-500/10 text-orange-950 dark:text-orange-100";
    case "designer_audiovisual":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-950 dark:text-cyan-100";
    case "support_cs":
      return "border-teal-500/25 bg-teal-500/10 text-teal-950 dark:text-teal-100";
    case "data_analyst":
      return "border-indigo-500/25 bg-indigo-500/10 text-indigo-950 dark:text-indigo-100";
    case "client_viewer":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    default:
      return "border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300";
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

/** Classes reutilizáveis no modal Equipe (contraste e foco). */
export const teamModalLabelClass =
  "text-sm font-medium text-neutral-700 dark:text-neutral-200";
export const teamModalInputClass = cn(
  "h-10 w-full rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[color,box-shadow] placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "dark:border-neutral-600"
);
export const teamModalSelectTriggerClass = cn(teamModalInputClass, "flex items-center justify-between");

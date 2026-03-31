/** Cargos da equipe (UI / agência) — armazenados em `Membership.jobTitle` e `Invitation.jobTitle`. */
export const TEAM_JOB_TITLE_SLUGS = [
  "owner_ceo",
  "partner_director",
  "launch_strategist",
  "traffic_manager",
  "media_manager",
  "social_media",
  "copywriter",
  "designer_audiovisual",
  "support_cs",
  "data_analyst",
  "client_viewer",
] as const;

export type TeamJobTitleSlug = (typeof TEAM_JOB_TITLE_SLUGS)[number];

export function isValidTeamJobTitleSlug(v: string): v is TeamJobTitleSlug {
  return (TEAM_JOB_TITLE_SLUGS as readonly string[]).includes(v);
}

/** Nível de acesso enviado pela UI → `Membership.role`. */
export type TeamAccessLevel = "ADMIN" | "OPERADOR" | "VIEWER";

export function teamAccessLevelToRole(level: string): string {
  const u = level.trim().toUpperCase();
  if (u === "ADMIN") return "admin";
  if (u === "VIEWER") return "report_viewer";
  return "member";
}

/** Novo membro / convite: cargo + nível → role canónico + slug de cargo persistido. */
export function resolveNewMemberRoleAndJobTitle(
  accessLevel: string,
  jobTitleSlug: string
): { role: string; jobTitle: string } {
  const raw = jobTitleSlug.trim();
  const jt = isValidTeamJobTitleSlug(raw) ? raw : "traffic_manager";
  if (jt === "client_viewer") {
    return { role: "report_viewer", jobTitle: "client_viewer" };
  }
  return { role: teamAccessLevelToRole(accessLevel), jobTitle: jt };
}

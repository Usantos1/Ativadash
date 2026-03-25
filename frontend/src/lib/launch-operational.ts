/** Estado da janela de lançamento (alinhado à regra de backend em organizations.service). */
export type LaunchWindowKind = "active" | "future" | "ended" | "open";

export function launchWindowKind(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  ref: Date = new Date()
): LaunchWindowKind {
  const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  const s = startDate ? new Date(startDate) : null;
  const e = endDate ? new Date(endDate) : null;
  if (!s && !e) return "open";
  if (s && !Number.isNaN(s.getTime()) && todayEnd < s) return "future";
  if (e && !Number.isNaN(e.getTime()) && todayStart > e) return "ended";
  return "active";
}

export function launchWindowLabel(kind: LaunchWindowKind): string {
  switch (kind) {
    case "active":
      return "Ativo";
    case "future":
      return "Futuro";
    case "ended":
      return "Encerrado";
    default:
      return "Em aberto";
  }
}

export type ProjectLaunchPulse = "ativo" | "futuro" | "encerrado" | "sem_lancamentos";

export function projectLaunchPulse(
  launches: Array<{ startDate: string | null; endDate: string | null }>,
  ref: Date = new Date()
): ProjectLaunchPulse {
  if (launches.length === 0) return "sem_lancamentos";
  const kinds = launches.map((l) => launchWindowKind(l.startDate, l.endDate, ref));
  if (kinds.some((k) => k === "active" || k === "open")) return "ativo";
  if (kinds.every((k) => k === "future")) return "futuro";
  if (kinds.every((k) => k === "ended")) return "encerrado";
  if (kinds.some((k) => k === "future")) return "futuro";
  return "encerrado";
}

export function projectLaunchPulseLabel(p: ProjectLaunchPulse): string {
  switch (p) {
    case "ativo":
      return "Com lançamento ativo";
    case "futuro":
      return "Só futuros";
    case "encerrado":
      return "Só encerrados";
    default:
      return "Sem lançamentos";
  }
}

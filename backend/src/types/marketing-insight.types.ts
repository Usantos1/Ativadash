export type InsightAlert = {
  severity: "critical" | "warning" | "info" | "success";
  code: string;
  title: string;
  message: string;
  /** Presente quando a avaliação foi feita por canal (Meta / Google). */
  channel?: "meta" | "google";
};

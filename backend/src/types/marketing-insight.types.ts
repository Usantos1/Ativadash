export type InsightAlert = {
  severity: "critical" | "warning" | "info" | "success";
  code: string;
  title: string;
  message: string;
};

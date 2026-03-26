import type { InsightAlert } from "../types/marketing-insight.types.js";

export function parseMessageTemplatesJson(json: unknown): Record<string, string> {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (typeof k === "string" && k.length <= 80 && typeof v === "string" && v.length <= 2000) {
      out[k] = v;
    }
  }
  return out;
}

export function alertWhatsappDedupeKey(alert: InsightAlert): string {
  const ch = alert.channel ?? "";
  return `${alert.code}${ch ? `|${ch}` : ""}`;
}

export function parseLastOutboundByCodeJson(json: unknown): Record<string, string> {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (typeof k === "string" && k.length <= 120 && typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Placeholders: {title}, {message}, {period}, {periodLabel}, {channel}, {code}
 */
export function formatWhatsappAlertLine(
  templates: Record<string, string>,
  alert: InsightAlert,
  periodLabel: string
): string {
  const specific =
    templates[alert.code] ??
    (alert.code.startsWith("CUSTOM_RULE:") ? templates["CUSTOM_RULE"] : undefined);
  const tpl = (specific ?? templates["default"] ?? "• *{title}*\n{message}").trim();
  const channel =
    alert.channel === "meta" ? "Meta Ads" : alert.channel === "google" ? "Google Ads" : "";
  return tpl
    .replace(/\{title\}/g, alert.title)
    .replace(/\{message\}/g, alert.message)
    .replace(/\{period\}/g, periodLabel)
    .replace(/\{periodLabel\}/g, periodLabel)
    .replace(/\{channel\}/g, channel)
    .replace(/\{code\}/g, alert.code);
}

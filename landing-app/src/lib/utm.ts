/** Lê parâmetros UTM e contexto da URL atual + referrer (best-effort, sem cookies). */
export type LandingTracking = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  pageUrl: string | null;
};

export function readTracking(): LandingTracking {
  if (typeof window === "undefined") {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      referrer: null,
      pageUrl: null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k)?.trim() || null;
  return {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmTerm: get("utm_term"),
    utmContent: get("utm_content"),
    referrer: document.referrer || null,
    pageUrl: window.location.href || null,
  };
}

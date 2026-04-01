/** Abre a campanha no gestor da rede (utilizador tem de estar autenticado na Meta / Google). */
export function campaignManagerUrl(channel: string, campaignId: string | undefined | null): string | null {
  const id = typeof campaignId === "string" ? campaignId.trim() : "";
  if (!id) return null;
  if (channel === "Google") {
    return `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(id)}`;
  }
  if (channel === "Meta") {
    return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(id)}`;
  }
  return null;
}

/** Espelha o slug gerado no backend (`slugifyOrganizationName`) para pré-visualização na UI. */
export function previewOrganizationSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "empresa";
}

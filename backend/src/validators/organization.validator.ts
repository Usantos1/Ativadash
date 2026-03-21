import { z } from "zod";

export const patchOrganizationSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo"),
});

export const createChildOrganizationSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(120, "Nome muito longo"),
});

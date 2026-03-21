import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  clientAccountId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientAccountId: z.string().optional().nullable(),
});

export const createLaunchSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1, "Nome obrigatório").max(200),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const updateLaunchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(120),
});

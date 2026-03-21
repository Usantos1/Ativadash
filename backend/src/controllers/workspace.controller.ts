import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listLaunches,
  createLaunch,
  updateLaunch,
  deleteLaunch,
  listOrganizationMembers,
} from "../services/workspace.service.js";
import {
  createClientSchema,
  updateClientSchema,
  createProjectSchema,
  updateProjectSchema,
  createLaunchSchema,
  updateLaunchSchema,
} from "../validators/workspace.validator.js";

type AuthRequest = Request & { user: JwtPayload };

function parseDateInput(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Data inválida");
  }
  return d;
}

// —— Clients ——

export async function clientsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const list = await listClients(organizationId);
  return res.json(list);
}

export async function clientsCreate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const row = await createClient(organizationId, parsed.data.name);
  return res.status(201).json(row);
}

export async function clientsUpdate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.name) {
    return res.status(400).json({ message: "Nome é obrigatório" });
  }
  const row = await updateClient(organizationId, id, parsed.data.name);
  if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
  return res.json(row);
}

export async function clientsDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteClient(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Cliente não encontrado" });
  return res.status(204).send();
}

// —— Projects ——

export async function projectsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const clientId = req.query.clientAccountId as string | undefined;
  const list = await listProjects(organizationId, clientId || undefined);
  return res.json(list);
}

export async function projectsCreate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const cid = parsed.data.clientAccountId === "" ? null : parsed.data.clientAccountId ?? null;
  try {
    const row = await createProject(organizationId, parsed.data.name, cid);
    return res.status(201).json(row);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao criar projeto" });
  }
}

export async function projectsUpdate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const body = parsed.data;
  const data: { name?: string; clientAccountId?: string | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.clientAccountId !== undefined) {
    data.clientAccountId = body.clientAccountId === "" ? null : body.clientAccountId;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada para atualizar" });
  }
  try {
    const row = await updateProject(organizationId, id, data);
    if (!row) return res.status(404).json({ message: "Projeto não encontrado" });
    return res.json(row);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao atualizar" });
  }
}

export async function projectsDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteProject(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Projeto não encontrado" });
  return res.status(204).send();
}

// —— Launches ——

export async function launchesList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const projectId = req.query.projectId as string | undefined;
  const list = await listLaunches(organizationId, projectId);
  return res.json(list);
}

export async function launchesCreate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = createLaunchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  try {
    startDate = parseDateInput(parsed.data.startDate) ?? null;
    endDate = parseDateInput(parsed.data.endDate) ?? null;
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Data inválida" });
  }
  try {
    const row = await createLaunch(
      organizationId,
      parsed.data.projectId,
      parsed.data.name,
      startDate,
      endDate
    );
    return res.status(201).json(row);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao criar lançamento" });
  }
}

export async function launchesUpdate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateLaunchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const body = parsed.data;
  const data: { name?: string; startDate?: Date | null; endDate?: Date | null } = {};
  if (body.name !== undefined) data.name = body.name;
  try {
    if (body.startDate !== undefined) data.startDate = parseDateInput(body.startDate) ?? null;
    if (body.endDate !== undefined) data.endDate = parseDateInput(body.endDate) ?? null;
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Data inválida" });
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada para atualizar" });
  }
  const row = await updateLaunch(organizationId, id, data);
  if (!row) return res.status(404).json({ message: "Lançamento não encontrado" });
  return res.json(row);
}

export async function launchesDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteLaunch(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Lançamento não encontrado" });
  return res.status(204).send();
}

// —— Members ——

export async function membersList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const list = await listOrganizationMembers(organizationId);
  return res.json(list);
}

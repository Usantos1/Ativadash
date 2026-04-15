import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { userCanReadMarketing } from "../services/marketing-permissions.service.js";
import {
  buildShareSnapshot,
  createDashboardShareLink,
  getShareLinkByToken,
  isShareExpired,
  normalizeSections,
  type DashboardShareSections,
} from "../services/dashboard-share.service.js";
import { expirationToDate, postDashboardShareBodySchema } from "../validators/dashboard-share.validator.js";
import { appendAuditLog } from "../services/audit-log.service.js";

async function guardRead(userId: string, organizationId: string, res: Response): Promise<boolean> {
  const ok = await userCanReadMarketing(userId, organizationId);
  if (!ok) {
    res.status(403).json({ code: "FORBIDDEN_SCOPE", message: "Sem acesso aos dados de marketing desta empresa." });
    return false;
  }
  return true;
}

type Authed = Request & { user: JwtPayload };

export async function postDashboardShareHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as Authed).user;
  if (!(await guardRead(userId, organizationId, res))) return;

  const parsed = postDashboardShareBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Payload inválido.", issues: parsed.error.flatten() });
  }

  const { page, sections: secIn, startDate, endDate, periodLabel, expiration } = parsed.data;
  if (startDate > endDate) {
    return res.status(400).json({ message: "A data inicial não pode ser maior que a final." });
  }

  const sections: DashboardShareSections = normalizeSections(secIn ?? {});

  try {
    const expiresAt = expirationToDate(expiration);
    const { token } = await createDashboardShareLink({
      organizationId,
      createdByUserId: userId,
      page,
      sections,
      startDate,
      endDate,
      periodLabel,
      expiresAt,
    });
    await appendAuditLog({ actorUserId: userId, organizationId, action: "dashboard.share_created", entityType: "DashboardShareLink", metadata: { page, expiration } });
    return res.status(201).json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Não foi possível criar o link de compartilhamento." });
  }
}

export async function getPublicDashboardShareMetaHandler(req: Request, res: Response) {
  const token = String(req.params.token ?? "").trim();
  const row = await getShareLinkByToken(token);
  if (!row) {
    return res.status(404).json({ message: "Link inválido ou revogado." });
  }
  const expired = isShareExpired(row.expiresAt);
  const sections = normalizeSections(row.sectionsJson);
  return res.json({
    organizationName: row.organization.name,
    page: row.page,
    periodLabel: row.periodLabel,
    startDate: row.startDate,
    endDate: row.endDate,
    sections,
    expired,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  });
}

export async function getPublicDashboardShareSnapshotHandler(req: Request, res: Response) {
  const token = String(req.params.token ?? "").trim();
  const row = await getShareLinkByToken(token);
  if (!row) {
    return res.status(404).json({ message: "Link inválido ou revogado." });
  }
  if (isShareExpired(row.expiresAt)) {
    return res.status(410).json({ message: "Este link expirou." });
  }

  try {
    const snapshot = await buildShareSnapshot(row.organizationId, {
      startDate: row.startDate,
      endDate: row.endDate,
    });
    const sections = normalizeSections(row.sectionsJson);
    return res.json({
      page: row.page,
      periodLabel: row.periodLabel,
      startDate: row.startDate,
      endDate: row.endDate,
      sections,
      organizationName: row.organization.name,
      ...snapshot,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Não foi possível carregar o snapshot." });
  }
}

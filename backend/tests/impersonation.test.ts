import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orgFindFirst: vi.fn(),
  sessionCreate: vi.fn(),
  sessionFindFirst: vi.fn(),
  sessionUpdate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    organization: { findFirst: mocks.orgFindFirst },
    impersonationSession: {
      create: mocks.sessionCreate,
      findFirst: mocks.sessionFindFirst,
      update: mocks.sessionUpdate,
    },
    auditLog: { create: mocks.auditLogCreate },
  },
}));

vi.mock("../src/utils/platform-admin.js", () => ({
  isPlatformAdminEmail: (email: string) => email === "admin@plataforma.com",
}));

vi.mock("../src/services/audit-log.service.js", () => ({
  appendAuditLog: vi.fn(),
}));

vi.mock("../src/services/tenancy-access.service.js", () => ({
  isOrganizationUnderAncestor: vi.fn().mockResolvedValue(true),
}));

import {
  startImpersonation,
  stopImpersonation,
  getImpersonationStatus,
} from "../src/services/impersonation.service.js";
import { isOrganizationUnderAncestor } from "../src/services/tenancy-access.service.js";

describe("impersonation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startImpersonation", () => {
    it("bloqueia impersonação quando já tem sessão ativa", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce({ id: "sess-1", isActive: true });

      await expect(
        startImpersonation({
          actorUserId: "user-1",
          actorEmail: "user@test.com",
          sourceOrganizationId: "org-matrix",
          targetOrganizationId: "org-client",
        })
      ).rejects.toThrow("Já existe uma impersonação ativa");
    });

    it("bloqueia impersonação na própria organização", async () => {
      await expect(
        startImpersonation({
          actorUserId: "user-1",
          actorEmail: "user@test.com",
          sourceOrganizationId: "org-1",
          targetOrganizationId: "org-1",
        })
      ).rejects.toThrow("Não é possível impersonar a própria organização");
    });

    it("bloqueia quando a org alvo não existe", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce(null);
      mocks.orgFindFirst.mockResolvedValueOnce(null);

      await expect(
        startImpersonation({
          actorUserId: "user-1",
          actorEmail: "user@test.com",
          sourceOrganizationId: "org-matrix",
          targetOrganizationId: "org-missing",
        })
      ).rejects.toThrow("Organização alvo não encontrada");
    });

    it("bloqueia quando user não é admin da org de origem", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce(null);
      mocks.orgFindFirst
        .mockResolvedValueOnce({ id: "org-client", name: "Client", slug: "client", workspaceStatus: "ACTIVE" })
        .mockResolvedValueOnce({ organizationKind: "MATRIX", resellerPartner: true });
      mocks.membershipFindUnique.mockResolvedValueOnce({ role: "member" });

      await expect(
        startImpersonation({
          actorUserId: "user-1",
          actorEmail: "user@test.com",
          sourceOrganizationId: "org-matrix",
          targetOrganizationId: "org-client",
        })
      ).rejects.toThrow("Sem permissão");
    });

    it("permite impersonação por platform admin mesmo sem membership", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce(null);
      mocks.orgFindFirst.mockResolvedValueOnce({
        id: "org-client",
        name: "Client",
        slug: "client",
        workspaceStatus: "ACTIVE",
      });
      mocks.sessionCreate.mockResolvedValueOnce({
        id: "sess-new",
        actorUserId: "user-admin",
        sourceOrganizationId: "org-matrix",
        targetOrganizationId: "org-client",
        assumedRole: "admin",
        startedAt: new Date(),
      });

      const result = await startImpersonation({
        actorUserId: "user-admin",
        actorEmail: "admin@plataforma.com",
        sourceOrganizationId: "org-matrix",
        targetOrganizationId: "org-client",
      });

      expect(result.session.id).toBe("sess-new");
      expect(result.targetOrganization.name).toBe("Client");
      expect(mocks.sessionCreate).toHaveBeenCalledOnce();
    });

    it("permite impersonação por agency_owner com descendente válido", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce(null);
      mocks.orgFindFirst
        .mockResolvedValueOnce({ id: "org-client", name: "Client", slug: "client", workspaceStatus: "ACTIVE" })
        .mockResolvedValueOnce({ organizationKind: "MATRIX", resellerPartner: true });
      mocks.membershipFindUnique.mockResolvedValueOnce({ role: "agency_owner" });
      vi.mocked(isOrganizationUnderAncestor).mockResolvedValueOnce(true);
      mocks.sessionCreate.mockResolvedValueOnce({
        id: "sess-2",
        actorUserId: "user-1",
        sourceOrganizationId: "org-matrix",
        targetOrganizationId: "org-client",
        assumedRole: "admin",
        startedAt: new Date(),
      });

      const result = await startImpersonation({
        actorUserId: "user-1",
        actorEmail: "user@agency.com",
        sourceOrganizationId: "org-matrix",
        targetOrganizationId: "org-client",
      });

      expect(result.session.id).toBe("sess-2");
    });

    it("bloqueia quando target não é descendente", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce(null);
      mocks.orgFindFirst
        .mockResolvedValueOnce({ id: "org-other", name: "Other", slug: "other", workspaceStatus: "ACTIVE" })
        .mockResolvedValueOnce({ organizationKind: "MATRIX", resellerPartner: true });
      mocks.membershipFindUnique.mockResolvedValueOnce({ role: "agency_owner" });
      vi.mocked(isOrganizationUnderAncestor).mockResolvedValueOnce(false);

      await expect(
        startImpersonation({
          actorUserId: "user-1",
          actorEmail: "user@agency.com",
          sourceOrganizationId: "org-matrix",
          targetOrganizationId: "org-other",
        })
      ).rejects.toThrow("não pertence à sua hierarquia");
    });
  });

  describe("stopImpersonation", () => {
    it("encerra sessão ativa corretamente", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce({
        id: "sess-1",
        actorUserId: "user-1",
        sourceOrganizationId: "org-matrix",
        targetOrganizationId: "org-client",
        startedAt: new Date(Date.now() - 60_000),
        isActive: true,
      });
      mocks.sessionUpdate.mockResolvedValueOnce({});

      const result = await stopImpersonation({
        actorUserId: "user-1",
        impersonationSessionId: "sess-1",
      });

      expect(result.sourceOrganizationId).toBe("org-matrix");
      expect(mocks.sessionUpdate).toHaveBeenCalledWith({
        where: { id: "sess-1" },
        data: { isActive: false, endedAt: expect.any(Date) },
      });
    });

    it("falha quando não tem sessão ativa", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce(null);

      await expect(
        stopImpersonation({
          actorUserId: "user-1",
          impersonationSessionId: "sess-missing",
        })
      ).rejects.toThrow("Nenhuma sessão de impersonação ativa");
    });
  });

  describe("getImpersonationStatus", () => {
    it("retorna isImpersonating: false quando sem sessionId", async () => {
      const status = await getImpersonationStatus("user-1");
      expect(status.isImpersonating).toBe(false);
    });

    it("retorna dados completos para sessão ativa", async () => {
      mocks.sessionFindFirst.mockResolvedValueOnce({
        id: "sess-1",
        actorUserId: "user-1",
        sourceOrganizationId: "org-matrix",
        sourceOrganization: { id: "org-matrix", name: "Matriz" },
        targetOrganizationId: "org-client",
        targetOrganization: { id: "org-client", name: "Client" },
        assumedRole: "admin",
        startedAt: new Date(),
        isActive: true,
      });

      const status = await getImpersonationStatus("user-1", "sess-1");

      expect(status.isImpersonating).toBe(true);
      expect(status.sourceOrganizationName).toBe("Matriz");
      expect(status.targetOrganizationName).toBe("Client");
      expect(status.assumedRole).toBe("admin");
    });
  });
});

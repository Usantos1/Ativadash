import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: {
    membership: { findUnique: mocks.findUnique },
    organization: { findFirst: vi.fn() },
    matrixWorkspaceGrant: { count: vi.fn(), findFirst: vi.fn() },
  },
}));

import { isOrganizationUnderAncestor } from "../src/services/tenancy-access.service.js";
import { userHasEffectiveAccess } from "../src/services/tenancy-access.service.js";
import { prisma } from "../src/utils/prisma.js";

describe("tenancy-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("userHasEffectiveAccess: membership direta concede acesso", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce({
      workspaceStatus: "ACTIVE",
    } as never);
    mocks.findUnique.mockResolvedValueOnce({
      organization: { deletedAt: null },
    });
    await expect(userHasEffectiveAccess("u1", "org-ws")).resolves.toBe(true);
  });

  it("userHasEffectiveAccess: workspace ARCHIVED nega acesso", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce({
      workspaceStatus: "ARCHIVED",
    } as never);
    await expect(userHasEffectiveAccess("u1", "org-ws")).resolves.toBe(false);
  });

  it("isOrganizationUnderAncestor confirma descendência", async () => {
    vi.mocked(prisma.organization.findFirst)
      .mockResolvedValueOnce({ parentOrganizationId: "matrix-1" } as never)
      .mockResolvedValueOnce({ parentOrganizationId: null } as never);
    await expect(isOrganizationUnderAncestor("matrix-1", "child")).resolves.toBe(true);
  });
});

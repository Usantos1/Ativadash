import { describe, expect, it } from "vitest";
import {
  demoteOwnerRoleForMove,
  isAgencyOpsStyleRole,
  isMatrixWideAdminRole,
  isResellerMatrixAdminRole,
} from "../src/constants/roles.js";

describe("roles", () => {
  it("matrix admin inclui legado owner/admin", () => {
    expect(isMatrixWideAdminRole("agency_owner")).toBe(true);
    expect(isMatrixWideAdminRole("owner")).toBe(true);
    expect(isResellerMatrixAdminRole("admin")).toBe(true);
  });

  it("agency_ops exige grants para workspaces", () => {
    expect(isAgencyOpsStyleRole("agency_ops")).toBe(true);
    expect(isAgencyOpsStyleRole("agency_owner")).toBe(false);
  });

  it("demoteOwnerRoleForMove não replica proprietário no destino", () => {
    expect(demoteOwnerRoleForMove("workspace_owner")).toBe("workspace_admin");
    expect(demoteOwnerRoleForMove("agency_owner")).toBe("agency_admin");
    expect(demoteOwnerRoleForMove("performance_analyst")).toBe("performance_analyst");
  });
});

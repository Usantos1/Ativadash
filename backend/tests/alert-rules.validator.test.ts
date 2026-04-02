import { describe, expect, it } from "vitest";
import {
  createAlertRuleSchema,
  patchAlertRuleSchema,
} from "../src/validators/alert-rules.validator.js";

describe("alert-rules.validator", () => {
  it("createAlertRuleSchema aceita ACTIVATE_ASSET e campos do motor", () => {
    const parsed = createAlertRuleSchema.safeParse({
      name: "Reativar",
      metric: "roas",
      operator: "lt",
      threshold: 0,
      thresholdRef: "VAR_CHANNEL_TARGET_ROAS",
      severity: "warning",
      active: true,
      appliesToChannel: "google",
      notifyWhatsapp: true,
      actionType: "ACTIVATE_ASSET",
      evaluationLevel: "campaign",
      checkFrequency: "3h",
      actionWindowStartLocal: "08:00",
      actionWindowEndLocal: "20:00",
      evaluationTimezone: "America/Sao_Paulo",
      muteStartHour: 2,
      muteEndHour: 6,
      actionValue: 15,
      cooldownMinutes: 720,
      checkFrequencyMinutes: 45,
      messageTemplate: "{{rule_name}}",
      routing: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.actionType).toBe("ACTIVATE_ASSET");
      expect(parsed.data.muteStartHour).toBe(2);
      expect(parsed.data.checkFrequencyMinutes).toBe(45);
    }
  });

  it("alertRuleActionTypeSchema normaliza ações legadas", () => {
    const parsed = createAlertRuleSchema.safeParse({
      name: "Legado",
      metric: "cpa",
      operator: "gt",
      threshold: 10,
      severity: "critical",
      actionType: "pause_campaign",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.actionType).toBe("PAUSE_ASSET");
  });

  it("patchAlertRuleSchema aceita atualização parcial (ex.: só active)", () => {
    const parsed = patchAlertRuleSchema.safeParse({ active: false });
    expect(parsed.success).toBe(true);
  });

  it("patchAlertRuleSchema rejeita actionType inválido", () => {
    const parsed = patchAlertRuleSchema.safeParse({ actionType: "INVALID" });
    expect(parsed.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "../src/services/webhooks.service.js";

describe("webhooks signature", () => {
  it("aceita HMAC sha256=hex no header", () => {
    const secret = "whsec_test";
    const body = Buffer.from('{"a":1}', "utf8");
    const hex = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(secret, body, `sha256=${hex}`)).toBe(true);
    expect(verifyWebhookSignature(secret, body, hex)).toBe(true);
  });

  it("rejeita assinatura errada", () => {
    const body = Buffer.from("x", "utf8");
    expect(verifyWebhookSignature("s", body, "sha256=deadbeef")).toBe(false);
  });
});

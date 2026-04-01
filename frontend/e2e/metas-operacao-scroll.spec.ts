import { test, expect } from "@playwright/test";

test.describe("/ads/metas-operacao", () => {
  test("aba Meta Ads: após rolar, painel do canal permanece visível", async ({ page }, testInfo) => {
    await page.goto("/ads/metas-operacao");
    if (page.url().includes("/login")) {
      testInfo.skip(true, "Requer sessão autenticada (storageState / login).");
    }
    await page.getByRole("tab", { name: "Meta Ads" }).click();
    await expect(page.getByRole("tab", { name: "Meta Ads" })).toHaveAttribute("data-state", "active");
    await expect(page.getByText("Metas do canal")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await expect(page.getByText("Metas do canal").first()).toBeVisible();
  });
});

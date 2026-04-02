import cron from "node-cron";
import { env } from "../config/env.js";

/**
 * Serviço de agendamento do “cérebro autónomo”: avalia `AlertRule` ativas e executa ações Meta/Google.
 * Usa expressão cron em UTC (padrão a cada 30 minutos). Ative com `AUTOMATION_WORKER_ENABLED=true`.
 */
export class AutomationWorkerService {
  private job: cron.ScheduledTask | null = null;

  start(): void {
    if (!env.AUTOMATION_WORKER_ENABLED) {
      return;
    }
    const expression = env.AUTOMATION_WORKER_CRON;
    console.info(`[AutomationWorkerService] cron UTC: "${expression}"`);
    void this.runTickOnce();
    this.job = cron.schedule(expression, () => void this.runTickOnce(), { timezone: "UTC" });
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  private async runTickOnce(): Promise<void> {
    try {
      const { runAutomationExecutionTick } = await import("./automation-execution-engine.service.js");
      const r = await runAutomationExecutionTick();
      console.info(
        `[AutomationWorkerService] tick orgs=${r.organizationsScanned} actions=${r.actionsExecuted} ${r.durationMs}ms`
      );
    } catch (e) {
      console.error("[AutomationWorkerService] erro no tick:", e);
    }
  }
}

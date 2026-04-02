import { env } from "../config/env.js";
import { AutomationWorkerService } from "./automation-worker.service.js";

let instance: AutomationWorkerService | null = null;

/**
 * Inicia o agendamento do motor de automação (`AutomationWorkerService`).
 * Requer `AUTOMATION_WORKER_ENABLED=true` e migrações Prisma aplicadas.
 */
export function startAutomationWorker(): void {
  if (!env.AUTOMATION_WORKER_ENABLED) {
    return;
  }
  instance = new AutomationWorkerService();
  instance.start();
}

export function stopAutomationWorkerForTests(): void {
  instance?.stop();
  instance = null;
}

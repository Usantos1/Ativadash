import { env } from "../config/env.js";

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runTickSafe(): Promise<void> {
  try {
    const { runAutomationExecutionTick } = await import("./automation-execution-engine.service.js");
    const r = await runAutomationExecutionTick();
    console.info(
      `[automation-worker] tick — orgs=${r.organizationsScanned} actions=${r.actionsExecuted} ${r.durationMs}ms`
    );
  } catch (e) {
    console.error("[automation-worker] erro no tick:", e);
  }
}

/**
 * Agenda execução periódica do motor de automação (pausa / orçamento Meta & Google).
 * Ative com `AUTOMATION_WORKER_ENABLED=true` no ambiente.
 */
export function startAutomationWorker(): void {
  if (!env.AUTOMATION_WORKER_ENABLED) {
    return;
  }
  const ms = env.AUTOMATION_WORKER_INTERVAL_MS;
  console.info(`[automation-worker] ativo — intervalo ${Math.round(ms / 1000 / 60)} min`);
  void runTickSafe();
  intervalHandle = setInterval(() => void runTickSafe(), ms);
}

export function stopAutomationWorkerForTests(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

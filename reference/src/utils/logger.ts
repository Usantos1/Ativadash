/**
 * Sistema de logging profissional
 * Substitui console.log/error/warn por um sistema centralizado
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  context?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private isDevelopment = import.meta.env.DEV;

  private formatMessage(level: LogLevel, message: string, data?: any, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}`;
  }

  private addLog(level: LogLevel, message: string, data?: any, context?: string) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      context,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Em desenvolvimento, sempre loga no console
    if (this.isDevelopment) {
      const formatted = this.formatMessage(level, message, data, context);
      switch (level) {
        case 'debug':
          console.debug(formatted, data || '');
          break;
        case 'info':
          console.info(formatted, data || '');
          break;
        case 'warn':
          console.warn(formatted, data || '');
          break;
        case 'error':
          console.error(formatted, data || '');
          break;
      }
    }

    // Em produção, apenas erros são logados
    if (!this.isDevelopment && level === 'error') {
      // Aqui você pode enviar para um serviço de monitoramento (Sentry, LogRocket, etc.)
      this.sendToMonitoring(entry);
    }
  }

  private sendToMonitoring(entry: LogEntry) {
    // TODO: Integrar com serviço de monitoramento
    // Exemplo: Sentry.captureException(new Error(entry.message), { extra: entry.data });
  }

  debug(message: string, data?: any, context?: string) {
    this.addLog('debug', message, data, context);
  }

  info(message: string, data?: any, context?: string) {
    this.addLog('info', message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.addLog('warn', message, data, context);
  }

  error(message: string, error?: any, context?: string) {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack, ...error }
      : error;
    this.addLog('error', message, errorData, context);
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();

// Exportar funções de conveniência
export const log = {
  debug: (message: string, data?: any, context?: string) => logger.debug(message, data, context),
  info: (message: string, data?: any, context?: string) => logger.info(message, data, context),
  warn: (message: string, data?: any, context?: string) => logger.warn(message, data, context),
  error: (message: string, error?: any, context?: string) => logger.error(message, error, context),
};










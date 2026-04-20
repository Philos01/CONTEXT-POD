export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  duration?: number;
}

interface LoggerConfig {
  enabled: boolean;
  consoleOutput: boolean;
  storageEnabled: boolean;
  maxStorageEntries: number;
  minLevel: LogLevel;
}

const LOG_KEY = 'context-pod-logs';
const CONFIG_KEY = 'context-pod-log-config';

const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  consoleOutput: true,
  storageEnabled: true,
  maxStorageEntries: 500,
  minLevel: 'DEBUG',
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: '#9ca3af',
  INFO: '#3b82f6',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  DEBUG: '🔍',
  INFO: 'ℹ️',
  WARNING: '⚠️',
  ERROR: '❌',
};

let config: LoggerConfig = { ...DEFAULT_CONFIG };
let logs: LogEntry[] = [];

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    const savedLogs = localStorage.getItem(LOG_KEY);
    if (savedLogs) logs = JSON.parse(savedLogs);
  } catch {
    // use defaults
  }
}

function saveConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function saveLogs() {
  if (config.storageEnabled && logs.length > 0) {
    const toSave = logs.slice(-config.maxStorageEntries);
    localStorage.setItem(LOG_KEY, JSON.stringify(toSave));
  }
}

loadConfig();

export function configureLogger(overrides: Partial<LoggerConfig>) {
  config = { ...config, ...overrides };
  saveConfig();
}

export function getLogger(module: string) {
  return {
    debug(message: string, data?: any) {
      log('DEBUG', module, message, data);
    },
    info(message: string, data?: any) {
      log('INFO', module, message, data);
    },
    warning(message: string, data?: any) {
      log('WARNING', module, message, data);
    },
    error(message: string, data?: any) {
      log('ERROR', module, message, data);
    },
    time<T>(message: string, fn: () => T): T {
      const start = performance.now();
      log('DEBUG', module, `⏱️ START: ${message}`);
      try {
        const result = fn();
        const duration = performance.now() - start;
        log('DEBUG', module, `✅ END: ${message} (${duration.toFixed(2)}ms)`, undefined, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        log('ERROR', module, `❌ FAIL: ${message} (${duration.toFixed(2)}ms)`, error, duration);
        throw error;
      }
    },
    async timeAsync<T>(message: string, fn: () => Promise<T>): Promise<T> {
      const start = performance.now();
      log('DEBUG', module, `⏱️ START (async): ${message}`);
      try {
        const result = await fn();
        const duration = performance.now() - start;
        log('DEBUG', module, `✅ END (async): ${message} (${duration.toFixed(2)}ms)`, undefined, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        log('ERROR', module, `❌ FAIL (async): ${message} (${duration.toFixed(2)}ms)`, error, duration);
        throw error;
      }
    },
  };
}

function log(level: LogLevel, module: string, message: string, data?: any, duration?: number) {
  if (!config.enabled || LEVEL_PRIORITY[level] < LEVEL_PRIORITY[config.minLevel]) return;

  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    level,
    module,
    message,
    data: data !== undefined ? JSON.stringify(data).substring(0, 500) : undefined,
    duration,
  };

  logs.push(entry);

  if (config.consoleOutput) {
    const prefix = `[Context-Pod] [${level.padEnd(7)}]`;
    const color = LEVEL_COLORS[level];
    const icon = LEVEL_ICONS[level];
    
    if (data !== undefined) {
      console.log(`%c${prefix}%c${icon} %c[${module}]%c${message}`, 
        `color:${color};font-weight:bold`,
        '',
        `color:#6b7280;font-size:11px`,
        '',
        data
      );
    } else {
      console.log(`%c${prefix}%c${icon} %c[%module]%c${message}`,
        `color:${color};font-weight:bold`,
        '',
        `color:#6b7280;font-size:11px`,
        ''
      );
    }
  }

  if (config.storageEnabled && logs.length > config.maxStorageEntries * 1.5) {
    saveLogs();
  }
}

export function getLogs(options?: {
  level?: LogLevel;
  module?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): LogEntry[] {
  let filtered = [...logs];

  if (options?.level) {
    filtered = filtered.filter(l => l.level === options.level);
  }

  if (options?.module) {
    const searchLower = options.module.toLowerCase();
    filtered = filtered.filter(l => l.module.toLowerCase().includes(searchLower));
  }

  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(l => 
      l.message.toLowerCase().includes(searchLower) ||
      (l.data && l.data.toLowerCase().includes(searchLower))
    );
  }

  const offset = options?.offset || 0;
  const limit = options?.limit || 100;

  return filtered.slice(offset, offset + limit);
}

export function getLogCount(): number {
  return logs.length;
}

export function getLogStats(): Record<LogLevel, number> & { total: number } {
  const stats: Record<string, number> = {
    DEBUG: 0,
    INFO: 0,
    WARNING: 0,
    ERROR: 0,
    total: logs.length,
  };

  for (const log of logs) {
    stats[log.level]++;
  }

  return stats as any;
}

export function clearLogs() {
  logs = [];
  localStorage.removeItem(LOG_KEY);
}

export function exportLogs(): string {
  const header = `Context-Pod Logs\nExported: ${new Date().toISOString()}\nTotal Entries: ${logs.length}\n${'='.repeat(80)}\n\n`;
  
  let content = '';
  for (const log of logs) {
    const time = new Date(log.timestamp).toISOString();
    content += `[${time}] [${log.level}] [${log.module}] ${log.message}\n`;
    if (log.duration) content += `  Duration: ${log.duration.toFixed(2)}ms\n`;
    if (log.data) content += `  Data: ${log.data}\n`;
    content += '\n';
  }

  return header + content;
}

export default {
  configureLogger,
  getLogger,
  getLogs,
  getLogCount,
  getLogStats,
  clearLogs,
  exportLogs,
};

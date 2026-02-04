/**
 * Simple logger utility for scraper
 * Replaces @shared/logger dependency
 */

export interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export interface ScraperLogger extends Logger {
  performance: (metric: string, value: number) => void;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
}

export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;

  return {
    info: (message: string, ...args: any[]) => {
      console.log(`${prefix} ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`${prefix} ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`${prefix} ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.DEBUG === 'true') {
        console.debug(`${prefix} ${message}`, ...args);
      }
    }
  };
}

export function createScraperLogger(module: string): ScraperLogger {
  const prefix = `[${module}]`;

  return {
    info: (message: string, ...args: any[]) => {
      console.log(`${prefix} ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`${prefix} ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`${prefix} ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.DEBUG === 'true') {
        console.debug(`${prefix} ${message}`, ...args);
      }
    },
    performance: (metric: string, value: number) => {
      if (process.env.DEBUG === 'true') {
        console.log(`${prefix} [PERF] ${metric}: ${value}`);
      }
    }
  };
}

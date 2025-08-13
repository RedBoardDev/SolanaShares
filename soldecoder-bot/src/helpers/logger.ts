import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

type LoggerOptions = {
  level?: LogLevel;
  timestamps?: boolean;
  colorize?: boolean;
  logToFile?: boolean;
  logDir?: string;
};

class Logger {
  private level: LogLevel;
  private timestamps: boolean;
  private colorize: boolean;
  private logToFile: boolean;
  private logDir: string;
  private currentLogFile: string | null = null;
  private currentDate = '';

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.timestamps = options.timestamps ?? true;
    this.colorize = options.colorize ?? true;
    this.logToFile = options.logToFile ?? true;
    this.logDir = options.logDir ?? path.join(process.cwd(), 'logs');

    if (this.logToFile) {
      this.initializeLogDir();
      this.updateLogFile();
    }
  }

  private initializeLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.error(`Created log directory: ${this.logDir}`);
      }
    } catch (err) {
      console.error(`Failed to create log directory: ${err instanceof Error ? err.message : String(err)}`);
      this.logToFile = false;
    }
  }

  private updateLogFile(): void {
    const isoDate = new Date().toISOString().split('T')[0];
    if (this.currentDate !== isoDate) {
      this.currentDate = isoDate;
      this.currentLogFile = path.join(this.logDir, `${isoDate}.log`);
    }
  }

  private formatTimestamp(): string {
    return this.timestamps ? `[${new Date().toISOString()}]` : '';
  }

  private formatMessage(levelLabel: string, message: string, metadata?: Record<string, unknown>): string {
    const ts = this.formatTimestamp();
    const meta = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `${ts} ${levelLabel} ${message}${meta}`;
  }

  private writeToFile(msg: string): void {
    if (!this.logToFile || !this.currentLogFile) return;
    this.updateLogFile();
    try {
      fs.appendFileSync(this.currentLogFile, `${msg}\n`);
    } catch (err) {
      console.error(`Failed to write to log file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      const formatted = this.formatMessage('DEBUG', message, metadata);
      // Terminal
      const out = this.colorize ? chalk.gray(formatted) : formatted;
      try {
        process.stdout.write(`${out}\n`);
      } catch {
        // ignore terminal write errors
      }
      // File
      this.writeToFile(formatted);
    }
  }

  info(
    message: string,
    metadata?: Record<string, unknown>,
    p0?: {
      channelsLoaded: number;
      guildSettingsLoaded: number;
      cacheStats: { channels: number; guilds: number; guildSettings: number };
    },
  ): void {
    if (this.level <= LogLevel.INFO) {
      const formatted = this.formatMessage('INFO', message, metadata);
      const out = this.colorize ? chalk.blue(formatted) : formatted;
      try {
        process.stdout.write(`${out}\n`);
      } catch {
        // ignore terminal write errors
      }
      this.writeToFile(formatted);
    }
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      const formatted = this.formatMessage('WARN', message, metadata);
      const out = this.colorize ? chalk.yellow(formatted) : formatted;
      try {
        process.stderr.write(`${out}\n`);
      } catch {
        // ignore terminal write errors
      }
      this.writeToFile(formatted);
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      const combined = error ? { ...metadata, error: { message: error.message, stack: error.stack } } : metadata;
      const formatted = this.formatMessage('ERROR', message, combined);
      const out = this.colorize ? chalk.red(formatted) : formatted;
      try {
        process.stderr.write(`${out}\n`);
      } catch {
        // ignore terminal write errors
      }
      this.writeToFile(formatted);
    }
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.level <= LogLevel.FATAL) {
      const combined = error ? { ...metadata, error: { message: error.message, stack: error.stack } } : metadata;
      const formatted = this.formatMessage('FATAL', message, combined);
      const out = this.colorize ? chalk.bgRed.white(formatted) : formatted;
      try {
        process.stderr.write(`${out}\n`);
      } catch {
        // ignore terminal write errors
      }
      this.writeToFile(formatted);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  enableFileLogging(enable = true): void {
    this.logToFile = enable;
    if (enable && !this.currentLogFile) {
      this.initializeLogDir();
      this.updateLogFile();
    }
  }

  setLogDirectory(directory: string): void {
    this.logDir = directory;
    this.initializeLogDir();
    this.updateLogFile();
  }
}

export const logger = new Logger({ level: LogLevel.INFO });
export { LogLevel };

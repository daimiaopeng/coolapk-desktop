import { invoke } from '@tauri-apps/api/core';
import { debug as writeDebug, error as writeError, info as writeInfo, warn as writeWarn } from '@tauri-apps/plugin-log';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
let installed = false;
let writing = false;
let verbose = false;

function loggingAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
}

export async function setVerboseDiagnosticLogging(enabled: boolean): Promise<void> {
  await invoke('set_diagnostic_verbose', { enabled });
  verbose = enabled;
}

export async function getVerboseDiagnosticLogging(): Promise<boolean> {
  verbose = await invoke<boolean>('get_diagnostic_verbose');
  return verbose;
}

/** Only short, redacted summaries are persisted. Never serialize arbitrary objects. */
export function redactDiagnosticText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[url]';
      }
    })
    .replace(/"(?:SESSID|cookie|token|access[_-]?token|password|passwd|device[_-]?id|deviceCode|oaid|ck|code)"\s*:\s*"[^"]*"/gi, '"[credential]"')
    .replace(/\b(?:SESSID|cookie|token|access[_-]?token|password|passwd|device[_-]?id|deviceCode|oaid|ck|code)\s*[:=]\s*[^\s;,&]+/gi, '[credential]')
    .replace(/\b(?:Authorization\s*:\s*Bearer|Bearer)\s+[^\s]+/gi, '[credential]')
    .replace(/(?:[?&](?:code|ck|token|access_token|device_id|password)=)[^&#\s]+/gi, '[credential]')
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '[user-dir]')
    .replace(/\/(?:Users|home)\/[^/\s]+/g, '[user-dir]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 2000);
}

function summarize(value: unknown): string {
  if (typeof value === 'string') return redactDiagnosticText(value);
  if (value instanceof Error) return redactDiagnosticText(`${value.name}: ${value.message}`);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '[object]';
}

export function logDiagnostic(level: LogLevel, module: string, event: string, detail?: unknown): void {
  if (!loggingAvailable() || writing || (level === 'debug' && !verbose)) return;
  const message = `[frontend][${redactDiagnosticText(module)}] ${redactDiagnosticText(event)}${detail === undefined ? '' : ` ${summarize(detail)}`}`;
  writing = true;
  try {
    const send = level === 'error' ? writeError : level === 'warn' ? writeWarn : level === 'debug' ? writeDebug : writeInfo;
    void send(message).catch(() => undefined);
  } finally {
    writing = false;
  }
}

/** Initialize logging once. Only named events are persisted; console objects may contain private data. */
export function installDiagnosticLogging(): void {
  if (installed || !loggingAvailable()) return;
  installed = true;
  logDiagnostic('info', 'app', 'startup');
}

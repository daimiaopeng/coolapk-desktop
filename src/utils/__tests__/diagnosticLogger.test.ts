import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  info: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
  debug: vi.fn().mockResolvedValue(undefined),
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-log', () => ({ info: mocks.info, warn: mocks.warn, error: mocks.error, debug: mocks.debug }));

import { logDiagnostic, redactDiagnosticText, setVerboseDiagnosticLogging } from '../diagnosticLogger';

describe('diagnosticLogger', () => {
  beforeEach(() => { (window as any).__TAURI_INTERNALS__ = {}; });
  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
    vi.clearAllMocks();
  });

  it('removes URL parameters, credentials and user directory names', () => {
    const result = redactDiagnosticText('https://account.coolapk.com/callback?ck=secret&code=123 SESSID=abc token:xyz C:\\Users\\alice\\file "cookie":"hidden" Bearer bearer-secret');
    expect(result).not.toContain('secret');
    expect(result).not.toContain('123');
    expect(result).not.toContain('abc');
    expect(result).not.toContain('xyz');
    expect(result).not.toContain('alice');
    expect(result).not.toContain('hidden');
    expect(result).not.toContain('bearer-secret');
    expect(result).toContain('https://account.coolapk.com/callback');
  });

  it('never serializes arbitrary objects', () => {
    logDiagnostic('error', 'login', 'failed', { cookie: 'private-value' });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('[object]'));
    expect(mocks.error.mock.calls[0][0]).not.toContain('private-value');
  });

  it('only writes debug events when verbose mode is enabled', async () => {
    logDiagnostic('debug', 'api', 'request_ok');
    expect(mocks.debug).not.toHaveBeenCalled();
    await setVerboseDiagnosticLogging(true);
    logDiagnostic('debug', 'api', 'request_ok');
    expect(mocks.debug).toHaveBeenCalledOnce();
    await setVerboseDiagnosticLogging(false);
  });
});

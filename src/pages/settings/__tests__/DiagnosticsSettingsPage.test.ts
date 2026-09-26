import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  save: vi.fn(),
  writeTextFile: vi.fn(),
  confirmation: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: () => false }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: mocks.writeTextFile }));
vi.mock('../../../utils/diagnosticLogger', () => ({
  getVerboseDiagnosticLogging: () => Promise.resolve(false),
  setVerboseDiagnosticLogging: vi.fn(),
}));
vi.mock('../../../utils/confirm', () => ({ requestConfirmation: mocks.confirmation }));

import DiagnosticsSettingsPage from '../DiagnosticsSettingsPage.vue';

describe('DiagnosticsSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockImplementation((command: string) => command === 'get_diagnostic_logs'
      ? Promise.resolve({ files: [{ name: 'coolapk-diagnostics.log', size: 8, modifiedAt: 1 }], content: '[INFO] app.ready', directory: '/logs' })
      : Promise.resolve(undefined));
    mocks.save.mockResolvedValue('content://documents/diagnostics');
    mocks.writeTextFile.mockResolvedValue(undefined);
  });

  it('exports the selected system file URI through the filesystem plugin', async () => {
    const wrapper = mount(DiagnosticsSettingsPage);
    await flushPromises();
    const exportButton = wrapper.findAll('button').find((button) => button.text().includes('导出日志'))!;
    await exportButton.trigger('click');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.writeTextFile).toHaveBeenCalledWith('content://documents/diagnostics', '[INFO] app.ready');
  });

  it('only clears local logs after confirmation', async () => {
    mocks.confirmation.mockResolvedValue(false);
    const wrapper = mount(DiagnosticsSettingsPage);
    await flushPromises();
    const clearButton = wrapper.findAll('button').find((button) => button.text().includes('清空日志'))!;
    await clearButton.trigger('click');
    await flushPromises();
    expect(mocks.invoke).not.toHaveBeenCalledWith('clear_diagnostic_logs');
    mocks.confirmation.mockResolvedValue(true);
    await clearButton.trigger('click');
    await flushPromises();
    expect(mocks.invoke).toHaveBeenCalledWith('clear_diagnostic_logs');
  });
});

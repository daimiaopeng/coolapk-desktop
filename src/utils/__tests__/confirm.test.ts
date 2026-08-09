import { beforeEach, describe, expect, it } from 'vitest';
import { confirmationState, requestConfirmation, settleConfirmation } from '../confirm';

describe('application confirmation service', () => {
  beforeEach(() => {
    settleConfirmation(false);
  });

  it('resolves only after the application confirmation host settles it', async () => {
    const pending = requestConfirmation({
      title: '删除动态',
      message: '确定删除吗？',
      confirmText: '删除',
      danger: true
    });

    expect(confirmationState.isOpen).toBe(true);
    expect(confirmationState.title).toBe('删除动态');
    expect(confirmationState.danger).toBe(true);

    settleConfirmation(true);
    await expect(pending).resolves.toBe(true);
    expect(confirmationState.isOpen).toBe(false);
  });

  it('cancels an older pending confirmation when a new one opens', async () => {
    const first = requestConfirmation('第一次操作');
    const second = requestConfirmation('第二次操作');

    await expect(first).resolves.toBe(false);
    expect(confirmationState.message).toBe('第二次操作');

    settleConfirmation(false);
    await expect(second).resolves.toBe(false);
  });
});

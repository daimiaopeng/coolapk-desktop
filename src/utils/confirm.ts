import { reactive } from 'vue';

export interface ConfirmationOptions {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

export const confirmationState = reactive({
  isOpen: false,
  title: '请确认',
  message: '',
  confirmText: '确定',
  danger: false
});

let resolvePending: ((confirmed: boolean) => void) | null = null;

export function requestConfirmation(options: ConfirmationOptions | string): Promise<boolean> {
  if (resolvePending) {
    resolvePending(false);
    resolvePending = null;
  }

  const normalized = typeof options === 'string' ? { message: options } : options;
  confirmationState.title = normalized.title || '请确认';
  confirmationState.message = normalized.message;
  confirmationState.confirmText = normalized.confirmText || '确定';
  confirmationState.danger = Boolean(normalized.danger);
  confirmationState.isOpen = true;

  return new Promise<boolean>((resolve) => {
    resolvePending = resolve;
  });
}

export function settleConfirmation(confirmed: boolean) {
  const resolve = resolvePending;
  resolvePending = null;
  confirmationState.isOpen = false;
  resolve?.(confirmed);
}

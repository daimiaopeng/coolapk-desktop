interface MessageDraft {
  text: string;
  updatedAt: number;
}

const STORAGE_PREFIX = 'coolapk-message-drafts:';

function storageKey(userUid: string | number, conversationKey: string | number): string {
  return `${STORAGE_PREFIX}${String(userUid || 'guest')}:${String(conversationKey)}`;
}

export function loadMessageDraft(userUid: string | number, conversationKey: string | number): string {
  try {
    const raw = localStorage.getItem(storageKey(userUid, conversationKey));
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Partial<MessageDraft>;
    return typeof parsed.text === 'string' ? parsed.text : '';
  } catch {
    return '';
  }
}

export function saveMessageDraft(userUid: string | number, conversationKey: string | number, text: string): void {
  try {
    const key = storageKey(userUid, conversationKey);
    if (!text.trim()) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({ text, updatedAt: Date.now() } satisfies MessageDraft));
  } catch {
    // 草稿保存失败时继续保留当前输入，不影响发送私信。
  }
}

export function clearMessageDraft(userUid: string | number, conversationKey: string | number): void {
  try {
    localStorage.removeItem(storageKey(userUid, conversationKey));
  } catch {
    // 忽略本地存储不可用的情况。
  }
}

import { readTauriStoreValue, updateTauriStoreValue, writeTauriStoreValue } from './tauriStore';

interface MessageDraft {
  text: string;
  updatedAt: number;
}

type MessageDraftMap = Record<string, MessageDraft>;

const STORE_FILE = 'message_drafts.json';
const STORE_KEY = 'drafts';
const LEGACY_STORAGE_PREFIX = 'coolapk-message-drafts:';
const drafts: MessageDraftMap = {};
let readyPromise: Promise<void> | null = null;

function storageKey(userUid: string | number, conversationKey: string | number): string {
  return `${String(userUid || 'guest')}:${String(conversationKey)}`;
}

function loadDraftMap(value: unknown): MessageDraftMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: MessageDraftMap = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && typeof (item as MessageDraft).text === 'string') {
      result[key] = { text: (item as MessageDraft).text, updatedAt: Number((item as MessageDraft).updatedAt) || 0 };
    }
  }
  return result;
}

function migrateLegacyDrafts(): MessageDraftMap {
  const migrated: MessageDraftMap = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(LEGACY_STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<MessageDraft>;
      if (typeof parsed.text === 'string' && parsed.text.trim()) {
        migrated[key.slice(LEGACY_STORAGE_PREFIX.length)] = { text: parsed.text, updatedAt: Number(parsed.updatedAt) || 0 };
      }
    }
  } catch {
    // 浏览器存储不可用时直接跳过历史草稿迁移。
  }
  return migrated;
}

function removeLegacyDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // 忽略旧数据清理失败。
  }
}

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const stored = await readTauriStoreValue<unknown>(STORE_FILE, STORE_KEY);
      if (stored !== undefined) {
        Object.assign(drafts, loadDraftMap(stored));
        return;
      }
      Object.assign(drafts, migrateLegacyDrafts());
      await writeTauriStoreValue(STORE_FILE, STORE_KEY, { ...drafts });
      removeLegacyDrafts();
    })().catch((error) => {
      console.warn('加载私信草稿失败:', error);
    });
  }
  return readyPromise;
}

export async function loadMessageDraft(userUid: string | number, conversationKey: string | number): Promise<string> {
  await ensureReady();
  return drafts[storageKey(userUid, conversationKey)]?.text || '';
}

export async function saveMessageDraft(userUid: string | number, conversationKey: string | number, text: string): Promise<void> {
  await ensureReady();
  const key = storageKey(userUid, conversationKey);
  if (!text.trim()) delete drafts[key];
  else drafts[key] = { text, updatedAt: Date.now() };
  await updateTauriStoreValue(STORE_FILE, STORE_KEY, {}, () => ({ ...drafts }));
}

export async function clearMessageDraft(userUid: string | number, conversationKey: string | number): Promise<void> {
  await saveMessageDraft(userUid, conversationKey, '');
}

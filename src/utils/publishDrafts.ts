import { readTauriStoreValue, updateTauriStoreValue } from './tauriStore';

interface PublishDraft {
  text: string;
  updatedAt: number;
}

type PublishDraftMap = Record<string, PublishDraft>;

const STORE_FILE = 'publish_drafts.json';
const STORE_KEY = 'drafts';
const drafts: PublishDraftMap = {};
let readyPromise: Promise<void> | null = null;

function accountKey(userUid: string | number | null | undefined): string {
  return String(userUid || 'guest');
}

function loadDraftMap(value: unknown): PublishDraftMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: PublishDraftMap = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && typeof (item as PublishDraft).text === 'string') {
      result[key] = { text: (item as PublishDraft).text, updatedAt: Number((item as PublishDraft).updatedAt) || 0 };
    }
  }
  return result;
}

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = readTauriStoreValue<unknown>(STORE_FILE, STORE_KEY).then((value) => {
      Object.assign(drafts, loadDraftMap(value));
    }).catch((error) => {
      console.warn('加载发布动态草稿失败:', error);
    });
  }
  return readyPromise;
}

export async function loadPublishDraft(userUid: string | number | null | undefined): Promise<string> {
  await ensureReady();
  return drafts[accountKey(userUid)]?.text || '';
}

export async function savePublishDraft(userUid: string | number | null | undefined, text: string): Promise<void> {
  await ensureReady();
  const key = accountKey(userUid);
  if (!text.trim()) delete drafts[key];
  else drafts[key] = { text, updatedAt: Date.now() };
  await updateTauriStoreValue(STORE_FILE, STORE_KEY, {}, () => ({ ...drafts }));
}

export async function clearPublishDraft(userUid: string | number | null | undefined): Promise<void> {
  await savePublishDraft(userUid, '');
}

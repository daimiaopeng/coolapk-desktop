import { readTauriStoreValue, updateTauriStoreValue } from './tauriStore';

interface CommentDraft {
  text: string;
  updatedAt: number;
}

type CommentDraftMap = Record<string, CommentDraft>;

const STORE_FILE = 'comment_drafts.json';
const STORE_KEY = 'drafts';
const drafts: CommentDraftMap = {};
let readyPromise: Promise<void> | null = null;

function draftKey(userUid: string | number | null | undefined, feedId: string | number, replyId?: string | number | null): string {
  return `${String(userUid || 'guest')}:${String(feedId)}:${String(replyId || 'root')}`;
}

function loadDraftMap(value: unknown): CommentDraftMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: CommentDraftMap = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && typeof (item as CommentDraft).text === 'string') {
      result[key] = { text: (item as CommentDraft).text, updatedAt: Number((item as CommentDraft).updatedAt) || 0 };
    }
  }
  return result;
}

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = readTauriStoreValue<unknown>(STORE_FILE, STORE_KEY).then((value) => {
      Object.assign(drafts, loadDraftMap(value));
    }).catch((error) => {
      console.warn('加载评论草稿失败:', error);
    });
  }
  return readyPromise;
}

export async function loadCommentDraft(userUid: string | number | null | undefined, feedId: string | number, replyId?: string | number | null): Promise<string> {
  await ensureReady();
  return drafts[draftKey(userUid, feedId, replyId)]?.text || '';
}

export async function saveCommentDraft(userUid: string | number | null | undefined, feedId: string | number, replyId: string | number | null | undefined, text: string): Promise<void> {
  await ensureReady();
  const key = draftKey(userUid, feedId, replyId);
  if (!text.trim()) delete drafts[key];
  else drafts[key] = { text, updatedAt: Date.now() };
  await updateTauriStoreValue(STORE_FILE, STORE_KEY, {}, () => ({ ...drafts }));
}

export async function clearCommentDraft(userUid: string | number | null | undefined, feedId: string | number, replyId?: string | number | null): Promise<void> {
  await saveCommentDraft(userUid, feedId, replyId, '');
}

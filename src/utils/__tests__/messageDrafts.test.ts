import { beforeEach, describe, expect, it } from 'vitest';
import { clearMessageDraft, loadMessageDraft, saveMessageDraft } from '../messageDrafts';

describe('messageDrafts', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearMessageDraft('100', 'session-a');
    await clearMessageDraft('100', 'session-b');
    await clearMessageDraft('200', 'session-a');
  });

  it('按账号和会话隔离保存草稿', async () => {
    await saveMessageDraft('100', 'session-a', '给小明的草稿');
    await saveMessageDraft('100', 'session-b', '给小红的草稿');
    await saveMessageDraft('200', 'session-a', '另一个账号的草稿');
    expect(await loadMessageDraft('100', 'session-a')).toBe('给小明的草稿');
    expect(await loadMessageDraft('100', 'session-b')).toBe('给小红的草稿');
    expect(await loadMessageDraft('200', 'session-a')).toBe('另一个账号的草稿');
  });

  it('空内容会清除草稿', async () => {
    await saveMessageDraft('100', 'session-a', '待清除');
    await saveMessageDraft('100', 'session-a', '   ');
    expect(await loadMessageDraft('100', 'session-a')).toBe('');
    await clearMessageDraft('100', 'session-a');
    expect(await loadMessageDraft('100', 'session-a')).toBe('');
  });
});

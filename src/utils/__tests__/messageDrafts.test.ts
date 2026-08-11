import { beforeEach, describe, expect, it } from 'vitest';
import { clearMessageDraft, loadMessageDraft, saveMessageDraft } from '../messageDrafts';

describe('messageDrafts', () => {
  beforeEach(() => localStorage.clear());

  it('按账号和会话隔离保存草稿', () => {
    saveMessageDraft('100', 'session-a', '给小明的草稿');
    saveMessageDraft('100', 'session-b', '给小红的草稿');
    saveMessageDraft('200', 'session-a', '另一个账号的草稿');
    expect(loadMessageDraft('100', 'session-a')).toBe('给小明的草稿');
    expect(loadMessageDraft('100', 'session-b')).toBe('给小红的草稿');
    expect(loadMessageDraft('200', 'session-a')).toBe('另一个账号的草稿');
  });

  it('空内容会清除草稿', () => {
    saveMessageDraft('100', 'session-a', '待清除');
    saveMessageDraft('100', 'session-a', '   ');
    expect(loadMessageDraft('100', 'session-a')).toBe('');
    clearMessageDraft('100', 'session-a');
    expect(loadMessageDraft('100', 'session-a')).toBe('');
  });
});
